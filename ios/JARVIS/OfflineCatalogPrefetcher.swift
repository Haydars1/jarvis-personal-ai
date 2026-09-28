import Foundation
import Combine

@MainActor
final class OfflineCatalogPrefetcher: ObservableObject {
    @Published private(set) var running = false
    @Published private(set) var lastRefresh: Date?
    @Published private(set) var cachedBrands = 0

    private let api = JarvisAPI()
    private let defaults = UserDefaults.standard
    private let refreshKey = "jarvis.vehicle.offlineCatalog.lastRefresh"
    private let interval: TimeInterval = 24 * 60 * 60

    init() {
        lastRefresh = defaults.object(forKey: refreshKey) as? Date
    }

    func refreshIfNeeded(force: Bool = false) async {
        guard !running else { return }

        if !force,
           let lastRefresh,
           Date().timeIntervalSince(lastRefresh) < interval {
            cachedBrands = VehicleBrand.allCases
                .filter { $0 != .generic && OfflineVehicleDataStore.hasCodingResearch(brand: $0) }
                .count
            return
        }

        running = true
        defer { running = false }

        var successful = 0
        for brand in VehicleBrand.allCases where brand != .generic {
            do {
                let catalog = try await api.vehicleCodingResearchCatalog(brand: brand.rawValue)
                if !catalog.candidates.isEmpty {
                    OfflineVehicleDataStore.saveCodingResearch(catalog.candidates, brand: brand)
                    successful += 1
                }
            } catch {
                if OfflineVehicleDataStore.hasCodingResearch(brand: brand) {
                    successful += 1
                }
            }

            try? await Task.sleep(nanoseconds: 60_000_000)
        }

        cachedBrands = successful
        let now = Date()
        lastRefresh = now
        defaults.set(now, forKey: refreshKey)
    }
}
