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
                consumePendingSharedContentIfNeeded()
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
            do { try biometricStore.savePassword(typedPassword); refreshBiometricState() }
            catch { loginStatusText = "Giriş tamam. Face ID kaydedilemedi: \(error.localizedDescription)" }
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
        guard biometricLoginAvailable else { loginStatusText = "Önce parolayla giriş yap. Sonra Face ID aktif olur."; return }
        isLoggingIn = true
        loginStatusText = "Face ID bekleniyor..."
        do { let savedPassword = try biometricStore.readPassword(); try await completeLogin(password: savedPassword); password = "" }
        catch { let message = friendlyError(error.localizedDescription); loginStatusText = message; statusText = message }
        isLoggingIn = false
    }

    private func completeLogin(password: String) async throws {
        try await api.login(password: password)
        showLogin = false
        loginStatusText = ""
        try await loadHistory()
        await NotificationManager.shared.syncPendingToken()
        await consumePendingIntentIfNeeded()
        consumePendingSharedContentIfNeeded()
        statusText = "Hazır"
    }

    func loadHistory() async throws { messages = try await api.history() }
    func addAttachment(_ attachment: NativeAttachment) { guard attachments.count < 4 else { statusText = "En fazla 4 dosya eklenebilir"; return }; attachments.append(attachment) }
    func removeAttachment(_ id: UUID) { attachments.removeAll { $0.id == id } }
    func startQuickAction(_ text: String) { guard !isSending else { statusText = "JARVIS zaten çalışıyor..."; return }; input = text; Task { await send() } }

    func send() async {
        let typed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (!typed.isEmpty || !attachments.isEmpty), !isSending else { return }
        let text = typed.isEmpty ? "Bu dosyaları incele ve ihtiyacım olan sonucu ver." : typed
        let pendingAttachments = attachments
        input = ""; attachments = []; isSending = true; statusText = "JARVIS çalışıyor..."
        let visible = pendingAttachments.isEmpty ? text : "\(text)\n📎 \(pendingAttachments.map(\.name).joined(separator: ", "))"
        messages.append(ChatMessage(role: "user", content: visible, provider: nil, createdAt: Date().timeIntervalSince1970 * 1000))
        do {
            let result = try await api.send(text: text, attachments: pendingAttachments)
            var updatedHistory = result.history
            // Some providers can return a reply before the persisted history catches up.
            // Never leave the UI showing a visibly truncated assistant answer.
            let reply = result.reply.trimmingCharacters(in: .whitespacesAndNewlines)
            if !reply.isEmpty {
                if let last = updatedHistory.last, last.role == "assistant" {
                    if reply.count > last.content.count {
                        updatedHistory[updatedHistory.count - 1] = ChatMessage(role: "assistant", content: reply, provider: result.provider, createdAt: Date().timeIntervalSince1970 * 1000)
                    }
                } else {
                    updatedHistory.append(ChatMessage(role: "assistant", content: reply, provider: result.provider, createdAt: Date().timeIntervalSince1970 * 1000))
                }
            }
            messages = updatedHistory
            statusText = "Hazır"
        } catch {
            let raw = error.localizedDescription
            statusText = "Yanıt tamamlanıyor..."
            attachments = pendingAttachments
            Task { await api.reportRuntimeIssue(message: raw, context: "ios.send", userText: text) }
            // The Worker may finish and persist the answer after the client request ends.
            // Reconcile history in-place instead of showing a false permanent failure that only disappears after app restart.
            var recovered = false
            for delay in [1_500_000_000, 3_000_000_000, 5_000_000_000] as [UInt64] {
                try? await Task.sleep(nanoseconds: delay)
                do {
                    let history = try await api.history()
                    if historyContainsAnswer(history, for: text) {
                        messages = history
                        statusText = "Hazır"
                        recovered = true
                        break
                    }
                } catch { }
            }
            if !recovered {
                let message = friendlyError(raw)
                statusText = message
                messages.append(ChatMessage(role: "assistant", content: message, provider: "JARVIS", createdAt: Date().timeIntervalSince1970 * 1000))
            }
        }
        isSending = false
    }

    private func historyContainsAnswer(_ history: [ChatMessage], for text: String) -> Bool {
        guard let userIndex = history.lastIndex(where: { $0.role == "user" && $0.content.contains(text) }) else { return false }
        let next = history.index(after: userIndex)
        guard next < history.endIndex else { return false }
        return history[next...].contains { $0.role == "assistant" && !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private func friendlyError(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("jarvis_temporary_unavailable") || lower.contains("temporarily unavailable") || lower.contains("service unavailable") { return "JARVIS kısa süreliğine yanıt yolunu değiştirdi. Birkaç saniye sonra tekrar dene." }
        if lower.contains("timed out") || lower.contains("timeout") || lower.contains("zaman aş") { return "Yanıt gecikti. JARVIS cevabı tamamlayamadı; tekrar gönderebilirsin." }
        if lower.contains("network") || lower.contains("internet") || lower.contains("connection") || lower.contains("bağlantı") { return "Bağlantı şu an kararsız. Mesajını kaybetmedim; tekrar deneyebilirsin." }
        return raw
    }


    private func consumePendingSharedContentIfNeeded() {
        let suite = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")
        if let sharedText = suite?.string(forKey: "pendingShareText"), !sharedText.isEmpty {
            if input.isEmpty { input = "Bunu incele ve gerekli olanı yap: \(sharedText)" }
            suite?.removeObject(forKey: "pendingShareText")
        }

        guard let names = suite?.stringArray(forKey: "pendingShareFiles"), !names.isEmpty,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.haydojarvis.jarvis") else { return }
        let inbox = container.appendingPathComponent("SharedInbox", isDirectory: true)
        var added = 0
        for name in names.prefix(4) {
            let url = inbox.appendingPathComponent(name)
            do {
                let attachment = try NativeAttachment.from(url: url)
                addAttachment(attachment)
                added += 1
                try? FileManager.default.removeItem(at: url)
            } catch {
                statusText = "Paylaşılan dosya açılamadı: \(error.localizedDescription)"
            }
        }
        suite?.removeObject(forKey: "pendingShareFiles")
        if added > 0 { statusText = added == 1 ? "Paylaşılan dosya eklendi" : "\(added) paylaşılan dosya eklendi" }
    }

    func toggleVoice() { if isListening { voice.stopListening() } else { voice.startListening() } }
    private func consumePendingIntentIfNeeded() async { let defaults=UserDefaults(suiteName:"group.com.haydojarvis.jarvis"); guard let text=defaults?.string(forKey:"pendingIntentText"),!text.isEmpty else{return}; defaults?.removeObject(forKey:"pendingIntentText"); input=text; await send() }
    func handle(url: URL) {
        guard url.scheme == "jarvis" else { return }
        if url.host == "voice" { voice.startListening(); return }
        if url.host == "settings" { statusText = "Ayarları sol üst dişliden aç"; return }
        if url.host == "share" { consumePendingSharedContentIfNeeded(); return }
        if url.host == "ask", let c=URLComponents(url:url,resolvingAgainstBaseURL:false), let q=c.queryItems?.first(where:{$0.name=="q"})?.value { input=q; Task { await send() } }
    }
}
