import SwiftUI

struct ProtocolLearningSection: View {
    @ObservedObject var learner: ManufacturerProtocolLearner
    @Binding var learnedPackURL: URL?
    let decodedFrameCount: Int
    let onMessage: (String) -> Void
    let onCreatePack: () -> URL?

    var body: some View {
        Section("Protokol Öğrenme") {
            Button {
                if learner.active {
                    learner.stop()
                    onMessage("Protokol öğrenme durduruldu.")
                } else {
                    learner.start(currentFrameCount: decodedFrameCount)
                    onMessage("Protokol öğrenme başladı; JARVIS gelen UDS servislerini ve DID'leri kaydediyor.")
                }
            } label: {
                Label(
                    learner.active ? "Öğrenmeyi durdur" : "Protokol öğrenmeyi başlat",
                    systemImage: learner.active ? "stop.circle" : "brain.head.profile"
                )
            }

            if !learner.observations.isEmpty {
                Text("\(learner.observations.count) protokol gözlemi bulundu")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                DisclosureGroup("Bulunan servisler / DID'ler") {
                    ForEach(learner.observations) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.detail)
                                .font(.caption)
                            Text(verbatim: "VCI op \(String(format: "%04X", item.opcode)) • \(item.rawHex)")
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                }

                Button {
                    learnedPackURL = onCreatePack()
                } label: {
                    Label("Aday üretici paketi oluştur", systemImage: "wand.and.stars")
                }

                if let learnedPackURL {
                    ShareLink(item: learnedPackURL) {
                        Label("Öğrenilen paketi paylaş / kaydet", systemImage: "square.and.arrow.up")
                    }
                }
            }

            Text("Öğrenme modu yalnızca gözlem yapar. Yakalanan opcode, UDS servisleri ve DID'lerden aday paket üretir; bilinmeyen kodlama yazma komutları otomatik oluşturulmaz.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}
