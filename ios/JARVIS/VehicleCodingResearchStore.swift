import Foundation
import Combine

@MainActor
final class VehicleCodingResearchStore: ObservableObject {
    @Published private(set) var loading = false
    @Published private(set) var candidates: [VehicleCodingResearchCandidate] = []
    @Published private(set) var totalCandidates = 0
    @Published private(set) var lastError: String?
    @Published private(set) var lastSyncBrand: String?

    private let api = JarvisAPI()

    func sync(brand: VehicleBrand, pages: Int = 3) async {
        guard brand != .generic, !loading else { return }
        loading = true
        lastError = nil
        defer { loading = false }

        do {
            let sync = try await api.syncVehicleCodingResearch(brand: brand.rawValue, pages: pages)
            totalCandidates = sync.status.totalCandidates
            lastSyncBrand = brand.rawValue
            let catalog = try await api.vehicleCodingResearchCatalog(brand: brand.rawValue)
            candidates = catalog.candidates
                .sorted { lhs, rhs in
                    if lhs.confidence != rhs.confidence { return lhs.confidence > rhs.confidence }
                    return lhs.observedAt > rhs.observedAt
                }
        } catch {
            lastError = error.localizedDescription
            do {
                let catalog = try await api.vehicleCodingResearchCatalog(brand: brand.rawValue)
                candidates = catalog.candidates
                lastSyncBrand = brand.rawValue
            } catch {}
        }
    }

    func refresh(brand: VehicleBrand) async {
        guard brand != .generic else {
            candidates = []
            return
        }
        do {
            let catalog = try await api.vehicleCodingResearchCatalog(brand: brand.rawValue)
            candidates = catalog.candidates
            lastSyncBrand = brand.rawValue
            let status = try await api.vehicleCodingResearchStatus()
            totalCandidates = status.totalCandidates
        } catch {
            lastError = error.localizedDescription
        }
    }

    var exactParameterCandidates: [VehicleCodingResearchCandidate] {
        candidates.filter {
            !$0.feature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            (
                !$0.channel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                !($0.operations ?? []).isEmpty
            )
        }
    }

    var trustedEvidenceFeatures: [EvidenceBackedCodingFeature] {
        candidates.compactMap { candidate in
            guard candidate.status == "trusted_catalog",
                  !candidate.feature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let operations = candidate.operations,
                  !operations.isEmpty else {
                return nil
            }

            let semantic: [SemanticCodingOperation] = operations.compactMap { op in
                switch op.kind {
                case "longCodingBit":
                    guard let byte = op.byte,
                          let bit = op.bit,
                          let enabled = op.enabled else { return nil }
                    return .longCodingBit(
                        module: candidate.module,
                        byte: byte,
                        bit: bit,
                        enabled: enabled
                    )

                case "adaptation":
                    guard let channel = op.channel,
                          let value = op.value else { return nil }
                    return .adaptation(
                        module: candidate.module,
                        channel: channel,
                        value: value,
                        securityAccess: nil
                    )

                default:
                    return nil
                }
            }

            guard !semantic.isEmpty else { return nil }

            return EvidenceBackedCodingFeature(
                id: candidate.id,
                title: candidate.feature,
                description: candidate.coding ?? candidate.title,
                category: "Topluluk / doğrulanmış katalog",
                risk: .low,
                applicability: .init(
                    brands: candidate.brands.compactMap { brandName in
                        VehicleBrand.allCases.first {
                            $0.rawValue.caseInsensitiveCompare(brandName) == .orderedSame
                        }
                    },
                    modelContains: candidate.applicability.isEmpty ? [] : [candidate.applicability],
                    platformContains: [],
                    yearMin: nil,
                    yearMax: nil,
                    requiredModules: candidate.module.isEmpty ? [] : [candidate.module],
                    requiredPartPrefixes: [],
                    requiredSoftwareContains: [],
                    requiredEquipmentTokens: []
                ),
                operations: semantic,
                evidence: [
                    .init(
                        id: candidate.id + "-source",
                        kind: candidate.sourceKind.lowercased().contains("github") ? .github : .forum,
                        title: candidate.sourceTitle,
                        url: candidate.sourceUrl,
                        note: "Trusted catalog import",
                        confidence: candidate.confidence
                    )
                ],
                rollbackRequired: true,
                notes: ["Kaynak katalog: \(candidate.status)"]
            )
        }
    }
}
