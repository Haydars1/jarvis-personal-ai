import Foundation

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
