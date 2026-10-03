import SwiftUI

private struct YouTubeTeachingSource: Codable, Identifiable, Hashable {
    let id: String
    let jobId: String
    let url: String
    var status: String
    var answer: String?
    var error: String?
    var learningStatus: String?
    var learningChunks: Int?
    var queuedVideos: Int?
    let createdAt: Date

    var statusLabel: String {
        switch learningStatus?.lowercased() {
        case "learned": return "Öğrenildi"
        case "index-queued": return "Videolar öğreniliyor"
        case "no-transcript": return "Transkript bulunamadı"
        default: break
        }
        switch status.lowercased() {
        case "queued", "running": return "Analiz ediliyor"
        case "completed": return "İşlendi"
        case "failed": return "Hata"
        default: return status
        }
    }

    var isLearned: Bool { learningStatus?.lowercased() == "learned" }
}

struct YouTubeTeachingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var sourceURL = ""
    @State private var history: [YouTubeTeachingSource] = []
    @State private var isSubmitting = false
    @State private var statusText = "YouTube videosu veya kanal linki ekle."

    private let api = JarvisAPI()
    private let storageKey = "jarvis.youtubeTeaching.history.v1"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    inputCard
                    historySection
                }
                .padding(16)
            }
            .navigationTitle("YT Öğretisi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
            .task {
                loadHistory()
                await resumePendingSources()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                Image(systemName: "graduationcap.fill")
                    .font(.title2)
                Text("JARVIS Öğrenme Kaynakları")
                    .font(.title2.bold())
            }
            Text("YouTube video veya kanal bağlantısını ekle. JARVIS transkripti çıkarır, kalıcı öğrenme hafızasına parçalar halinde kaydeder ve normal sohbetlerinde gerektiğinde bu bilgiyi kaynaklı olarak kullanır.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Kanal bağlantısında bulunan videolar ayrı öğrenme işlerine dağıtılır. 'Öğrenildi' yalnız bilgi gerçekten kalıcı hafızaya yazıldığında gösterilir.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Yeni eğitim kaynağı")
                .font(.headline)

            TextField("https://www.youtube.com/... veya https://youtu.be/...", text: $sourceURL, axis: .vertical)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...4)

            Button {
                Task { await submitSource() }
            } label: {
                HStack {
                    if isSubmitting { ProgressView().tint(.white) }
                    Image(systemName: "brain.head.profile")
                    Text(isSubmitting ? "KAYNAK EKLENİYOR..." : "JARVIS'E ÖĞRET")
                        .fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .background(Color.red, in: RoundedRectangle(cornerRadius: 14))
            .disabled(isSubmitting || sourceURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Text(statusText)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Öğrenme Geçmişi")
                    .font(.headline)
                Spacer()
                if !history.isEmpty {
                    Text("\(history.count)")
                        .font(.caption.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(uiColor: .tertiarySystemBackground), in: Capsule())
                }
            }

            if history.isEmpty {
                Text("Henüz eğitim kaynağı eklenmedi.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 14)
            } else {
                ForEach(history) { item in
                    sourceCard(item)
                }
            }
        }
    }

    private func sourceCard(_ item: YouTubeTeachingSource) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                Image(systemName: item.isLearned ? "brain.fill" : item.status == "failed" ? "exclamationmark.triangle.fill" : item.status == "completed" ? "checkmark.circle.fill" : "hourglass.circle.fill")
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.statusLabel)
                        .font(.subheadline.bold())
                    Text(item.url)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
            }

            if let chunks = item.learningChunks, chunks > 0 {
                Label("\(chunks) kalıcı bilgi parçası", systemImage: "books.vertical.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let queued = item.queuedVideos, queued > 0 {
                Label("\(queued) video öğrenme kuyruğuna eklendi", systemImage: "list.bullet.rectangle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let answer = item.answer, !answer.isEmpty {
                Text(answer)
                    .font(.footnote)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color(uiColor: .tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 11))
            }

            if let error = item.error, !error.isEmpty {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Text(item.createdAt.formatted(date: .abbreviated, time: .shortened))
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private func submitSource() async {
        let candidate = sourceURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidYouTubeURL(candidate) else {
            statusText = "Geçerli bir HTTPS YouTube veya youtu.be bağlantısı gir."
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let job = try await api.queueYouTubeTeaching(url: candidate)
            let source = YouTubeTeachingSource(
                id: UUID().uuidString,
                jobId: job.id,
                url: candidate,
                status: job.status,
                answer: nil,
                error: job.error,
                learningStatus: job.result?.learningStatus,
                learningChunks: job.result?.learningChunks,
                queuedVideos: job.result?.queuedVideos,
                createdAt: Date()
            )
            history.insert(source, at: 0)
            persistHistory()
            sourceURL = ""
            statusText = "Kaynak öğrenme kuyruğuna alındı."
            await monitor(sourceID: source.id, jobID: job.id)
        } catch {
            statusText = "Kaynak eklenemedi: \(error.localizedDescription)"
        }
    }

    private func resumePendingSources() async {
        let pending = history.filter { ["queued", "running"].contains($0.status.lowercased()) }
        for item in pending {
            if Task.isCancelled { return }
            await monitor(sourceID: item.id, jobID: item.jobId)
        }
    }

    private func monitor(sourceID: String, jobID: String) async {
        while !Task.isCancelled {
            do {
                let result = try await api.cloudToolJob(jobID)
                updateSource(sourceID) { item in
                    item.status = result.job.status
                    item.error = result.job.error
                    item.learningStatus = result.job.result?.learningStatus
                    item.learningChunks = result.job.result?.learningChunks
                    item.queuedVideos = result.job.result?.queuedVideos
                    if let answer = result.answer, !answer.isEmpty {
                        item.answer = answer
                    }
                }
                persistHistory()

                let state = result.job.status.lowercased()
                if state == "completed" {
                    switch result.job.result?.learningStatus?.lowercased() {
                    case "learned":
                        statusText = "JARVIS bu videoyu öğrendi ve kalıcı bilgi hafızasına ekledi."
                    case "index-queued":
                        let count = result.job.result?.queuedVideos ?? 0
                        statusText = "Kanal tarandı; \(count) video öğrenme kuyruğuna eklendi."
                    case "no-transcript":
                        statusText = "Video işlendi ancak öğrenilecek transkript bulunamadı."
                    default:
                        statusText = "Kaynak işlendi ancak kalıcı öğrenme doğrulanmadı."
                    }
                    return
                }
                if state == "failed" {
                    statusText = "Kaynak işlenirken hata oluştu."
                    return
                }
            } catch {
                statusText = "Durum kontrolü başarısız: \(error.localizedDescription)"
                return
            }

            try? await Task.sleep(nanoseconds: 3_000_000_000)
        }
    }

    private func updateSource(_ id: String, mutate: (inout YouTubeTeachingSource) -> Void) {
        guard let index = history.firstIndex(where: { $0.id == id }) else { return }
        mutate(&history[index])
    }

    private func isValidYouTubeURL(_ value: String) -> Bool {
        guard let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let host = components.host?.lowercased() else { return false }
        let allowedHosts = Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"])
        return allowedHosts.contains(host)
    }

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([YouTubeTeachingSource].self, from: data) else { return }
        history = Array(decoded.prefix(100))
    }

    private func persistHistory() {
        let bounded = Array(history.prefix(100))
        guard let data = try? JSONEncoder().encode(bounded) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}
