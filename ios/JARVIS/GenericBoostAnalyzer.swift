import Foundation

struct P0299Assessment: Hashable {
    let confidence: Double
    let summary: String
    let findings: [String]
}

enum GenericBoostAnalyzer {
    static func assess(samples: [ThinkDiagLiveSample]) -> P0299Assessment? {
        var peakRpm = 0.0
        var peakMap = 0.0
        var baro = 100.0
        var peakMaf: Double?
        var hasRpm = false
        var hasMap = false

        for sample in samples {
            switch sample.pid {
            case 0x0C:
                hasRpm = true
                if sample.value > peakRpm { peakRpm = sample.value }
            case 0x0B:
                hasMap = true
                if sample.value > peakMap { peakMap = sample.value }
            case 0x33:
                baro = sample.value
            case 0x10:
                if let current = peakMaf {
                    if sample.value > current { peakMaf = sample.value }
                } else {
                    peakMaf = sample.value
                }
            default:
                break
            }
        }

        guard hasRpm, hasMap else { return nil }

        let peakGauge = peakMap - baro
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
