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
    private static let key = "jarvis.thinkdiag.protocol.profile"

    static func load() -> ThinkDiagProtocolProfile? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ThinkDiagProtocolProfile.self, from: data)
    }

    static func save(_ profile: ThinkDiagProtocolProfile) {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

struct ThinkDiagProbeAttempt: Identifiable, Hashable {
    let id = UUID()
    let header: [UInt8]
    let success: Bool
    let detail: String

    var headerHex: String { header.map { String(format: "%02X", $0) }.joined() }
}
