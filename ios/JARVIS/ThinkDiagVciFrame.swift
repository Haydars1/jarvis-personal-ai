import Foundation

struct ThinkDiagVciFrame: Identifiable, Hashable {
    let id = UUID()
    let header: [UInt8]
    let opcode: UInt16
    let payload: Data
    let checksum: UInt8
    let checksumValid: Bool

    static let minimumSize = 7

    static func build(header: [UInt8] = [0x55, 0xAA], opcode: UInt16, payload: Data = Data()) -> Data {
        precondition(header.count == 2)
        var bytes: [UInt8] = [
            header[0], header[1],
            UInt8((opcode >> 8) & 0xFF), UInt8(opcode & 0xFF),
            UInt8((payload.count >> 8) & 0xFF), UInt8(payload.count & 0xFF)
        ]
        bytes.append(contentsOf: payload)
        var checksum: UInt8 = 0
        for byte in bytes[2...] { checksum ^= byte }
        bytes.append(checksum)
        return Data(bytes)
    }

    static func decode(_ data: Data) -> ThinkDiagVciFrame? {
        let bytes = [UInt8](data)
        guard bytes.count >= minimumSize else { return nil }
        let opcode = (UInt16(bytes[2]) << 8) | UInt16(bytes[3])
        let length = (Int(bytes[4]) << 8) | Int(bytes[5])
        let total = 2 + 2 + 2 + length + 1
        guard bytes.count >= total else { return nil }
        let payload = Data(bytes[6..<(6 + length)])
        let checksum = bytes[6 + length]
        var expected: UInt8 = 0
        for byte in bytes[2..<(6 + length)] { expected ^= byte }
        return ThinkDiagVciFrame(
            header: [bytes[0], bytes[1]],
            opcode: opcode,
            payload: payload,
            checksum: checksum,
            checksumValid: checksum == expected
        )
    }

    var hex: String {
        let headerHex = header.map { String(format: "%02X", $0) }.joined()
        let op = String(format: "%04X", opcode)
        let body = payload.map { String(format: "%02X", $0) }.joined()
        return "\(headerHex) op=\(op) len=\(payload.count) data=\(body) crc=\(checksumValid ? "OK" : "BAD")"
    }
}

enum ThinkDiagKnownBle {
    static let serviceFFF0 = "FFF0"
    static let serviceFFF0Full = "0000FFF0-0000-1000-8000-00805F9B34FB"
    static let issC = "49535343-FE7D-4AE5-8FA9-9FAFD205E455"

    static func isPreferredService(_ uuid: String) -> Bool {
        let n = uuid.uppercased()
        return n == serviceFFF0 || n == serviceFFF0Full || n == issC
    }
}
