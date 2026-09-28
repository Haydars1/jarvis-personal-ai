import Foundation

enum FeatureApplicabilityEngine {
    static func evaluate(
        _ feature: EvidenceBackedCodingFeature,
        inventory: ConnectedVehicleInventory
    ) -> FeatureAvailability {
        var hardFailures: [String] = []
        var uncertainties: [String] = []
        var score = 0.0
        var checks = 0.0

        func pass(_ condition: Bool, weight: Double, failure: String) {
            checks += weight
            if condition {
                score += weight
            } else {
                hardFailures.append(failure)
            }
        }

        if !feature.applicability.brands.isEmpty {
            pass(
                feature.applicability.brands.contains(inventory.brand),
                weight: 2.0,
                failure: "Marka eşleşmiyor"
            )
        }

        if !feature.applicability.modelContains.isEmpty {
            if let model = inventory.modelName?.lowercased() {
                pass(
                    feature.applicability.modelContains.contains { model.contains($0.lowercased()) },
                    weight: 1.5,
                    failure: "Model eşleşmiyor"
                )
            } else {
                uncertainties.append("Model bilgisi okunamadı")
            }
        }

        if !feature.applicability.platformContains.isEmpty {
            if let platform = inventory.platform?.lowercased() {
                pass(
                    feature.applicability.platformContains.contains { platform.contains($0.lowercased()) },
                    weight: 1.5,
                    failure: "Platform eşleşmiyor"
                )
            } else {
                uncertainties.append("Platform bilgisi okunamadı")
            }
        }

        if feature.applicability.yearMin != nil || feature.applicability.yearMax != nil {
            if let year = inventory.modelYear {
                let minOK = feature.applicability.yearMin.map { year >= $0 } ?? true
                let maxOK = feature.applicability.yearMax.map { year <= $0 } ?? true
                pass(minOK && maxOK, weight: 1.0, failure: "Model yılı eşleşmiyor")
            } else {
                uncertainties.append("Model yılı okunamadı")
            }
        }

        let moduleStrings = inventory.modules.map { "\($0.address) \($0.name)".lowercased() }
        for required in feature.applicability.requiredModules {
            pass(
                moduleStrings.contains { $0.contains(required.lowercased()) },
                weight: 1.0,
                failure: "Gerekli modül yok: \(required)"
            )
        }

        if !feature.applicability.requiredPartPrefixes.isEmpty {
            let parts = inventory.modules.compactMap(\.partNumber)
            if parts.isEmpty {
                uncertainties.append("Parça numarası okunamadı")
            } else {
                pass(
                    parts.contains { part in
                        feature.applicability.requiredPartPrefixes.contains { prefix in
                            part.uppercased().hasPrefix(prefix.uppercased())
                        }
                    },
                    weight: 1.0,
                    failure: "ECU parça numarası eşleşmiyor"
                )
            }
        }

        if !feature.applicability.requiredSoftwareContains.isEmpty {
            let versions = inventory.modules.compactMap(\.softwareVersion).map { $0.lowercased() }
            if versions.isEmpty {
                uncertainties.append("Yazılım sürümü okunamadı")
            } else {
                pass(
                    versions.contains { version in
                        feature.applicability.requiredSoftwareContains.contains { version.contains($0.lowercased()) }
                    },
                    weight: 1.0,
                    failure: "Yazılım sürümü eşleşmiyor"
                )
            }
        }

        for token in feature.applicability.requiredEquipmentTokens {
            if inventory.equipmentTokens.isEmpty {
                uncertainties.append("Opsiyon/donanım listesi okunamadı: \(token)")
            } else if !inventory.equipmentTokens.contains(where: { $0.caseInsensitiveCompare(token) == .orderedSame }) {
                hardFailures.append("Gerekli donanım yok: \(token)")
            } else {
                score += 1.0
                checks += 1.0
            }
        }

        let evidenceWeight = feature.evidence.reduce(0.0) { $0 + min(max($1.confidence, 0), 1) }
        let normalized = checks > 0 ? score / checks : 0.5
        let evidenceBoost = min(1.0, evidenceWeight / 2.0)
        let finalScore = normalized * 0.75 + evidenceBoost * 0.25

        if !hardFailures.isEmpty {
            return .init(
                feature: feature,
                state: .unavailable(hardFailures),
                score: finalScore,
                matchedEvidenceCount: feature.evidence.count
            )
        }

        if !uncertainties.isEmpty {
            return .init(
                feature: feature,
                state: .maybeAvailable(uncertainties),
                score: finalScore,
                matchedEvidenceCount: feature.evidence.count
            )
        }

        return .init(
            feature: feature,
            state: .available,
            score: finalScore,
            matchedEvidenceCount: feature.evidence.count
        )
    }

    static func availableFeatures(
        catalog: [EvidenceBackedCodingFeature],
        inventory: ConnectedVehicleInventory
    ) -> [FeatureAvailability] {
        catalog
            .map { evaluate($0, inventory: inventory) }
            .sorted {
                if stateRank($0.state) != stateRank($1.state) {
                    return stateRank($0.state) < stateRank($1.state)
                }
                return $0.score > $1.score
            }
    }

    private static func stateRank(_ state: FeatureAvailabilityState) -> Int {
        switch state {
        case .available: return 0
        case .maybeAvailable: return 1
        case .unavailable: return 2
        }
    }
}
