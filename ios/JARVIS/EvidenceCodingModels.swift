import Foundation

enum EvidenceSourceKind: String, Codable, Hashable {
    case official = "Official"
    case rossTech = "Ross-Tech"
    case github = "GitHub"
    case forum = "Forum"
    case reddit = "Reddit"
    case fieldCapture = "Field capture"
}

struct CodingEvidenceSource: Codable, Hashable, Identifiable {
    let id: String
    let kind: EvidenceSourceKind
    let title: String
    let url: String
    let note: String?
    let confidence: Double
}

struct VehicleApplicabilityRule: Codable, Hashable {
    let brands: [VehicleBrand]
    let modelContains: [String]
    let platformContains: [String]
    let yearMin: Int?
    let yearMax: Int?
    let requiredModules: [String]
    let requiredPartPrefixes: [String]
    let requiredSoftwareContains: [String]
    let requiredEquipmentTokens: [String]
}

enum SemanticCodingOperation: Codable, Hashable {
    case adaptation(module: String, channel: String, value: String, securityAccess: String?)
    case longCodingBit(module: String, byte: Int, bit: Int, enabled: Bool)
    case longCodingValue(module: String, byte: Int, bitStart: Int, bitLength: Int, value: Int)
}

struct EvidenceBackedCodingFeature: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let description: String
    let category: String
    let risk: CodingRisk
    let applicability: VehicleApplicabilityRule
    let operations: [SemanticCodingOperation]
    let evidence: [CodingEvidenceSource]
    let rollbackRequired: Bool
    let notes: [String]
}

struct ConnectedVehicleInventory: Hashable {
    let vin: String?
    let brand: VehicleBrand
    let modelName: String?
    let platform: String?
    let modelYear: Int?
    let modules: [ConnectedModuleIdentity]
    let equipmentTokens: Set<String>
}

struct ConnectedModuleIdentity: Hashable, Identifiable {
    var id: String { address + "|" + name }
    let address: String
    let name: String
    let partNumber: String?
    let softwareVersion: String?
}

enum FeatureAvailabilityState: Hashable {
    case available
    case maybeAvailable([String])
    case unavailable([String])

    var label: String {
        switch self {
        case .available: return "Uygun"
        case .maybeAvailable: return "Kontrol gerekli"
        case .unavailable: return "Uygun değil"
        }
    }
}

struct FeatureAvailability: Identifiable, Hashable {
    var id: String { feature.id }
    let feature: EvidenceBackedCodingFeature
    let state: FeatureAvailabilityState
    let score: Double
    let matchedEvidenceCount: Int
}
