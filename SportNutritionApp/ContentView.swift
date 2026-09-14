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
    @State private var exerciseBeingEdited: WorkoutExercise?
    @State private var exercisePendingDeletion: WorkoutExercise?

    var body: some View {
        Group {
            if workout.orderedExercises.isEmpty {
                ContentUnavailableView(
                    "Aucun exercice",
                    systemImage: "dumbbell",
                    description: Text("Cette séance ne contient encore aucun exercice.")
                )
            } else {
                List {
                    ForEach(workout.orderedExercises) { exercise in
                        NavigationLink {
                            WorkoutExerciseDetailView(exercise: exercise)
                        } label: {
                            Text(exercise.name)
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Supprimer", role: .destructive) {
                                exercisePendingDeletion = exercise
                            }
                            Button("Modifier") {
                                exerciseBeingEdited = exercise
                            }
                            .tint(.blue)
                        }
                    }
                    .onMove(perform: moveExercises)
                }
            }
        }
        .navigationTitle(workout.name)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if !workout.orderedExercises.isEmpty {
                    EditButton()
                }
                Button("Ajouter un exercice", systemImage: "plus") {
                    isPresentingNewExercise = true
                }
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
        .sheet(item: $exerciseBeingEdited) { exercise in
            EditWorkoutExerciseSheet(exercise: exercise)
        }
        .confirmationDialog(
            "Supprimer cet exercice ?",
            isPresented: Binding(
                get: { exercisePendingDeletion != nil },
                set: { if !$0 { exercisePendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                if let exercisePendingDeletion {
                    delete(exercisePendingDeletion)
                }
                exercisePendingDeletion = nil
            }
            Button("Annuler", role: .cancel) {
                exercisePendingDeletion = nil
            }
        } message: {
            Text("Ses séries prévues seront également supprimées.")
        }
    }

    private func moveExercises(from source: IndexSet, to destination: Int) {
        var exercises = workout.orderedExercises
        exercises.move(fromOffsets: source, toOffset: destination)
        updatePositions(of: exercises)
    }

    private func delete(_ exercise: WorkoutExercise) {
        let remainingExercises = workout.orderedExercises.filter { $0 !== exercise }
        modelContext.delete(exercise)
        updatePositions(of: remainingExercises)
    }

    private func updatePositions(of exercises: [WorkoutExercise]) {
        for (position, exercise) in exercises.enumerated() {
            exercise.position = position
        }
    }
}

private struct WorkoutExerciseDetailView: View {
    @Environment(\.modelContext) private var modelContext
    let exercise: WorkoutExercise
    @State private var isPresentingNewSet = false
    @State private var setBeingEdited: WorkoutSet?

    var body: some View {
        Group {
            if exercise.orderedSets.isEmpty {
                ContentUnavailableView(
                    "Aucune série",
                    systemImage: "list.number",
                    description: Text("Ajoutez une série prévue pour cet exercice.")
                )
            } else {
                List {
                    ForEach(exercise.orderedSets) { set in
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
                        .swipeActions(edge: .trailing) {
                            Button("Supprimer", role: .destructive) {
                                delete(set)
                            }
                            Button("Modifier") {
                                setBeingEdited = set
                            }
                            .tint(.blue)
                        }
                    }
                    .onMove(perform: moveSets)
                }
            }
        }
        .navigationTitle(exercise.name)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if !exercise.orderedSets.isEmpty {
                    EditButton()
                }
                Button("Ajouter une série", systemImage: "plus") {
                    isPresentingNewSet = true
                }
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
        .sheet(item: $setBeingEdited) { set in
            EditWorkoutSetSheet(set: set, isBodyweight: exercise.isBodyweight)
        }
    }

    private func moveSets(from source: IndexSet, to destination: Int) {
        var sets = exercise.orderedSets
        sets.move(fromOffsets: source, toOffset: destination)
        updatePositions(of: sets)
    }

    private func delete(_ set: WorkoutSet) {
        let remainingSets = exercise.orderedSets.filter { $0 !== set }
        modelContext.delete(set)
        updatePositions(of: remainingSets)
    }

    private func updatePositions(of sets: [WorkoutSet]) {
        for (position, set) in sets.enumerated() {
            set.position = position
        }
    }
}

private struct NewWorkoutSetSheet: View {
    @Environment(\.dismiss) private var dismiss
    let isBodyweight: Bool
    let createSet: (Double?, Int, Int) -> Void

    var body: some View {
        WorkoutSetForm(
            title: "Nouvelle série",
            confirmationTitle: "Créer",
            isBodyweight: isBodyweight
        ) { weight, repetitions, restDurationSeconds in
            createSet(weight, repetitions, restDurationSeconds)
            dismiss()
        }
    }
}

private struct EditWorkoutSetSheet: View {
    @Environment(\.dismiss) private var dismiss
    let set: WorkoutSet
    let isBodyweight: Bool

    var body: some View {
        WorkoutSetForm(
            title: "Modifier la série",
            confirmationTitle: "Enregistrer",
            isBodyweight: isBodyweight,
            initialWeight: set.weightInKilograms,
            initialRepetitions: set.repetitions,
            initialRestDurationSeconds: set.restDurationSeconds
        ) { weight, repetitions, restDurationSeconds in
            set.weightInKilograms = weight
            set.repetitions = repetitions
            set.restDurationSeconds = restDurationSeconds
            dismiss()
        }
    }
}

private struct WorkoutSetForm: View {
    @Environment(\.dismiss) private var dismiss
    @State private var weightText: String
    @State private var repetitionsText: String
    @State private var restDurationSeconds: Int

    let title: String
    let confirmationTitle: String
    let isBodyweight: Bool
    let saveSet: (Double?, Int, Int) -> Void

    init(
        title: String,
        confirmationTitle: String,
        isBodyweight: Bool,
        initialWeight: Double? = nil,
        initialRepetitions: Int? = nil,
        initialRestDurationSeconds: Int = 90,
        saveSet: @escaping (Double?, Int, Int) -> Void
    ) {
        self.title = title
        self.confirmationTitle = confirmationTitle
        self.isBodyweight = isBodyweight
        self.saveSet = saveSet
        _weightText = State(initialValue: initialWeight.map { String($0) } ?? "")
        _repetitionsText = State(initialValue: initialRepetitions.map { String($0) } ?? "")
        _restDurationSeconds = State(initialValue: initialRestDurationSeconds)
    }

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
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmationTitle) {
                        guard let repetitions else {
                            return
                        }
                        saveSet(isBodyweight ? nil : parsedWeight, repetitions, restDurationSeconds)
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

private struct EditWorkoutExerciseSheet: View {
    @Environment(\.dismiss) private var dismiss
    let exercise: WorkoutExercise
    @State private var name: String
    @State private var isBodyweight: Bool

    init(exercise: WorkoutExercise) {
        self.exercise = exercise
        _name = State(initialValue: exercise.name)
        _isBodyweight = State(initialValue: exercise.isBodyweight)
    }

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
            .navigationTitle("Modifier l’exercice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        exercise.name = trimmedName
                        exercise.isBodyweight = isBodyweight
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
