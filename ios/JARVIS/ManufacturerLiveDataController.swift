import Foundation
import Combine

struct ManufacturerLiveValue: Identifiable, Hashable {
    var id: String { "\(moduleID)|\(did)" }
    let moduleID: String
    let moduleName: String
    let did: UInt16
    let label: String
    let value: Double?
    let textValue: String
    let unit: String?
    let updatedAt: Date
}

@MainActor
final class ManufacturerLiveDataController: ObservableObject {
    @Published private(set) var running = false
    @Published private(set) var values: [ManufacturerLiveValue] = []
    @Published private(set) var error: String?

    private var task: Task<Void, Never>?

    func start(
        brand: VehicleBrand,
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) {
        guard !running,
              let pack = ManufacturerDiagnosticRegistry.shared.pack(for: brand) else {
            error = "Üretici canlı veri paketi yüklü değil"
            return
        }

        running = true
        error = nil
        task = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { break }

                for module in pack.modules {
                    if Task.isCancelled { break }
                    for did in module.liveDataDIDs {
                        if Task.isCancelled { break }

                        let rawRequest = UDSCodec.readDID(did.did)
                        let request = ManufacturerTransportCodec.wrapRequest(rawRequest, route: module.transport)
                        let expected = ManufacturerTransportCodec.expectedWrappedPrefix(
                            Data([0x62, UInt8((did.did >> 8) & 0xFF), UInt8(did.did & 0xFF)]),
                            route: module.transport
                        )

                        if let rawResponse = await send(module.transport.vciOpcode, request, expected) {
                            let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                            if let parsed = UDSCodec.parseReadDID(response), parsed.did == did.did {
                                let value = Self.decodeNumeric(parsed.payload, definition: did)
                                let text = value.map { Self.format($0) }
                                    ?? Self.decodeText(parsed.payload)
                                    ?? parsed.payload.map { String(format: "%02X", $0) }.joined()

                                let item = ManufacturerLiveValue(
                                    moduleID: module.id,
                                    moduleName: module.name,
                                    did: did.did,
                                    label: did.label,
                                    value: value,
                                    textValue: text,
                                    unit: did.unit,
                                    updatedAt: Date()
                                )
                                if let index = self.values.firstIndex(where: { $0.id == item.id }) {
                                    self.values[index] = item
                                } else {
                                    self.values.append(item)
                                }
                            }
                        }

                        try? await Task.sleep(nanoseconds: 120_000_000)
                    }
                }

                try? await Task.sleep(nanoseconds: 500_000_000)
            }

            await MainActor.run {
                self?.running = false
                self?.task = nil
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        running = false
    }

    private static func decodeNumeric(_ data: Data, definition: ManufacturerDIDDefinition) -> Double? {
        let bytes = [UInt8](data)
        guard !bytes.isEmpty, bytes.count <= 8 else { return nil }

        var raw: UInt64 = 0
        for byte in bytes {
            raw = (raw << 8) | UInt64(byte)
        }

        var base: Double
        if definition.signed == true {
            let bitCount = bytes.count * 8
            if bitCount == 64 {
                base = Double(Int64(bitPattern: raw))
            } else {
                let signBit = UInt64(1) << UInt64(bitCount - 1)
                if raw & signBit != 0 {
                    let mask = (UInt64(1) << UInt64(bitCount)) - 1
                    let twos = -Int64((~raw + 1) & mask)
                    base = Double(twos)
                } else {
                    base = Double(raw)
                }
            }
        } else {
            base = Double(raw)
        }

        return base * (definition.scale ?? 1.0) + (definition.offset ?? 0.0)
    }

    private static func decodeText(_ data: Data) -> String? {
        guard let string = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .controlCharacters.union(.whitespacesAndNewlines)),
              !string.isEmpty else { return nil }
        return string
    }

    private static func format(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
    }
}
