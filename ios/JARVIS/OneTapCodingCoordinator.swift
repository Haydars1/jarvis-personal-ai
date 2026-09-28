import Foundation
import Combine

enum OneTapExecutionState: Equatable {
    case idle
    case unavailable(String)
    case preparing
    case awaitingConfirmation(String)
    case writing(String)
    case verifying(String)
    case completed
    case failed(String)

    var label: String {
        switch self {
        case .idle: return "Hazır"
        case .unavailable(let reason): return "Kullanılamıyor: \(reason)"
        case .preparing: return "Mevcut ayarlar okunuyor ve yedekleniyor"
        case .awaitingConfirmation(let title): return "Onay bekleniyor: \(title)"
        case .writing(let title): return "Uygulanıyor: \(title)"
        case .verifying(let title): return "Doğrulanıyor: \(title)"
        case .completed: return "Tek-tık kodlama tamamlandı"
        case .failed(let reason): return "Hata: \(reason)"
        }
    }
}

struct OneTapBackupEntry: Identifiable, Hashable {
    let id = UUID()
    let semanticKey: String
    let module: String
    let responseHex: String
}

@MainActor
final class OneTapCodingCoordinator: ObservableObject {
    @Published private(set) var state: OneTapExecutionState = .idle
    @Published private(set) var pendingFeature: EvidenceBackedCodingFeature?
    @Published private(set) var backups: [OneTapBackupEntry] = []
    @Published private(set) var log: [String] = []

    private var pendingMappings: [SemanticCodingMapping] = []

    func prepare(
        feature: EvidenceBackedCodingFeature,
        inventory: ConnectedVehicleInventory,
        transportReady: Bool,
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard transportReady else {
            state = .unavailable("ThinkDiag bağlantısı hazır değil")
            return
        }

        let availability = FeatureApplicabilityEngine.evaluate(feature, inventory: inventory)
        guard case .available = availability.state else {
            state = .unavailable(availability.state.label)
            return
        }

        let keys = semanticKeys(for: feature, brand: inventory.brand)
        var mappings: [SemanticCodingMapping] = []
        for key in keys {
            guard let mapping = SemanticCodingRegistry.shared.mapping(
                for: key,
                brand: inventory.brand,
                inventory: inventory
            ) else {
                state = .unavailable("Bu ECU parça/yazılım sürümü için doğrulanmış reçete yok")
                return
            }
            mappings.append(mapping)
        }

        pendingFeature = feature
        pendingMappings = mappings
        backups.removeAll()
        log.removeAll()
        state = .preparing

        for mapping in mappings {
            guard let module = ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: mapping.brand,
                moduleID: mapping.moduleID
            ) ?? ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: mapping.brand,
                moduleName: mapping.recipe.module
            ) else {
                state = .failed("Modül taşıma tanımı bulunamadı: \(mapping.recipe.module)")
                return
            }

            for step in mapping.recipe.readCurrentValueSteps {
                guard let request = Data(hexString: step.requestHex) else {
                    state = .failed("Geçersiz yedek okuma komutu")
                    return
                }
                let routed = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
                let expectedRaw = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
                let expected = ManufacturerTransportCodec.expectedWrappedPrefix(expectedRaw, route: module.transport)
                guard let rawResponse = await send(module.transport.vciOpcode, routed, expected) else {
                    state = .failed("Mevcut değer okunamadı: \(step.description)")
                    return
                }
                let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                let hex = response.map { String(format: "%02X", $0) }.joined()
                backups.append(.init(
                    semanticKey: mapping.semanticKey,
                    module: module.name,
                    responseHex: hex
                ))
                log.append("BACKUP \(module.name) • \(step.description) • \(hex)")
            }
        }

        state = .awaitingConfirmation(feature.title)
    }

    func execute(
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard let feature = pendingFeature,
              case .awaitingConfirmation = state else {
            state = .failed("Hazırlanmış tek-tık işlemi yok")
            return
        }

        for mapping in pendingMappings {
            guard let module = ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: mapping.brand,
                moduleID: mapping.moduleID
            ) ?? ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: mapping.brand,
                moduleName: mapping.recipe.module
            ) else {
                state = .failed("Modül taşıma tanımı bulunamadı")
                return
            }

            state = .writing(feature.title)
            for step in mapping.recipe.writeSteps {
                guard let request = Data(hexString: step.requestHex) else {
                    state = .failed("Geçersiz yazma komutu")
                    return
                }
                let routed = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
                let expectedRaw = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
                let expected = ManufacturerTransportCodec.expectedWrappedPrefix(expectedRaw, route: module.transport)

                guard let rawResponse = await send(module.transport.vciOpcode, routed, expected) else {
                    state = .failed("Yazma yanıtı yok: \(step.description)")
                    return
                }
                let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                if let negative = UDSCodec.parseNegative(response) {
                    state = .failed(negative.message)
                    return
                }
                log.append("WRITE \(module.name) • \(step.description) • " + response.map { String(format: "%02X", $0) }.joined())
            }

            state = .verifying(feature.title)
            for step in mapping.recipe.verifySteps {
                guard let request = Data(hexString: step.requestHex) else {
                    state = .failed("Geçersiz doğrulama komutu")
                    return
                }
                let routed = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
                let expectedRaw = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
                let expected = ManufacturerTransportCodec.expectedWrappedPrefix(expectedRaw, route: module.transport)

                guard let rawResponse = await send(module.transport.vciOpcode, routed, expected) else {
                    state = .failed("Doğrulama yanıtı yok: \(step.description)")
                    return
                }
                let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
                log.append("VERIFY \(module.name) • \(step.description) • " + response.map { String(format: "%02X", $0) }.joined())
            }
        }

        state = .completed
    }

    func cancel() {
        pendingFeature = nil
        pendingMappings.removeAll()
        backups.removeAll()
        state = .idle
    }

    private func semanticKeys(
        for feature: EvidenceBackedCodingFeature,
        brand: VehicleBrand
    ) -> [String] {
        feature.operations.map { operation in
            switch operation {
            case .adaptation(let module, let channel, let value, _):
                return "semantic|\(brand.rawValue)|\(module)|adapt|\(channel)|\(value)"
            case .longCodingBit(let module, let byte, let bit, let enabled):
                return "semantic|\(brand.rawValue)|\(module)|coding|b\(byte).\(bit)|\(enabled ? 1 : 0)"
            case .longCodingValue(let module, let byte, let bitStart, let bitLength, let value):
                return "semantic|\(brand.rawValue)|\(module)|coding|b\(byte).\(bitStart).\(bitLength)|\(value)"
            }
        }
    }
}
