import Foundation

enum VehicleWriteSafetyLevel: String, Codable {
    case ready = "Hazır"
    case caution = "Dikkat"
    case blocked = "Yazma kilitli"
    case unknown = "Voltaj bilinmiyor"
}

struct VehicleWriteSafetyResult: Hashable {
    let level: VehicleWriteSafetyLevel
    let voltage: Double?
    let canWrite: Bool
    let message: String
}

enum VehicleWriteSafetyGate {
    static func evaluate(observations: [ThinkDiagPassiveObservation]) -> VehicleWriteSafetyResult {
        let voltage = latestVoltage(observations)

        guard let voltage else {
            return .init(
                level: .unknown,
                voltage: nil,
                canWrite: false,
                message: "Kodlama öncesi modül voltajını oku. Voltaj bilinmeden ECU yazması başlatılmaz."
            )
        }

        if voltage > 15.5 {
            return .init(
                level: .blocked,
                voltage: voltage,
                canWrite: false,
                message: String(format: "Voltaj %.2f V. Şarj voltajı olağandışı yüksek; ECU yazması başlatılmaz.", voltage)
            )
        }

        if voltage < 11.8 {
            return .init(
                level: .blocked,
                voltage: voltage,
                canWrite: false,
                message: String(format: "Voltaj %.2f V. Kodlama/yazma için düşük; akü desteği bağla.", voltage)
            )
        }

        if voltage < 12.2 {
            return .init(
                level: .caution,
                voltage: voltage,
                canWrite: false,
                message: String(format: "Voltaj %.2f V. Yazma güvenlik payı düşük; akü destek cihazı önerilir.", voltage)
            )
        }

        return .init(
            level: .ready,
            voltage: voltage,
            canWrite: true,
            message: String(format: "Voltaj %.2f V • yazma ön kontrolü uygun.", voltage)
        )
    }

    static func latestVoltage(_ observations: [ThinkDiagPassiveObservation]) -> Double? {
        for item in observations.reversed() where item.kind == "PID" {
            let text = item.detail
            guard text.localizedCaseInsensitiveContains("PID 0x42")
                    || item.title.localizedCaseInsensitiveContains("voltaj") else { continue }

            let pattern = #"([0-9]+(?:[.,][0-9]+)?)\s*V"#
            guard let regex = try? NSRegularExpression(pattern: pattern),
                  let match = regex.firstMatch(
                    in: text,
                    range: NSRange(text.startIndex..<text.endIndex, in: text)
                  ),
                  let range = Range(match.range(at: 1), in: text) else { continue }

            return Double(text[range].replacingOccurrences(of: ",", with: "."))
        }
        return nil
    }
}
