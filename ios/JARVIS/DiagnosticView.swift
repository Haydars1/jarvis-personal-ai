import SwiftUI
import UniformTypeIdentifiers

struct DiagnosticView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var bluetooth = ThinkDiagBluetooth()
    @State private var snapshot: DiagnosticSnapshot?
    @State private var showImporter = false
    @State private var message = ""

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

    private func format(_ metric: DiagnosticLiveMetric) -> String {
        let value = metric.value.rounded() == metric.value
            ? String(Int(metric.value))
            : String(format: "%.2f", metric.value)
        return metric.unit.isEmpty ? value : "\(value) \(metric.unit)"
    }
}
