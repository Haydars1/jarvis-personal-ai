import Foundation

struct ThinkDiagProtocolProfile: Codable, Equatable {
    let header0: UInt8
    let header1: UInt8
    let confirmedAt: Date
    let evidence: String

    var header: [UInt8] { [header0, header1] }
    var headerHex: String { String(format: "%02X%02X", header0, header1) }
}

enum ThinkDiagProtocolProfileStore {
    private static let legacyKey = "jarvis.thinkdiag.protocol.profile"
    private static let prefix = "jarvis.thinkdiag.protocol.profile."

    static func load() -> ThinkDiagProtocolProfile? {
        guard let data = UserDefaults.standard.data(forKey: legacyKey) else { return nil }
        return try? JSONDecoder().decode(ThinkDiagProtocolProfile.self, from: data)
    }

    static func load(for peripheralID: UUID) -> ThinkDiagProtocolProfile? {
        let key = prefix + peripheralID.uuidString.lowercased()
        if let data = UserDefaults.standard.data(forKey: key),
           let profile = try? JSONDecoder().decode(ThinkDiagProtocolProfile.self, from: data) {
            return profile
        }
        return load()
    }

    static func save(_ profile: ThinkDiagProtocolProfile, for peripheralID: UUID? = nil) {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        UserDefaults.standard.set(data, forKey: legacyKey)
        if let peripheralID {
            UserDefaults.standard.set(
                data,
                forKey: prefix + peripheralID.uuidString.lowercased()
            )
        }
    }

    static func clear(for peripheralID: UUID? = nil) {
        if let peripheralID {
            UserDefaults.standard.removeObject(
                forKey: prefix + peripheralID.uuidString.lowercased()
            )
        } else {
            UserDefaults.standard.removeObject(forKey: legacyKey)
        }
    }
}

struct ThinkDiagProbeAttempt: Identifiable, Hashable {
    let id = UUID()
    let header: [UInt8]
    let success: Bool
    let detail: String

    var headerHex: String { header.map { String(format: "%02X", $0) }.joined() }
}
