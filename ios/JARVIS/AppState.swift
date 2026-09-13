import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input: String = ""
    @Published var attachments: [NativeAttachment] = []
    @Published var isSending = false
    @Published var isListening = false
    @Published var statusText = "Hazır"
    @Published var showLogin = false
    @Published var password = ""

    let api = JarvisAPI()
    let voice = VoiceEngine()

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
        do {
            let auth = try await api.authStatus()
            showLogin = !auth.authenticated
            if auth.authenticated {
                try await loadHistory()
                await NotificationManager.shared.syncPendingToken()
                await consumePendingIntentIfNeeded()
            }
        } catch {
            statusText = error.localizedDescription
        }
    }

    func login() async {
        do {
            try await api.login(password: password)
            password = ""
            showLogin = false
            try await loadHistory()
            await NotificationManager.shared.syncPendingToken()
            await consumePendingIntentIfNeeded()
        } catch {
            statusText = error.localizedDescription
        }
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
            statusText = "JARVIS zaten çalışıyor…"
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
        statusText = "JARVIS çalışıyor…"
        let visible = pendingAttachments.isEmpty ? text : "\(text)\n📎 \(pendingAttachments.map(\.name).joined(separator: ", "))"
        messages.append(ChatMessage(role: "user", content: visible, provider: nil, createdAt: Date().timeIntervalSince1970 * 1000))
        do {
            let result = try await api.send(text: text, attachments: pendingAttachments)
            messages = result.history
            statusText = "Hazır"
            voice.speak(result.reply)
        } catch {
            let message = error.localizedDescription
            statusText = message
            attachments = pendingAttachments
            Task { await api.reportRuntimeIssue(message: message, context: "ios.send", userText: text) }
            messages.append(ChatMessage(role: "assistant", content: "Bu hatayı gördüm ve kendi düzeltme hattıma bildirdim: \(message)", provider: "JARVIS", createdAt: Date().timeIntervalSince1970 * 1000))
        }
        isSending = false
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
            statusText = "Ayarları sağ üst dişliden aç"
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
