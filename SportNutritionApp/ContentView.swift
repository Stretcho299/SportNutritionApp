import SwiftUI
import SwiftData

struct ContentView: View {
    var body: some View {
        TabView {
            ForEach(AppSection.allCases) { section in
                switch section {
                case .workouts:
                    WorkoutListView()
                case .nutrition:
                    SectionPlaceholderView(section: section)
                }
                .tabItem {
                    Label(section.title, systemImage: section.systemImage)
                }
            }
        }
    }
}

private struct WorkoutListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Workout.name) private var workouts: [Workout]
    @State private var isPresentingNewWorkout = false

    var body: some View {
        NavigationStack {
            Group {
                if workouts.isEmpty {
                    ContentUnavailableView(
                        "Aucune séance",
                        systemImage: "dumbbell",
                        description: Text("Créez votre première séance pour la retrouver ici.")
                    )
                } else {
                    List(workouts) { workout in
                        Text(workout.name)
                    }
                }
            }
            .navigationTitle("Séances")
            .toolbar {
                Button("Créer une séance", systemImage: "plus") {
                    isPresentingNewWorkout = true
                }
            }
            .sheet(isPresented: $isPresentingNewWorkout) {
                NewWorkoutSheet { name in
                    modelContext.insert(Workout(name: name))
                }
            }
        }
    }
}

private struct NewWorkoutSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""

    let createWorkout: (String) -> Void

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nom de la séance", text: $name)
                    .textInputAutocapitalization(.sentences)
            }
            .navigationTitle("Nouvelle séance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        createWorkout(trimmedName)
                        dismiss()
                    }
                    .disabled(trimmedName.isEmpty)
                }
            }
        }
    }
}

private struct SectionPlaceholderView: View {
    let section: AppSection

    var body: some View {
        ContentUnavailableView(
            section.title,
            systemImage: section.systemImage,
            description: Text("Cette section sera disponible dans une prochaine étape du MVP.")
        )
    }
}

#Preview {
    ContentView()
}
