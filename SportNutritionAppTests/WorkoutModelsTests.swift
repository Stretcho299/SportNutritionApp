import SwiftData
import XCTest
@testable import SportNutritionApp

final class WorkoutModelsTests: XCTestCase {
    func testPersistsNewWorkoutName() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        context.insert(Workout(name: "Séance libre"))
        try context.save()

        let readingContext = ModelContext(container)
        let workouts = try readingContext.fetch(FetchDescriptor<Workout>())
        XCTAssertEqual(workouts.map(\.name), ["Séance libre"])
    }

    func testPersistsOrderedWorkoutHierarchyAndIndependentSetValues() throws {
        let container = try makeContainer()
        let writingContext = ModelContext(container)
        let workout = Workout(name: "Haut du corps")
        let row = WorkoutExercise(name: "Tirage horizontal", position: 1)
        let press = WorkoutExercise(name: "Développé couché", position: 0)
        press.sets = [
            WorkoutSet(position: 1, weightInKilograms: 62.5, repetitions: 8, restDurationSeconds: 90),
            WorkoutSet(position: 0, weightInKilograms: 60, repetitions: 10, restDurationSeconds: 75)
        ]
        workout.exercises = [row, press]
        writingContext.insert(workout)
        try writingContext.save()

        let readingContext = ModelContext(container)
        let persistedWorkout = try XCTUnwrap(readingContext.fetch(FetchDescriptor<Workout>()).first)
        let exercises = persistedWorkout.exercises.sorted { $0.position < $1.position }
        XCTAssertEqual(persistedWorkout.name, "Haut du corps")
        XCTAssertEqual(exercises.map(\.name), ["Développé couché", "Tirage horizontal"])

        let sets = exercises[0].sets.sorted { $0.position < $1.position }
        XCTAssertEqual(sets.map(\.repetitions), [10, 8])
        XCTAssertEqual(sets.map(\.restDurationSeconds), [75, 90])
        XCTAssertEqual(sets.map(\.weightInKilograms), [60, 62.5])
        sets[0].repetitions = 12
        XCTAssertEqual(sets[0].repetitions, 12)
        XCTAssertEqual(sets[1].repetitions, 8)
    }

    func testPersistsBodyweightSetAndCascadesDeletion() throws {
        let container = try makeContainer()
        let context = ModelContext(container)
        let workout = Workout(name: "Mobilité")
        let pushUp = WorkoutExercise(name: "Pompes", position: 0, isBodyweight: true)
        pushUp.sets = [WorkoutSet(position: 0, weightInKilograms: nil, repetitions: 12, restDurationSeconds: 60)]
        workout.exercises = [pushUp]
        context.insert(workout)
        try context.save()

        let readingContext = ModelContext(container)
        let persistedExercise = try XCTUnwrap(readingContext.fetch(FetchDescriptor<WorkoutExercise>()).first)
        XCTAssertTrue(persistedExercise.isBodyweight)
        XCTAssertNil(persistedExercise.sets.first?.weightInKilograms)

        context.delete(workout)
        try context.save()

        let verificationContext = ModelContext(container)
        XCTAssertTrue(try verificationContext.fetch(FetchDescriptor<Workout>()).isEmpty)
        XCTAssertTrue(try verificationContext.fetch(FetchDescriptor<WorkoutExercise>()).isEmpty)
        XCTAssertTrue(try verificationContext.fetch(FetchDescriptor<WorkoutSet>()).isEmpty)
    }

    private func makeContainer() throws -> ModelContainer {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
        return try ModelContainer(
            for: Workout.self,
            WorkoutExercise.self,
            WorkoutSet.self,
            configurations: configuration
        )
    }
}
