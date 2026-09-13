import SwiftData
import XCTest
@testable import SportNutritionApp

final class WorkoutModelsTests: XCTestCase {
    func testPersistsNewWeightedAndBodyweightSetsWithNextPositions() throws {
        let container = try makeContainer()
        let context = ModelContext(container)
        let workout = Workout(name: "Haut du corps")
        let weightedExercise = WorkoutExercise(name: "Développé couché", position: 0)
        weightedExercise.sets = [
            WorkoutSet(position: 2, weightInKilograms: 60, repetitions: 8, restDurationSeconds: 90)
        ]
        let bodyweightExercise = WorkoutExercise(name: "Tractions", position: 1, isBodyweight: true)
        workout.exercises = [weightedExercise, bodyweightExercise]
        context.insert(workout)
        try context.save()

        let weightedSet = WorkoutSet(
            position: weightedExercise.nextSetPosition,
            weightInKilograms: 70.5,
            repetitions: 10,
            restDurationSeconds: 120
        )
        weightedSet.exercise = weightedExercise
        context.insert(weightedSet)

        let bodyweightSet = WorkoutSet(
            position: bodyweightExercise.nextSetPosition,
            weightInKilograms: nil,
            repetitions: 12,
            restDurationSeconds: 45
        )
        bodyweightSet.exercise = bodyweightExercise
        context.insert(bodyweightSet)
        try context.save()

        let readingContext = ModelContext(container)
        let persistedWorkout = try XCTUnwrap(readingContext.fetch(FetchDescriptor<Workout>()).first)
        let exercises = persistedWorkout.orderedExercises
        let persistedWeightedSets = exercises[0].orderedSets
        let persistedBodyweightSets = exercises[1].orderedSets

        XCTAssertEqual(persistedWeightedSets.map(\.position), [2, 3])
        XCTAssertEqual(persistedWeightedSets.last?.weightInKilograms, 70.5)
        XCTAssertEqual(persistedWeightedSets.last?.repetitions, 10)
        XCTAssertEqual(persistedWeightedSets.last?.restDurationSeconds, 120)
        XCTAssertEqual(persistedWeightedSets.last?.exercise?.name, "Développé couché")
        XCTAssertEqual(persistedBodyweightSets.map(\.position), [0])
        XCTAssertNil(persistedBodyweightSets.first?.weightInKilograms)
        XCTAssertEqual(persistedBodyweightSets.first?.repetitions, 12)
        XCTAssertEqual(persistedBodyweightSets.first?.restDurationSeconds, 45)
        XCTAssertEqual(persistedBodyweightSets.first?.exercise?.name, "Tractions")
    }

    func testPersistsNewExerciseAttachedToWorkoutAfterExistingExercises() throws {
        let container = try makeContainer()
        let context = ModelContext(container)
        let workout = Workout(name: "Haut du corps")
        workout.exercises = [WorkoutExercise(name: "Développé couché", position: 3)]
        context.insert(workout)
        try context.save()

        let exercise = WorkoutExercise(
            name: "Tractions",
            position: workout.nextExercisePosition,
            isBodyweight: true
        )
        exercise.workout = workout
        context.insert(exercise)
        try context.save()

        let readingContext = ModelContext(container)
        let persistedWorkout = try XCTUnwrap(readingContext.fetch(FetchDescriptor<Workout>()).first)
        let exercises = persistedWorkout.orderedExercises
        XCTAssertEqual(exercises.map(\.name), ["Développé couché", "Tractions"])
        XCTAssertEqual(exercises.map(\.position), [3, 4])
        XCTAssertEqual(exercises.last?.workout?.name, "Haut du corps")
        XCTAssertTrue(exercises.last?.isBodyweight ?? false)
    }

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
        let exercises = persistedWorkout.orderedExercises
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
