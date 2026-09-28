import Foundation

enum OfflineDiagnosticReasoner {
    static func summary(
        codes: [String],
        brand: VehicleBrand,
        observations: [ThinkDiagPassiveObservation]
    ) -> String {
        let normalized = Array(Set(codes.map { $0.uppercased() })).sorted()
        guard !normalized.isEmpty else { return "" }

        var lines: [String] = ["Çevrimdışı teşhis:"]
        for code in normalized {
            let item = DiagnosticDtcCatalog.explain(code)
            lines.append("• \(code): \(item.title)")
            if !item.meaning.isEmpty {
                lines.append("  \(item.meaning)")
            }
            if !item.checks.isEmpty {
                lines.append("  Kontrol: " + item.checks.prefix(3).joined(separator: " → "))
            }
        }

        let live = observations.filter { $0.kind == "PID" }.suffix(8)
        if !live.isEmpty {
            lines.append("Son canlı veriler:")
            for item in live {
                lines.append("• \(item.title): \(item.detail)")
            }
        }

        if brand != .generic {
            lines.append("Marka: \(brand.rawValue)")
        }
        lines.append("Bu açıklama internet olmadan cihazdaki yerel veritabanından üretildi.")
        return lines.joined(separator: "\n")
    }
}
