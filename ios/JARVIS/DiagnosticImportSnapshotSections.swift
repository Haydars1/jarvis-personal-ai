import SwiftUI

struct DiagnosticImportSnapshotSections: View {
    @Binding var showImporter: Bool
    let snapshot: DiagnosticSnapshot?
    let message: String

    var body: some View {
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
            Section("Canlı Veriler") {
                if snapshot.metrics.isEmpty {
                    Text("Tanımlanan canlı değer bulunamadı")
                        .foregroundStyle(.secondary)
                }

                ForEach(snapshot.metrics) { metric in
                    LabeledContent(metric.label, value: format(metric))
                }
            }

            Section("Teşhis Özeti") {
                Text("Kaynak: \(snapshot.sourceName)")

                ForEach(snapshot.notes, id: \.self) { note in
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let boost = snapshot.metrics.first(where: {
                    $0.key.contains("turbo") || $0.key.contains("manifold")
                }) {
                    Text("Turbo verisi bulundu: \(format(boost)). Genel DTC-family motoru ilgili sinyalleri ayrıca değerlendirir.")
                        .font(.caption)
                }
            }
        }

        if !message.isEmpty {
            Section("Durum") {
                Text(message)
                    .font(.caption)
            }
        }
    }

    private func format(_ metric: DiagnosticLiveMetric) -> String {
        let value = metric.value.rounded() == metric.value
            ? String(Int(metric.value))
            : String(format: "%.2f", metric.value)
        return metric.unit.isEmpty ? value : "\(value) \(metric.unit)"
    }
}
