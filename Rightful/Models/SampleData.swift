import Foundation

enum SampleData {
    static let facebookID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    static let instagramID = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    static let tiktokID = UUID(uuidString: "00000000-0000-0000-0000-000000000003")!
    static let amazonID = UUID(uuidString: "00000000-0000-0000-0000-000000000004")!
    static let appleID = UUID(uuidString: "00000000-0000-0000-0000-000000000005")!
    static let tmobileID = UUID(uuidString: "00000000-0000-0000-0000-000000000006")!
    static let verizonID = UUID(uuidString: "00000000-0000-0000-0000-000000000007")!
    static let uberID = UUID(uuidString: "00000000-0000-0000-0000-000000000008")!
    static let doordashID = UUID(uuidString: "00000000-0000-0000-0000-000000000009")!
    static let netflixID = UUID(uuidString: "00000000-0000-0000-0000-000000000010")!
    static let spotifyID = UUID(uuidString: "00000000-0000-0000-0000-000000000011")!
    static let capitalOneID = UUID(uuidString: "00000000-0000-0000-0000-000000000012")!
    static let ticketmasterID = UUID(uuidString: "00000000-0000-0000-0000-000000000013")!
    static let walmartID = UUID(uuidString: "00000000-0000-0000-0000-000000000014")!
    static let airbnbID = UUID(uuidString: "00000000-0000-0000-0000-000000000015")!

    static let brands: [Brand] = [
        Brand(id: facebookID, name: "Facebook", category: .social, aliases: ["Meta"], monogramColorHex: "#4664A5"),
        Brand(id: instagramID, name: "Instagram", category: .social, aliases: ["Meta"], monogramColorHex: "#D82C74"),
        Brand(id: tiktokID, name: "TikTok", category: .social, aliases: ["ByteDance"], monogramColorHex: "#17211B"),
        Brand(id: amazonID, name: "Amazon", category: .shopping, aliases: ["Prime"], monogramColorHex: "#D97706"),
        Brand(id: appleID, name: "Apple", category: .shopping, aliases: ["iPhone", "App Store"], monogramColorHex: "#606862"),
        Brand(id: tmobileID, name: "T-Mobile", category: .phone, aliases: ["TMobile"], monogramColorHex: "#D40073"),
        Brand(id: verizonID, name: "Verizon", category: .phone, aliases: ["Wireless"], monogramColorHex: "#C71920"),
        Brand(id: uberID, name: "Uber", category: .delivery, aliases: ["Uber Eats"], monogramColorHex: "#16231B"),
        Brand(id: doordashID, name: "DoorDash", category: .delivery, aliases: ["DashPass"], monogramColorHex: "#D74227"),
        Brand(id: netflixID, name: "Netflix", category: .entertainment, aliases: ["Streaming"], monogramColorHex: "#B91C1C"),
        Brand(id: spotifyID, name: "Spotify", category: .entertainment, aliases: ["Music"], monogramColorHex: "#168A4B"),
        Brand(id: capitalOneID, name: "Capital One", category: .finance, aliases: ["Credit card", "Bank"], monogramColorHex: "#176084"),
        Brand(id: ticketmasterID, name: "Ticketmaster", category: .entertainment, aliases: ["Live Nation", "Tickets"], monogramColorHex: "#2777C5"),
        Brand(id: walmartID, name: "Walmart", category: .shopping, aliases: ["Walmart+"], monogramColorHex: "#1F61A6"),
        Brand(id: airbnbID, name: "Airbnb", category: .shopping, aliases: ["Vacation rental"], monogramColorHex: "#CC4A57"),
    ]

    static let settlements: [Settlement] = [
        settlement(
            "10000000-0000-0000-0000-000000000001",
            title: "Privacy settlement",
            company: "Facebook",
            brandID: facebookID,
            min: 20,
            max: 85,
            deadlineDays: 18,
            proofRequired: false,
            summary: "US users who had an account at any point during the covered years.",
            details: ["I had an account during the covered years", "I haven’t already filed this claim"],
            payout: "Early 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000002",
            title: "Data breach",
            company: "T-Mobile",
            brandID: tmobileID,
            min: 25,
            max: 100,
            deadlineDays: 34,
            proofRequired: false,
            summary: "Customers whose information was included in the covered incident.",
            details: ["I was a customer during the covered period", "I did not opt out of the settlement"],
            payout: "Spring 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000003",
            title: "Savings rate",
            company: "Capital One",
            brandID: capitalOneID,
            min: 30,
            max: 350,
            deadlineDays: 47,
            proofRequired: false,
            summary: "Eligible savings account holders during the settlement period.",
            details: ["I held an eligible savings account", "The account was open during the covered dates"],
            payout: "Mid 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000004",
            title: "Service fees",
            company: "Ticketmaster",
            brandID: ticketmasterID,
            min: 10,
            max: 40,
            deadlineDays: 13,
            proofRequired: false,
            summary: "US customers who bought eligible tickets during the covered years.",
            details: ["I bought an eligible ticket", "I used a US billing address"],
            payout: "Late 2026"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000005",
            title: "Service fees",
            company: "Uber",
            brandID: uberID,
            min: 5,
            max: 25,
            deadlineDays: 62,
            proofRequired: true,
            summary: "Riders charged covered service fees during the settlement period.",
            details: ["I took a covered ride", "I can provide a receipt if asked"],
            payout: "Mid 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000006",
            title: "Prime billing",
            company: "Amazon",
            brandID: amazonID,
            min: 15,
            max: 75,
            deadlineDays: 27,
            proofRequired: false,
            summary: "Prime members billed during the covered subscription period.",
            details: ["I had a Prime membership", "I was billed during the covered period"],
            payout: "Early 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000007",
            title: "Subscription disclosure",
            company: "Netflix",
            brandID: netflixID,
            min: 8,
            max: 30,
            deadlineDays: 78,
            proofRequired: false,
            summary: "Subscribers in covered states during the listed billing period.",
            details: ["I had a paid Netflix plan", "I lived in a covered state"],
            payout: "Late 2027"
        ),
        settlement(
            "10000000-0000-0000-0000-000000000008",
            title: "App privacy",
            company: "TikTok",
            brandID: tiktokID,
            min: 12,
            max: 60,
            deadlineDays: 96,
            proofRequired: false,
            summary: "US users who used the app during the covered dates.",
            details: ["I used the app during the covered dates", "I have not filed another claim"],
            payout: "Late 2027"
        ),
    ]

    private static func settlement(
        _ id: String,
        title: String,
        company: String,
        brandID: UUID,
        min: Decimal,
        max: Decimal,
        deadlineDays: Int,
        proofRequired: Bool,
        summary: String,
        details: [String],
        payout: String
    ) -> Settlement {
        Settlement(
            id: UUID(uuidString: id)!,
            title: title,
            company: company,
            brandID: brandID,
            eligibleStateCodes: [],
            payoutMin: min,
            payoutMax: max,
            deadline: Calendar.current.date(byAdding: .day, value: deadlineDays, to: .now)!,
            proofRequired: proofRequired,
            qualifiesSummary: summary,
            eligibilityDetails: details,
            claimURL: URL(string: "https://www.ftc.gov/legal-library/browse/cases-proceedings/refunds")!,
            expectedPayoutDate: payout,
            status: .verified,
            isSample: true
        )
    }
}
