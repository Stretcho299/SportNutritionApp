import SwiftUI
import SwiftData

struct ContentView: View {
    var body: some View {
        TabView {
            ForEach(AppSection.allCases) { section in
                Group {
                    switch section {
                    case .workouts:
                        WorkoutListView()
                    case .nutrition:
                        SectionPlaceholderView(section: section)
                    }
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
                        NavigationLink {
                            WorkoutDetailView(workout: workout)
                        } label: {
                            Text(workout.name)
                        }
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

private struct WorkoutDetailView: View {
    @Environment(\.modelContext) private var modelContext
    let workout: Workout
    @State private var isPresentingNewExercise = false

    var body: some View {
        Group {
            if workout.orderedExercises.isEmpty {
                ContentUnavailableView(
                    "Aucun exercice",
                    systemImage: "dumbbell",
                    description: Text("Cette séance ne contient encore aucun exercice.")
                )
            } else {
                List(workout.orderedExercises) { exercise in
                    Text(exercise.name)
                }
            }
        }
        .navigationTitle(workout.name)
        .toolbar {
            Button("Ajouter un exercice", systemImage: "plus") {
                isPresentingNewExercise = true
            }
        }
        .sheet(isPresented: $isPresentingNewExercise) {
            NewWorkoutExerciseSheet { name, isBodyweight in
                let exercise = WorkoutExercise(
                    name: name,
                    position: workout.nextExercisePosition,
                    isBodyweight: isBodyweight
                )
                exercise.workout = workout
                modelContext.insert(exercise)
            }
        }
    }
}

private struct NewWorkoutExerciseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var isBodyweight = false

    let createExercise: (String, Bool) -> Void

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nom de l’exercice", text: $name)
                    .textInputAutocapitalization(.sentences)
                Toggle("Exercice au poids du corps", isOn: $isBodyweight)
            }
            .navigationTitle("Nouvel exercice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        createExercise(trimmedName, isBodyweight)
                        dismiss()
                    }
                    .disabled(trimmedName.isEmpty)
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
