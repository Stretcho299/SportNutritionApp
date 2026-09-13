import SwiftUI
import SwiftData

@main
struct SportNutritionAppApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Workout.self, WorkoutExercise.self, WorkoutSet.self])
    }
}
