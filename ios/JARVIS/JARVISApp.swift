import SwiftUI

@main
struct JARVISApp: App {
    @UIApplicationDelegateAdaptor(NotificationManager.self) private var notificationManager
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
