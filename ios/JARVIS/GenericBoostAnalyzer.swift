import Foundation

struct P0299Assessment: Hashable {
    let confidence: Double
    let summary: String
    let findings: [String]
}

enum GenericBoostAnalyzer {
    static func assess(samples: [ThinkDiagLiveSample]) -> P0299Assessment? {
        let rpm = samples.filter { $0.pid == 0x0C }
        let map = samples.filter { $0.pid == 0x0B }
        guard !rpm.isEmpty, !map.isEmpty else { return nil }

        let baro = samples.last(where: { $0.pid == 0x33 })?.value ?? 100.0
        let maf = samples.filter { $0.pid == 0x10 }

        let peakRpm = rpm.map(\.value).max() ?? 0
        let peakMap = map.map(\.value).max() ?? 0
        let peakGauge = peakMap - baro
        let peakMaf: Double? = maf.reduce(nil) { current, sample in
            guard let current else { return sample.value }
            return max(current, sample.value)
        }

        var findings: [String] = []
        var confidence = 0.35

        if peakRpm < 1800 {
            findings.append("Kayıtta turbo değerlendirmesi için yeterli motor yükü/devir görünmüyor.")
            return .init(
                confidence: 0.25,
                summary: "P0299 için daha yüksek yükte sürüş kaydı gerekli.",
                findings: findings
            )
        }

        if peakGauge < 30 {
            findings.append(String(format: "Tepe gauge boost yaklaşık %.0f kPa; yük altında düşük görünüyor.", peakGauge))
            confidence += 0.30
        } else {
            findings.append(String(format: "Tepe gauge boost yaklaşık %.0f kPa.", peakGauge))
        }

        if let peakMaf {
            findings.append(String(format: "Tepe MAF %.1f g/s.", peakMaf))
            if peakRpm > 2500 && peakMaf < 45 {
                findings.append("Yüksek devirde MAF da düşük; hava kaçağı/MAF/EGR/turbo kontrolü birlikte incelenmeli.")
                confidence += 0.15
            }
        }

        findings.append("Generic OBD MAP gerçek manifold basıncıdır; hedef boost değildir. Kesin hedef-gerçek karşılaştırması için üretici özel DID gerekir.")

        return .init(
            confidence: min(confidence, 0.85),
            summary: peakGauge < 30
                ? "Gerçek boost üretimi zayıf görünüyor."
                : "Generic OBD verisinde belirgin boost çökmesi tek başına kanıtlanmadı.",
            findings: findings
        )
    }
}
