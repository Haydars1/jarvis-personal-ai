import Foundation

enum ThinkCarImport {
    static func parse(data: Data, filename: String) -> DiagnosticSnapshot {
        let lower = filename.lowercased()
        if lower.hasSuffix(".json"), let snapshot = parseJSON(data: data, filename: filename) {
            return snapshot
        }
        if let text = String(data: data, encoding: .utf8) {
            return parseText(text, filename: filename)
        }
        return DiagnosticSnapshot(
            sourceName: filename,
            capturedAt: Date(),
            dtcs: [],
            metrics: [],
            notes: [
                "Dosya ikili (binary) biçimde. ThinkCar .TC kayıtları için ham dosya saklandı fakat bu sürümde tam binary decoder yok.",
                "ThinkDiag uygulamasından CSV/JSON veya paylaşılabilir teşhis raporu dışa aktarılırsa JARVIS DTC ve canlı değerleri doğrudan ayrıştırabilir."
            ]
        )
    }

    private static func parseJSON(data: Data, filename: String) -> DiagnosticSnapshot? {
        guard let object = try? JSONSerialization.jsonObject(with: data) else { return nil }
        let flattened = flattenJSON(object)
        let text = flattened.map { "\($0.0)=\($0.1)" }.joined(separator: "\n")
        return parseText(text, filename: filename)
    }

    private static func flattenJSON(_ value: Any, prefix: String = "") -> [(String,String)] {
        var out: [(String,String)] = []
        if let dict = value as? [String:Any] {
            for (key,val) in dict {
                let next = prefix.isEmpty ? key : "\(prefix).\(key)"
                out.append(contentsOf: flattenJSON(val, prefix: next))
            }
        } else if let array = value as? [Any] {
            for (index,val) in array.enumerated() {
                out.append(contentsOf: flattenJSON(val, prefix: "\(prefix)[\(index)]"))
            }
        } else {
            out.append((prefix, String(describing: value)))
        }
        return out
    }

    private static func parseText(_ text: String, filename: String) -> DiagnosticSnapshot {
        let dtcRegex = try! NSRegularExpression(pattern: #"\b[PCBU][0-9A-Fa-f]{4}\b"#)
        let ns = text as NSString
        let matches = dtcRegex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        var seen = Set<String>()
        var dtcs: [DiagnosticTroubleCode] = []
        for match in matches {
            let code = ns.substring(with: match.range).uppercased()
            guard seen.insert(code).inserted else { continue }
            dtcs.append(.init(code: code, module: "Bilinmiyor", description: nil, status: nil))
        }

        var metrics: [DiagnosticLiveMetric] = []
        let candidates: [(String,String,String)] = [
            ("rpm", "Motor devri", "rpm"),
            ("engine speed", "Motor devri", "rpm"),
            ("boost", "Turbo basıncı", "mbar"),
            ("charge pressure", "Turbo basıncı", "mbar"),
            ("manifold", "Manifold basıncı", "kPa"),
            ("coolant", "Soğutma suyu", "°C"),
            ("vehicle speed", "Araç hızı", "km/h"),
            ("speed", "Araç hızı", "km/h"),
            ("maf", "Hava kütlesi", "g/s"),
            ("egr", "EGR", "%"),
            ("dpf", "DPF", ""),
            ("differential pressure", "DPF diferansiyel basınç", "mbar"),
        ]

        let lines = text.components(separatedBy: .newlines)
        for line in lines {
            let normalized = line.lowercased()
            guard let found = candidates.first(where: { normalized.contains($0.0) }) else { continue }
            guard let number = firstNumber(in: line) else { continue }
            let key = found.1.lowercased().replacingOccurrences(of: " ", with: "_")
            if metrics.contains(where: { $0.key == key }) { continue }
            metrics.append(.init(key: key, label: found.1, value: number, unit: found.2, source: filename))
        }

        return DiagnosticSnapshot(
            sourceName: filename,
            capturedAt: Date(),
            dtcs: dtcs,
            metrics: metrics,
            notes: dtcs.isEmpty && metrics.isEmpty
                ? ["Dosya okundu fakat tanınan DTC/canlı veri bulunamadı."]
                : ["ThinkDiag/ThinkCar dışa aktarımından \(dtcs.count) DTC ve \(metrics.count) canlı değer bulundu."]
        )
    }

    private static func firstNumber(in line: String) -> Double? {
        let regex = try! NSRegularExpression(pattern: #"-?\d+(?:[\.,]\d+)?"#)
        let ns = line as NSString
        guard let match = regex.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return Double(ns.substring(with: match.range).replacingOccurrences(of: ",", with: "."))
    }
}
