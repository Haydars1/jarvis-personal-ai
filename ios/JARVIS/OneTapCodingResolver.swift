import Foundation

struct ResolvedOneTapPlan: Hashable {
    let feature: EvidenceBackedCodingFeature
    let executable: Bool
    let blockingReasons: [String]
    let resolvedRecipeIDs: [String]
}

enum OneTapCodingResolver {
    static func resolve(
        feature: EvidenceBackedCodingFeature,
        brand: VehicleBrand,
        inventory: ConnectedVehicleInventory
    ) -> ResolvedOneTapPlan {
        var reasons: [String] = []
        var recipeIDs: [String] = []

        for operation in feature.operations {
            let candidateID: String
            switch operation {
            case .adaptation(let module, let channel, let value, _):
                candidateID = "semantic|\(brand.rawValue)|\(module)|adapt|\(channel)|\(value)"
            case .longCodingBit(let module, let byte, let bit, let enabled):
                candidateID = "semantic|\(brand.rawValue)|\(module)|coding|b\(byte).\(bit)|\(enabled ? 1 : 0)"
            case .longCodingValue(let module, let byte, let bitStart, let bitLength, let value):
                candidateID = "semantic|\(brand.rawValue)|\(module)|coding|b\(byte).\(bitStart).\(bitLength)|\(value)"
            }

            recipeIDs.append(candidateID)

            // Semantic recipes become executable only when an exact vehicle/module
            // mapping exists for the connected ECU part/software identity.
            let mapping = SemanticCodingRegistry.shared.mapping(
                for: candidateID,
                brand: brand,
                inventory: inventory
            )
            if mapping == nil {
                reasons.append("Doğrulanmış araç/modül eşlemesi eksik: \(candidateID)")
            }
        }

        return .init(
            feature: feature,
            executable: reasons.isEmpty,
            blockingReasons: reasons,
            resolvedRecipeIDs: recipeIDs
        )
    }
}
