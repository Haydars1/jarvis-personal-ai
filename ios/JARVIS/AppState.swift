import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input: String = ""
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
            if auth.authenticated { try await loadHistory() }
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
        } catch {
            statusText = error.localizedDescription
        }
    }

    func loadHistory() async throws {
        messages = try await api.history()
    }

    func send() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }
        input = ""
        isSending = true
        statusText = "JARVIS çalışıyor…"
        messages.append(ChatMessage(role: "user", content: text, provider: nil, createdAt: Date().timeIntervalSince1970 * 1000))
        do {
            let result = try await api.send(text: text)
            messages = result.history
            statusText = "Hazır"
            voice.speak(result.reply)
        } catch {
            statusText = error.localizedDescription
            messages.append(ChatMessage(role: "assistant", content: "Bağlantı hatası: \(error.localizedDescription)", provider: "JARVIS", createdAt: Date().timeIntervalSince1970 * 1000))
        }
        isSending = false
    }

    func toggleVoice() {
        if isListening { voice.stopListening() }
        else { voice.startListening() }
    }

    func handle(url: URL) {
        guard url.scheme == "jarvis" else { return }
        if url.host == "voice" { voice.startListening() }
        if url.host == "ask", let c = URLComponents(url: url, resolvingAgainstBaseURL: false), let q = c.queryItems?.first(where: {$0.name == "q"})?.value {
            input = q
            Task { await send() }
        }
    }
}
