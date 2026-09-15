import Foundation
import SwiftUI

enum AppConstants {
    static let name = "Rightful"
    static let yearlyProductID = "com.rightful.app.yearly"
    static let weeklyProductID = "com.rightful.app.weekly"
    static let supportEmail = "support@rightful.app"
}

enum BrandCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case all = "All"
    case social = "Social"
    case phone = "Phone"
    case shopping = "Shopping"
    case delivery = "Delivery"
    case food = "Food"
    case entertainment = "Entertainment"
    case finance = "Finance"
    case tech = "Tech"
    case travel = "Travel"
    case health = "Health"
    case auto = "Auto"

    var id: String { rawValue }
}

struct Brand: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let name: String
    let category: BrandCategory
    let aliases: [String]
    let monogramColorHex: String

    var initial: String { String(name.prefix(1)).uppercased() }

    func matches(searchText: String) -> Bool {
        guard !searchText.isEmpty else { return true }
        let query = searchText.localizedLowercase
        return name.localizedLowercase.contains(query)
            || aliases.contains { $0.localizedLowercase.contains(query) }
    }
}

enum SettlementStatus: String, Codable, Sendable {
    case draft
    case verified
    case closed
}

struct Settlement: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let title: String
    let company: String
    let brandID: UUID
    let eligibleStateCodes: [String]
    let payoutMin: Decimal
    let payoutMax: Decimal
    let deadline: Date
    let proofRequired: Bool
    let qualifiesSummary: String
    let eligibilityDetails: [String]
    let claimURL: URL
    let expectedPayoutDate: String
    let status: SettlementStatus
    let isSample: Bool

    var payoutRange: String {
        "\(payoutMin.usd)–\(payoutMax.usd)"
    }

    var daysUntilDeadline: Int {
        max(0, Calendar.current.dateComponents([.day], from: .now, to: deadline).day ?? 0)
    }

    var deadlineLabel: String {
        deadline.formatted(.dateTime.month(.abbreviated).day())
    }

    var isClosingSoon: Bool { daysUntilDeadline <= 21 }
}

enum ClaimStatus: String, Codable, CaseIterable, Sendable {
    case needsFiling = "To file"
    case filed = "Filed"
    case approved = "Approved"
    case rejected = "Rejected"
    case paid = "Paid"
}

struct Claim: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let settlementID: UUID
    var status: ClaimStatus
    var claimReference: String?
    var filedAt: Date?
    var paidAmount: Decimal?
    var paidAt: Date?
    var modifiedAt: Date?
}

enum BrowseFilter: String, CaseIterable, Identifiable, Sendable {
    case matches = "Matches me"
    case noProof = "No proof"
    case closingSoon = "Closing soon"
    case highestPayout = "Highest payout"

    var id: String { rawValue }
}

enum SubscriptionPlan: String, Codable, Sendable {
    case free
    case yearly
    case weekly

    var isPremium: Bool { self != .free }
}

struct MatchSummary: Sendable {
    let settlements: [Settlement]

    var totalMinimum: Decimal {
        settlements.reduce(0) { $0 + $1.payoutMin }
    }

    var totalMaximum: Decimal {
        settlements.reduce(0) { $0 + $1.payoutMax }
    }
}

enum MatchingEngine {
    static func matches(
        settlements: [Settlement],
        selectedBrandIDs: Set<UUID>,
        stateCodes: Set<String> = []
    ) -> MatchSummary {
        let today = Calendar.current.startOfDay(for: .now)
        let states = Set(stateCodes.map { $0.uppercased() })
        let matches = settlements.filter { settlement in
            guard settlement.status != .closed,
                settlement.deadline >= today,
                selectedBrandIDs.contains(settlement.brandID)
            else {
                return false
            }
            // State-limited settlements only count once the user has said where they've lived,
            // so totals are never inflated by settlements they can't claim.
            guard !settlement.eligibleStateCodes.isEmpty else { return true }
            return !states.isDisjoint(with: settlement.eligibleStateCodes.map { $0.uppercased() })
        }
        return MatchSummary(settlements: matches)
    }
}

enum USStates {
    static let all: [(code: String, name: String)] = [
        ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"), ("CA", "California"),
        ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"), ("DC", "District of Columbia"),
        ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"), ("ID", "Idaho"), ("IL", "Illinois"),
        ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"), ("KY", "Kentucky"), ("LA", "Louisiana"),
        ("ME", "Maine"), ("MD", "Maryland"), ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"),
        ("MS", "Mississippi"), ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"),
        ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"), ("NY", "New York"),
        ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"), ("OR", "Oregon"),
        ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"), ("SD", "South Dakota"),
        ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"), ("VT", "Vermont"), ("VA", "Virginia"),
        ("WA", "Washington"), ("WV", "West Virginia"), ("WI", "Wisconsin"), ("WY", "Wyoming"),
    ]
}

extension Decimal {
    var usd: String {
        formatted(
            .currency(code: "USD")
                .precision(.fractionLength(0))
        )
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }
}
