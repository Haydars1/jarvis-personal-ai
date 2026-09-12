import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject var state: AppState
    @State private var showCamera = false
    @State private var showFiles = false
    @State private var photoItem: PhotosPickerItem?
    @FocusState private var composerFocused: Bool

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.015, green: 0.02, blue: 0.055), Color(red: 0.02, green: 0.075, blue: 0.12)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                chat
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            composer
        }
        .preferredColorScheme(.dark)
        .dynamicTypeSize(.small ... .xxLarge)
        .task { await state.bootstrap() }
        .fullScreenCover(isPresented: $state.showLogin) {
            loginView
                .environmentObject(state)
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
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("JARVIS")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(.cyan)
                Text(state.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 12)

            Button { state.toggleVoice() } label: {
                Image(systemName: state.isListening ? "waveform.circle.fill" : "waveform.circle")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundStyle(state.isListening ? .green : .cyan)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(state.isListening ? "Dinlemeyi durdur" : "Sesli konuş")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if state.messages.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 32))
                                .foregroundStyle(.cyan)
                            Text("Hazırım")
                                .font(.headline)
                            Text("Bir şey yaz veya mikrofonla konuş.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 56)
                    }

                    ForEach(state.messages) { message in
                        messageBubble(message)
                            .id(message.id)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: state.messages.count) { _, _ in
                if let id = state.messages.last?.id {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(id, anchor: .bottom)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func messageBubble(_ message: ChatMessage) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == "user" { Spacer(minLength: 48) }

            VStack(alignment: .leading, spacing: 6) {
                Text(message.content)
                    .font(.body)
                    .textSelection(.enabled)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)

                if message.role == "assistant" {
                    Text("JARVIS")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.cyan)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                message.role == "user" ? Color.blue.opacity(0.24) : Color.white.opacity(0.075),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )

            if message.role != "user" { Spacer(minLength: 48) }
        }
        .frame(maxWidth: .infinity)
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if !state.attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(state.attachments) { attachment in
                            HStack(spacing: 6) {
                                Image(systemName: attachment.icon)
                                Text(attachment.name)
                                    .lineLimit(1)
                                    .font(.caption)
                                Button { state.removeAttachment(attachment.id) } label: {
                                    Image(systemName: "xmark.circle.fill")
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Color.white.opacity(0.08), in: Capsule())
                        }
                    }
                    .padding(.horizontal, 12)
                }
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

                Button(action: state.toggleVoice) {
                    composerIcon(state.isListening ? "mic.fill" : "mic")
                }
                .buttonStyle(.plain)

                TextField("JARVIS'e söyle…", text: $state.input, axis: .vertical)
                    .focused($composerFocused)
                    .lineLimit(1...4)
                    .font(.body)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.075))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .submitLabel(.send)
                    .onSubmit { sendMessage() }

                Button { sendMessage() } label: {
                    Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 42, height: 42)
                        .background(Color.cyan)
                        .foregroundStyle(.black)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(
                    state.isSending ||
                    (state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && state.attachments.isEmpty)
                )
                .opacity(
                    state.isSending ||
                    (state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && state.attachments.isEmpty)
                    ? 0.45 : 1
                )
            }
            .padding(.horizontal, 10)
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(.ultraThinMaterial)
    }

    private func composerIcon(_ systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 18, weight: .semibold))
            .frame(width: 42, height: 42)
            .background(Color.white.opacity(0.08))
            .clipShape(Circle())
    }

    private func sendMessage() {
        guard !state.isSending else { return }
        composerFocused = false
        Task { await state.send() }
    }

    private var loginView: some View {
        ZStack {
            LinearGradient(
                colors: [Color.black, Color(red: 0.015, green: 0.07, blue: 0.11)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    Spacer(minLength: 44)

                    Image(systemName: "waveform.circle.fill")
                        .font(.system(size: 70))
                        .foregroundStyle(.cyan)
                        .accessibilityHidden(true)

                    VStack(spacing: 6) {
                        Text("JARVIS")
                            .font(.system(size: 38, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)
                            .minimumScaleFactor(0.8)
                        Text("Kişisel AI Asistanın")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Giriş Yap")
                            .font(.title2.bold())

                        SecureField("Parola", text: $state.password)
                            .textContentType(.password)
                            .submitLabel(.go)
                            .onSubmit { Task { await state.login() } }
                            .padding(.horizontal, 14)
                            .frame(height: 52)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                        Button { Task { await state.login() } } label: {
                            HStack {
                                Spacer()
                                if state.isSending {
                                    ProgressView().tint(.black)
                                } else {
                                    Text("Giriş Yap").fontWeight(.bold)
                                }
                                Spacer()
                            }
                            .frame(height: 52)
                        }
                        .buttonStyle(.plain)
                        .background(Color.cyan)
                        .foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                        Text("Oturum bilgisi cihazında güvenli şekilde tutulur. API anahtarları uygulamaya indirilmez.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(18)
                    .background(Color.white.opacity(0.055))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                    Spacer(minLength: 32)
                }
                .frame(maxWidth: 520)
                .padding(.horizontal, 20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .preferredColorScheme(.dark)
        .dynamicTypeSize(.small ... .xxLarge)
        .interactiveDismissDisabled()
    }
}
