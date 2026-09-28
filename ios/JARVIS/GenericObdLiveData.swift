import Foundation

struct ThinkDiagLiveSample: Identifiable, Hashable {
    let id = UUID()
    let timestamp: Date
    let pid: UInt8
    let label: String
    let value: Double
    let unit: String
}

struct ThinkDiagFreezeFrameValue: Identifiable, Hashable {
    var id: String { String(format: "%02X-%@", pid, label) }
    let pid: UInt8
    let label: String
    let value: Double
    let unit: String
}

enum GenericObdDecoder {
    static func decodeMode01(_ bytes: [UInt8]) -> ThinkDiagLiveSample? {
        guard bytes.count >= 3, bytes[0] == 0x41 else { return nil }
        let pid = bytes[1]
        let data = Array(bytes.dropFirst(2))
        guard let value = decodeValue(pid: pid, data: data) else { return nil }
        return .init(
            timestamp: Date(),
            pid: pid,
            label: value.label,
            value: value.value,
            unit: value.unit
        )
    }

    static func decodeMode02(_ bytes: [UInt8]) -> ThinkDiagFreezeFrameValue? {
        guard bytes.count >= 4, bytes[0] == 0x42 else { return nil }
        let pid = bytes[1]
        let data = Array(bytes.dropFirst(3)) // byte 2 is freeze-frame index
        guard let value = decodeValue(pid: pid, data: data) else { return nil }
        return .init(pid: pid, label: value.label, value: value.value, unit: value.unit)
    }

    static func supportedPids(_ bytes: [UInt8]) -> Set<UInt8>? {
        guard bytes.count >= 6, bytes[0] == 0x41 else { return nil }
        let base = bytes[1]
        guard [0x00,0x20,0x40,0x60,0x80,0xA0,0xC0].contains(base) else { return nil }

        let map = Array(bytes[2...5])
        var result = Set<UInt8>()
        for bitIndex in 0..<32 {
            let byteIndex = bitIndex / 8
            let bitInByte = 7 - (bitIndex % 8)
            if map[byteIndex] & (1 << bitInByte) != 0 {
                let pid = Int(base) + bitIndex + 1
                if pid <= 0xFF { result.insert(UInt8(pid)) }
            }
        }
        return result
    }

    static func decodeValue(pid: UInt8, data: [UInt8]) -> (label: String, value: Double, unit: String)? {
        switch pid {
        case 0x04 where data.count >= 1:
            return ("Motor yükü", Double(data[0]) * 100.0 / 255.0, "%")
        case 0x05 where data.count >= 1:
            return ("Soğutma suyu", Double(Int(data[0]) - 40), "°C")
        case 0x0A where data.count >= 1:
            return ("Yakıt basıncı", Double(data[0]) * 3.0, "kPa")
        case 0x0B where data.count >= 1:
            return ("Manifold basıncı", Double(data[0]), "kPa")
        case 0x0C where data.count >= 2:
            return ("Motor devri", Double(Int(data[0]) * 256 + Int(data[1])) / 4.0, "rpm")
        case 0x0D where data.count >= 1:
            return ("Araç hızı", Double(data[0]), "km/h")
        case 0x0F where data.count >= 1:
            return ("Emme havası", Double(Int(data[0]) - 40), "°C")
        case 0x10 where data.count >= 2:
            return ("MAF", Double(Int(data[0]) * 256 + Int(data[1])) / 100.0, "g/s")
        case 0x11 where data.count >= 1:
            return ("Gaz kelebeği", Double(data[0]) * 100.0 / 255.0, "%")
        case 0x1F where data.count >= 2:
            return ("Motor çalışma süresi", Double(Int(data[0]) * 256 + Int(data[1])), "s")
        case 0x23 where data.count >= 2:
            return ("Yakıt ray basıncı", Double(Int(data[0]) * 256 + Int(data[1])) * 10.0, "kPa")
        case 0x2F where data.count >= 1:
            return ("Yakıt seviyesi", Double(data[0]) * 100.0 / 255.0, "%")
        case 0x33 where data.count >= 1:
            return ("Barometrik basınç", Double(data[0]), "kPa")
        case 0x42 where data.count >= 2:
            return ("Kontrol modülü voltajı", Double(Int(data[0]) * 256 + Int(data[1])) / 1000.0, "V")
        case 0x46 where data.count >= 1:
            return ("Ortam sıcaklığı", Double(Int(data[0]) - 40), "°C")
        case 0x5C where data.count >= 1:
            return ("Motor yağı sıcaklığı", Double(Int(data[0]) - 40), "°C")
        default:
            return nil
        }
    }
}

@MainActor
final class GenericLiveDataStore: ObservableObject {
    @Published private(set) var samples: [ThinkDiagLiveSample] = []
    @Published private(set) var supportedPids: Set<UInt8> = []
    @Published private(set) var freezeFrame: [ThinkDiagFreezeFrameValue] = []

    private let maxSamples = 1200

    func ingest(frame: ThinkDiagVciFrame) {
        guard frame.checksumValid else { return }
        let bytes = [UInt8](frame.payload)

        for start in bytes.indices {
            let suffix = Array(bytes[start...])
            if suffix.first == 0x41 {
                if let supported = GenericObdDecoder.supportedPids(suffix) {
                    supportedPids.formUnion(supported)
                }
                if let sample = GenericObdDecoder.decodeMode01(suffix) {
                    samples.append(sample)
                }
            } else if suffix.first == 0x42,
                      let item = GenericObdDecoder.decodeMode02(suffix) {
                if let index = freezeFrame.firstIndex(where: { $0.pid == item.pid }) {
                    freezeFrame[index] = item
                } else {
                    freezeFrame.append(item)
                }
            }
        }

        if samples.count > maxSamples {
            samples.removeFirst(samples.count - maxSamples)
        }
    }

    func latest(pid: UInt8) -> ThinkDiagLiveSample? {
        samples.last(where: { $0.pid == pid })
    }

    func recent(pid: UInt8, limit: Int = 120) -> [ThinkDiagLiveSample] {
        Array(samples.filter { $0.pid == pid }.suffix(limit))
    }

    func reset() {
        samples.removeAll()
        supportedPids.removeAll()
        freezeFrame.removeAll()
    }
}
