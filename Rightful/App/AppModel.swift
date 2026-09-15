import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    var brands: [Brand] = SampleData.brands
    var settlements: [Settlement] = SampleData.settlements
    var selectedBrandIDs: Set<UUID> = [] {
        didSet { persistSelections() }
    }
    var claims: [Claim] = [] {
        didSet { persistClaims() }
    }
    var onboardingCompleted: Bool {
        didSet {
            defaults.set(onboardingCompleted, forKey: Keys.onboardingCompleted)
        }
    }
    var isLoading = false
    var dataError: String?
    var isUsingSampleData = true
    var selectedTab = 0
    var notificationsEnabled = false {
        didSet {
            defaults.set(notificationsEnabled, forKey: Keys.notificationsEnabled)
        }
    }

    let auth: AuthService
    let subscriptions: SubscriptionStore
    let notifications = NotificationService()

    private let defaults: UserDefaults
    private var pendingPushToken: String?
    private var dirtyClaimIDs: Set<UUID> = []
    private var repository: SupabaseRepository {
        SupabaseRepository(client: auth.client)
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        auth = AuthService()
        subscriptions = SubscriptionStore()
        onboardingCompleted = defaults.bool(forKey: Keys.onboardingCompleted)
        notificationsEnabled = defaults.bool(forKey: Keys.notificationsEnabled)

        if let data = defaults.data(forKey: Keys.selectedBrands),
            let values = try? JSONDecoder().decode([UUID].self, from: data)
        {
            selectedBrandIDs = Set(values)
        }
        if let data = defaults.data(forKey: Keys.claims),
            let values = try? JSONDecoder.rightful.decode([Claim].self, from: data)
        {
            claims = values
        }
        if let data = defaults.data(forKey: Keys.dirtyClaims),
            let values = try? JSONDecoder().decode([UUID].self, from: data)
        {
            dirtyClaimIDs = Set(values)
        }
    }

    var matchSummary: MatchSummary {
        MatchingEngine.matches(
            settlements: settlements,
            selectedBrandIDs: selectedBrandIDs
        )
    }

    var matchedSettlements: [Settlement] {
        matchSummary.settlements.sorted { $0.deadline < $1.deadline }
    }

    var unfiledMatchedSettlements: [Settlement] {
        matchedSettlements.filter {
            guard let status = claim(for: $0)?.status else { return true }
            return status == .needsFiling || status == .rejected
        }
    }

    var potentialMaximum: Decimal {
        matchedSettlements.reduce(0) { $0 + $1.payoutMax }
    }

    var waitingMaximum: Decimal {
        matchedSettlements
            .filter { claim(for: $0)?.status != .paid }
            .reduce(0) { $0 + $1.payoutMax }
    }

    var filedClaims: [Claim] {
        claims.filter { $0.status != .needsFiling }
    }

    var paidTotal: Decimal {
        claims.compactMap(\.paidAmount).reduce(0, +)
    }

    var isPremium: Bool {
        subscriptions.plan.isPremium
    }

    func prepare() async {
        isLoading = true
        dataError = nil
        defer { isLoading = false }

        async let authTask: Void = auth.restoreSession()
        async let subscriptionTask: Void = subscriptions.prepare()

        do {
            let data = try await repository.loadPublicData()
            brands = data.brands
            settlements = data.settlements
            isUsingSampleData = data.settlements.contains(where: \.isSample)
        } catch {
            brands = SampleData.brands
            settlements = SampleData.settlements
            isUsingSampleData = true
            dataError = "Live settlements couldn’t be refreshed. Showing clearly labeled sample data."
        }

        _ = await (authTask, subscriptionTask)
        await syncProfileIfPossible()
    }

    func brand(for settlement: Settlement) -> Brand? {
        brands.first { $0.id == settlement.brandID }
    }

    func settlement(for claim: Claim) -> Settlement? {
        settlements.first { $0.id == claim.settlementID }
    }

    func claim(for settlement: Settlement) -> Claim? {
        claims.first { $0.settlementID == settlement.id }
    }

    func completeOnboarding() {
        onboardingCompleted = true
    }

    func syncProfileIfPossible() async {
        guard auth.userID != nil else { return }
        do {
            await hydrateRemoteDataIfPossible()
            try await repository.syncSelectedBrands(selectedBrandIDs)
            try await syncDirtyClaims()
            if let signedTransaction = subscriptions.latestSignedTransaction {
                try await repository.verifyPurchase(signedTransaction: signedTransaction)
            }
            if let pendingPushToken {
                try await syncPushToken(pendingPushToken, userID: auth.userID)
            }
            await rebuildNotificationSchedules()
        } catch {
            dataError = "Your picks are safe on this phone, but cloud sync will retry later."
        }
    }

    func signOutAndReset() async {
        if let userID = auth.userID, let pendingPushToken {
            try? await repository.removeDeviceToken(pendingPushToken, userID: userID)
        }
        guard await auth.signOut() else {
            dataError = auth.errorMessage
            return
        }
        notifications.disableAll()
        pendingPushToken = nil
        selectedBrandIDs = []
        claims = []
        dirtyClaimIDs = []
        notificationsEnabled = false
        onboardingCompleted = false
        defaults.removeObject(forKey: Keys.dirtyClaims)
        defaults.removeObject(forKey: Keys.notificationsEnabled)
    }

    func markFiled(settlement: Settlement, reference: String?) async {
        let cleanReference = reference?.trimmingCharacters(in: .whitespacesAndNewlines)
        let claim: Claim
        let modifiedAt = Date.now

        if let index = claims.firstIndex(where: { $0.settlementID == settlement.id }) {
            guard claims[index].status != .paid else { return }
            claims[index].status = .filed
            claims[index].claimReference = cleanReference?.isEmpty == true ? nil : cleanReference
            claims[index].filedAt = modifiedAt
            claims[index].modifiedAt = modifiedAt
            claim = claims[index]
        } else {
            claim = Claim(
                id: UUID(),
                settlementID: settlement.id,
                status: .filed,
                claimReference: cleanReference?.isEmpty == true ? nil : cleanReference,
                filedAt: modifiedAt,
                paidAmount: nil,
                paidAt: nil,
                modifiedAt: modifiedAt
            )
            claims.append(claim)
        }

        markClaimDirty(claim.id)
        await syncClaimIfPossible(claim)
        notifications.cancelReminders(for: settlement)
        await rebuildNotificationSchedules()
    }

    func markPaid(claimID: UUID, amount: Decimal) async {
        guard let index = claims.firstIndex(where: { $0.id == claimID }) else {
            return
        }
        claims[index].status = .paid
        claims[index].paidAmount = amount
        claims[index].paidAt = .now
        claims[index].modifiedAt = .now

        markClaimDirty(claimID)
        await syncClaimIfPossible(claims[index])
        if let settlement = settlement(for: claims[index]) {
            notifications.cancelReminders(for: settlement)
        }
        await rebuildNotificationSchedules()
    }

    func remindTomorrow(for settlement: Settlement) async {
        guard await notifications.scheduleFilingReminder(for: settlement) else {
            dataError = "Allow notifications in Settings to receive a filing reminder."
            return
        }
    }

    func enableNotifications() async -> Bool {
        let granted = await notifications.requestPermission()
        notificationsEnabled = granted
        if granted {
            do {
                try await notifications.scheduleDeadlineAlerts(
                    for: unfiledMatchedSettlements
                )
                try await notifications.scheduleWeeklyDigest(
                    waitingAmount: waitingMaximum,
                    claimCount: matchedSettlements.count
                )
            } catch {
                dataError = "Notifications are allowed, but reminders couldn’t be scheduled."
            }
            if let userID = auth.userID {
                try? await repository.setNotificationsEnabled(true, userID: userID)
            }
        }
        return granted
    }

    func disableNotifications() async {
        notificationsEnabled = false
        notifications.disableAll()
        if let userID = auth.userID {
            try? await repository.setNotificationsEnabled(false, userID: userID)
        }
    }

    func registerPushToken(_ token: String) async {
        pendingPushToken = token
        guard let userID = auth.userID else { return }
        try? await syncPushToken(token, userID: userID)
    }

    private func syncPushToken(_ token: String, userID: UUID?) async throws {
        guard let userID else { return }
        #if DEBUG
            let environment = "sandbox"
        #else
            let environment = "production"
        #endif
        try await repository.syncDeviceToken(
            token,
            environment: environment
        )
    }

    func deleteAccountAndLocalData() async -> Bool {
        if auth.isAuthenticated {
            let deleted = await auth.deleteAccount()
            guard deleted else { return false }
        }
        selectedBrandIDs = []
        claims = []
        dirtyClaimIDs = []
        notificationsEnabled = false
        notifications.disableAll()
        pendingPushToken = nil
        onboardingCompleted = false
        defaults.removeObject(forKey: Keys.selectedBrands)
        defaults.removeObject(forKey: Keys.claims)
        defaults.removeObject(forKey: Keys.dirtyClaims)
        defaults.removeObject(forKey: Keys.notificationsEnabled)
        return true
    }

    #if DEBUG
        func resetDemo() {
            selectedBrandIDs = []
            claims = []
            dirtyClaimIDs = []
            notificationsEnabled = false
            onboardingCompleted = false
            defaults.removeObject(forKey: Keys.selectedBrands)
            defaults.removeObject(forKey: Keys.claims)
            defaults.removeObject(forKey: Keys.dirtyClaims)
            defaults.removeObject(forKey: Keys.notificationsEnabled)
            subscriptions.unlockForPreview()
        }
    #endif

    private func persistSelections() {
        if let data = try? JSONEncoder().encode(Array(selectedBrandIDs)) {
            defaults.set(data, forKey: Keys.selectedBrands)
        }
    }

    private func hydrateRemoteDataIfPossible() async {
        guard let userID = auth.userID else { return }
        do {
            let remote = try await repository.loadUserData(userID: userID)
            selectedBrandIDs.formUnion(remote.brandIDs)

            let hasLocalNotificationPreference =
                defaults.object(forKey: Keys.notificationsEnabled) != nil
            if hasLocalNotificationPreference {
                if notificationsEnabled != remote.notificationsEnabled {
                    try await repository.setNotificationsEnabled(
                        notificationsEnabled,
                        userID: userID
                    )
                }
            } else {
                notificationsEnabled = remote.notificationsEnabled
            }

            if notificationsEnabled, await notifications.isAuthorized() {
                await notifications.resumeRemoteRegistrationIfAuthorized()
            } else if notificationsEnabled {
                notificationsEnabled = false
                try? await repository.setNotificationsEnabled(false, userID: userID)
            }

            var settlementsByID = Dictionary(
                uniqueKeysWithValues: settlements.map { ($0.id, $0) }
            )
            for settlement in remote.historicalSettlements {
                settlementsByID[settlement.id] = settlement
            }
            settlements = Array(settlementsByID.values).sorted {
                $0.deadline < $1.deadline
            }

            var mergedBySettlement = Dictionary(
                uniqueKeysWithValues: claims.map { ($0.settlementID, $0) }
            )
            let remoteSettlementIDs = Set(remote.claims.map(\.settlementID))
            for localClaim in claims where !remoteSettlementIDs.contains(localClaim.settlementID) {
                markClaimDirty(localClaim.id)
            }
            for claim in remote.claims {
                guard let localClaim = mergedBySettlement[claim.settlementID] else {
                    mergedBySettlement[claim.settlementID] = claim
                    continue
                }
                if dirtyClaimIDs.contains(localClaim.id) {
                    continue
                }
                if (localClaim.modifiedAt ?? .distantPast)
                    > (claim.modifiedAt ?? .distantPast)
                {
                    markClaimDirty(localClaim.id)
                } else {
                    mergedBySettlement[claim.settlementID] = claim
                }
            }
            claims = Array(mergedBySettlement.values).sorted {
                ($0.filedAt ?? .distantPast) > ($1.filedAt ?? .distantPast)
            }
        } catch {
            dataError = "Your local progress is available, but cloud data couldn’t be refreshed."
        }
    }

    private func syncDirtyClaims() async throws {
        guard let userID = auth.userID else { return }
        for claimID in Array(dirtyClaimIDs) {
            guard let claim = claims.first(where: { $0.id == claimID }) else {
                clearClaimDirty(claimID)
                continue
            }
            try await repository.syncClaim(claim, userID: userID)
            clearClaimDirty(claimID)
        }
    }

    private func syncClaimIfPossible(_ claim: Claim) async {
        guard let userID = auth.userID else { return }
        do {
            try await repository.syncClaim(claim, userID: userID)
            clearClaimDirty(claim.id)
        } catch {
            dataError = "Your claim is saved on this phone and will sync later."
        }
    }

    private func markClaimDirty(_ claimID: UUID) {
        dirtyClaimIDs.insert(claimID)
        persistDirtyClaims()
    }

    private func clearClaimDirty(_ claimID: UUID) {
        dirtyClaimIDs.remove(claimID)
        persistDirtyClaims()
    }

    private func rebuildNotificationSchedules() async {
        guard notificationsEnabled, await notifications.isAuthorized() else {
            return
        }
        do {
            try await notifications.scheduleDeadlineAlerts(
                for: unfiledMatchedSettlements
            )
            try await notifications.scheduleWeeklyDigest(
                waitingAmount: waitingMaximum,
                claimCount: matchedSettlements.count
            )
        } catch {
            dataError = "Your notification schedule couldn’t be refreshed."
        }
    }

    private func persistClaims() {
        if let data = try? JSONEncoder.rightful.encode(claims) {
            defaults.set(data, forKey: Keys.claims)
        }
    }

    private func persistDirtyClaims() {
        if let data = try? JSONEncoder().encode(Array(dirtyClaimIDs)) {
            defaults.set(data, forKey: Keys.dirtyClaims)
        }
    }

    private enum Keys {
        static let selectedBrands = "rightful.selected-brands"
        static let claims = "rightful.claims"
        static let dirtyClaims = "rightful.dirty-claims"
        static let notificationsEnabled = "rightful.notifications-enabled"
        static let onboardingCompleted = "rightful.onboarding-completed"
    }
}

private extension JSONEncoder {
    static var rightful: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var rightful: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
