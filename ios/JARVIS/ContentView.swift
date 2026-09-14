import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import UIKit

struct ContentView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.colorScheme) private var colorScheme
    @State private var showCamera = false
    @State private var showFiles = false
    @State private var showSettings = false
    @State private var photoItem: PhotosPickerItem?
    @FocusState private var composerFocused: Bool
    @FocusState private var loginPasswordFocused: Bool

    private let accent = Color(red: 0.06, green: 0.64, blue: 0.47)
    private var bg: Color { Color(uiColor: .systemBackground) }
    private var surface: Color { Color(uiColor: .secondarySystemBackground) }
    private var elevated: Color { Color(uiColor: .tertiarySystemBackground) }
    private var border: Color { Color(uiColor: .separator).opacity(0.28) }

    var body: some View {
        VStack(spacing: 0) {
            header
            chat
        }
        .background(bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .dynamicTypeSize(.small ... .xxLarge)
        .task { await state.bootstrap() }
        .fullScreenCover(isPresented: $state.showLogin) { loginView.environmentObject(state) }
        .sheet(isPresented: $showSettings) {
            SettingsView().environmentObject(state).presentationDetents([.large])
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { state.addAttachment($0) }.ignoresSafeArea()
        }
        .fileImporter(
            isPresented: $showFiles,
            allowedContentTypes: [.image, .pdf, .text, .data, .movie, .audio],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                for url in urls.prefix(4) {
                    do { state.addAttachment(try NativeAttachment.from(url: url)) }
                    catch { state.statusText = error.localizedDescription }
                }
            case .failure(let error): state.statusText = error.localizedDescription
            }
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                do {
                    if let data = try await item.loadTransferable(type: Data.self) {
                        await MainActor.run {
                            state.addAttachment(NativeAttachment(name: "photo-\(Int(Date().timeIntervalSince1970)).jpg", mimeType: "image/jpeg", data: data))
                            photoItem = nil
                        }
                    }
                } catch { await MainActor.run { state.statusText = error.localizedDescription } }
            }
        }
    }

    private var header: some View {
        HStack {
            Button { showSettings = true } label: {
                Image(systemName: "gearshape").font(.system(size: 20, weight: .semibold)).frame(width: 42, height: 42)
            }
            .buttonStyle(.plain)
            Spacer()
            VStack(spacing: 1) {
                Text("JARVIS").font(.system(size: 17, weight: .bold))
                Text(state.statusText).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Button { state.toggleVoice() } label: {
                Image(systemName: state.isListening ? "waveform.circle.fill" : "waveform.circle")
                    .font(.system(size: 29, weight: .medium))
                    .foregroundStyle(state.isListening ? accent : .primary)
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(bg)
        .overlay(alignment: .bottom) { Rectangle().fill(border).frame(height: 0.5) }
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if state.messages.isEmpty { emptyState }
                    ForEach(state.messages) { message in
                        messageRow(message).id(message.id)
                    }
                }
                .padding(.vertical, 8)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: state.messages.count) { _, _ in
                if let id = state.messages.last?.id {
                    withAnimation(.easeOut(duration: 0.18)) { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Circle().fill(accent.opacity(0.12)).frame(width: 64, height: 64)
                .overlay(Image(systemName: "sparkles").font(.system(size: 27, weight: .semibold)).foregroundStyle(accent))
            Text("JARVIS hazır").font(.title3.bold())
            Text("Sorunu yaz, dosya ekle veya mikrofona konuş.")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .padding(.top, 90)
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        if message.role == "user" {
            HStack(alignment: .bottom) {
                Spacer(minLength: 54)
                Text(message.content)
                    .font(.body)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
        } else {
            HStack(alignment: .top, spacing: 10) {
                Circle().fill(accent).frame(width: 28, height: 28)
                    .overlay(Text("J").font(.system(size: 13, weight: .bold)).foregroundStyle(.white))

                VStack(alignment: .leading, spacing: 8) {
                    Text(renderedAssistantText(message.content))
                        .font(.system(size: 17))
                        .foregroundStyle(.primary)
                        .tint(accent)
                        .lineSpacing(4)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)

                    if let provider = message.provider, !provider.isEmpty {
                        Text(provider.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
        }
    }

    private func renderedAssistantText(_ raw: String) -> AttributedString {
        var source = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\n\n\n", with: "\n\n")

        // Markdown olmayan çıplak http(s) bağlantılarını da tıklanabilir yap.
        if let regex = try? NSRegularExpression(pattern: #"(?<![<\(])https?://[^\s<>\)]+"#) {
            let range = NSRange(source.startIndex..<source.endIndex, in: source)
            for match in regex.matches(in: source, range: range).reversed() {
                guard let r = Range(match.range, in: source) else { continue }
                let url = String(source[r])
                source.replaceSubrange(r, with: "<\(url)>")
            }
        }

        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
        return (try? AttributedString(markdown: source, options: options)) ?? AttributedString(raw)
    }

    private var composer: some View {
        VStack(spacing: 7) {
            if !state.attachments.isEmpty { attachmentStrip }
            HStack(alignment: .bottom, spacing: 7) {
                Menu {
                    Button { showCamera = true } label: { Label("Kamera", systemImage: "camera") }
                    PhotosPicker(selection: $photoItem, matching: .images) { Label("Fotoğraflar", systemImage: "photo.on.rectangle") }
                    Button { showFiles = true } label: { Label("Dosya / PDF", systemImage: "doc") }
                } label: {
                    Image(systemName: "plus").font(.system(size: 19, weight: .semibold)).frame(width: 36, height: 36)
                }

                TextField("Mesaj yaz", text: $state.input, axis: .vertical)
                    .focused($composerFocused)
                    .lineLimit(1...5)
                    .font(.body)
                    .padding(.vertical, 10)
                    .submitLabel(.send)
                    .onSubmit { sendMessage() }

                Button(action: state.toggleVoice) {
                    Image(systemName: state.isListening ? "mic.fill" : "mic")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(state.isListening ? accent : .secondary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)

                Button { sendMessage() } label: {
                    Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .frame(width: 34, height: 34)
                        .background(canSend ? accent : Color(uiColor: .quaternaryLabel), in: Circle())
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(elevated, in: RoundedRectangle(cornerRadius: 25, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 25).stroke(border, lineWidth: 0.7))
            .padding(.horizontal, 12)

            Text("JARVIS hata yapabilir. Önemli bilgileri kontrol et.")
                .font(.caption2).foregroundStyle(.secondary).padding(.bottom, 1)
        }
        .padding(.top, 9)
        .padding(.bottom, 7)
        .background(bg.shadow(color: .black.opacity(colorScheme == .dark ? 0.32 : 0.07), radius: 10, y: -3))
    }

    private var attachmentStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(state.attachments) { attachment in
                    HStack(spacing: 7) {
                        Image(systemName: attachment.icon).foregroundStyle(accent)
                        Text(attachment.name).lineLimit(1).font(.caption)
                        Button { state.removeAttachment(attachment.id) } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(surface, in: Capsule())
                }
            }.padding(.horizontal, 12)
        }
    }

    private var canSend: Bool {
        !state.isSending && (!state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !state.attachments.isEmpty)
    }

    private func sendMessage() {
        guard canSend else { return }
        composerFocused = false
        Task { await state.send() }
    }

    private var loginView: some View {
        ZStack {
            bg.ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer()
                Circle().fill(accent).frame(width: 68, height: 68)
                    .overlay(Text("J").font(.system(size: 31, weight: .bold)).foregroundStyle(.white))
                VStack(spacing: 5) {
                    Text("JARVIS").font(.system(size: 34, weight: .bold))
                    Text("Devam etmek için giriş yap").font(.subheadline).foregroundStyle(.secondary)
                }
                VStack(spacing: 12) {
                    SecureField("Parola", text: $state.password)
                        .focused($loginPasswordFocused)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit { submitLogin() }
                        .padding(.horizontal, 14)
                        .frame(height: 52)
                        .background(surface, in: RoundedRectangle(cornerRadius: 14))

                    Button(action: submitLogin) {
                        HStack {
                            Spacer()
                            if state.isLoggingIn { ProgressView().tint(.white) }
                            Text(state.isLoggingIn ? "Giriş yapılıyor..." : "Giriş Yap").fontWeight(.semibold)
                            Spacer()
                        }.frame(height: 52)
                    }
                    .buttonStyle(.plain)
                    .background(loginCanSubmit ? accent : Color(uiColor: .systemGray3), in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)
                    .disabled(!loginCanSubmit)

                    if state.biometricLoginAvailable {
                        Button { Task { await state.loginWithBiometrics() } } label: {
                            Label(state.biometricLoginTitle, systemImage: "faceid")
                                .fontWeight(.semibold).frame(maxWidth: .infinity).frame(height: 50)
                        }
                        .buttonStyle(.plain)
                        .background(surface, in: RoundedRectangle(cornerRadius: 14))
                        .disabled(state.isLoggingIn)
                    }

                    if !state.loginStatusText.isEmpty {
                        Text(state.loginStatusText).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: 420)
                .padding(.horizontal, 22)
                Spacer()
            }
        }
        .interactiveDismissDisabled()
        .onAppear {
            state.refreshBiometricState()
            loginPasswordFocused = true
        }
    }

    private var loginCanSubmit: Bool {
        !state.isLoggingIn && !state.password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submitLogin() {
        guard loginCanSubmit else { return }
        loginPasswordFocused = false
        Task { await state.login() }
    }
}
