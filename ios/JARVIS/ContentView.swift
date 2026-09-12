import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject var state: AppState
    @State private var showCamera = false
    @State private var showFiles = false
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.02, green: 0.03, blue: 0.08), Color(red: 0.03, green: 0.08, blue: 0.14)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                chat
                composer
            }

            if state.isListening {
                VStack(spacing: 16) {
                    ZStack {
                        Circle().fill(Color.cyan.opacity(0.12)).frame(width: 150, height: 150)
                        Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 2).frame(width: 118, height: 118)
                        Image(systemName: "waveform").font(.system(size: 45, weight: .semibold)).foregroundStyle(.cyan)
                    }
                    Text("Seni dinliyorum").font(.headline)
                    Text("Konuşman bitince JARVIS otomatik çalışacak").font(.caption).foregroundStyle(.secondary)
                    Button("Durdur") { state.toggleVoice() }.buttonStyle(.bordered)
                }
                .padding(28)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .padding(30)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .preferredColorScheme(.dark)
        .task { await state.bootstrap() }
        .sheet(isPresented: $state.showLogin) { loginView }
        .sheet(isPresented: $showCamera) {
            CameraPicker { state.addAttachment($0) }
                .ignoresSafeArea()
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
                } catch {
                    await MainActor.run { state.statusText = error.localizedDescription }
                }
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("JARVIS").font(.title2.bold()).foregroundStyle(.cyan)
                Text(state.statusText).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button { state.toggleVoice() } label: {
                Image(systemName: state.isListening ? "waveform.circle.fill" : "waveform.circle")
                    .font(.system(size: 30))
                    .foregroundStyle(state.isListening ? .green : .cyan)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
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
                                Text(m.content).textSelection(.enabled).foregroundStyle(.primary)
                                if m.role == "assistant" { Text("JARVIS").font(.caption2).foregroundStyle(.cyan) }
                            }
                            .padding(12)
                            .background(m.role == "user" ? Color.blue.opacity(0.22) : Color.white.opacity(0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            if m.role != "user" { Spacer(minLength: 42) }
                        }
                        .id(m.id)
                    }
                }
                .padding(14)
            }
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
                    }
                    .padding(.horizontal, 12)
                }
            }

            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    Button { showCamera = true } label: { Label("Kamera", systemImage: "camera") }
                    PhotosPicker(selection: $photoItem, matching: .images) { Label("Fotoğraflar", systemImage: "photo.on.rectangle") }
                    Button { showFiles = true } label: { Label("Dosya / PDF", systemImage: "doc") }
                } label: {
                    Image(systemName: "plus").font(.system(size: 20, weight: .semibold)).frame(width: 42, height: 42)
                        .background(Color.white.opacity(0.08)).clipShape(Circle())
                }

                Button(action: state.toggleVoice) {
                    Image(systemName: state.isListening ? "mic.fill" : "mic")
                        .font(.system(size: 20)).frame(width: 42, height: 42)
                        .background(Color.white.opacity(0.08)).clipShape(Circle())
                }

                TextField("JARVIS'e söyle…", text: $state.input, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(Color.white.opacity(0.07))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .submitLabel(.send)
                    .onSubmit { Task { await state.send() } }

                Button { Task { await state.send() } } label: {
                    Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                        .font(.headline.bold()).frame(width: 42, height: 42)
                        .background(Color.cyan).foregroundStyle(.black).clipShape(Circle())
                }
                .disabled(state.isSending || (state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && state.attachments.isEmpty))
            }
            .padding(.horizontal, 12)
        }
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private var loginView: some View {
        NavigationStack {
            Form {
                Section("JARVIS") {
                    SecureField("Parola", text: $state.password)
                    Button("Giriş Yap") { Task { await state.login() } }
                }
                Section {
                    Text("Giriş çerezi iOS URLSession içinde tutulur. API anahtarların uygulamaya indirilmez; Cloudflare kasasında kalır.")
                        .font(.footnote)
                }
            }
            .navigationTitle("JARVIS Giriş")
            .interactiveDismissDisabled()
        }
    }
}
