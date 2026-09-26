import SwiftUI

struct EcuChatView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var attachments: [NativeAttachment] = []
    @State private var activeFiles: [NativeAttachment] = []
    @State private var channels: [EcuChannel] = []
    @State private var searchText = ""
    @State private var currentChannelId: String?
    @State private var currentChannelTitle = "Yeni ECU dosyası"
    @State private var sending = false
    @State private var loadingChannels = false
    @State private var showFiles = false
    @State private var showDashboard = false
    @State private var showChannels = false

    private let api = JarvisAPI()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                channelHeader
                chat
                fileStrip
                composer
            }
            .navigationTitle("ECU Brain")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kapat") { dismiss() }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        Task {
                            await loadChannels()
                            showChannels = true
                        }
                    } label: {
                        Image(systemName: "sidebar.left")
                    }
                    Button {
                        showDashboard = true
                    } label: {
                        Image(systemName: "gauge.with.dots.needle.67percent")
                    }
                }
            }
        }
        .sheet(isPresented: $showDashboard) {
            EcuBrainView().presentationDetents([.large])
        }
        .sheet(isPresented: $showChannels) {
            channelBrowser
        }
        .sheet(isPresented: $showFiles) {
            UniversalDocumentPicker(allowsMultipleSelection: true) { urls in
                showFiles = false
                var selected: [NativeAttachment] = []
                for url in urls.prefix(2) {
                    if let attachment = try? NativeAttachment.from(url: url) {
                        selected.append(attachment)
                    }
                }
                if !selected.isEmpty {
                    attachments = selected
                }
            } onCancel: {
                showFiles = false
            }
            .ignoresSafeArea()
        }
        .task {
            await loadChannels()
        }
    }

    private var channelHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: currentChannelId == nil ? "doc.badge.plus" : "memorychip")
                .foregroundStyle(currentChannelId == nil ? Color.blue : Color.green)

            VStack(alignment: .leading, spacing: 2) {
                Text(currentChannelTitle)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)

                if let channelId = currentChannelId {
                    Text("Kanal • \(String(channelId.prefix(8)))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Dosya yükleyince ayrı kanal oluşturulur")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Button {
                Task {
                    await loadChannels()
                    showChannels = true
                }
            } label: {
                Image(systemName: "magnifyingglass")
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(Color(uiColor: .secondarySystemBackground))
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if messages.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "waveform.path.ecg.rectangle")
                                .font(.system(size: 42))
                            Text("ECU Brain Sohbeti")
                                .font(.title2.bold())
                            Text("Her ECU dosyasının ayrı sohbet kanalı olur. Dosya adı, model/HW/SW ve sohbet içeriği daha sonra genel aramadan bulunabilir.")
                                .multilineTextAlignment(.center)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 70)
                        .padding(.horizontal, 24)
                    }

                    ForEach(messages) { message in
                        HStack {
                            if message.role == "user" { Spacer(minLength: 40) }

                            Text(message.content)
                                .textSelection(.enabled)
                                .padding(12)
                                .background(
                                    message.role == "user" ? Color.secondary.opacity(0.16) : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 16)
                                )

                            if message.role != "user" { Spacer(minLength: 24) }
                        }
                        .id(message.id)
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) { _, _ in
                if let last = messages.last {
                    withAnimation(.easeOut(duration: 0.18)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var fileStrip: some View {
        if !attachments.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(attachments) { file in
                        HStack {
                            Image(systemName: "doc.badge.plus")
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Yeni kanal dosyası")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text(file.name)
                                    .font(.caption)
                                    .lineLimit(1)
                            }
                            Button {
                                attachments.removeAll { $0.id == file.id }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                            }
                        }
                        .padding(8)
                        .background(Color.blue.opacity(0.10), in: Capsule())
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 6)
        } else if !activeFiles.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(activeFiles) { file in
                        HStack {
                            Image(systemName: "memorychip")
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Bu kanalın aktif dosyası")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text(file.name)
                                    .font(.caption)
                                    .lineLimit(1)
                            }
                        }
                        .padding(8)
                        .background(Color.green.opacity(0.10), in: Capsule())
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 6)
        } else if currentChannelId != nil {
            HStack(spacing: 7) {
                Image(systemName: "exclamationmark.triangle")
                Text("Bu kanalın sohbeti bulundu; BIN dosyası bu telefonda yoksa dosya işlemi için yeniden seçmen gerekir.")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Button {
                showFiles = true
            } label: {
                Image(systemName: "plus")
                    .frame(width: 38, height: 38)
            }

            TextField("ECU Brain'e yaz", text: $input, axis: .vertical)
                .lineLimit(1...5)
                .padding(10)

            Button {
                Task { await send() }
            } label: {
                Image(systemName: sending ? "hourglass" : "arrow.up")
                    .frame(width: 38, height: 38)
                    .background(Color.accentColor, in: Circle())
                    .foregroundStyle(.white)
            }
            .disabled(!canSend)
        }
        .padding()
        .background(.thinMaterial)
    }

    private var canSend: Bool {
        !sending && (
            !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !attachments.isEmpty ||
            !activeFiles.isEmpty
        )
    }

    private var channelBrowser: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Dosya, model, HW/SW veya sohbet içinde ara", text: $searchText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit {
                            Task { await loadChannels(query: searchText) }
                        }
                    if !searchText.isEmpty {
                        Button {
                            searchText = ""
                            Task { await loadChannels() }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal, 14)
                .padding(.top, 10)

                HStack {
                    Button {
                        Task { await loadChannels(query: searchText) }
                    } label: {
                        Label("ARA", systemImage: "magnifyingglass")
                    }
                    .buttonStyle(.borderedProminent)

                    Button {
                        startNewChannel()
                        showChannels = false
                        showFiles = true
                    } label: {
                        Label("YENİ DOSYA", systemImage: "plus")
                    }
                    .buttonStyle(.bordered)

                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)

                if loadingChannels {
                    ProgressView()
                        .padding()
                }

                List(channels) { channel in
                    Button {
                        Task {
                            await openChannel(channel)
                            showChannels = false
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Image(systemName: "memorychip")
                                Text(channel.title.isEmpty ? channel.fileName : channel.title)
                                    .font(.headline)
                                    .lineLimit(1)
                                Spacer()
                            }

                            if !channel.fileName.isEmpty && channel.fileName != channel.title {
                                Text(channel.fileName)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }

                            if let match = channel.matchMessage, !match.isEmpty {
                                Text("Bulunan: \(match)")
                                    .font(.caption)
                                    .foregroundStyle(.blue)
                                    .lineLimit(2)
                            } else if let last = channel.lastMessage, !last.isEmpty {
                                Text(last)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }

                            if !channel.fileSha256.isEmpty {
                                Text("SHA256 \(channel.fileSha256.prefix(12))…")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
            .navigationTitle("ECU Kanalları")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { showChannels = false }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func send() async {
        guard canSend else { return }

        let typed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = typed.isEmpty ? "Bu BIN dosyasını analiz et ve sonucu ver." : typed

        let newlySelected = attachments
        let isNewFileChannel = !newlySelected.isEmpty
        let files = isNewFileChannel ? newlySelected : activeFiles
        let targetChannelId = isNewFileChannel ? nil : currentChannelId

        input = ""
        attachments = []
        sending = true

        let visible = files.isEmpty ? text : "\(text)\n📎 \(files.map(\.name).joined(separator: ", "))"
        messages.append(ChatMessage(role: "user", content: visible, createdAt: Date().timeIntervalSince1970 * 1000))

        do {
            let response = try await api.send(
                text: text,
                attachments: files,
                channel: "ecu",
                channelId: targetChannelId
            )

            if let channelId = response.channelId, !channelId.isEmpty {
                currentChannelId = channelId

                if isNewFileChannel {
                    activeFiles = files
                    currentChannelTitle = files.first?.name ?? "ECU Sohbeti"
                    persistFiles(files, channelId: channelId)
                } else if currentChannelTitle == "Yeni ECU dosyası" {
                    currentChannelTitle = files.first?.name ?? "ECU Sohbeti"
                }
            }

            messages = response.history.isEmpty
                ? messages + [ChatMessage(role: "assistant", content: response.reply, provider: response.provider, createdAt: Date().timeIntervalSince1970 * 1000)]
                : response.history

            await loadChannels()
        } catch {
            if isNewFileChannel {
                attachments = files
            }
            messages.append(
                ChatMessage(
                    role: "assistant",
                    content: "ECU Brain hatası: \(error.localizedDescription)",
                    provider: "JARVIS ECU Brain",
                    createdAt: Date().timeIntervalSince1970 * 1000
                )
            )
        }

        sending = false
    }

    private func loadChannels(query: String = "") async {
        loadingChannels = true
        defer { loadingChannels = false }

        do {
            channels = try await api.ecuChannels(query: query)
        } catch {
            channels = []
        }
    }

    private func openChannel(_ channel: EcuChannel) async {
        do {
            let history = try await api.ecuChannelMessages(channel.id)
            currentChannelId = channel.id
            currentChannelTitle = channel.title.isEmpty
                ? (channel.fileName.isEmpty ? "ECU Sohbeti" : channel.fileName)
                : channel.title
            messages = history
            attachments = []
            activeFiles = loadFiles(channelId: channel.id)
        } catch {
            messages = [
                ChatMessage(
                    role: "assistant",
                    content: "Kanal açılamadı: \(error.localizedDescription)",
                    provider: "JARVIS ECU Brain",
                    createdAt: Date().timeIntervalSince1970 * 1000
                )
            ]
        }
    }

    private func startNewChannel() {
        currentChannelId = nil
        currentChannelTitle = "Yeni ECU dosyası"
        messages = []
        attachments = []
        activeFiles = []
        searchText = ""
    }

    private struct StoredFile: Codable {
        let name: String
        let mimeType: String
        let filename: String
    }

    private var channelsDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("JARVIS/ecu-channels", isDirectory: true)
    }

    private func channelDirectory(_ channelId: String) -> URL {
        channelsDirectory.appendingPathComponent(channelId, isDirectory: true)
    }

    private func persistFiles(_ files: [NativeAttachment], channelId: String) {
        do {
            let fm = FileManager.default
            let dir = channelDirectory(channelId)
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)

            if let existing = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
                for url in existing {
                    try? fm.removeItem(at: url)
                }
            }

            var manifest: [StoredFile] = []
            for (index, item) in files.prefix(2).enumerated() {
                let storedName = "file-\(index).bin"
                try item.data.write(to: dir.appendingPathComponent(storedName), options: .atomic)
                manifest.append(
                    StoredFile(name: item.name, mimeType: item.mimeType, filename: storedName)
                )
            }

            let data = try JSONEncoder().encode(manifest)
            try data.write(to: dir.appendingPathComponent("manifest.json"), options: .atomic)
        } catch { }
    }

    private func loadFiles(channelId: String) -> [NativeAttachment] {
        let dir = channelDirectory(channelId)
        guard
            let manifestData = try? Data(contentsOf: dir.appendingPathComponent("manifest.json")),
            let manifest = try? JSONDecoder().decode([StoredFile].self, from: manifestData)
        else {
            return []
        }

        return manifest.compactMap { item in
            guard let data = try? Data(contentsOf: dir.appendingPathComponent(item.filename)) else {
                return nil
            }
            return NativeAttachment(name: item.name, mimeType: item.mimeType, data: data)
        }
    }
}
