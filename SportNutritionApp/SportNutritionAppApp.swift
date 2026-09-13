import SwiftUI
import SwiftData

@main
struct SportNutritionAppApp: App {
    private let modelContainer: ModelContainer = {
        let configuration = ModelConfiguration(
            isStoredInMemoryOnly: ProcessInfo.processInfo.arguments.contains("-ui-testing")
        )

        do {
            return try ModelContainer(
                for: Workout.self,
                WorkoutExercise.self,
                WorkoutSet.self,
                configurations: configuration
            )
        } catch {
            fatalError("Unable to create the model container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(modelContainer)
    }
}
