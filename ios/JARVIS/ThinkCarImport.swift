import Foundation

enum ThinkCarImport {
    static func parse(data: Data, filename: String) -> DiagnosticSnapshot {
        let lower = filename.lowercased()
        if lower.hasSuffix(".json"), let snapshot = parseJSON(data: data, filename: filename) {
            return snapshot
        }
        if lower.hasSuffix(".tc"), let snapshot = parseTC(data: data, filename: filename) {
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
            notes: ["Dosya biçimi henüz tanınmıyor."]
        )
    }

    // ThinkCar .TC live-data container (LSX8/LSX9). This decoder follows
    // descriptor pointers instead of assuming fixed record widths.
    private static func parseTC(data: Data, filename: String) -> DiagnosticSnapshot? {
        guard data.count > 0x138 else { return nil }
        guard let magic = String(data: data.prefix(4), encoding: .ascii),
              magic == "LSX8" || magic == "LSX9" else { return nil }

        guard let stringTableOffset = u32(data, 0x0C),
              let descriptorOffset = u32(data, 0x118) else { return nil }
        let stringOffset = Int(stringTableOffset)
        let desc = Int(descriptorOffset)
        guard stringOffset + 16 <= data.count, desc + 16 <= data.count else { return nil }

        guard let strings = parseTCStrings(data, offset: stringOffset),
              let dataBlockRaw = u32(data, desc + 4),
              let recordSizeRaw = u32(data, desc + 12) else { return nil }

        let dataBlock = Int(dataBlockRaw)
        let recordSize = Int(recordSizeRaw)
        guard recordSize >= 4, recordSize % 4 == 0,
              dataBlock + 16 <= data.count,
              let dataSizeRaw = u32(data, dataBlock + 8),
              let blockRecordSizeRaw = u32(data, dataBlock + 12) else { return nil }

        let blockRecordSize = Int(blockRecordSizeRaw)
        guard blockRecordSize == recordSize else { return nil }
        let dataSize = Int(dataSizeRaw)
        let rowCount = dataSize / recordSize
        let columnCount = recordSize / 4
        let namesOffset = desc + 16
        let unitsOffset = namesOffset + recordSize
        guard unitsOffset + recordSize <= data.count else { return nil }

        var names: [String] = []
        var units: [String] = []
        for column in 0..<columnCount {
            let nameIndex = Int(u16(data, namesOffset + column * 4) ?? 0)
            let unitIndex = Int(u16(data, unitsOffset + column * 4) ?? 0)
            names.append(tcString(strings, nameIndex).trimmingCharacters(in: .whitespacesAndNewlines))
            units.append(normalizeUnit(tcString(strings, unitIndex)))
        }

        let recordsOffset = dataBlock + 16
        guard rowCount > 0, recordsOffset + rowCount * recordSize <= data.count else {
            return DiagnosticSnapshot(
                sourceName: filename,
                capturedAt: Date(),
                dtcs: [],
                metrics: [],
                notes: ["ThinkCar .TC bulundu fakat canlı veri kaydı yok."]
            )
        }

        // Use the newest numeric sample for the dashboard. The file still keeps all
        // rows; time-series graphing can be layered on top without changing format parsing.
        let lastRow = recordsOffset + (rowCount - 1) * recordSize
        var metrics: [DiagnosticLiveMetric] = []
        for column in 0..<columnCount {
            let valueIndex = Int(u32(data, lastRow + column * 4) ?? 0)
            guard valueIndex > 0 else { continue }
            let raw = tcString(strings, valueIndex).trimmingCharacters(in: .whitespacesAndNewlines)
            guard let numeric = Double(raw.replacingOccurrences(of: ",", with: ".")) else { continue }
            let name = names[column].isEmpty ? "PID \(column + 1)" : names[column]
            let key = "tc_\(column)_\(name.lowercased().replacingOccurrences(of: " ", with: "_"))"
            metrics.append(.init(
                key: key,
                label: name,
                value: numeric,
                unit: units[column],
                source: filename
            ))
        }

        return DiagnosticSnapshot(
            sourceName: filename,
            capturedAt: Date(),
            dtcs: [],
            metrics: metrics,
            notes: [
                "ThinkCar \(magic) kaydı çözüldü: \(rowCount) örnek, \(columnCount) parametre.",
                "Gösterilen değerler kaydın son örneğidir."
            ]
        )
    }

    private static func parseTCStrings(_ data: Data, offset: Int) -> [String]? {
        guard let countRaw = u32(data, offset + 12) else { return nil }
        let count = Int(countRaw)
        guard count >= 0, count < 200_000 else { return nil }
        var strings = [""]
        var cursor = offset + 16
        for _ in 0..<count {
            guard let lengthRaw = u16(data, cursor) else { return nil }
            let length = Int(lengthRaw)
            guard length >= 3, cursor + length <= data.count else { return nil }
            var bytes = Data(data[(cursor + 2)..<(cursor + length)])
            while bytes.last == 0 { bytes.removeLast() }
            strings.append(String(data: bytes, encoding: .utf8) ?? String(data: bytes, encoding: .ascii) ?? "")
            cursor += length
        }
        return strings
    }

    private static func tcString(_ strings: [String], _ index: Int) -> String {
        guard index > 0, index < strings.count else { return "" }
        return strings[index]
    }

    private static func normalizeUnit(_ raw: String) -> String {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        switch value.lowercased() {
        case "degree c", "deg c", "celsius": return "°C"
        case "degree f", "deg f", "fahrenheit": return "°F"
        default: return value
        }
    }

    private static func u16(_ data: Data, _ offset: Int) -> UInt16? {
        guard offset >= 0, offset + 2 <= data.count else { return nil }
        return UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
    }

    private static func u32(_ data: Data, _ offset: Int) -> UInt32? {
        guard offset >= 0, offset + 4 <= data.count else { return nil }
        return UInt32(data[offset])
            | (UInt32(data[offset + 1]) << 8)
            | (UInt32(data[offset + 2]) << 16)
            | (UInt32(data[offset + 3]) << 24)
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
