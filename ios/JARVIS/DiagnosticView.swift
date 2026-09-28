import SwiftUI
import UniformTypeIdentifiers

struct DiagnosticView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var bluetooth = ThinkDiagBluetooth()
    @State private var snapshot: DiagnosticSnapshot?
    @State private var showImporter = false
    @State private var message = ""
    @State private var captureURL: URL?

    var body: some View {
        NavigationStack {
            List {
                Section("ThinkDiag Plus / OBD") {
                    LabeledContent("Durum", value: bluetooth.state.label)
                    HStack {
                        Button {
                            bluetooth.scan()
                        } label: {
                            Label("Bluetooth Tara", systemImage: "dot.radiowaves.left.and.right")
                        }
                        Spacer()
                        if case .connected = bluetooth.state {
                            Button("Ayır") { bluetooth.disconnect() }
                        }
                    }
                    ForEach(bluetooth.devices.prefix(12)) { device in
                        Button {
                            bluetooth.connect(device)
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(device.name)
                                    Text(device.id.uuidString)
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(device.rssi) dBm")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if bluetooth.isThinkDiagTransportReady {
                        Text("\(bluetooth.discoveredServices.count) servis/karakteristik • \(bluetooth.notificationFrames.count) ham paket • \(bluetooth.decodedFrames.count) VCI frame")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(bluetooth.protocolFingerprint.summary)
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                        if bluetooth.preferredServiceDetected {
                            Label("ThinkDiag/Launch BLE imzası bulundu", systemImage: "checkmark.seal.fill")
                                .font(.caption)
                        }
                        if let write = bluetooth.writableCharacteristic {
                            Text("WRITE: \(write)").font(.caption2.monospaced()).textSelection(.enabled)
                        }
                        if let notify = bluetooth.notifyCharacteristic {
                            Text("NOTIFY: \(notify)").font(.caption2.monospaced()).textSelection(.enabled)
                        }
                    }
                    Text(bluetooth.transportNotice)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if bluetooth.isThinkDiagTransportReady {
                        if bluetooth.canWrite {
                            if let profile = bluetooth.protocolProfile {
                                LabeledContent("Doğrulanmış header", value: profile.headerHex)
                                    .font(.caption)
                            }

                            Button {
                                let sent = bluetooth.sendReadOnlyDtcProbe()
                                message = sent
                                    ? "Salt-okuma DTC probu gönderildi; gelen cevaplar aşağıda otomatik çözülecek."
                                    : "DTC probu gönderilemedi."
                            } label: {
                                Label("DTC oku — deneysel salt-okuma", systemImage: "stethoscope")
                            }

                            Button {
                                Task {
                                    message = "Salt-okuma protokol taraması çalışıyor…"
                                    await bluetooth.runReadOnlyHeaderSweep()
                                    if let profile = bluetooth.protocolProfile {
                                        message = "ThinkDiag header doğrulandı: \(profile.headerHex)"
                                    } else {
                                        message = "Header taraması tamamlandı; doğrulanmış Mode 03 cevabı bulunamadı."
                                    }
                                }
                            } label: {
                                Label(bluetooth.probeRunning ? "Protokol taranıyor…" : "Salt-okuma protokol taraması", systemImage: "waveform.badge.magnifyingglass")
                            }
                            .disabled(bluetooth.probeRunning)

                            if bluetooth.protocolProfile != nil {
                                Button {
                                    if bluetooth.livePolling {
                                        bluetooth.stopLivePolling()
                                        message = "Canlı veri okuma durduruldu."
                                    } else {
                                        bluetooth.startLivePolling()
                                        message = "RPM, MAP, MAF, sıcaklık, hız ve modül voltajı okunuyor…"
                                    }
                                } label: {
                                    Label(
                                        bluetooth.livePolling ? "Canlı veriyi durdur" : "Canlı veriyi başlat",
                                        systemImage: bluetooth.livePolling ? "stop.circle" : "waveform.path.ecg"
                                    )
                                }
                            }

                            if !bluetooth.probeAttempts.isEmpty {
                                DisclosureGroup("Protokol testleri") {
                                    ForEach(bluetooth.probeAttempts) { attempt in
                                        HStack {
                                            Text(attempt.headerHex).font(.caption.monospaced())
                                            Spacer()
                                            Text(attempt.success ? "OK" : attempt.detail)
                                                .font(.caption2)
                                                .foregroundStyle(attempt.success ? .green : .secondary)
                                        }
                                    }
                                }
                            }
                        }

                        Button {
                            captureURL = makeCaptureFile()
                        } label: {
                            Label("ThinkDiag bağlantı kaydını hazırla", systemImage: "square.and.arrow.up")
                        }
                    }

                    if let captureURL {
                        ShareLink(item: captureURL) {
                            Label("Bağlantı kaydını paylaş / kaydet", systemImage: "doc.text")
                        }
                    }

                    if !bluetooth.passiveObservations.isEmpty {
                        DisclosureGroup("Araçtan algılanan veriler") {
                            ForEach(bluetooth.passiveObservations.suffix(30)) { observation in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(observation.title).font(.caption.weight(.semibold))
                                    Text("\(observation.kind) • \(observation.detail) • op \(String(format: "%04X", observation.sourceOpcode))")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    if !bluetooth.decodedFrames.isEmpty {
                        DisclosureGroup("Çözülen VCI çerçeveleri") {
                            ForEach(bluetooth.decodedFrames.suffix(20)) { frame in
                                Text(frame.hex)
                                    .font(.caption2.monospaced())
                                    .textSelection(.enabled)
                            }
                        }
                    }

                    if !bluetooth.discoveredServices.isEmpty {
                        DisclosureGroup("Bluetooth servisleri") {
                            ForEach(bluetooth.discoveredServices, id: \.self) { item in
                                Text(item).font(.caption2.monospaced()).textSelection(.enabled)
                            }
                        }
                    }
                }

                Section("ThinkDiag Kayıt / Rapor") {
                    Button {
                        showImporter = true
                    } label: {
                        Label("Rapor veya canlı veri dosyası içe aktar", systemImage: "doc.badge.plus")
                    }
                    Text("CSV, JSON ve metin raporlarından DTC kodlarını; ThinkCar .TC kayıtlarından parametre adları, birimler ve son canlı değerleri çıkarır.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if let snapshot {
                    Section("Arıza Kodları") {
                        if snapshot.dtcs.isEmpty {
                            Text("DTC bulunamadı").foregroundStyle(.secondary)
                        }
                        ForEach(snapshot.dtcs) { dtc in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(dtc.code).font(.headline.monospaced())
                                Text(dtc.description ?? "Açıklama JARVIS teşhis katmanında çözümlenecek")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section("Canlı Veriler") {
                        if snapshot.metrics.isEmpty {
                            Text("Tanımlanan canlı değer bulunamadı").foregroundStyle(.secondary)
                        }
                        ForEach(snapshot.metrics) { metric in
                            LabeledContent(metric.label, value: format(metric))
                        }
                    }

                    Section("Teşhis Özeti") {
                        Text("Kaynak: \(snapshot.sourceName)")
                        ForEach(snapshot.notes, id: \.self) { note in
                            Text(note).font(.caption).foregroundStyle(.secondary)
                        }
                        if let boost = snapshot.metrics.first(where: { $0.key.contains("turbo") || $0.key.contains("manifold") }) {
                            Text("Turbo verisi bulundu: \(format(boost)). P0299 için sonraki sürümde requested/actual basınç farkı otomatik grafiklenecek.")
                                .font(.caption)
                        }
                    }
                }

                if !message.isEmpty {
                    Section("Durum") { Text(message).font(.caption) }
                }
            }
            .navigationTitle("Araç Teşhis")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kapat") { dismiss() }
                }
            }
            .sheet(isPresented: $showImporter) {
                UniversalDocumentPicker(allowsMultipleSelection: false) { urls in
                    showImporter = false
                    guard let url = urls.first else { return }
                    load(url)
                } onCancel: {
                    showImporter = false
                }
                .ignoresSafeArea()
            }
        }
    }

    private func load(_ url: URL) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            snapshot = ThinkCarImport.parse(data: data, filename: url.lastPathComponent)
            message = "Dosya analiz edildi"
        } catch {
            message = "Dosya açılamadı: \(error.localizedDescription)"
        }
    }

    private func makeCaptureFile() -> URL? {
        var lines: [String] = []
        lines.append("JARVIS ThinkDiag capture")
        lines.append("state=\(bluetooth.state.label)")
        lines.append("preferredServiceDetected=\(bluetooth.preferredServiceDetected)")
        lines.append("write=\(bluetooth.writableCharacteristic ?? "-")")
        lines.append("notify=\(bluetooth.notifyCharacteristic ?? "-")")
        lines.append("bytesSeen=\(bluetooth.streamStats.bytesSeen)")
        lines.append("framesDecoded=\(bluetooth.streamStats.framesDecoded)")
        lines.append("checksumValid=\(bluetooth.streamStats.checksumValid)")
        lines.append("discardedBytes=\(bluetooth.streamStats.discardedBytes)")
        lines.append("fingerprint=\(bluetooth.protocolFingerprint.summary)")
        lines.append("protocolProfile=\(bluetooth.protocolProfile?.headerHex ?? "-")")
        lines.append(contentsOf: bluetooth.probeAttempts.map { "probe|\($0.headerHex)|\($0.success)|\($0.detail)" })
        lines.append("--- services ---")
        lines.append(contentsOf: bluetooth.discoveredServices)
        lines.append("--- passive observations ---")
        lines.append(contentsOf: bluetooth.passiveObservations.map {
            "\($0.kind)|\($0.title)|\($0.detail)|op=\(String(format: "%04X", $0.sourceOpcode))"
        })
        lines.append("--- decoded frames ---")
        lines.append(contentsOf: bluetooth.decodedFrames.map(\.hex))
        lines.append("--- raw notifications ---")
        lines.append(contentsOf: bluetooth.notificationFrames.map { data in
            data.map { String(format: "%02X", $0) }.joined()
        })
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("JARVIS-ThinkDiag-\(Int(Date().timeIntervalSince1970)).txt")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            message = "ThinkDiag bağlantı kaydı hazır"
            return url
        } catch {
            message = "Kayıt hazırlanamadı: \(error.localizedDescription)"
            return nil
        }
    }

    private func format(_ metric: DiagnosticLiveMetric) -> String {
        let value = metric.value.rounded() == metric.value
            ? String(Int(metric.value))
            : String(format: "%.2f", metric.value)
        return metric.unit.isEmpty ? value : "\(value) \(metric.unit)"
    }
}
