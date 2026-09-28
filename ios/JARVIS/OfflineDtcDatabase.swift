import Foundation

struct OfflineDtcEntry: Hashable {
    let code: String
    let description: String
}

final class OfflineDtcDatabase {
    static let shared = OfflineDtcDatabase()

    private var entries: [String:OfflineDtcEntry] = [:]
    private var loaded = false
    private let lock = NSLock()

    private init() {}

    func lookup(_ code: String) -> OfflineDtcEntry? {
        loadIfNeeded()
        return entries[code.uppercased()]
    }

    func contains(_ code: String) -> Bool {
        lookup(code) != nil
    }

    var count: Int {
        loadIfNeeded()
        return entries.count
    }

    private func loadIfNeeded() {
        lock.lock()
        defer { lock.unlock() }
        guard !loaded else { return }
        loaded = true

        guard let url = Bundle.main.url(
            forResource: "obd-trouble-codes",
            withExtension: "csv",
            subdirectory: "Resources"
        ) ?? Bundle.main.url(forResource: "obd-trouble-codes", withExtension: "csv"),
        let text = try? String(contentsOf: url, encoding: .utf8) else {
            return
        }

        var parsed: [String:OfflineDtcEntry] = [:]
        for line in text.split(whereSeparator: \.isNewline) {
            let raw = String(line)
            guard let comma = raw.firstIndex(of: ",") else { continue }
            let left = String(raw[..<comma])
                .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            let right = String(raw[raw.index(after: comma)...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                .replacingOccurrences(of: "\"\"", with: "\"")
            let code = left.uppercased()
            guard code.count >= 5, !right.isEmpty else { continue }
            parsed[code] = OfflineDtcEntry(code: code, description: right)
        }
        entries = parsed
    }
}

enum OfflineDtcTurkish {
    static func title(for entry: OfflineDtcEntry) -> String {
        let english = entry.description
        let normalized = english.lowercased()

        let phrases: [(String,String)] = [
            ("turbocharger/supercharger underboost condition", "Turbo / kompresör düşük basınç"),
            ("turbocharger/supercharger overboost condition", "Turbo / kompresör aşırı basınç"),
            ("random/multiple cylinder misfire detected", "Rastgele / birden fazla silindirde ateşleme kesilmesi"),
            ("system too lean", "Yakıt-hava karışımı fazla fakir"),
            ("system too rich", "Yakıt-hava karışımı fazla zengin"),
            ("catalyst system efficiency below threshold", "Katalizör verimi eşik altında"),
            ("exhaust gas recirculation flow insufficient detected", "EGR akışı yetersiz"),
            ("diesel particulate filter efficiency below threshold", "DPF verimi eşik altında"),
            ("mass or volume air flow", "Hava kütle / debi ölçümü"),
            ("engine coolant temperature", "Motor soğutma suyu sıcaklığı"),
            ("oxygen sensor", "Oksijen sensörü"),
            ("throttle position", "Gaz kelebeği konumu"),
            ("manifold absolute pressure", "Manifold mutlak basıncı"),
            ("fuel rail pressure", "Yakıt ray basıncı"),
            ("camshaft position", "Eksantrik mili konumu"),
            ("crankshaft position", "Krank mili konumu"),
            ("vehicle speed sensor", "Araç hız sensörü"),
            ("evaporative emission", "Yakıt buharı / EVAP sistemi"),
            ("control module communication", "Kontrol ünitesi haberleşmesi")
        ]

        for (needle, turkish) in phrases where normalized.contains(needle) {
            return turkish
        }

        return english
    }
}
