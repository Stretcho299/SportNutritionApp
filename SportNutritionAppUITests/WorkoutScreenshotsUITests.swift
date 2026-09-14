import XCTest

final class WorkoutScreenshotsUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR"]
        app.launch()
    }

    func testCapturesWorkoutFlow() throws {
        XCTAssertTrue(app.navigationBars["Séances"].waitForExistence(timeout: 5))
        capture("01-workouts-empty.png")

        app.buttons["Créer une séance"].tap()
        let workoutNameField = app.textFields["Nom de la séance"]
        XCTAssertTrue(workoutNameField.waitForExistence(timeout: 5))
        workoutNameField.tap()
        workoutNameField.typeText("Séance de test")
        app.buttons["Créer"].tap()

        let workoutName = app.staticTexts["Séance de test"]
        XCTAssertTrue(workoutName.waitForExistence(timeout: 5))
        capture("02-workouts-list.png")
        workoutName.tap()

        XCTAssertTrue(app.navigationBars["Séance de test"].waitForExistence(timeout: 5))
        capture("03-workout-detail.png")

        app.buttons["Ajouter un exercice"].tap()
        let exerciseNameField = app.textFields["Nom de l’exercice"]
        XCTAssertTrue(exerciseNameField.waitForExistence(timeout: 5))
        exerciseNameField.tap()
        exerciseNameField.typeText("Exercice de test")
        app.buttons["Créer"].tap()

        let exerciseName = app.staticTexts["Exercice de test"]
        XCTAssertTrue(exerciseName.waitForExistence(timeout: 5))
        exerciseName.tap()

        XCTAssertTrue(app.navigationBars["Exercice de test"].waitForExistence(timeout: 5))
        capture("04-exercise-detail.png")

        app.buttons["Ajouter une série"].tap()
        XCTAssertTrue(app.navigationBars["Nouvelle série"].waitForExistence(timeout: 5))
        capture("05-new-set-form.png")

        let weightField = app.textFields["Charge (kg)"]
        let repetitionsField = app.textFields["Répétitions"]
        XCTAssertTrue(weightField.exists)
        XCTAssertTrue(repetitionsField.exists)
        weightField.tap()
        weightField.typeText("60")
        repetitionsField.tap()
        repetitionsField.typeText("10")
        app.buttons["Créer"].tap()

        XCTAssertTrue(app.navigationBars["Exercice de test"].waitForExistence(timeout: 5))
        capture("06-planned-set.png")
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
