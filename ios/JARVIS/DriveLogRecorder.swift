import Foundation
import Combine

struct DriveLogRecord: Codable, Identifiable, Hashable {
    let id: UUID
    let startedAt: Date
    let finishedAt: Date
    let vin: String?
    let brand: VehicleBrand
    let samples: [DriveLogSample]
}

struct DriveLogSample: Codable, Hashable {
    let timestamp: Date
    let pid: UInt8
    let label: String
    let value: Double
    let unit: String
}

@MainActor
final class DriveLogRecorder: ObservableObject {
    @Published private(set) var recording = false
    @Published private(set) var currentSamples: [DriveLogSample] = []
    @Published private(set) var savedLogs: [DriveLogRecord] = []
    @Published private(set) var startedAt: Date?

    private let fm = FileManager.default
    private var lastSeenSampleID: UUID?

    init() {
        load()
    }

    func start() {
        currentSamples.removeAll()
        lastSeenSampleID = nil
        startedAt = Date()
        recording = true
    }

    func ingest(_ sample: ThinkDiagLiveSample?) {
        guard recording, let sample else { return }
        guard lastSeenSampleID != sample.id else { return }
        lastSeenSampleID = sample.id
        currentSamples.append(.init(
            timestamp: sample.timestamp,
            pid: sample.pid,
            label: sample.label,
            value: sample.value,
            unit: sample.unit
        ))
        if currentSamples.count > 20_000 {
            currentSamples.removeFirst(currentSamples.count - 20_000)
        }
    }

    @discardableResult
    func stop(vin: String?, brand: VehicleBrand) -> DriveLogRecord? {
        guard recording, let startedAt else { return nil }
        recording = false
        self.startedAt = nil

        guard !currentSamples.isEmpty else {
            currentSamples.removeAll()
            return nil
        }

        let record = DriveLogRecord(
            id: UUID(),
            startedAt: startedAt,
            finishedAt: Date(),
            vin: vin,
            brand: brand,
            samples: currentSamples
        )
        savedLogs.insert(record, at: 0)
        if savedLogs.count > 40 {
            savedLogs.removeLast(savedLogs.count - 40)
        }
        persist()
        return record
    }

    func csvURL(for record: DriveLogRecord) -> URL? {
        var lines = ["timestamp,pid,label,value,unit"]
        let formatter = ISO8601DateFormatter()
        for sample in record.samples {
            let label = sample.label.replacingOccurrences(of: """, with: """")
            lines.append(
                "(formatter.string(from: sample.timestamp)),0x(String(format: "%02X", sample.pid)),"(label)",(sample.value),(sample.unit)"
            )
        }

        let name = record.vin ?? record.id.uuidString
        let url = fm.temporaryDirectory
            .appendingPathComponent("JARVIS-DriveLog-(name).csv")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    func p0299Assessment(for record: DriveLogRecord) -> P0299Assessment? {
        let mapped = record.samples.map {
            ThinkDiagLiveSample(
                timestamp: $0.timestamp,
                pid: $0.pid,
                label: $0.label,
                value: $0.value,
                unit: $0.unit
            )
        }
        return GenericBoostAnalyzer.assess(samples: mapped)
    }

    private var storeURL: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("JARVISWorkshop", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("drive-logs.json")
    }

    private func load() {
        guard let url = storeURL,
              let data = try? Data(contentsOf: url) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        savedLogs = (try? decoder.decode([DriveLogRecord].self, from: data)) ?? []
    }

    private func persist() {
        guard let url = storeURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(savedLogs) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
