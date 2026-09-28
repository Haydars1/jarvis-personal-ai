import Foundation
import Combine

@MainActor
final class VehicleDiagnosticAI: ObservableObject {
    @Published private(set) var explanation = ""
    @Published private(set) var loading = false
    @Published private(set) var lastCodeKey = ""

    private let api = JarvisAPI()

    func explainIfNeeded(
        codes: [String],
        brand: VehicleBrand,
        vin: String?,
        observations: [ThinkDiagPassiveObservation]
    ) async {
        let normalized = Array(Set(codes.map { $0.uppercased() })).sorted()
        guard !normalized.isEmpty else { return }
        let key = "\(brand.rawValue)|\(normalized.joined(separator: ","))"
        guard key != lastCodeKey, !loading else { return }

        lastCodeKey = key
        loading = true
        defer { loading = false }

        let live = observations
            .filter { $0.kind == "PID" }
            .suffix(12)
            .map { "\($0.title): \($0.detail)" }
            .joined(separator: "\n")

        let prompt = """
        Araç teşhis analizi yap.
        Marka: \(brand.rawValue)
        VIN: \(vin ?? "bilinmiyor")
        Hata kodları: \(normalized.joined(separator: ", "))
        Son canlı veriler:
        \(live.isEmpty ? "yok" : live)

        Türkçe ve kısa yaz. Her DTC'nin anlamını, olası nedenlerini, birlikte değerlendirilmesi gereken canlı verileri ve en mantıklı kontrol sırasını açıkla. Kesin bilmediğin üreticiye özel kodlarda bunu belirt; kodu uydurma.
        """

        do {
            let response = try await api.send(text: prompt, channel: "vehicle-diagnostics")
            explanation = response.reply
        } catch {
            explanation = "JARVIS teşhis yorumu alınamadı: \(error.localizedDescription)"
        }
    }
}
