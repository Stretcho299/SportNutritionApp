import XCTest
@testable import SportNutritionApp

final class AppSectionTests: XCTestCase {
    func testMVPContainsOnlyWorkoutAndNutritionSections() {
        XCTAssertEqual(AppSection.allCases, [.workouts, .nutrition])
        XCTAssertEqual(AppSection.allCases.map(\.title), ["Séances", "Nutrition"])
    }
}
