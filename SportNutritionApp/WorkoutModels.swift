import Foundation
import SwiftData

@Model
final class Workout {
    var name: String
    @Relationship(deleteRule: .cascade, inverse: \WorkoutExercise.workout)
    var exercises: [WorkoutExercise] = []

    init(name: String) {
        self.name = name
    }
}

@Model
final class WorkoutExercise {
    var name: String
    var position: Int
    var isBodyweight: Bool
    var workout: Workout?
    @Relationship(deleteRule: .cascade, inverse: \WorkoutSet.exercise)
    var sets: [WorkoutSet] = []

    init(name: String, position: Int, isBodyweight: Bool = false) {
        self.name = name
        self.position = position
        self.isBodyweight = isBodyweight
    }
}

@Model
final class WorkoutSet {
    var position: Int
    var weightInKilograms: Double?
    var repetitions: Int
    var restDurationSeconds: Int
    var exercise: WorkoutExercise?

    init(
        position: Int,
        weightInKilograms: Double?,
        repetitions: Int,
        restDurationSeconds: Int
    ) {
        self.position = position
        self.weightInKilograms = weightInKilograms
        self.repetitions = repetitions
        self.restDurationSeconds = restDurationSeconds
    }
}
