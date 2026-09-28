import Foundation
import Combine

struct CodingRecipeStep: Codable, Hashable {
    enum Operation: String, Codable {
        case readDataByIdentifier
        case writeDataByIdentifier
        case routineControl
        case rawManufacturerCommand
    }

    let operation: Operation
    let requestHex: String
    let expectedPositivePrefixHex: String?
    let description: String
}

struct CodingRecipe: Codable, Identifiable {
    let id: String
    let featureID: String
    let brand: VehicleBrand
    let module: String
    let protocolFamily: VehicleProtocolFamily
    let readCurrentValueSteps: [CodingRecipeStep]
    let writeSteps: [CodingRecipeStep]
    let verifySteps: [CodingRecipeStep]
}

enum CodingExecutionState: Equatable {
    case idle
    case unsupported(String)
    case ready(String)
    case backingUp
    case awaitingConfirmation
    case writing
    case verifying
    case completed
    case failed(String)

    var label: String {
        switch self {
        case .idle: return "Hazır"
        case .unsupported(let reason): return "Desteklenmiyor: \(reason)"
        case .ready(let detail): return "Hazır: \(detail)"
        case .backingUp: return "Mevcut değer yedekleniyor"
        case .awaitingConfirmation: return "Kullanıcı onayı bekleniyor"
        case .writing: return "Kodlama yazılıyor"
        case .verifying: return "Sonuç doğrulanıyor"
        case .completed: return "Tamamlandı"
        case .failed(let reason): return "Hata: \(reason)"
        }
    }
}

final class CodingRecipeRegistry {
    static let shared = CodingRecipeRegistry()

    private var recipes: [String:CodingRecipe] = [:]

    private init() {}

    func register(_ recipe: CodingRecipe) {
        recipes[recipe.featureID] = recipe
    }

    func recipe(for featureID: String) -> CodingRecipe? {
        recipes[featureID]
    }

    func supports(_ feature: CodingFeatureDescriptor) -> Bool {
        guard CodingSafetyPolicy.isAllowed(feature) else { return false }
        return recipes[feature.id] != nil
    }

    var registeredFeatureIDs: [String] {
        recipes.keys.sorted()
    }
}

@MainActor
final class VehicleCodingCoordinator: ObservableObject {
    @Published private(set) var state: CodingExecutionState = .idle
    @Published private(set) var pendingFeature: CodingFeatureDescriptor?
    @Published private(set) var backup: CodingBackupRecord?
    @Published private(set) var executionLog: [String] = []

    func prepare(
        _ feature: CodingFeatureDescriptor,
        vin: String?,
        transportReady: Bool
    ) {
        guard transportReady else {
            state = .unsupported("ThinkDiag bağlantısı hazır değil")
            return
        }
        guard CodingSafetyPolicy.isAllowed(feature) else {
            state = .unsupported("Bu işlev güvenlik politikası nedeniyle çalıştırılmıyor")
            return
        }
        guard CodingRecipeRegistry.shared.recipe(for: feature.id) != nil else {
            pendingFeature = feature
            state = .unsupported("Bu araç/modül için doğrulanmış kodlama reçetesi henüz yüklenmemiş")
            return
        }
        pendingFeature = feature
        state = .ready(feature.title)
    }

    func prepareAndBackup(
        _ feature: CodingFeatureDescriptor,
        vin: String?,
        transportReady: Bool,
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        prepare(feature, vin: vin, transportReady: transportReady)
        guard case .ready = state,
              let recipe = CodingRecipeRegistry.shared.recipe(for: feature.id),
              let module = ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: feature.brand,
                moduleName: recipe.module
              ) else {
            if case .ready = state {
                state = .unsupported("Kodlama reçetesi için modül taşıma yolu bulunamadı")
            }
            return
        }

        state = .backingUp
        executionLog.removeAll()
        var backupBytes = Data()

        for step in recipe.readCurrentValueSteps {
            guard let request = Data(hexString: step.requestHex) else {
                state = .failed("Geçersiz backup komutu")
                return
            }
            let routedRequest = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
            let rawExpected = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
            let expected = ManufacturerTransportCodec.expectedWrappedPrefix(rawExpected, route: module.transport)
            guard let rawResponse = await send(module.transport.vciOpcode, routedRequest, expected) else {
                state = .failed("Mevcut değer okunamadı: \(step.description)")
                return
            }
            let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
            executionLog.append("READ \(step.description): " + response.map { String(format: "%02X", $0) }.joined())
            backupBytes.append(response)
        }

        guard !backupBytes.isEmpty || recipe.readCurrentValueSteps.isEmpty else {
            state = .failed("Yedek alınamadı")
            return
        }

        stageBackup(vin: vin, originalValue: backupBytes)
    }

    func executeConfirmed(
        send: @escaping (UInt16, Data, Data?) async -> Data?
    ) async {
        guard case .awaitingConfirmation = state,
              let feature = pendingFeature,
              let recipe = CodingRecipeRegistry.shared.recipe(for: feature.id),
              let module = ManufacturerDiagnosticRegistry.shared.moduleRecipe(
                brand: feature.brand,
                moduleName: recipe.module
              ) else {
            state = .failed("Kodlama başlatılamadı")
            return
        }

        state = .writing
        for step in recipe.writeSteps {
            guard let request = Data(hexString: step.requestHex) else {
                state = .failed("Geçersiz yazma komutu")
                return
            }
            let routedRequest = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
            let rawExpected = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
            let expected = ManufacturerTransportCodec.expectedWrappedPrefix(rawExpected, route: module.transport)
            guard let rawResponse = await send(module.transport.vciOpcode, routedRequest, expected) else {
                state = .failed("Yazma yanıtı alınamadı: \(step.description)")
                return
            }
            let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
            if let negative = UDSCodec.parseNegative(response) {
                state = .failed(negative.message)
                return
            }
            executionLog.append("WRITE \(step.description): " + response.map { String(format: "%02X", $0) }.joined())
        }

        state = .verifying
        for step in recipe.verifySteps {
            guard let request = Data(hexString: step.requestHex) else {
                state = .failed("Geçersiz doğrulama komutu")
                return
            }
            let routedRequest = ManufacturerTransportCodec.wrapRequest(request, route: module.transport)
            let rawExpected = step.expectedPositivePrefixHex.flatMap(Data.init(hexString:))
            let expected = ManufacturerTransportCodec.expectedWrappedPrefix(rawExpected, route: module.transport)
            guard let rawResponse = await send(module.transport.vciOpcode, routedRequest, expected) else {
                state = .failed("Doğrulama yanıtı alınamadı: \(step.description)")
                return
            }
            let response = ManufacturerTransportCodec.unwrapResponse(rawResponse, route: module.transport)
            executionLog.append("VERIFY \(step.description): " + response.map { String(format: "%02X", $0) }.joined())
        }

        state = .completed
    }

    func stageBackup(vin: String?, originalValue: Data) {
        guard let feature = pendingFeature else { return }
        state = .backingUp
        backup = CodingBackupRecord(
            id: UUID(),
            createdAt: Date(),
            vin: vin,
            brand: feature.brand,
            module: feature.module,
            featureID: feature.id,
            originalValueHex: originalValue.map { String(format: "%02X", $0) }.joined()
        )
        state = .awaitingConfirmation
    }

    func cancel() {
        pendingFeature = nil
        backup = nil
        state = .idle
    }
}
