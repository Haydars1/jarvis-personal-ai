import SwiftUI

@main
struct JARVISApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onOpenURL { url in
                    appState.handle(url: url)
                }
        }
    }
}
