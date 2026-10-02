import Foundation

struct SemanticCodingMapping: Codable, Identifiable {
    let id: String
    let brand: VehicleBrand
    let semanticKey: String
    let moduleID: String
    let recipe: CodingRecipe
    let supportedPartPrefixes: [String]
    let supportedSoftwareContains: [String]
    let evidenceSourceIDs: [String]
}

final class SemanticCodingRegistry {
    static let shared = SemanticCodingRegistry()

    private var mappings: [String:[SemanticCodingMapping]] = [:]

    private init() {}

    func register(_ mapping: SemanticCodingMapping) {
        mappings[mapping.semanticKey, default: []].append(mapping)
        CodingRecipeRegistry.shared.register(mapping.recipe)
    }

    func mapping(
        for semanticKey: String,
        brand: VehicleBrand,
        inventory: ConnectedVehicleInventory
    ) -> SemanticCodingMapping? {
        guard let candidates = mappings[semanticKey] else { return nil }

        return candidates.first { mapping in
            guard mapping.brand == brand else { return false }

            if !mapping.supportedPartPrefixes.isEmpty {
                let parts = inventory.modules.compactMap(\.partNumber)
                guard parts.contains(where: { part in
                    mapping.supportedPartPrefixes.contains(where: {
                        part.uppercased().hasPrefix($0.uppercased())
                    })
                }) else { return false }
            }

            if !mapping.supportedSoftwareContains.isEmpty {
                let versions = inventory.modules.compactMap(\.softwareVersion)
                guard versions.contains(where: { version in
                    mapping.supportedSoftwareContains.contains(where: {
                        version.localizedCaseInsensitiveContains($0)
                    })
                }) else { return false }
            }

            return true
        }
    }
}
