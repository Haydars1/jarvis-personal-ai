import Foundation

struct ManufacturerTransportRoute: Codable, Hashable {
    let vciOpcode: UInt16
    let requestPrefixHex: String?
    let responsePrefixHex: String?
}

struct ManufacturerDIDDefinition: Codable, Identifiable, Hashable {
    var id: UInt16 { did }
    let did: UInt16
    let label: String
    let unit: String?
    let scale: Double?
    let offset: Double?
    let signed: Bool?
}

struct ManufacturerModuleRecipe: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let address: String
    let protocolFamily: VehicleProtocolFamily
    let transport: ManufacturerTransportRoute
    let enterSessionHex: String?
    let keepAliveHex: String?
    let readDtcHex: String
    let clearDtcHex: String?
    let identificationDIDs: [ManufacturerDIDDefinition]
    let liveDataDIDs: [ManufacturerDIDDefinition]
    let codingDID: UInt16?
}

struct ManufacturerDiagnosticPackManifest: Codable {
    let schemaVersion: Int
    let brand: VehicleBrand
    let packVersion: String
    let supportedVINPrefixes: [String]?
    let modules: [ManufacturerModuleRecipe]
    let codingRecipes: [CodingRecipe]
    let semanticMappings: [SemanticCodingMapping]?
}

final class ManufacturerDiagnosticRegistry {
    static let shared = ManufacturerDiagnosticRegistry()

    private(set) var packs: [VehicleBrand:ManufacturerDiagnosticPackManifest] = [:]

    private init() {}

    func register(_ manifest: ManufacturerDiagnosticPackManifest) {
        packs[manifest.brand] = manifest
        for recipe in manifest.codingRecipes {
            CodingRecipeRegistry.shared.register(recipe)
        }
        for mapping in manifest.semanticMappings ?? [] {
            SemanticCodingRegistry.shared.register(mapping)
        }
    }

    func pack(for brand: VehicleBrand) -> ManufacturerDiagnosticPackManifest? {
        packs[brand]
    }

    func moduleRecipe(brand: VehicleBrand, moduleID: String) -> ManufacturerModuleRecipe? {
        packs[brand]?.modules.first(where: { $0.id == moduleID })
    }

    func moduleRecipe(brand: VehicleBrand, moduleName: String) -> ManufacturerModuleRecipe? {
        packs[brand]?.modules.first(where: {
            $0.name.caseInsensitiveCompare(moduleName) == .orderedSame
                || $0.id.caseInsensitiveCompare(moduleName) == .orderedSame
        })
    }
}

enum ManufacturerDiagnosticPackLoader {
    static func load(
        data: Data,
        persistOffline: Bool = true
    ) throws -> ManufacturerDiagnosticPackManifest {
        let manifest = try JSONDecoder().decode(ManufacturerDiagnosticPackManifest.self, from: data)
        guard manifest.schemaVersion == 2 || manifest.schemaVersion == 3 else {
            throw NSError(
                domain: "JARVIS.ManufacturerDiagnosticPack",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Bu üretici teşhis paketi sürümü desteklenmiyor"]
            )
        }

        guard manifest.modules.allSatisfy({ !$0.id.isEmpty && !$0.name.isEmpty }) else {
            throw NSError(
                domain: "JARVIS.ManufacturerDiagnosticPack",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Modül tanımı eksik"]
            )
        }

        guard manifest.codingRecipes.allSatisfy({ $0.brand == manifest.brand }) else {
            throw NSError(
                domain: "JARVIS.ManufacturerDiagnosticPack",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Kodlama reçetesi marka bilgisi uyuşmuyor"]
            )
        }

        guard (manifest.semanticMappings ?? []).allSatisfy({ $0.brand == manifest.brand }) else {
            throw NSError(
                domain: "JARVIS.ManufacturerDiagnosticPack",
                code: 4,
                userInfo: [NSLocalizedDescriptionKey: "Semantik kodlama eşlemesi marka bilgisi uyuşmuyor"]
            )
        }

        ManufacturerDiagnosticRegistry.shared.register(manifest)
        if persistOffline {
            OfflineVehicleDataStore.saveManufacturerPack(data, brand: manifest.brand)
        }
        return manifest
    }
}
