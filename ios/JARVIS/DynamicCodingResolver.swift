import Foundation

struct DynamicCodingResolution {
    let templates: [DynamicCodingTemplate]
    let modules: [ManufacturerModuleRecipe]
    let blockers: [String]

    var executable: Bool {
        !templates.isEmpty && templates.count == modules.count && blockers.isEmpty
    }
}

enum DynamicCodingResolver {
    static func resolve(
        feature: EvidenceBackedCodingFeature,
        brand: VehicleBrand
    ) -> DynamicCodingResolution {
        guard let pack = ManufacturerDiagnosticRegistry.shared.pack(for: brand) else {
            return .init(templates: [], modules: [], blockers: ["Üretici teşhis paketi yüklü değil"])
        }

        var templates: [DynamicCodingTemplate] = []
        var modules: [ManufacturerModuleRecipe] = []
        var blockers: [String] = []

        let grouped = Dictionary(grouping: feature.operations) { operation -> String in
            switch operation {
            case .adaptation(let module, _, _, _): return module
            case .longCodingBit(let module, _, _, _): return module
            case .longCodingValue(let module, _, _, _, _): return module
            }
        }

        for (moduleName, operations) in grouped {
            if operations.contains(where: {
                if case .adaptation = $0 { return true }
                return false
            }) {
                blockers.append("\(moduleName): adaptation kanalı için raw DID eşlemesi gerekiyor")
            }

            let candidates = pack.modules.filter { module in
                module.name.localizedCaseInsensitiveContains(moduleName)
                    || moduleName.localizedCaseInsensitiveContains(module.name)
                    || module.id.localizedCaseInsensitiveContains(moduleName)
                    || module.address.localizedCaseInsensitiveCompare(moduleName) == .orderedSame
                    || moduleName.localizedCaseInsensitiveContains(module.address)
            }

            guard let module = candidates.first else {
                blockers.append("\(moduleName): araçta eşleşen modül rotası bulunamadı")
                continue
            }

            guard let did = module.codingDID else {
                blockers.append("\(module.name): long-coding DID bilinmiyor")
                continue
            }

            let localFeature = EvidenceBackedCodingFeature(
                id: feature.id,
                title: feature.title,
                description: feature.description,
                category: feature.category,
                risk: feature.risk,
                applicability: feature.applicability,
                operations: operations,
                evidence: feature.evidence,
                rollbackRequired: feature.rollbackRequired,
                notes: feature.notes
            )

            if let template = DynamicCodingTemplateFactory.from(
                feature: localFeature,
                brand: brand,
                moduleID: module.id,
                moduleName: module.name,
                codingDID: did,
                sourceIDs: feature.evidence.map(\.id)
            ) {
                templates.append(template)
                modules.append(module)
            }
        }

        return .init(templates: templates, modules: modules, blockers: blockers)
    }
}
