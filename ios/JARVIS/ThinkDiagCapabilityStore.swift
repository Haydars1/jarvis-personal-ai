import Foundation

enum ThinkDiagReadCapability: String, Codable, CaseIterable, Hashable {
    case currentData = "Mode 01 • Canlı veri"
    case freezeFrame = "Mode 02 • Freeze frame"
    case storedDtcs = "Mode 03 • Stored DTC"
    case pendingDtcs = "Mode 07 • Pending DTC"
    case vehicleInfo = "Mode 09 • Araç bilgisi/VIN"
    case permanentDtcs = "Mode 0A • Permanent DTC"
}

enum ThinkDiagCapabilityStore {
    private static let prefix = "jarvis.thinkdiag.capabilities."

    static func load(for peripheralID: UUID) -> Set<ThinkDiagReadCapability> {
        let key = prefix + peripheralID.uuidString.lowercased()
        guard let data = UserDefaults.standard.data(forKey: key),
              let values = try? JSONDecoder().decode([ThinkDiagReadCapability].self, from: data) else {
            return []
        }
        return Set(values)
    }

    static func save(_ values: Set<ThinkDiagReadCapability>, for peripheralID: UUID) {
        let key = prefix + peripheralID.uuidString.lowercased()
        guard let data = try? JSONEncoder().encode(values.sorted { $0.rawValue < $1.rawValue }) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
