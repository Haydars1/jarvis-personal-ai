import SwiftUI
import UniformTypeIdentifiers

struct EcuServiceOption: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
    let operation: String

    static let all: [EcuServiceOption] = [
        .init(id: "stage1", title: "Stage 1", subtitle: "Doğrulanmış map/rulepack ile performans MOD", operation: "stage1_proposal"),
        .init(id: "dtc_off", title: "DTC OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "dtc_off_proposal"),
        .init(id: "egr_off", title: "EGR OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "egr_off_proposal"),
        .init(id: "dpf_off", title: "DPF OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "dpf_off_proposal"),
        .init(id: "adblue_off", title: "AdBlue / SCR OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "adblue_off_proposal"),
        .init(id: "vmax_off", title: "VMAX OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "vmax_off_proposal"),
        .init(id: "startstop_off", title: "Start/Stop OFF", subtitle: "Doğrulanmış ECU/HW/SW patch rulepack", operation: "startstop_off_proposal"),
    ]
}

struct EcuBrainView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showImporter = false
    @State private var compute: EcuComputeStatus?
    @State private var training: EcuTrainingStatus?
    @State private var jobs: [EcuJob] = []
    @State private var models: [EcuModelSummary] = []
    @State private var rulepacks: EcuRulepackStatus?
    @State private var message = ""
    @State private var loading = false
    @State private var modURL: URL?
    @State private var selectedServices: Set<String> = ["stage1"]
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
                    LabeledContent("Rulepack", value: rulepackLabel)
                }

                Section("İşlemler") {
                    ForEach(EcuServiceOption.all) { option in
                        Button {
                            if selectedServices.contains(option.id) {
                                selectedServices.remove(option.id)
                            } else {
                                selectedServices.insert(option.id)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: selectedServices.contains(option.id) ? "checkmark.square.fill" : "square")
                                    .font(.title3)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.title).fontWeight(.semibold)
                                    Text(option.subtitle).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("MOD")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 7).padding(.vertical, 4)
                                    .background(.secondary.opacity(0.12), in: Capsule())
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    Text("Seçilen işlemler ECU ailesi + HW/SW eşleşen doğrulanmış rulepack ile çalışır. Eşleşme veya checksum doğrulaması yoksa sistem READY MOD üretmez.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
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
                        VStack(alignment: .leading, spacing: 6) {
                            Text(job.state).font(.headline)
                            let family = job.result?.ecu_family ?? "UNKNOWN"
                            let confidence = Int((job.result?.confidence ?? 0) * 100)
                            let mapCount = job.result?.map_candidates?.count ?? 0
                            Text("\(family) • %\(confidence) • \(mapCount) map")
                                .font(.caption).foregroundStyle(.secondary)
                            if let proposal = job.result?.proposal {
                                let changedMaps = proposal.mutation?.changed_maps ?? 0
                                let changedCells = proposal.mutation?.changed_cells ?? 0
                                if changedMaps > 0 {
                                    Text("Mutation: \(changedMaps) map • \(changedCells) hücre")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Text("Checksum: \(proposal.checksum_support ?? "bekliyor")")
                                    .font(.caption).foregroundStyle(.secondary)
                                if let reasons = proposal.reasons, !reasons.isEmpty {
                                    Text(reasons.joined(separator: " • "))
                                        .font(.caption2).foregroundStyle(.orange)
                                }
                            }
                            if let fileId = job.fileId {
                                Button("Seçili İşlemleri Çalıştır") {
                                    Task { await runSelected(fileId) }
                                }
                                .buttonStyle(.bordered)
                            }
                            if job.state == "READY" {
                                Button("MOD Dosyasını Hazırla") {
                                    Task { await prepareMod(job.id) }
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                }

                if let modURL {
                    Section("Hazır MOD") {
                        ShareLink(item: modURL) {
                            Label("MOD Dosyasını Kaydet / Paylaş", systemImage: "square.and.arrow.up")
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
            .sheet(isPresented: $showImporter) {
                UniversalDocumentPicker(allowsMultipleSelection: false) { urls in
                    showImporter = false
                    guard let url = urls.first else {
                        message = "Dosya seçilmedi"
                        return
                    }
                    Task { await analyze(url) }
                } onCancel: {
                    showImporter = false
                }
                .ignoresSafeArea()
            }
        }
    }

    private var rulepackLabel: String {
        if let production = rulepacks?.production { return "production \(production.version)" }
        if let latest = rulepacks?.latest { return "aday \(latest.version) • \(latest.evidenceCount ?? 0) kanıt" }
        return "kanıt yetersiz"
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
            async let r = api.rulepackStatus()
            compute = try await c
            training = try await t
            jobs = try await j
            models = try await m
            rulepacks = try await r
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
    private func runSelected(_ fileId: String) async {
        var notes: [String] = []
        let selected = EcuServiceOption.all.filter { selectedServices.contains($0.id) }
        for option in selected {
            do {
                let job = try await api.runOperation(fileId: fileId, operation: option.operation)
                notes.append("\(option.title): \(job.state)")
            } catch {
                notes.append("\(option.title): \(error.localizedDescription)")
            }
        }
        message = notes.isEmpty ? "İşlem seçilmedi" : notes.joined(separator: " • ")
        await refresh()
    }

    @MainActor
    private func stage1Preview(_ fileId: String) async {
        do {
            let job = try await api.stage1Preview(fileId: fileId)
            message = "Stage1 önizleme işi: \(job.state)"
            await refresh()
        } catch {
            message = error.localizedDescription
        }
    }

    @MainActor
    private func prepareMod(_ jobId: String) async {
        do {
            modURL = try await api.downloadMod(jobId: jobId)
            message = "Doğrulanmış MOD hazır. Kaydet/Paylaş bölümünden alabilirsin."
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
