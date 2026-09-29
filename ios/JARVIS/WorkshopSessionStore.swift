import Foundation
import Combine

struct WorkshopDtcRecord: Codable, Hashable, Identifiable {
    var id: String { module + "|" + code + "|" + status }
    let module: String
    let code: String
    let status: String
    let description: String
}

struct WorkshopModuleRecord: Codable, Identifiable {
    var id: String { address + "|" + name }
    let address: String
    let name: String
    let identification: [String:String]
    let dtcs: [WorkshopDtcRecord]
    let error: String?
}

struct WorkshopLiveRecord: Codable, Hashable, Identifiable {
    var id: String { name }
    let name: String
    let value: String
}

struct WorkshopSessionRecord: Codable, Identifiable {
    let id: UUID
    let startedAt: Date
    let finishedAt: Date
    let vin: String?
    let brand: VehicleBrand
    let connectionName: String
    let protocolHeader: String?
    let genericDtcs: [WorkshopDtcRecord]
    let modules: [WorkshopModuleRecord]
    let liveData: [WorkshopLiveRecord]
    let notes: [String]
}

@MainActor
final class WorkshopSessionStore: ObservableObject {
    @Published private(set) var sessions: [WorkshopSessionRecord] = []

    private let fm = FileManager.default

    init() {
        load()
    }

    func save(_ record: WorkshopSessionRecord) {
        sessions.insert(record, at: 0)
        if sessions.count > 100 {
            sessions.removeLast(sessions.count - 100)
        }
        persist()
    }

    func delete(_ id: UUID) {
        sessions.removeAll { $0.id == id }
        persist()
    }

    func reportURL(for record: WorkshopSessionRecord) -> URL? {
        var lines: [String] = []
        lines.append("JARVIS ARAÇ TEŞHİS RAPORU")
        lines.append("Tarih: \(record.finishedAt.formatted(date: .numeric, time: .shortened))")
        lines.append("VIN: \(record.vin ?? "Bilinmiyor")")
        lines.append("Marka: \(record.brand.rawValue)")
        lines.append("Bağlantı: \(record.connectionName)")
        lines.append("Protokol: \(record.protocolHeader ?? "Bilinmiyor")")
        lines.append("")

        lines.append("HATA KODLARI")
        if record.genericDtcs.isEmpty && record.modules.allSatisfy({ $0.dtcs.isEmpty }) {
            lines.append("DTC bulunamadı.")
        } else {
            for dtc in record.genericDtcs {
                lines.append("\(dtc.module) • \(dtc.code) • \(dtc.status) • \(dtc.description)")
            }
            for module in record.modules {
                for dtc in module.dtcs {
                    lines.append("\(module.name) • \(dtc.code) • \(dtc.status) • \(dtc.description)")
                }
            }
        }

        lines.append("")
        lines.append("KONTROL ÜNİTELERİ")
        for module in record.modules {
            lines.append("\(module.address) • \(module.name)")
            for key in module.identification.keys.sorted() {
                lines.append("  \(key): \(module.identification[key] ?? "")")
            }
            if let error = module.error {
                lines.append("  Hata: \(error)")
            }
        }

        lines.append("")
        lines.append("CANLI VERİ")
        for item in record.liveData {
            lines.append("\(item.name): \(item.value)")
        }

        if !record.notes.isEmpty {
            lines.append("")
            lines.append("NOTLAR")
            lines.append(contentsOf: record.notes)
        }

        let url = fm.temporaryDirectory
            .appendingPathComponent("JARVIS-Teşhis-\(record.vin ?? record.id.uuidString).txt")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private var storeURL: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("JARVISWorkshop", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sessions.json")
    }

    private func load() {
        guard let url = storeURL,
              let data = try? Data(contentsOf: url) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        sessions = (try? decoder.decode([WorkshopSessionRecord].self, from: data)) ?? []
    }

    private func persist() {
        guard let url = storeURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(sessions) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
