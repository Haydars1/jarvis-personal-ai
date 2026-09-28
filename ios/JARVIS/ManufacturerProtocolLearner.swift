import Foundation
import Combine

struct ProtocolObservation: Identifiable, Hashable, Codable {
    var id: String { "\(opcode)-\(service)-\(detail)" }
    let opcode: UInt16
    let service: UInt8
    let detail: String
    let rawHex: String
}

struct ProtocolLearningSnapshot: Codable {
    let createdAt: Date
    let opcodes: [UInt16]
    let observations: [ProtocolObservation]
}

@MainActor
final class ManufacturerProtocolLearner: ObservableObject {
    @Published private(set) var active = false
    @Published private(set) var observations: [ProtocolObservation] = []

    private var seenFrameCount = 0

    func start(currentFrameCount: Int) {
        active = true
        observations.removeAll()
        seenFrameCount = currentFrameCount
    }

    func stop() {
        active = false
    }

    func ingest(_ frames: [ThinkDiagVciFrame]) {
        guard active else { return }
        let start = min(seenFrameCount, frames.count)
        for frame in frames.dropFirst(start) {
            analyze(frame)
        }
        seenFrameCount = frames.count
    }

    func snapshot() -> ProtocolLearningSnapshot {
        .init(
            createdAt: Date(),
            opcodes: Array(Set(observations.map(\.opcode))).sorted(),
            observations: observations
        )
    }

    func exportJSON() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(snapshot())
    }

    private func analyze(_ frame: ThinkDiagVciFrame) {
        let bytes = [UInt8](frame.payload)
        guard !bytes.isEmpty else { return }

        for (index, byte) in bytes.enumerated() {
            switch byte {
            case 0x50:
                add(frame, service: byte, detail: "UDS diagnostic session positive response", from: index)
            case 0x59:
                add(frame, service: byte, detail: "UDS DTC information positive response", from: index)
            case 0x62:
                if index + 2 < bytes.count {
                    let did = (UInt16(bytes[index + 1]) << 8) | UInt16(bytes[index + 2])
                    add(frame, service: byte, detail: String(format: "UDS DID response 0x%04X", did), from: index)
                }
            case 0x67:
                add(frame, service: byte, detail: "UDS security access positive response", from: index)
            case 0x6E:
                if index + 2 < bytes.count {
                    let did = (UInt16(bytes[index + 1]) << 8) | UInt16(bytes[index + 2])
                    add(frame, service: byte, detail: String(format: "UDS write DID positive response 0x%04X", did), from: index)
                }
            case 0x71:
                add(frame, service: byte, detail: "UDS routine control positive response", from: index)
            case 0x7E:
                add(frame, service: byte, detail: "UDS tester present positive response", from: index)
            case 0x7F:
                if index + 2 < bytes.count {
                    add(
                        frame,
                        service: byte,
                        detail: String(
                            format: "UDS negative response service 0x%02X NRC 0x%02X",
                            bytes[index + 1],
                            bytes[index + 2]
                        ),
                        from: index
                    )
                }
            default:
                continue
            }
        }
    }

    private func add(_ frame: ThinkDiagVciFrame, service: UInt8, detail: String, from index: Int) {
        let raw = frame.payload
            .dropFirst(index)
            .prefix(64)
            .map { String(format: "%02X", $0) }
            .joined()
        let item = ProtocolObservation(
            opcode: frame.opcode,
            service: service,
            detail: detail,
            rawHex: raw
        )
        if !observations.contains(item) {
            observations.append(item)
        }
    }
}
