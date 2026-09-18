import SwiftUI
import UniformTypeIdentifiers

struct EcuBrainView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showImporter = false
    @State private var compute: EcuComputeStatus?
    @State private var training: EcuTrainingStatus?
    @State private var jobs: [EcuJob] = []
    @State private var models: [EcuModelSummary] = []
    @State private var message = ""
    @State private var loading = false
    private let api = EcuBrainAPI()

    var body: some View {
        NavigationStack {
            List {
                Section("Compute") {
                    LabeledContent("Tercih", value: computeLabel)
                    LabeledContent("Laptop", value: compute?.localOnline == true ? "Aktif" : "Kapalı")
                    LabeledContent("Cloud", value: compute?.cloudContainerReady == true ? "Hazır" : "Bekliyor")
                }

                Section("Öğrenme") {
                    LabeledContent("Durum", value: training?.status ?? "—")
                    LabeledContent("Doğrulanmış örnek", value: training.map { "\($0.verifiedExamples)/\($0.minVerifiedExamples)" } ?? "—")
                    LabeledContent("Aktif model", value: training?.productionModel?.version ?? "baseline")
                }

                Section {
                    Button {
                        showImporter = true
                    } label: {
                        Label("ORI/BIN Yükle ve Analiz Et", systemImage: "waveform.path.ecg.rectangle")
                    }
                    .disabled(loading)

                    if !message.isEmpty {
                        Text(message).font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section("Son Analizler") {
                    if jobs.isEmpty {
                        Text("Henüz ECU analizi yok").foregroundStyle(.secondary)
                    }
                    ForEach(jobs) { job in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(job.state).font(.headline)
                            let family = job.result?.ecu_family ?? "UNKNOWN"
                            let confidence = Int((job.result?.confidence ?? 0) * 100)
                            let mapCount = job.result?.map_candidates?.count ?? 0
                            Text("\(family) • %\(confidence) • \(mapCount) map")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Model Geçmişi") {
                    if models.isEmpty {
                        Text("Henüz model yok").foregroundStyle(.secondary)
                    }
                    ForEach(models) { model in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(model.version).font(.subheadline.weight(.semibold))
                                Text("\(model.state ?? "") • benchmark %\(Int((model.benchmarkScore ?? 0) * 100))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if model.state == "ROLLBACK" {
                                Button("Geri Dön") {
                                    Task { await rollback(model.version) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                }
            }
            .navigationTitle("ECU Brain")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kapat") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task { await refresh() }
            .refreshable { await refresh() }
            .fileImporter(
                isPresented: $showImporter,
                allowedContentTypes: [.data, .item],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    Task { await analyze(url) }
                case .failure(let error):
                    message = error.localizedDescription
                }
            }
        }
    }

    private var computeLabel: String {
        switch compute?.preferred {
        case "local": return "Laptop GPU"
        case "cloud-container": return "Cloud container"
        case "cloud": return "Cloud worker"
        default: return "Bekliyor"
        }
    }

    @MainActor
    private func refresh() async {
        do {
            async let c = api.computeStatus()
            async let t = api.trainingStatus()
            async let j = api.jobs()
            async let m = api.models()
            compute = try await c
            training = try await t
            jobs = try await j
            models = try await m
        } catch {
            message = error.localizedDescription
        }
    }

    @MainActor
    private func analyze(_ url: URL) async {
        loading = true
        defer { loading = false }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            message = "Yükleniyor: \(url.lastPathComponent) • \(data.count / 1024) KB"
            let response = try await api.analyze(data: data, filename: url.lastPathComponent)
            message = "Analiz kuyruğa alındı • \(response.job.state)"
            await refresh()
        } catch {
            message = error.localizedDescription
        }
    }

    @MainActor
    private func rollback(_ version: String) async {
        do {
            try await api.rollback(version: version)
            message = "Model geri alındı: \(version)"
            await refresh()
        } catch {
            message = error.localizedDescription
        }
    }
}
