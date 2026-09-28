import Foundation
import Combine

struct ModuleScanResult: Identifiable, Hashable {
    let id: String
    let moduleID: String
    let moduleName: String
    let address: String
    let dtcs: [UDSDTCRecord]
    let identification: [String:String]
    let error: String?
}

@MainActor
final class ManufacturerModuleScanner: ObservableObject {
    @Published private(set) var running = false
    @Published private(set) var currentModule = ""
    @Published private(set) var results: [ModuleScanResult] = []
    @Published private(set) var log: [String] = []

    func reset() {
        running = false
        currentModule = ""
        results.removeAll()
        log.removeAll()
    }

    func scan(
        brand: VehicleBrand,
        send: @escaping (UInt16, Data) async -> Data?
    ) async {
        guard !running else { return }
        guard let pack = ManufacturerDiagnosticRegistry.shared.pack(for: brand) else {
            log.append("\(brand.rawValue) için üretici teşhis paketi yüklü değil")
            return
        }

        running = true
        results.removeAll()
        defer {
            currentModule = ""
            running = false
        }

        for module in pack.modules {
            if Task.isCancelled { break }
            currentModule = module.name
            log.append("\(module.name) taranıyor…")

            if let sessionHex = module.enterSessionHex,
               let session = Data(hexString: sessionHex) {
                let wrapped = ManufacturerTransportCodec.wrapRequest(session, route: module.transport)
                _ = await send(module.transport.vciOpcode, wrapped)
            }

            var identification: [String:String] = [:]
            for did in module.identificationDIDs {
                let rawRequest = UDSCodec.readDID(did.did)
                let request = ManufacturerTransportCodec.wrapRequest(rawRequest, route: module.transport)
                if let rawResponse = await send(module.transport.vciOpcode, request) {
                    let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                    if let parsed = UDSCodec.parseReadDID(response),
                       parsed.did == did.did {
                        identification[did.label] = decodeDisplay(parsed.payload)
                    }
                }
            }

            var dtcs: [UDSDTCRecord] = []
            var scanError: String?
            if let rawDtcRequest = Data(hexString: module.readDtcHex) {
                let dtcRequest = ManufacturerTransportCodec.wrapRequest(rawDtcRequest, route: module.transport)
                if let rawResponse = await send(module.transport.vciOpcode, dtcRequest) {
                    let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                    if let negative = UDSCodec.parseNegative(response) {
                        scanError = negative.message
                    } else {
                        dtcs = UDSCodec.parseDTCResponse(response)
                    }
                } else {
                    scanError = "Modül yanıt vermedi"
                }
            } else {
                scanError = "DTC komutu geçersiz"
            }

            results.append(.init(
                id: module.id,
                moduleID: module.id,
                moduleName: module.name,
                address: module.address,
                dtcs: dtcs,
                identification: identification,
                error: scanError
            ))
        }
    }

    private func decodeDisplay(_ data: Data) -> String {
        if let decoded = String(data: data, encoding: .utf8) {
            let string = decoded.trimmingCharacters(in: .controlCharacters.union(.whitespacesAndNewlines))
            if !string.isEmpty { return string }
        }
        return data.map { String(format: "%02X", $0) }.joined()
    }
}

extension Data {
    init?(hexString: String) {
        let clean = hexString
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "0x", with: "", options: .caseInsensitive)
        guard clean.count % 2 == 0 else { return nil }
        var data = Data()
        var index = clean.startIndex
        while index < clean.endIndex {
            let next = clean.index(index, offsetBy: 2)
            guard let byte = UInt8(clean[index..<next], radix: 16) else { return nil }
            data.append(byte)
            index = next
        }
        self = data
    }
}
