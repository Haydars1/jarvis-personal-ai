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
                !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            )
        }
    }
}
