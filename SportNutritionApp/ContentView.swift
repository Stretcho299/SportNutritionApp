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
                    NavigationLink {
                        WorkoutExerciseDetailView(exercise: exercise)
                    } label: {
                        Text(exercise.name)
                    }
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
                workout.exercises.append(exercise)
                modelContext.insert(exercise)
            }
        }
    }
}

private struct WorkoutExerciseDetailView: View {
    @Environment(\.modelContext) private var modelContext
    let exercise: WorkoutExercise
    @State private var isPresentingNewSet = false

    var body: some View {
        Group {
            if exercise.orderedSets.isEmpty {
                ContentUnavailableView(
                    "Aucune série",
                    systemImage: "list.number",
                    description: Text("Ajoutez une série prévue pour cet exercice.")
                )
            } else {
                List(exercise.orderedSets) { set in
                    VStack(alignment: .leading) {
                        Text("Série \(set.position + 1)")
                        HStack {
                            if !exercise.isBodyweight, let weight = set.weightInKilograms {
                                Text("\(weight, specifier: "%.2f") kg")
                            }
                            Text("\(set.repetitions) répétitions")
                            Text("\(set.restDurationSeconds) s")
                        }
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(exercise.name)
        .toolbar {
            Button("Ajouter une série", systemImage: "plus") {
                isPresentingNewSet = true
            }
        }
        .sheet(isPresented: $isPresentingNewSet) {
            NewWorkoutSetSheet(isBodyweight: exercise.isBodyweight) { weight, repetitions, restDurationSeconds in
                let set = WorkoutSet(
                    position: exercise.nextSetPosition,
                    weightInKilograms: weight,
                    repetitions: repetitions,
                    restDurationSeconds: restDurationSeconds
                )
                set.exercise = exercise
                modelContext.insert(set)
            }
        }
    }
}

private struct NewWorkoutSetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var weightText = ""
    @State private var repetitionsText = ""
    @State private var restDurationSeconds = 90

    let isBodyweight: Bool
    let createSet: (Double?, Int, Int) -> Void

    private var parsedWeight: Double? {
        let normalizedWeight = weightText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        return Double(normalizedWeight)
    }

    private var repetitions: Int? {
        guard let value = Int(repetitionsText), value > 0 else {
            return nil
        }
        return value
    }

    private var isValid: Bool {
        guard repetitions != nil else {
            return false
        }
        return isBodyweight || (parsedWeight ?? -1) >= 0
    }

    var body: some View {
        NavigationStack {
            Form {
                if !isBodyweight {
                    TextField("Charge (kg)", text: $weightText)
                        .keyboardType(.decimalPad)
                }
                TextField("Répétitions", text: $repetitionsText)
                    .keyboardType(.numberPad)
                Picker("Temps de repos", selection: $restDurationSeconds) {
                    Text("30 s").tag(30)
                    Text("45 s").tag(45)
                    Text("1 min").tag(60)
                    Text("1 min 30").tag(90)
                    Text("2 min").tag(120)
                    Text("2 min 30").tag(150)
                    Text("3 min").tag(180)
                    Text("4 min").tag(240)
                    Text("5 min").tag(300)
                }
            }
            .navigationTitle("Nouvelle série")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        guard let repetitions else {
                            return
                        }
                        createSet(isBodyweight ? nil : parsedWeight, repetitions, restDurationSeconds)
                        dismiss()
                    }
                    .disabled(!isValid)
                }
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
