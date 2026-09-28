import Foundation

struct ThinkDiagPassiveObservation: Identifiable, Hashable {
    let id = UUID()
    let kind: String
    let title: String
    let detail: String
    let sourceOpcode: UInt16
}

enum ThinkDiagPassiveDecoder {
    static func observations(from frame: ThinkDiagVciFrame) -> [ThinkDiagPassiveObservation] {
        guard frame.checksumValid else { return [] }
        let bytes = [UInt8](frame.payload)
        guard !bytes.isEmpty else { return [] }

        var result: [ThinkDiagPassiveObservation] = []

        // Standard OBD-II positive responses embedded in the VCI payload.
        // 0x41 = Mode 01 live PID, 0x43 = Mode 03 stored DTCs, 0x47 = pending DTCs,
        // 0x49 = Mode 09 vehicle information (VIN etc.).
        for start in bytes.indices {
            switch bytes[start] {
            case 0x41:
                let suffix = Array(bytes[start...])
                if let supported = GenericObdDecoder.supportedPids(suffix), suffix.count >= 2 {
                    let base = suffix[1]
                    let list = supported.sorted().map { String(format: "%02X", $0) }.joined(separator: ",")
                    result.append(.init(
                        kind: "SUPPORTED_PIDS",
                        title: String(format: "PID bloğu 0x%02X", base),
                        detail: list,
                        sourceOpcode: frame.opcode
                    ))
                }
                if let obs = decodeMode01(suffix, opcode: frame.opcode) {
                    result.append(obs)
                }
            case 0x42:
                if let freeze = GenericObdDecoder.decodeMode02(Array(bytes[start...])) {
                    result.append(.init(
                        kind: "FREEZE_FRAME",
                        title: freeze.label,
                        detail: String(format: "PID 0x%02X • %.2f %@", freeze.pid, freeze.value, freeze.unit),
                        sourceOpcode: frame.opcode
                    ))
                }
            case 0x43:
                result.append(contentsOf: decodeDtcs(Array(bytes[start...]), status: "DTC", responseMode: 0x43, opcode: frame.opcode))
            case 0x47:
                result.append(contentsOf: decodeDtcs(Array(bytes[start...]), status: "PENDING_DTC", responseMode: 0x47, opcode: frame.opcode))
            case 0x49:
                if let obs = decodeVehicleInfo(Array(bytes[start...]), opcode: frame.opcode) {
                    result.append(obs)
                }
            case 0x4A:
                result.append(contentsOf: decodeDtcs(Array(bytes[start...]), status: "PERMANENT_DTC", responseMode: 0x4A, opcode: frame.opcode))
            default:
                continue
            }
        }
        return dedupe(result)
    }

    private static func decodeMode01(_ bytes: [UInt8], opcode: UInt16) -> ThinkDiagPassiveObservation? {
        guard let sample = GenericObdDecoder.decodeMode01(bytes) else { return nil }
        let rendered: String
        if sample.unit == "rpm" || sample.unit == "km/h" || sample.unit == "kPa" || sample.unit == "s" {
            rendered = String(format: "%.0f %@", sample.value, sample.unit)
        } else if sample.unit == "V" {
            rendered = String(format: "%.3f %@", sample.value, sample.unit)
        } else {
            rendered = String(format: "%.2f %@", sample.value, sample.unit)
        }

        return .init(
            kind: "PID",
            title: sample.label,
            detail: "PID 0x\(String(format: "%02X", sample.pid)) • \(rendered)",
            sourceOpcode: opcode
        )
    }

    private static func decodeDtcs(_ bytes: [UInt8], status: String, responseMode: UInt8, opcode: UInt16) -> [ThinkDiagPassiveObservation] {
        guard !bytes.isEmpty, bytes[0] == responseMode else { return [] }
        let payload = Array(bytes.dropFirst())
        var observations: [ThinkDiagPassiveObservation] = []
        var i = 0

        // Some ECUs put a count byte after 0x43/0x47. Detect conservatively.
        if payload.count >= 3, payload.count % 2 == 1 {
            let count = Int(payload[0])
            if count * 2 <= payload.count - 1 { i = 1 }
        }

        while i + 1 < payload.count {
            let a = payload[i]
            let b = payload[i + 1]
            i += 2
            if a == 0 && b == 0 { continue }

            let letters = ["P", "C", "B", "U"]
            let prefix = letters[Int((a >> 6) & 0x03)]
            let digit1 = Int((a >> 4) & 0x03)
            let digit2 = Int(a & 0x0F)
            let digit3 = Int((b >> 4) & 0x0F)
            let digit4 = Int(b & 0x0F)
            let code = "\(prefix)\(digit1)\(String(format: "%X", digit2))\(String(format: "%X", digit3))\(String(format: "%X", digit4))"
            observations.append(.init(
                kind: status,
                title: code,
                detail: status == "PENDING_DTC"
                    ? "Bekleyen arıza kodu"
                    : (status == "PERMANENT_DTC" ? "Kalıcı arıza kodu" : "Kayıtlı arıza kodu"),
                sourceOpcode: opcode
            ))
        }
        return observations
    }

    private static func decodeVehicleInfo(_ bytes: [UInt8], opcode: UInt16) -> ThinkDiagPassiveObservation? {
        guard bytes.count >= 3, bytes[0] == 0x49 else { return nil }
        let printable = bytes.dropFirst().filter { $0 >= 0x20 && $0 <= 0x7E }
        let text = String(bytes: printable, encoding: .ascii) ?? ""
        let vin = firstVin(in: text)
        guard let vin else { return nil }
        return .init(kind: "VIN", title: "VIN", detail: vin, sourceOpcode: opcode)
    }

    private static func firstVin(in text: String) -> String? {
        let pattern = "[A-HJ-NPR-Z0-9]{17}"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              let swiftRange = Range(match.range, in: text) else { return nil }
        return String(text[swiftRange])
    }

    private static func dedupe(_ items: [ThinkDiagPassiveObservation]) -> [ThinkDiagPassiveObservation] {
        var seen = Set<String>()
        return items.filter { seen.insert("\($0.kind)|\($0.title)|\($0.detail)").inserted }
    }
}
