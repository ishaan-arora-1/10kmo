import AuthenticationServices
import CryptoKit
import Foundation
import Observation
import Security
import Supabase

enum AppConfiguration {
    static var supabaseURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              !value.isEmpty else {
            return nil
        }
        return URL(string: value)
    }

    static var supabaseKey: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_PUBLISHABLE_KEY") as? String,
              !value.isEmpty else {
            return nil
        }
        return value
    }

    static var isLiveBackendConfigured: Bool {
        supabaseURL != nil && supabaseKey != nil
    }
}

@MainActor
@Observable
final class AuthService {
    private(set) var userID: UUID?
    private(set) var isLoading = false
    var errorMessage: String?

    let client: SupabaseClient?
    private(set) var currentNonce: String?

    init() {
        if let url = AppConfiguration.supabaseURL,
           let key = AppConfiguration.supabaseKey {
            client = SupabaseClient(
                supabaseURL: url,
                supabaseKey: key,
                options: .init(auth: .init(flowType: .pkce))
            )
        } else {
            client = nil
        }
    }

    var isAuthenticated: Bool { userID != nil }
    var isSampleMode: Bool { client == nil }

    func restoreSession() async {
        guard let client else { return }
        do {
            userID = try await client.auth.session.user.id
        } catch {
            userID = nil
        }
    }

    func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = NonceGenerator.random()
        currentNonce = nonce
        request.requestedScopes = [.email, .fullName]
        request.nonce = NonceGenerator.sha256(nonce)
    }

    func completeAppleSignIn(_ result: Result<ASAuthorization, any Error>) async -> Bool {
        guard let client else {
            userID = UUID()
            return true
        }

        guard case .success(let authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            errorMessage = "Apple sign-in didn’t finish. Please try again."
            return false
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await client.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: token,
                    nonce: nonce
                )
            )
            userID = session.user.id
            return true
        } catch {
            errorMessage = "We couldn’t sign you in with Apple."
            return false
        }
    }

    func signInWithGoogle() async -> Bool {
        guard let client else {
            userID = UUID()
            return true
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: URL(string: "rightful://auth/callback")
            )
            userID = session.user.id
            return true
        } catch {
            errorMessage = "We couldn’t sign you in with Google."
            return false
        }
    }

    func handleOpenURL(_ url: URL) {
        client?.auth.handle(url)
    }

    func signOut() async {
        guard let client else {
            userID = nil
            return
        }
        do {
            try await client.auth.signOut()
            userID = nil
        } catch {
            errorMessage = "We couldn’t sign you out."
        }
    }

    func deleteAccount() async -> Bool {
        guard let client else {
            userID = nil
            return true
        }

        struct DeleteResponse: Decodable {
            let deleted: Bool
        }

        do {
            let response: DeleteResponse = try await client.functions.invoke("delete-account")
            if response.deleted {
                userID = nil
            }
            return response.deleted
        } catch {
            errorMessage = "We couldn’t delete your account. Please contact support."
            return false
        }
    }
}

struct SupabaseRepository {
    let client: SupabaseClient?

    func loadPublicData() async throws -> (brands: [Brand], settlements: [Settlement]) {
        guard let client else {
            return (SampleData.brands, SampleData.settlements)
        }

        async let brandRows: [BrandRow] = client
            .from("brands")
            .select()
            .order("name")
            .execute()
            .value

        async let settlementRows: [SettlementRow] = client
            .from("settlements")
            .select()
            .eq("status", value: "verified")
            .order("deadline")
            .execute()
            .value

        let (loadedBrands, loadedSettlements) = try await (brandRows, settlementRows)
        return (
            loadedBrands.map(\.domain),
            loadedSettlements.compactMap(\.domain)
        )
    }

    func syncSelectedBrands(_ brandIDs: Set<UUID>) async throws {
        guard let client else { return }
        try await client
            .rpc(
                "replace_profile_brands",
                params: ["p_brand_ids": Array(brandIDs)]
            )
            .execute()
    }

    func syncClaim(_ claim: Claim, userID: UUID) async throws {
        guard let client else { return }
        try await client
            .from("claims")
            .upsert(
                ClaimRow(claim: claim, userID: userID),
                onConflict: "user_id,settlement_id"
            )
            .execute()
    }

    func verifyPurchase(signedTransaction: String) async throws {
        guard let client else { return }

        struct VerificationResponse: Decodable {
            let verified: Bool
        }

        let response: VerificationResponse = try await client.functions.invoke(
            "verify-purchase",
            options: FunctionInvokeOptions(
                body: ["signedTransaction": signedTransaction]
            )
        )
        guard response.verified else {
            throw BackendError.purchaseNotVerified
        }
    }

    func syncDeviceToken(
        _ token: String,
        userID: UUID,
        environment: String
    ) async throws {
        guard let client else { return }
        try await client
            .from("notification_devices")
            .upsert(
                DeviceTokenRow(
                    userID: userID,
                    token: token,
                    environment: environment
                ),
                onConflict: "user_id,apns_token"
            )
            .execute()
    }
}

private enum BackendError: Error {
    case purchaseNotVerified
}

private struct BrandRow: Decodable {
    let id: UUID
    let name: String
    let category: String
    let aliases: [String]
    let monogramColor: String

    enum CodingKeys: String, CodingKey {
        case id, name, category, aliases
        case monogramColor = "monogram_color"
    }

    var domain: Brand {
        Brand(
            id: id,
            name: name,
            category: BrandCategory(rawValue: category) ?? .shopping,
            aliases: aliases,
            monogramColorHex: monogramColor
        )
    }
}

private struct SettlementRow: Decodable {
    let id: UUID
    let title: String
    let company: String
    let brandID: UUID
    let eligibleStateCodes: [String]
    let payoutMin: Decimal
    let payoutMax: Decimal
    let deadline: String
    let proofRequired: Bool
    let qualifiesSummary: String
    let eligibilityDetails: [String]
    let claimURL: URL
    let expectedPayoutDate: String
    let status: SettlementStatus
    let isSample: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, company, deadline, status
        case brandID = "brand_id"
        case eligibleStateCodes = "eligible_state_codes"
        case payoutMin = "payout_min"
        case payoutMax = "payout_max"
        case proofRequired = "proof_required"
        case qualifiesSummary = "qualifies_summary"
        case eligibilityDetails = "eligibility_details"
        case claimURL = "claim_url"
        case expectedPayoutDate = "expected_payout_date"
        case isSample = "is_sample"
    }

    var domain: Settlement? {
        guard let date = DateFormatter.databaseDate.date(from: deadline) else {
            return nil
        }
        return Settlement(
            id: id,
            title: title,
            company: company,
            brandID: brandID,
            eligibleStateCodes: eligibleStateCodes,
            payoutMin: payoutMin,
            payoutMax: payoutMax,
            deadline: date,
            proofRequired: proofRequired,
            qualifiesSummary: qualifiesSummary,
            eligibilityDetails: eligibilityDetails,
            claimURL: claimURL,
            expectedPayoutDate: expectedPayoutDate,
            status: status,
            isSample: isSample
        )
    }
}

private struct ClaimRow: Encodable {
    let id: UUID
    let userID: UUID
    let settlementID: UUID
    let status: String
    let claimReference: String?
    let filedAt: Date?
    let paidAmount: Decimal?
    let paidAt: Date?

    init(claim: Claim, userID: UUID) {
        id = claim.id
        self.userID = userID
        settlementID = claim.settlementID
        status = claim.status.rawValue
        claimReference = claim.claimReference
        filedAt = claim.filedAt
        paidAmount = claim.paidAmount
        paidAt = claim.paidAt
    }

    enum CodingKeys: String, CodingKey {
        case id, status
        case userID = "user_id"
        case settlementID = "settlement_id"
        case claimReference = "claim_ref"
        case filedAt = "filed_at"
        case paidAmount = "paid_amount"
        case paidAt = "paid_at"
    }
}

private struct DeviceTokenRow: Encodable {
    let userID: UUID
    let token: String
    let environment: String

    enum CodingKeys: String, CodingKey {
        case environment
        case userID = "user_id"
        case token = "apns_token"
    }
}

private enum NonceGenerator {
    static func random(length: Int = 32) -> String {
        precondition(length > 0)
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length

        while remaining > 0 {
            var random: UInt8 = 0
            guard SecRandomCopyBytes(kSecRandomDefault, 1, &random) == errSecSuccess else {
                fatalError("Unable to generate a secure nonce.")
            }
            if Int(random) < characters.count {
                result.append(characters[Int(random)])
                remaining -= 1
            }
        }
        return result
    }

    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .compactMap { String(format: "%02x", $0) }
            .joined()
    }
}

private extension DateFormatter {
    static let databaseDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
