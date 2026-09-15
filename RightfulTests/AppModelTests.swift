import XCTest
@testable import Rightful

@MainActor
final class AppModelTests: XCTestCase {
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "RightfulTests")
        defaults.removePersistentDomain(forName: "RightfulTests")
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "RightfulTests")
        defaults = nil
        super.tearDown()
    }

    func testFilingAndPaymentFlowPersistsClaim() async throws {
        let app = AppModel(defaults: defaults)
        let settlement = try XCTUnwrap(SampleData.settlements.first)

        await app.markFiled(settlement: settlement, reference: "TEST-123")
        let filed = try XCTUnwrap(app.claim(for: settlement))
        XCTAssertEqual(filed.status, .filed)
        XCTAssertEqual(filed.claimReference, "TEST-123")

        await app.markPaid(claimID: filed.id, amount: 42)
        let paid = try XCTUnwrap(app.claim(for: settlement))
        XCTAssertEqual(paid.status, .paid)
        XCTAssertEqual(paid.paidAmount, 42)
    }

    func testSelectedBrandsSurviveRelaunch() {
        var first: AppModel? = AppModel(defaults: defaults)
        first?.selectedBrandIDs = [SampleData.facebookID, SampleData.amazonID]
        first = nil

        let restored = AppModel(defaults: defaults)
        XCTAssertEqual(
            restored.selectedBrandIDs,
            [SampleData.facebookID, SampleData.amazonID]
        )
    }
}
