import Foundation
import Combine

@MainActor
final class DynamicOneTapCoordinator: ObservableObject {
    @Published private(set) var state: OneTapExecutionState = .idle
    @Published private(set) var backupHex = ""
    @Published private(set) var modifiedHex = ""
    @Published private(set) var log: [String] = []

    private var prepared: [(DynamicCodingPreparedWrite, ManufacturerModuleRecipe)] = []

    func prepare(
        resolution: DynamicCodingResolution,
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard resolution.executable else {
            state = .unavailable(resolution.blockers.joined(separator: " • "))
            return
        }

        state = .preparing
        log.removeAll()
        prepared.removeAll()
        backupHex = ""
        modifiedHex = ""

        for (template, module) in zip(resolution.templates, resolution.modules) {
            if let sessionHex = template.enterSessionHex,
               let session = Data(hexString: sessionHex) {
                let routed = ManufacturerTransportCodec.wrapRequest(session, route: module.transport)
                _ = await send(module.transport.vciOpcode, routed, nil)
            }

            let read = UDSCodec.readDID(template.codingDID)
            let routedRead = ManufacturerTransportCodec.wrapRequest(read, route: module.transport)
            let expected = ManufacturerTransportCodec.expectedWrappedPrefix(
                Data([
                    0x62,
                    UInt8((template.codingDID >> 8) & 0xFF),
                    UInt8(template.codingDID & 0xFF)
                ]),
                route: module.transport
            )

            guard let rawResponse = await send(module.transport.vciOpcode, routedRead, expected) else {
                state = .failed("Mevcut long coding okunamadı: \(module.name)")
                return
            }

            let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)

            do {
                let plan = try DynamicCodingCompiler.prepare(template: template, readResponse: response)
                prepared.append((plan, module))
                let before = plan.originalCoding.map { String(format: "%02X", $0) }.joined()
                let after = plan.modifiedCoding.map { String(format: "%02X", $0) }.joined()
                backupHex += backupHex.isEmpty ? before : "\n\(before)"
                modifiedHex += modifiedHex.isEmpty ? after : "\n\(after)"
                log.append("BACKUP \(module.name) DID \(String(format: "%04X", template.codingDID)) • \(before)")
                log.append("PLAN \(module.name) • \(after)")
            } catch {
                state = .failed(error.localizedDescription)
                return
            }
        }

        state = .awaitingConfirmation(resolution.templates.first?.id ?? "dynamic")
    }

    func execute(
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard !prepared.isEmpty, case .awaitingConfirmation = state else {
            state = .failed("Hazırlanmış dinamik kodlama yok")
            return
        }

        for (plan, module) in prepared {
            state = .writing(plan.template.id)
            let routedWrite = ManufacturerTransportCodec.wrapRequest(
                plan.writeRequest,
                route: module.transport
            )
            let positiveWrite = ManufacturerTransportCodec.expectedWrappedPrefix(
                Data([
                    0x6E,
                    UInt8((plan.template.codingDID >> 8) & 0xFF),
                    UInt8(plan.template.codingDID & 0xFF)
                ]),
                route: module.transport
            )

            guard let rawWrite = await send(module.transport.vciOpcode, routedWrite, positiveWrite) else {
                state = .failed("Long coding yazma yanıtı alınamadı: \(module.name)")
                return
            }

            let writeResponse = ManufacturerTransportCodec.unwrapResponse(rawWrite, route: module.transport)
            if let negative = UDSCodec.parseNegative(writeResponse) {
                state = .failed(negative.message)
                return
            }
            log.append("WRITE \(module.name) • " + writeResponse.map { String(format: "%02X", $0) }.joined())

            state = .verifying(plan.template.id)
            let routedVerify = ManufacturerTransportCodec.wrapRequest(
                plan.verifyRequest,
                route: module.transport
            )
            let positiveRead = ManufacturerTransportCodec.expectedWrappedPrefix(
                Data([
                    0x62,
                    UInt8((plan.template.codingDID >> 8) & 0xFF),
                    UInt8(plan.template.codingDID & 0xFF)
                ]),
                route: module.transport
            )

            guard let rawVerify = await send(module.transport.vciOpcode, routedVerify, positiveRead) else {
                state = .failed("Yazma sonrası doğrulama okunamadı: \(module.name)")
                return
            }

            let verify = ManufacturerTransportCodec.unwrapResponse(rawVerify, route: module.transport)
            guard let parsed = UDSCodec.parseReadDID(verify),
                  parsed.did == plan.template.codingDID,
                  parsed.payload == plan.modifiedCoding else {
                state = .failed("Kodlama yazıldı ancak doğrulama eşleşmedi: \(module.name)")
                return
            }

            log.append("VERIFY OK \(module.name) • " + parsed.payload.map { String(format: "%02X", $0) }.joined())
        }

        state = .completed
    }

    func cancel() {
        prepared.removeAll()
        backupHex = ""
        modifiedHex = ""
        state = .idle
    }
}
