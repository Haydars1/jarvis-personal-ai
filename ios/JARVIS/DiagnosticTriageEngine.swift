import Foundation

struct DiagnosticTriageFinding: Identifiable, Hashable {
    let id = UUID()
    let priority: Int
    let title: String
    let detail: String
    let relatedCodes: [String]
}

enum DiagnosticTriageEngine {
    static func analyze(
        codes: [String],
        observations: [ThinkDiagPassiveObservation]
    ) -> [DiagnosticTriageFinding] {
        let normalized = Set(codes.map { $0.uppercased() })
        var findings: [DiagnosticTriageFinding] = []

        let latestVoltage = VehicleWriteSafetyGate.latestVoltage(observations)
        if let latestVoltage, latestVoltage < 12.0 {
            findings.append(.init(
                priority: 100,
                title: "Önce besleme voltajını düzelt",
                detail: String(format: "Modül voltajı %.2f V. Düşük voltaj çok sayıda sahte/ikincil DTC ve haberleşme hatası üretebilir.", latestVoltage),
                relatedCodes: normalized.filter { $0.hasPrefix("U") || $0 == "P0562" }.sorted()
            ))
        }

        let uCodes = normalized.filter { $0.hasPrefix("U") }
        if uCodes.count >= 2 {
            findings.append(.init(
                priority: 90,
                title: "Ağ / gateway / besleme sorununu önce kontrol et",
                detail: "Birden fazla haberleşme DTC'si aynı anda mevcut. Tek tek modül değiştirmeden önce akü, şase, sigorta, gateway ve CAN hattını kontrol et.",
                relatedCodes: uCodes.sorted()
            ))
        }

        if normalized.contains("P0299") {
            var related = ["P0299"]
            for code in ["P0101","P0102","P0103","P0401","P0402","P0236","P0237","P0238"] where normalized.contains(code) {
                related.append(code)
            }

            let extra = related.count > 1
                ? "Boost arızası hava ölçümü/EGR/basınç sensörü kodlarıyla birlikte. Önce ortak hava yolu ve ölçüm zincirini kontrol et."
                : "İstenen-gerçek boost, MAP/MAF, vakum/aktüatör ve basınç hattını birlikte kontrol et."

            findings.append(.init(
                priority: 85,
                title: "P0299 — boost sistemini yük altında doğrula",
                detail: extra,
                relatedCodes: related
            ))
        }

        let misfires = normalized.filter { $0.hasPrefix("P030") }
        if !misfires.isEmpty {
            let lean = normalized.contains("P0171") || normalized.contains("P0174")
            findings.append(.init(
                priority: lean ? 88 : 78,
                title: lean ? "Misfire + fakir karışım: ortak hava/yakıt nedenini ara" : "Ateşleme kesilmelerini silindir bazında ayır",
                detail: lean
                    ? "Vakum kaçağı, düşük yakıt basıncı ve MAF sapması tek tek bobin değiştirmeden önce kontrol edilmeli."
                    : "Freeze frame, yakıt düzeltmeleri, buji/bobin/enjektör ve kompresyon verilerini karşılaştır.",
                relatedCodes: Array(misfires).sorted() + (lean ? ["P0171/P0174"] : [])
            ))
        }

        if normalized.contains("P0401") && (normalized.contains("P2002") || normalized.contains("P2463")) {
            findings.append(.init(
                priority: 80,
                title: "EGR + DPF zincirini birlikte değerlendir",
                detail: "EGR akış problemi egzoz sıcaklığı/kurum modeli ve rejenerasyon davranışını etkileyebilir. Diferansiyel basınç ve EGT verilerini birlikte incele.",
                relatedCodes: normalized.filter { ["P0401","P2002","P2463"].contains($0) }.sorted()
            ))
        }

        if normalized.contains("P0101") {
            findings.append(.init(
                priority: 72,
                title: "MAF plausibility kontrolü",
                detail: "MAF kodunu tek başına sensör arızası kabul etme. Emme kaçağı, EGR akışı, boost ve MAP/baro plausibility aynı kayıtta kontrol edilmeli.",
                relatedCodes: ["P0101"]
            ))
        }

        if findings.isEmpty, !normalized.isEmpty {
            findings.append(.init(
                priority: 50,
                title: "Freeze frame ve canlı veriden başla",
                detail: "Kodları silmeden önce oluşma koşullarını kaydet. Aynı anda oluşan kodları ve modül voltajını birlikte değerlendir.",
                relatedCodes: normalized.sorted()
            ))
        }

        return findings.sorted { lhs, rhs in
            if lhs.priority != rhs.priority { return lhs.priority > rhs.priority }
            return lhs.title < rhs.title
        }
    }
}
