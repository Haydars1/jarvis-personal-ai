import UIKit
import UserNotifications

final class NotificationManager: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    private let defaults = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { await requestAuthorization(application) }
        return true
    }

    @MainActor
    private func requestAuthorization(_ application: UIApplication) async {
        do {
            let ok = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            defaults?.set(ok, forKey: "pushAuthorized")
            if ok { application.registerForRemoteNotifications() }
        } catch {
            defaults?.set(error.localizedDescription, forKey: "apnsLastError")
        }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        defaults?.set(token, forKey: "apnsDeviceToken")
        defaults?.removeObject(forKey: "apnsLastError")
        Task { await syncPendingToken() }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        defaults?.set(error.localizedDescription, forKey: "apnsLastError")
    }

    func syncPendingToken() async {
        guard let token = defaults?.string(forKey: "apnsDeviceToken"), !token.isEmpty else { return }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let bundle = Bundle.main.bundleIdentifier ?? "com.haydojarvis.jarvis"
        do {
            try await JarvisAPI().registerPushToken(token, environment: environment, appBundle: bundle)
            defaults?.set(Date().timeIntervalSince1970, forKey: "apnsLastSyncAt")
            defaults?.removeObject(forKey: "apnsLastError")
        } catch {
            defaults?.set(error.localizedDescription, forKey: "apnsLastError")
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        await MainActor.run {
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
    }
}
