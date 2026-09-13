import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            ForEach(AppSection.allCases) { section in
                SectionPlaceholderView(section: section)
                    .tabItem {
                        Label(section.title, systemImage: section.systemImage)
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
