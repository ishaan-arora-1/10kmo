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
    var notificationsEnabled = false

    let auth: AuthService
    let subscriptions: SubscriptionStore
    let notifications = NotificationService()

    private let defaults: UserDefaults
    private var pendingPushToken: String?
    private var repository: SupabaseRepository {
        SupabaseRepository(client: auth.client)
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        auth = AuthService()
        subscriptions = SubscriptionStore()
        onboardingCompleted = defaults.bool(forKey: Keys.onboardingCompleted)

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
            if let signedTransaction = subscriptions.latestSignedTransaction {
                try await repository.verifyPurchase(signedTransaction: signedTransaction)
            }
            if let pendingPushToken {
                try await syncPushToken(pendingPushToken, userID: auth.userID)
            }
        } catch {
            dataError = "Your picks are safe on this phone, but cloud sync will retry later."
        }
    }

    func signOutAndReset() async {
        if let userID = auth.userID, let pendingPushToken {
            try? await repository.removeDeviceToken(pendingPushToken, userID: userID)
        }
        notifications.disableAll()
        pendingPushToken = nil
        await auth.signOut()
        selectedBrandIDs = []
        claims = []
        notificationsEnabled = false
        onboardingCompleted = false
    }

    func markFiled(settlement: Settlement, reference: String?) async {
        let cleanReference = reference?.trimmingCharacters(in: .whitespacesAndNewlines)
        let claim: Claim

        if let index = claims.firstIndex(where: { $0.settlementID == settlement.id }) {
            claims[index].status = .filed
            claims[index].claimReference = cleanReference?.isEmpty == true ? nil : cleanReference
            claims[index].filedAt = .now
            claim = claims[index]
        } else {
            claim = Claim(
                id: UUID(),
                settlementID: settlement.id,
                status: .filed,
                claimReference: cleanReference?.isEmpty == true ? nil : cleanReference,
                filedAt: .now,
                paidAmount: nil,
                paidAt: nil
            )
            claims.append(claim)
        }

        if let userID = auth.userID {
            try? await repository.syncClaim(claim, userID: userID)
        }
    }

    func markPaid(claimID: UUID, amount: Decimal) async {
        guard let index = claims.firstIndex(where: { $0.id == claimID }) else {
            return
        }
        claims[index].status = .paid
        claims[index].paidAmount = amount
        claims[index].paidAt = .now

        if let userID = auth.userID {
            try? await repository.syncClaim(claims[index], userID: userID)
        }
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
                try await notifications.scheduleDeadlineAlerts(for: matchedSettlements)
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
        notificationsEnabled = false
        notifications.disableAll()
        pendingPushToken = nil
        onboardingCompleted = false
        defaults.removeObject(forKey: Keys.selectedBrands)
        defaults.removeObject(forKey: Keys.claims)
        return true
    }

    #if DEBUG
        func resetDemo() {
            selectedBrandIDs = []
            claims = []
            onboardingCompleted = false
            defaults.removeObject(forKey: Keys.selectedBrands)
            defaults.removeObject(forKey: Keys.claims)
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
            notificationsEnabled = remote.notificationsEnabled
            if remote.notificationsEnabled {
                await notifications.resumeRemoteRegistrationIfAuthorized()
            }

            var mergedBySettlement = Dictionary(
                uniqueKeysWithValues: claims.map { ($0.settlementID, $0) }
            )
            for claim in remote.claims {
                mergedBySettlement[claim.settlementID] = claim
            }
            claims = Array(mergedBySettlement.values).sorted {
                ($0.filedAt ?? .distantPast) > ($1.filedAt ?? .distantPast)
            }
        } catch {
            dataError = "Your local progress is available, but cloud data couldn’t be refreshed."
        }
    }

    private func persistClaims() {
        if let data = try? JSONEncoder.rightful.encode(claims) {
            defaults.set(data, forKey: Keys.claims)
        }
    }

    private enum Keys {
        static let selectedBrands = "rightful.selected-brands"
        static let claims = "rightful.claims"
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
