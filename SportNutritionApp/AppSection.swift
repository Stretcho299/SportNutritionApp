import Foundation

enum AppSection: String, CaseIterable, Identifiable {
    case workouts
    case nutrition

    var id: Self { self }
    var title: String {
        switch self {
        case .workouts: "Séances"
        case .nutrition: "Nutrition"
        }
    }
    var systemImage: String {
        switch self {
        case .workouts: "dumbbell"
        case .nutrition: "fork.knife"
        }
    }
}
