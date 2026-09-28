import Foundation
import Combine

@MainActor
final class DynamicOneTapCoordinator: ObservableObject {
    @Published private(set) var state: OneTapExecutionState = .idle
    @Published private(set) var backupHex = ""
    @Published private(set) var modifiedHex = ""
    @Published private(set) var log: [String] = []

    private var prepared: DynamicCodingPreparedWrite?
    private var module: ManufacturerModuleRecipe?

    func prepare(
        template: DynamicCodingTemplate,
        module: ManufacturerModuleRecipe,
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        state = .preparing
        log.removeAll()

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
            state = .failed("Mevcut long coding okunamadı")
            return
        }

        let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)

        do {
            let prepared = try DynamicCodingCompiler.prepare(template: template, readResponse: response)
            self.prepared = prepared
            self.module = module
            backupHex = prepared.originalCoding.map { String(format: "%02X", $0) }.joined()
            modifiedHex = prepared.modifiedCoding.map { String(format: "%02X", $0) }.joined()
            log.append("BACKUP \(module.name) DID \(String(format: "%04X", template.codingDID)) • \(backupHex)")
            log.append("PLAN \(module.name) • \(modifiedHex)")
            state = .awaitingConfirmation(template.id)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func execute(
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard let prepared, let module, case .awaitingConfirmation = state else {
            state = .failed("Hazırlanmış dinamik kodlama yok")
            return
        }

        state = .writing(prepared.template.id)
        let routedWrite = ManufacturerTransportCodec.wrapRequest(
            prepared.writeRequest,
            route: module.transport
        )
        let positiveWrite = ManufacturerTransportCodec.expectedWrappedPrefix(
            Data([
                0x6E,
                UInt8((prepared.template.codingDID >> 8) & 0xFF),
                UInt8(prepared.template.codingDID & 0xFF)
            ]),
            route: module.transport
        )

        guard let rawWrite = await send(module.transport.vciOpcode, routedWrite, positiveWrite) else {
            state = .failed("Long coding yazma yanıtı alınamadı")
            return
        }

        let writeResponse = ManufacturerTransportCodec.unwrapResponse(rawWrite, route: module.transport)
        if let negative = UDSCodec.parseNegative(writeResponse) {
            state = .failed(negative.message)
            return
        }
        log.append("WRITE \(module.name) • " + writeResponse.map { String(format: "%02X", $0) }.joined())

        state = .verifying(prepared.template.id)
        let routedVerify = ManufacturerTransportCodec.wrapRequest(
            prepared.verifyRequest,
            route: module.transport
        )
        let positiveRead = ManufacturerTransportCodec.expectedWrappedPrefix(
            Data([
                0x62,
                UInt8((prepared.template.codingDID >> 8) & 0xFF),
                UInt8(prepared.template.codingDID & 0xFF)
            ]),
            route: module.transport
        )

        guard let rawVerify = await send(module.transport.vciOpcode, routedVerify, positiveRead) else {
            state = .failed("Yazma sonrası doğrulama okunamadı")
            return
        }

        let verify = ManufacturerTransportCodec.unwrapResponse(rawVerify, route: module.transport)
        guard let parsed = UDSCodec.parseReadDID(verify),
              parsed.did == prepared.template.codingDID,
              parsed.payload == prepared.modifiedCoding else {
            state = .failed("Kodlama yazıldı ancak doğrulama eşleşmedi")
            return
        }

        log.append("VERIFY OK • " + parsed.payload.map { String(format: "%02X", $0) }.joined())
        state = .completed
    }

    func cancel() {
        prepared = nil
        module = nil
        backupHex = ""
        modifiedHex = ""
        state = .idle
    }
}
