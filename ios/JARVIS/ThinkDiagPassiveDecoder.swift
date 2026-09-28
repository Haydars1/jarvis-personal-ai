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
        let bytes = [UInt8](frame.payload)
        guard !bytes.isEmpty else { return [] }

        var result: [ThinkDiagPassiveObservation] = []

        // Standard OBD-II positive responses embedded in the VCI payload.
        // 0x41 = Mode 01 live PID, 0x43 = Mode 03 stored DTCs, 0x47 = pending DTCs,
        // 0x49 = Mode 09 vehicle information (VIN etc.).
        for start in bytes.indices {
            switch bytes[start] {
            case 0x41:
                if let obs = decodeMode01(Array(bytes[start...]), opcode: frame.opcode) {
                    result.append(obs)
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
        guard bytes.count >= 3, bytes[0] == 0x41 else { return nil }
        let pid = bytes[1]
        let data = Array(bytes.dropFirst(2))
        let decoded: (String, String)?
        switch pid {
        case 0x05 where data.count >= 1:
            decoded = ("Soğutma suyu", "\(Int(data[0]) - 40) °C")
        case 0x0B where data.count >= 1:
            decoded = ("Manifold basıncı", "\(data[0]) kPa")
        case 0x0C where data.count >= 2:
            let rpm = (Double(Int(data[0]) * 256 + Int(data[1])) / 4.0)
            decoded = ("Motor devri", String(format: "%.0f rpm", rpm))
        case 0x0D where data.count >= 1:
            decoded = ("Araç hızı", "\(data[0]) km/h")
        case 0x10 where data.count >= 2:
            let maf = Double(Int(data[0]) * 256 + Int(data[1])) / 100.0
            decoded = ("MAF", String(format: "%.2f g/s", maf))
        case 0x11 where data.count >= 1:
            let throttle = Double(data[0]) * 100.0 / 255.0
            decoded = ("Gaz kelebeği", String(format: "%.1f %%", throttle))
        case 0x33 where data.count >= 1:
            decoded = ("Barometrik basınç", "\(data[0]) kPa")
        case 0x42 where data.count >= 2:
            let volts = Double(Int(data[0]) * 256 + Int(data[1])) / 1000.0
            decoded = ("Kontrol modülü voltajı", String(format: "%.3f V", volts))
        default:
            decoded = nil
        }
        guard let decoded else { return nil }
        return .init(
            kind: "PID",
            title: decoded.0,
            detail: "PID 0x\(String(format: "%02X", pid)) • \(decoded.1)",
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
