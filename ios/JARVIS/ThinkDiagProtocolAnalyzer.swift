import Foundation

struct ThinkDiagProtocolFingerprint: Equatable {
    let frameCount: Int
    let checksumValidCount: Int
    let dominantHeader: String?
    let opcodes: [(String, Int)]
    let confidence: Double

    var summary: String {
        guard frameCount > 0 else { return "Henüz yeterli VCI frame yok" }
        let crc = Int((Double(checksumValidCount) / Double(frameCount) * 100).rounded())
        let header = dominantHeader ?? "?"
        let op = opcodes.prefix(4).map { "\($0.0):\($0.1)" }.joined(separator: ", ")
        return "Frame \(frameCount) • CRC %\(crc) • header \(header) • opcode \(op)"
    }
}

enum ThinkDiagProtocolAnalyzer {
    static func fingerprint(_ frames: [ThinkDiagVciFrame]) -> ThinkDiagProtocolFingerprint {
        guard !frames.isEmpty else {
            return .init(frameCount: 0, checksumValidCount: 0, dominantHeader: nil, opcodes: [], confidence: 0)
        }

        var headers: [String:Int] = [:]
        var opcodes: [String:Int] = [:]
        var valid = 0
        for frame in frames {
            let header = frame.header.map { String(format: "%02X", $0) }.joined()
            headers[header, default: 0] += 1
            let opcode = String(format: "%04X", frame.opcode)
            opcodes[opcode, default: 0] += 1
            if frame.checksumValid { valid += 1 }
        }

        let dominant = headers.max(by: { $0.value < $1.value })?.key
        let sortedOpcodes = opcodes.sorted { lhs, rhs in
            lhs.value == rhs.value ? lhs.key < rhs.key : lhs.value > rhs.value
        }
        let crcRatio = Double(valid) / Double(frames.count)
        let headerRatio = Double(headers.values.max() ?? 0) / Double(frames.count)
        let confidence = min(1.0, crcRatio * 0.7 + headerRatio * 0.3)

        return .init(
            frameCount: frames.count,
            checksumValidCount: valid,
            dominantHeader: dominant,
            opcodes: sortedOpcodes,
            confidence: confidence
        )
    }
}
