import Foundation
import Observation
import StoreKit

@MainActor
@Observable
final class SubscriptionStore {
    private(set) var products: [Product] = []
    private(set) var plan: SubscriptionPlan = .free
    private(set) var isLoading = false
    private(set) var latestSignedTransaction: String?
    var errorMessage: String?

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = observeTransactions()
    }

    deinit {
        updatesTask?.cancel()
    }

    func prepare() async {
        isLoading = true
        defer { isLoading = false }

        do {
            products = try await Product.products(
                for: [AppConstants.yearlyProductID, AppConstants.weeklyProductID]
            ).sorted { first, second in
                first.id == AppConstants.yearlyProductID && second.id != AppConstants.yearlyProductID
            }
            await refreshEntitlements()
        } catch {
            errorMessage = "The App Store couldn’t load subscription options. Please try again."
        }
    }

    func purchase(_ product: Product) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try requireVerified(verification)
                updatePlan(for: transaction.productID)
                latestSignedTransaction = transaction.jwsRepresentation
                await transaction.finish()
                return true
            case .pending:
                errorMessage = "Your purchase is pending approval."
                return false
            case .userCancelled:
                return false
            @unknown default:
                return false
            }
        } catch {
            errorMessage = "We couldn’t complete the purchase. You haven’t been charged."
            return false
        }
    }

    func restore() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await AppStore.sync()
            await refreshEntitlements()
        } catch {
            errorMessage = "We couldn’t restore purchases right now."
        }
    }

    func refreshEntitlements() async {
        var activePlan = SubscriptionPlan.free

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.revocationDate == nil,
                  transaction.expirationDate.map({ $0 > .now }) ?? true else {
                continue
            }

            if transaction.productID == AppConstants.yearlyProductID {
                activePlan = .yearly
                latestSignedTransaction = transaction.jwsRepresentation
                break
            }
            if transaction.productID == AppConstants.weeklyProductID {
                activePlan = .weekly
                latestSignedTransaction = transaction.jwsRepresentation
            }
        }

        plan = activePlan
    }

    func product(for plan: SubscriptionPlan) -> Product? {
        let identifier = plan == .yearly
            ? AppConstants.yearlyProductID
            : AppConstants.weeklyProductID
        return products.first { $0.id == identifier }
    }

    #if DEBUG
    func unlockForPreview() {
        plan = .yearly
    }
    #endif

    private func observeTransactions() -> Task<Void, Never> {
        Task { [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled, case .verified(let transaction) = result else {
                    continue
                }
                await self?.refreshEntitlements()
                await transaction.finish()
            }
        }
    }

    private func updatePlan(for productID: String) {
        if productID == AppConstants.yearlyProductID {
            plan = .yearly
        } else if productID == AppConstants.weeklyProductID {
            plan = .weekly
        }
    }

    private func requireVerified<T>(
        _ result: VerificationResult<T>
    ) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw SubscriptionError.failedVerification
        }
    }
}

enum SubscriptionError: Error {
    case failedVerification
}
