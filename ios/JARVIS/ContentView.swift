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
            LinearGradient(colors: [Color(red: 0.02, green: 0.03, blue: 0.08), Color(red: 0.03, green: 0.08, blue: 0.14)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                chat
                composer
            }
        }
        .preferredColorScheme(.dark)
        .task { await state.bootstrap() }
        .sheet(isPresented: $state.showLogin) { loginView }
        .sheet(isPresented: $showCamera) {
            CameraPicker { state.addAttachment($0) }.ignoresSafeArea()
        }
        .fileImporter(isPresented: $showFiles, allowedContentTypes: [.image, .pdf, .text, .data, .movie, .audio], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls):
                for url in urls.prefix(4) {
                    do { state.addAttachment(try NativeAttachment.from(url: url)) }
                    catch { state.statusText = error.localizedDescription }
                }
            case .failure(let error): state.statusText = error.localizedDescription
            }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                do {
                    if let data = try await newItem.loadTransferable(type: Data.self) {
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
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("JARVIS").font(.title2.bold()).foregroundStyle(.cyan)
                Text(state.statusText).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Button { state.toggleVoice() } label: {
                Image(systemName: state.isListening ? "waveform.circle.fill" : "waveform.circle")
                    .font(.system(size: 30)).foregroundStyle(state.isListening ? .green : .cyan)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(state.messages) { m in
                        HStack {
                            if m.role == "user" { Spacer(minLength: 42) }
                            VStack(alignment: .leading, spacing: 5) {
                                Text(m.content).textSelection(.enabled).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                                if m.role == "assistant" { Text("JARVIS").font(.caption2).foregroundStyle(.cyan) }
                            }
                            .padding(12)
                            .background(m.role == "user" ? Color.blue.opacity(0.22) : Color.white.opacity(0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            if m.role != "user" { Spacer(minLength: 42) }
                        }.id(m.id)
                    }
                }.padding(14)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: state.messages.count) { _, _ in
                if let id = state.messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if !state.attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(state.attachments) { a in
                            HStack(spacing: 6) {
                                Image(systemName: a.icon)
                                Text(a.name).lineLimit(1).font(.caption)
                                Button { state.removeAttachment(a.id) } label: { Image(systemName: "xmark.circle.fill") }
                            }
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(Color.white.opacity(0.08), in: Capsule())
                        }
                    }.padding(.horizontal, 12)
                }
            }

            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    Button { showCamera = true } label: { Label("Kamera", systemImage: "camera") }
                    PhotosPicker(selection: $photoItem, matching: .images) { Label("Fotoğraflar", systemImage: "photo.on.rectangle") }
                    Button { showFiles = true } label: { Label("Dosya / PDF", systemImage: "doc") }
                } label: {
                    Image(systemName: "plus").font(.system(size: 19, weight: .semibold)).frame(width: 40, height: 40)
                        .background(Color.white.opacity(0.08)).clipShape(Circle())
                }

                Button(action: state.toggleVoice) {
                    Image(systemName: state.isListening ? "mic.fill" : "mic").font(.system(size: 19)).frame(width: 40, height: 40)
                        .background(Color.white.opacity(0.08)).clipShape(Circle())
                }

                TextField("JARVIS'e söyle…", text: $state.input, axis: .vertical)
                    .focused($composerFocused)
                    .lineLimit(1...4)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(Color.white.opacity(0.07))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .submitLabel(.send)
                    .onSubmit { sendMessage() }

                Button { sendMessage() } label: {
                    Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                        .font(.headline.bold()).frame(width: 40, height: 40)
                        .background(Color.cyan).foregroundStyle(.black).clipShape(Circle())
                }
                .disabled(state.isSending || (state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && state.attachments.isEmpty))
            }
            .padding(.horizontal, 12)
        }
        .padding(.top, 8).padding(.bottom, 8)
        .background(.ultraThinMaterial)
    }

    private func sendMessage() {
        guard !state.isSending else { return }
        composerFocused = false
        Task { await state.send() }
    }

    private var loginView: some View {
        ZStack {
            LinearGradient(colors: [Color.black, Color(red: 0.02, green: 0.08, blue: 0.14)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 22) {
                    Spacer(minLength: 38)
                    Image(systemName: "waveform.circle.fill").font(.system(size: 72)).foregroundStyle(.cyan)
                    VStack(spacing: 5) {
                        Text("JARVIS").font(.system(size: 42, weight: .bold))
                        Text("Kişisel AI Asistanınız").foregroundStyle(.secondary)
                    }
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Giriş Yap").font(.title.bold())
                        SecureField("Parola", text: $state.password)
                            .textContentType(.password)
                            .padding(14)
                            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        Button { Task { await state.login() } } label: {
                            Text("Giriş Yap").fontWeight(.semibold).frame(maxWidth: .infinity).padding(.vertical, 13)
                        }
                        .buttonStyle(.borderedProminent).tint(.cyan).foregroundStyle(.black)
                        Text("Giriş çerezi cihazda güvenli oturum içinde tutulur. API anahtarları uygulamaya indirilmez; Cloudflare kasasında kalır.")
                            .font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(22)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    Spacer(minLength: 24)
                }.padding(.horizontal, 20)
            }
        }
        .interactiveDismissDisabled()
    }
}
