import Foundation

struct DiagnosticTroubleCode: Identifiable, Hashable {
    var id: String { code + "|" + module }
    let code: String
    let module: String
    let description: String?
    let status: String?
}

struct DiagnosticLiveMetric: Identifiable, Hashable {
    var id: String { key }
    let key: String
    let label: String
    let value: Double
    let unit: String
    let source: String
}

struct DiagnosticSnapshot {
    let sourceName: String
    let capturedAt: Date
    let dtcs: [DiagnosticTroubleCode]
    let metrics: [DiagnosticLiveMetric]
    let notes: [String]
}

enum DiagnosticConnectionState: Equatable {
    case idle
    case scanning
    case connecting(String)
    case connected(String)
    case disconnected
    case failed(String)

    var label: String {
        switch self {
        case .idle: return "Hazır"
        case .scanning: return "Cihaz aranıyor"
        case .connecting(let name): return "\(name) bağlanıyor"
        case .connected(let name): return "\(name) bağlı"
        case .disconnected: return "Bağlantı kesildi"
        case .failed(let message): return "Hata: \(message)"
        }
    }
}
