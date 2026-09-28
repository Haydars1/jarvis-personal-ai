import Foundation
import Combine

struct PersistentCodingBackup: Codable, Identifiable, Hashable {
    let id: UUID
    let createdAt: Date
    let vin: String?
    let brand: VehicleBrand
    let feature: String
    let module: String
    let originalHex: String
    let plannedHex: String?
    let source: String
}

@MainActor
final class CodingBackupVault: ObservableObject {
    @Published private(set) var backups: [PersistentCodingBackup] = []

    private let fm = FileManager.default

    init() {
        load()
    }

    func record(
        vin: String?,
        brand: VehicleBrand,
        feature: String,
        module: String,
        originalHex: String,
        plannedHex: String? = nil,
        source: String
    ) {
        guard !originalHex.isEmpty else { return }
        backups.insert(.init(
            id: UUID(),
            createdAt: Date(),
            vin: vin,
            brand: brand,
            feature: feature,
            module: module,
            originalHex: originalHex,
            plannedHex: plannedHex,
            source: source
        ), at: 0)

        if backups.count > 250 {
            backups.removeLast(backups.count - 250)
        }
        persist()
    }

    func backups(for vin: String?) -> [PersistentCodingBackup] {
        guard let vin, !vin.isEmpty else { return backups }
        return backups.filter { $0.vin == vin }
    }

    private var url: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("JARVISWorkshop", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("coding-backups.json")
    }

    private func load() {
        guard let url, let data = try? Data(contentsOf: url) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        backups = (try? decoder.decode([PersistentCodingBackup].self, from: data)) ?? []
    }

    private func persist() {
        guard let url else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(backups) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
