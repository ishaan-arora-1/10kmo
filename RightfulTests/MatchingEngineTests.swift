import XCTest

@testable import Rightful

final class MatchingEngineTests: XCTestCase {
    func testMatchesOnlySelectedBrands() {
        let result = MatchingEngine.matches(
            settlements: SampleData.settlements,
            selectedBrandIDs: [SampleData.facebookID, SampleData.tmobileID]
        )

        XCTAssertEqual(result.settlements.count, 2)
        XCTAssertTrue(
            result.settlements.allSatisfy {
                [SampleData.facebookID, SampleData.tmobileID].contains($0.brandID)
            })
    }

    func testPotentialTotalUsesPayoutRanges() {
        let result = MatchingEngine.matches(
            settlements: SampleData.settlements,
            selectedBrandIDs: [SampleData.facebookID]
        )

        XCTAssertEqual(result.totalMinimum, 20)
        XCTAssertEqual(result.totalMaximum, 85)
    }

    func testStateRestrictionIsAppliedWhenKnown() throws {
        var settlement = try XCTUnwrap(SampleData.settlements.first)
        settlement = Settlement(
            id: settlement.id,
            title: settlement.title,
            company: settlement.company,
            brandID: settlement.brandID,
            eligibleStateCodes: ["CA"],
            payoutMin: settlement.payoutMin,
            payoutMax: settlement.payoutMax,
            deadline: settlement.deadline,
            proofRequired: settlement.proofRequired,
            qualifiesSummary: settlement.qualifiesSummary,
            eligibilityDetails: settlement.eligibilityDetails,
            claimURL: settlement.claimURL,
            expectedPayoutDate: settlement.expectedPayoutDate,
            status: settlement.status,
            isSample: settlement.isSample
        )

        let accepted = MatchingEngine.matches(
            settlements: [settlement],
            selectedBrandIDs: [settlement.brandID],
            stateCodes: ["ca"]
        )
        let rejected = MatchingEngine.matches(
            settlements: [settlement],
            selectedBrandIDs: [settlement.brandID],
            stateCodes: ["ny"]
        )
        let unknownState = MatchingEngine.matches(
            settlements: [settlement],
            selectedBrandIDs: [settlement.brandID]
        )

        XCTAssertEqual(accepted.settlements.count, 1)
        XCTAssertTrue(rejected.settlements.isEmpty)
        XCTAssertTrue(unknownState.settlements.isEmpty, "State-limited settlements need a known state")
    }

    func testBrandCatalogIsLargeAndUnique() {
        XCTAssertGreaterThanOrEqual(SampleData.brands.count, 180)
        XCTAssertEqual(Set(SampleData.brands.map(\.id)).count, SampleData.brands.count)
        XCTAssertEqual(Set(SampleData.brands.map(\.name)).count, SampleData.brands.count)
    }
}
