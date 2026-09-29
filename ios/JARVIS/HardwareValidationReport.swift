import Foundation

struct HardwareValidationModule: Codable, Hashable {
    let address: String
    let name: String
    let dtcCount: Int
    let error: String?
    let identification: [String:String]
}

struct HardwareValidationPacket: Codable, Hashable {
    let timestamp: Date
    let direction: String
    let characteristic: String
    let hex: String
}

struct HardwareValidationReport: Codable, Hashable {
    let createdAt: Date
    let adapterState: String
    let preferredServiceDetected: Bool
    let writeCharacteristic: String?
    let notifyCharacteristic: String?
    let maxWriteWithResponse: Int
    let maxWriteWithoutResponse: Int
    let protocolHeader: String?
    let protocolEvidence: String?
    let protocolFingerprint: String
    let supportedPids: [UInt8]
    let vin: String?
    let genericDtcCodes: [String]
    let liveSampleCount: Int
    let freezeFrameCount: Int
    let readinessSummary: String?
    let verifiedReadCapabilities: [String]
    let modules: [HardwareValidationModule]
    let packetTimeline: [HardwareValidationPacket]
}

enum HardwareValidationReportBuilder {
    @MainActor
    static func make(
        bluetooth: ThinkDiagBluetooth,
        modules: [ModuleScanResult]
    ) -> HardwareValidationReport {
        let vin = bluetooth.passiveObservations
            .last(where: { $0.kind == "VIN" })?
            .detail

        let dtcs = Array(Set(
            bluetooth.passiveObservations
                .filter { ["DTC","PENDING_DTC","PERMANENT_DTC"].contains($0.kind) }
                .map { $0.title.uppercased() }
        )).sorted()

        let moduleRows = modules.map {
            HardwareValidationModule(
                address: $0.address,
                name: $0.moduleName,
                dtcCount: $0.dtcs.count,
                error: $0.error,
                identification: $0.identification
            )
        }

        let packets = bluetooth.packetEvents.suffix(600).map {
            HardwareValidationPacket(
                timestamp: $0.timestamp,
                direction: $0.direction.rawValue,
                characteristic: $0.characteristic,
                hex: $0.hex
            )
        }

        return .init(
            createdAt: Date(),
            adapterState: bluetooth.state.label,
            preferredServiceDetected: bluetooth.preferredServiceDetected,
            writeCharacteristic: bluetooth.writableCharacteristic,
            notifyCharacteristic: bluetooth.notifyCharacteristic,
            maxWriteWithResponse: bluetooth.maxWriteWithResponse,
            maxWriteWithoutResponse: bluetooth.maxWriteWithoutResponse,
            protocolHeader: bluetooth.protocolProfile?.headerHex,
            protocolEvidence: bluetooth.protocolProfile?.evidence,
            protocolFingerprint: bluetooth.protocolFingerprint.summary,
            supportedPids: bluetooth.supportedPids.sorted(),
            vin: vin,
            genericDtcCodes: dtcs,
            liveSampleCount: bluetooth.liveSamples.count,
            freezeFrameCount: bluetooth.freezeFrameValues.count,
            readinessSummary: bluetooth.readiness?.summary,
            verifiedReadCapabilities: bluetooth.verifiedReadCapabilities.map(\.rawValue).sorted(),
            modules: moduleRows,
            packetTimeline: Array(packets)
        )
    }

    static func export(_ report: HardwareValidationReport) -> URL? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(report) else { return nil }

        let stamp = Int(report.createdAt.timeIntervalSince1970)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("JARVIS-ThinkDiag-Validation-\(stamp).json")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}
