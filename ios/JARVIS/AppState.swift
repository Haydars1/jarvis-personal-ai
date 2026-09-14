import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input: String = ""
    @Published var attachments: [NativeAttachment] = []
    @Published var isSending = false
    @Published var isListening = false
    @Published var isLoggingIn = false
    @Published var statusText = "Hazır"
    @Published var loginStatusText = ""
    @Published var showLogin = false
    @Published var password = ""
    @Published var biometricLoginAvailable = false
    @Published var biometricLoginTitle = "Face ID ile Giriş Yap"

    let api = JarvisAPI()
    let voice = VoiceEngine()
    private let biometricStore = BiometricLoginStore.shared

    init() {
        voice.onFinalTranscript = { [weak self] text in
            Task { @MainActor in
                guard let self else { return }
                self.input = text
                await self.send()
            }
        }
        voice.onStateChange = { [weak self] listening in
            Task { @MainActor in self?.isListening = listening }
        }
    }

    func bootstrap() async {
        refreshBiometricState()
        do {
            let auth = try await api.authStatus()
            showLogin = !auth.authenticated
            if auth.authenticated {
                try await loadHistory()
                await NotificationManager.shared.syncPendingToken()
                await consumePendingIntentIfNeeded()
            } else if biometricLoginAvailable {
                await loginWithBiometrics()
            }
        } catch {
            statusText = friendlyError(error.localizedDescription)
        }
    }

    func refreshBiometricState() {
        biometricLoginTitle = biometricStore.availabilityTitle()
        biometricLoginAvailable = biometricStore.isEnabled && biometricStore.canUseBiometrics()
    }

    func login() async {
        let typedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typedPassword.isEmpty, !isLoggingIn else {
            loginStatusText = typedPassword.isEmpty ? "Parolayı yaz." : loginStatusText
            return
        }

        isLoggingIn = true
        loginStatusText = "Giriş yapılıyor..."
        do {
            try await completeLogin(password: typedPassword)
            do {
                try biometricStore.savePassword(typedPassword)
                refreshBiometricState()
            } catch {
                loginStatusText = "Giriş tamam. Face ID kaydedilemedi: \(error.localizedDescription)"
            }
            password = ""
        } catch {
            let message = friendlyError(error.localizedDescription)
            loginStatusText = message
            statusText = message
        }
        isLoggingIn = false
    }

    func loginWithBiometrics() async {
        guard !isLoggingIn else { return }
        refreshBiometricState()
        guard biometricLoginAvailable else {
            loginStatusText = "Önce parolayla giriş yap. Sonra Face ID aktif olur."
            return
        }

        isLoggingIn = true
        loginStatusText = "Face ID bekleniyor..."
        do {
            let savedPassword = try biometricStore.readPassword()
            try await completeLogin(password: savedPassword)
            password = ""
        } catch {
            let message = friendlyError(error.localizedDescription)
            loginStatusText = message
            statusText = message
        }
        isLoggingIn = false
    }

    private func completeLogin(password: String) async throws {
        try await api.login(password: password)
        showLogin = false
        loginStatusText = ""
        try await loadHistory()
        await NotificationManager.shared.syncPendingToken()
        await consumePendingIntentIfNeeded()
        statusText = "Hazır"
    }

    func loadHistory() async throws {
        messages = try await api.history()
    }

    func addAttachment(_ attachment: NativeAttachment) {
        guard attachments.count < 4 else {
            statusText = "En fazla 4 dosya eklenebilir"
            return
        }
        attachments.append(attachment)
    }

    func removeAttachment(_ id: UUID) {
        attachments.removeAll { $0.id == id }
    }

    func startQuickAction(_ text: String) {
        guard !isSending else {
            statusText = "JARVIS zaten çalışıyor..."
            return
        }
        input = text
        Task { await send() }
    }

    func send() async {
        let typed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (!typed.isEmpty || !attachments.isEmpty), !isSending else { return }
        let text = typed.isEmpty ? "Bu dosyaları incele ve ihtiyacım olan sonucu ver." : typed
        let pendingAttachments = attachments
        input = ""
        attachments = []
        isSending = true
        statusText = "JARVIS çalışıyor..."
        let visible = pendingAttachments.isEmpty ? text : "\(text)\n📎 \(pendingAttachments.map(\.name).joined(separator: ", "))"
        messages.append(ChatMessage(role: "user", content: visible, provider: nil, createdAt: Date().timeIntervalSince1970 * 1000))
        do {
            let result = try await api.send(text: text, attachments: pendingAttachments)
            messages = result.history
            statusText = "Hazır"
            // Yanıtı otomatik seslendirme. Mikrofon yalnızca kullanıcı konuşmak istediğinde dinleme için kullanılır.
        } catch {
            let raw = error.localizedDescription
            let message = friendlyError(raw)
            statusText = message
            attachments = pendingAttachments
            Task { await api.reportRuntimeIssue(message: raw, context: "ios.send", userText: text) }
            messages.append(ChatMessage(role: "assistant", content: message, provider: "JARVIS", createdAt: Date().timeIntervalSince1970 * 1000))
        }
        isSending = false
    }

    private func friendlyError(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("jarvis_temporary_unavailable") || lower.contains("temporarily unavailable") || lower.contains("service unavailable") {
            return "JARVIS kısa süreliğine yanıt yolunu değiştirdi. Birkaç saniye sonra tekrar dene."
        }
        if lower.contains("timed out") || lower.contains("timeout") || lower.contains("zaman aş") {
            return "Yanıt gecikti. JARVIS başka bir yolu deneyecek; mesajı tekrar gönderebilirsin."
        }
        if lower.contains("network") || lower.contains("internet") || lower.contains("connection") || lower.contains("bağlantı") {
            return "Bağlantı şu an kararsız. Mesajını kaybetmedim; tekrar deneyebilirsin."
        }
        return raw
    }

    func toggleVoice() {
        if isListening { voice.stopListening() }
        else { voice.startListening() }
    }

    private func consumePendingIntentIfNeeded() async {
        let defaults = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")
        guard let text = defaults?.string(forKey: "pendingIntentText"), !text.isEmpty else { return }
        defaults?.removeObject(forKey: "pendingIntentText")
        input = text
        await send()
    }

    func handle(url: URL) {
        guard url.scheme == "jarvis" else { return }
        if url.host == "voice" {
            voice.startListening()
            return
        }
        if url.host == "settings" {
            statusText = "Ayarları sol üst dişliden aç"
            return
        }
        if url.host == "share" {
            if let shared = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")?.string(forKey: "pendingShareText"), !shared.isEmpty {
                input = "Bunu incele ve bana gerekli olanı yap: \(shared)"
                UserDefaults(suiteName: "group.com.haydojarvis.jarvis")?.removeObject(forKey: "pendingShareText")
            }
            return
        }
        if url.host == "ask", let c = URLComponents(url: url, resolvingAgainstBaseURL: false), let q = c.queryItems?.first(where: {$0.name == "q"})?.value {
            input = q
            Task { await send() }
        }
    }
}
