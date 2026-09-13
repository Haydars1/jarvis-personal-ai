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

    private var backgroundColor: Color {
        Color(uiColor: .systemBackground)
    }

    private var surfaceColor: Color {
        Color(uiColor: .secondarySystemBackground)
    }

    private var elevatedColor: Color {
        Color(uiColor: .tertiarySystemBackground)
    }

    private var borderColor: Color {
        Color(uiColor: .separator).opacity(0.35)
    }

    private var accentColor: Color {
        Color(red: 0.06, green: 0.64, blue: 0.47)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            chat
        }
        .background(backgroundColor.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            composer
        }
        .dynamicTypeSize(.small ... .xxLarge)
        .task { await state.bootstrap() }
        .fullScreenCover(isPresented: $state.showLogin) {
            loginView
                .environmentObject(state)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(state)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { state.addAttachment($0) }
                .ignoresSafeArea()
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
            case .failure(let error):
                state.statusText = error.localizedDescription
            }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                do {
                    if let data = try await newItem.loadTransferable(type: Data.self) {
                        await MainActor.run {
                            state.addAttachment(
                                NativeAttachment(
                                    name: "photo-\(Int(Date().timeIntervalSince1970)).jpg",
                                    mimeType: "image/jpeg",
                                    data: data
                                )
                            )
                            photoItem = nil
                        }
                    }
                } catch {
                    await MainActor.run { state.statusText = error.localizedDescription }
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button { showSettings = true } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .foregroundStyle(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Ayarlar")

            Spacer(minLength: 8)

            VStack(spacing: 2) {
                Text("JARVIS")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.primary)
                Text(state.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            Spacer(minLength: 8)

            Button { state.toggleVoice() } label: {
                Image(systemName: state.isListening ? "waveform.circle.fill" : "waveform.circle")
                    .font(.system(size: 29, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(state.isListening ? accentColor : .primary)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(state.isListening ? "Dinlemeyi durdur" : "Sesli konuş")
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .padding(.bottom, 8)
        .background(backgroundColor)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(borderColor)
                .frame(height: 0.5)
        }
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if state.messages.isEmpty {
                        emptyState
                    }

                    ForEach(state.messages) { message in
                        messageRow(message)
                            .id(message.id)
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 16)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: state.messages.count) { _, _ in
                if let id = state.messages.last?.id {
                    withAnimation(.easeOut(duration: 0.22)) {
                        proxy.scrollTo(id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.12))
                    .frame(width: 70, height: 70)
                Image(systemName: "sparkles")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(accentColor)
            }

            VStack(spacing: 6) {
                Text("JARVIS hazır")
                    .font(.title3.weight(.semibold))
                Text("Sorunu yaz, dosya ekle veya mikrofona konuş.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .padding(.top, 96)
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        if message.role == "user" {
            HStack(alignment: .bottom) {
                Spacer(minLength: 48)
                Text(message.content)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(surfaceColor, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
        } else {
            HStack(alignment: .top, spacing: 12) {
                assistantAvatar

                VStack(alignment: .leading, spacing: 8) {
                    Text(message.content)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)

                    if let provider = message.provider, !provider.isEmpty {
                        Text(provider.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(backgroundColor)
        }
    }

    private var assistantAvatar: some View {
        ZStack {
            Circle()
                .fill(accentColor)
                .frame(width: 28, height: 28)
            Text("J")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
        }
        .accessibilityHidden(true)
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if !state.attachments.isEmpty {
                attachmentStrip
            }

            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    Button { showCamera = true } label: {
                        Label("Kamera", systemImage: "camera")
                    }
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Fotoğraflar", systemImage: "photo.on.rectangle")
                    }
                    Button { showFiles = true } label: {
                        Label("Dosya / PDF", systemImage: "doc")
                    }
                } label: {
                    composerIcon("plus")
                }

                TextField("Mesaj yaz", text: $state.input, axis: .vertical)
                    .focused($composerFocused)
                    .lineLimit(1...5)
                    .font(.body)
                    .padding(.vertical, 11)
                    .submitLabel(.send)
                    .onSubmit { sendMessage() }

                Button(action: state.toggleVoice) {
                    Image(systemName: state.isListening ? "mic.fill" : "mic")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(state.isListening ? accentColor : .secondary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mikrofon")

                Button { sendMessage() } label: {
                    Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .frame(width: 34, height: 34)
                        .background(canSend ? accentColor : Color(uiColor: .quaternaryLabel), in: Circle())
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }
            .padding(.leading, 8)
            .padding(.trailing, 7)
            .padding(.vertical, 6)
            .background(elevatedColor, in: RoundedRectangle(cornerRadius: 25, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 25, style: .continuous)
                    .stroke(borderColor, lineWidth: 0.7)
            )
            .padding(.horizontal, 12)

            Text("JARVIS hata yapabilir. Önemli bilgileri kontrol et.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.bottom, 2)
        }
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(
            backgroundColor
                .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.35 : 0.08), radius: 12, y: -4)
        )
    }

    private var attachmentStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(state.attachments) { attachment in
                    HStack(spacing: 7) {
                        Image(systemName: attachment.icon)
                            .foregroundStyle(accentColor)
                        Text(attachment.name)
                            .lineLimit(1)
                            .font(.caption)
                        Button { state.removeAttachment(attachment.id) } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(surfaceColor, in: Capsule())
                }
            }
            .padding(.horizontal, 12)
        }
    }

    private var canSend: Bool {
        !state.isSending &&
        (!state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !state.attachments.isEmpty)
    }

    private func composerIcon(_ systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(.primary)
            .frame(width: 34, height: 34)
            .contentShape(Circle())
    }

    private func sendMessage() {
        guard canSend else { return }
        composerFocused = false
        Task { await state.send() }
    }

    private var loginView: some View {
        ZStack {
            backgroundColor.ignoresSafeArea()

            VStack(spacing: 26) {
                Spacer(minLength: 48)

                VStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(accentColor)
                            .frame(width: 68, height: 68)
                        Text("J")
                            .font(.system(size: 31, weight: .bold))
                            .foregroundStyle(.white)
                    }

                    VStack(spacing: 5) {
                        Text("JARVIS")
                            .font(.system(size: 34, weight: .semibold))
                        Text("Devam etmek için giriş yap")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(spacing: 12) {
                    SecureField("Parola", text: $state.password)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit { Task { await state.login() } }
                        .padding(.horizontal, 14)
                        .frame(height: 52)
                        .background(surfaceColor, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(borderColor, lineWidth: 0.7)
                        )

                    Button { Task { await state.login() } } label: {
                        HStack {
                            Spacer()
                            if state.isSending {
                                ProgressView().tint(.white)
                            } else {
                                Text("Giriş Yap").fontWeight(.semibold)
                            }
                            Spacer()
                        }
                        .frame(height: 52)
                    }
                    .buttonStyle(.plain)
                    .background(accentColor, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .foregroundStyle(.white)
                }
                .frame(maxWidth: 420)
                .padding(.horizontal, 22)

                Text("Oturum cihazda tutulur. API anahtarları uygulamaya indirilmez.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)

                Spacer(minLength: 32)
            }
        }
        .dynamicTypeSize(.small ... .xxLarge)
        .interactiveDismissDisabled()
    }
}
