import Foundation

enum VehiclePackValidationIssue: Hashable {
    case duplicateModuleID(String)
    case emptyDtcRequest(String)
    case unsafeCodingFeature(String)
    case missingCodingModule(String)

    var message: String {
        switch self {
        case .duplicateModuleID(let id): return "Tekrarlanan modül kimliği: \(id)"
        case .emptyDtcRequest(let id): return "DTC okuma komutu eksik: \(id)"
        case .unsafeCodingFeature(let id): return "Engellenen kodlama özelliği: \(id)"
        case .missingCodingModule(let id): return "Kodlama reçetesinin modülü teşhis paketinde yok: \(id)"
        }
    }
}

enum VehiclePackValidator {
    static func issues(in manifest: ManufacturerDiagnosticPackManifest) -> [VehiclePackValidationIssue] {
        var issues: [VehiclePackValidationIssue] = []
        var moduleIDs = Set<String>()

        for module in manifest.modules {
            if !moduleIDs.insert(module.id.lowercased()).inserted {
                issues.append(.duplicateModuleID(module.id))
            }
            if module.readDtcHex.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                issues.append(.emptyDtcRequest(module.id))
            }
        }

        for recipe in manifest.codingRecipes {
            if let feature = CodingFeatureCatalog.pack(for: manifest.brand).features.first(where: { $0.id == recipe.featureID }),
               !CodingSafetyPolicy.isAllowed(feature) {
                issues.append(.unsafeCodingFeature(recipe.featureID))
            }
            let hasModule = manifest.modules.contains {
                $0.id.caseInsensitiveCompare(recipe.module) == .orderedSame
                    || $0.name.caseInsensitiveCompare(recipe.module) == .orderedSame
            }
            if !hasModule {
                issues.append(.missingCodingModule(recipe.featureID))
            }
        }
        return issues
    }

    static func validate(_ manifest: ManufacturerDiagnosticPackManifest) throws {
        let found = issues(in: manifest)
        guard found.isEmpty else {
            throw NSError(
                domain: "JARVIS.VehiclePackValidator",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: found.map(\.message).joined(separator: " • ")]
            )
        }
    }
}
