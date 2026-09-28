import Foundation

enum OfflineVehicleDataStore {
    private static let fm = FileManager.default

    private static var root: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let url = base.appendingPathComponent("JARVISVehicleOffline", isDirectory: true)
        try? fm.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func saveManufacturerPack(_ data: Data, brand: VehicleBrand) {
        guard let root else { return }
        let url = root
            .appendingPathComponent("manufacturer-packs", isDirectory: true)
            .appendingPathComponent(safeName(brand.rawValue) + ".json")
        try? fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }

    static func saveFeaturePack(_ data: Data, brand: VehicleBrand) {
        guard let root else { return }
        let url = root
            .appendingPathComponent("feature-packs", isDirectory: true)
            .appendingPathComponent(safeName(brand.rawValue) + ".json")
        try? fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }

    static func loadFeaturePacks() {
        guard let root else { return }
        let dir = root.appendingPathComponent("feature-packs", isDirectory: true)
        guard let urls = try? fm.contentsOfDirectory(
            at: dir,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }

        for url in urls where url.pathExtension.lowercased() == "json" {
            guard let data = try? Data(contentsOf: url) else { continue }
            _ = try? ManufacturerFeaturePackLoader.load(data: data, persistOffline: false)
        }
    }

    static func loadManufacturerPacks() {
        guard let root else { return }
        let dir = root.appendingPathComponent("manufacturer-packs", isDirectory: true)
        guard let urls = try? fm.contentsOfDirectory(
            at: dir,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }

        for url in urls where url.pathExtension.lowercased() == "json" {
            guard let data = try? Data(contentsOf: url) else { continue }
            _ = try? ManufacturerDiagnosticPackLoader.load(data: data, persistOffline: false)
        }
    }

    static func saveCodingResearch(
        _ candidates: [VehicleCodingResearchCandidate],
        brand: VehicleBrand
    ) {
        guard let root else { return }
        let dir = root.appendingPathComponent("coding-research", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(safeName(brand.rawValue) + ".json")
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(candidates) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func hasCodingResearch(brand: VehicleBrand) -> Bool {
        !loadCodingResearch(brand: brand).isEmpty
    }

    static func loadCodingResearch(brand: VehicleBrand) -> [VehicleCodingResearchCandidate] {
        guard let root else { return [] }
        let url = root
            .appendingPathComponent("coding-research", isDirectory: true)
            .appendingPathComponent(safeName(brand.rawValue) + ".json")
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([VehicleCodingResearchCandidate].self, from: data)) ?? []
    }

    static func bootstrap() {
        loadManufacturerPacks()
        loadFeaturePacks()
        _ = OfflineDtcDatabase.shared.count
    }

    private static func safeName(_ text: String) -> String {
        text.lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: "ä", with: "a")
            .replacingOccurrences(of: "ö", with: "o")
            .replacingOccurrences(of: "ü", with: "u")
            .replacingOccurrences(of: "ß", with: "ss")
    }
}
