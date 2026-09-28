import Foundation
import Combine

struct CachedVehicleModule: Codable, Hashable, Identifiable {
    var id: String { address + "|" + name }
    let address: String
    let name: String
    let partNumber: String?
    let softwareVersion: String?
}

struct CachedVehicleProfile: Codable, Hashable, Identifiable {
    var id: String { vin }
    let vin: String
    let brand: VehicleBrand
    let modelName: String?
    let platform: String?
    let modelYear: Int?
    let modules: [CachedVehicleModule]
    let equipmentTokens: Set<String>
    let updatedAt: Date
}

@MainActor
final class VehicleProfileCache: ObservableObject {
    @Published private(set) var profiles: [String:CachedVehicleProfile] = [:]

    private let fm = FileManager.default

    init() {
        load()
    }

    func profile(for vin: String?) -> CachedVehicleProfile? {
        guard let vin, !vin.isEmpty else { return nil }
        return profiles[vin.uppercased()]
    }

    func save(_ profile: CachedVehicleProfile) {
        profiles[profile.vin.uppercased()] = profile
        persist()
    }

    func update(
        vin: String?,
        brand: VehicleBrand,
        modelName: String?,
        platform: String?,
        modelYear: Int?,
        modules: [ConnectedModuleIdentity],
        equipmentTokens: Set<String>
    ) {
        guard let vin, vin.count == 17 else { return }

        let cachedModules = modules.map {
            CachedVehicleModule(
                address: $0.address,
                name: $0.name,
                partNumber: $0.partNumber,
                softwareVersion: $0.softwareVersion
            )
        }

        save(.init(
            vin: vin.uppercased(),
            brand: brand,
            modelName: modelName,
            platform: platform,
            modelYear: modelYear,
            modules: cachedModules,
            equipmentTokens: equipmentTokens,
            updatedAt: Date()
        ))
    }

    private var storeURL: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("JARVISWorkshop", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("vehicle-profiles.json")
    }

    private func load() {
        guard let url = storeURL,
              let data = try? Data(contentsOf: url) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        profiles = (try? decoder.decode([String:CachedVehicleProfile].self, from: data)) ?? [:]
    }

    private func persist() {
        guard let url = storeURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(profiles) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
