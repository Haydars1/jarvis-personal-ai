import SwiftUI

struct ContentView: View {
    @EnvironmentObject var state: AppState

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
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("JARVIS").font(.title2.bold()).foregroundStyle(.cyan)
                Text(state.statusText).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                state.toggleVoice()
            } label: {
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
                                Text(m.content)
                                    .textSelection(.enabled)
                                    .foregroundStyle(.primary)
                                if m.role == "assistant" {
                                    Text("JARVIS").font(.caption2).foregroundStyle(.cyan)
                                }
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
        HStack(alignment: .bottom, spacing: 10) {
            Button(action: state.toggleVoice) {
                Image(systemName: state.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 21))
                    .frame(width: 42, height: 42)
                    .background(Color.white.opacity(0.08))
                    .clipShape(Circle())
            }
            TextField("JARVIS'e söyle…", text: $state.input, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Color.white.opacity(0.07))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .submitLabel(.send)
                .onSubmit { Task { await state.send() } }
            Button {
                Task { await state.send() }
            } label: {
                Image(systemName: state.isSending ? "hourglass" : "arrow.up")
                    .font(.headline.bold())
                    .frame(width: 42, height: 42)
                    .background(Color.cyan)
                    .foregroundStyle(.black)
                    .clipShape(Circle())
            }
            .disabled(state.isSending || state.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 12)
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
