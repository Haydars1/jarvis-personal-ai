import Foundation

enum ThinkDiagPacketDirection: String, Codable {
    case tx = "TX"
    case rx = "RX"
}

struct ThinkDiagPacketEvent: Identifiable, Hashable {
    let id = UUID()
    let timestamp: Date
    let direction: ThinkDiagPacketDirection
    let characteristic: String
    let data: Data

    var hex: String {
        data.map { String(format: "%02X", $0) }.joined(separator: " ")
    }
}
