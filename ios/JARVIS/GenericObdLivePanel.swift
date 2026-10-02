import SwiftUI
import Charts

struct GenericObdLivePanel: View {
    let samples: [ThinkDiagLiveSample]
    let supportedPids: Set<UInt8>
    let freezeFrame: [ThinkDiagFreezeFrameValue]
    let readiness: GenericObdReadiness?

    var body: some View {
        if !samples.isEmpty || !supportedPids.isEmpty || !freezeFrame.isEmpty || readiness != nil {
            Section("Genel OBD Canlı Teşhis") {
                if let readiness {
                    DisclosureGroup(readiness.summary) {
                        LabeledContent("Ateşleme tipi", value: readiness.ignitionType)
                            .font(.caption2)
                        if !readiness.supportedMonitors.isEmpty {
                            Text("Desteklenen monitorler: " + readiness.supportedMonitors.joined(separator: ", "))
                                .font(.caption2)
                        }
                        if !readiness.incompleteMonitors.isEmpty {
                            Text("Tamamlanmamış: " + readiness.incompleteMonitors.joined(separator: ", "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if !supportedPids.isEmpty {
                    DisclosureGroup("Desteklenen PID'ler • \(supportedPids.count)") {
                        Text(supportedPids.sorted().map { String(format: "0x%02X", $0) }.joined(separator: ", "))
                            .font(.caption2.monospaced())
                            .textSelection(.enabled)
                    }
                }

                let latest = latestValues
                if !latest.isEmpty {
                    ForEach(latest) { sample in
                        LabeledContent(
                            sample.label,
                            value: render(sample.value, unit: sample.unit)
                        )
                        .font(.caption)
                    }
                }

                if mapSamples.count >= 3 {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Manifold basıncı")
                            .font(.caption.weight(.semibold))
                        Chart(mapSamples) { sample in
                            LineMark(
                                x: .value("Zaman", sample.timestamp),
                                y: .value("MAP kPa", sample.value)
                            )
                        }
                        .frame(height: 140)
                    }
                }

                if rpmSamples.count >= 3 {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Motor devri")
                            .font(.caption.weight(.semibold))
                        Chart(rpmSamples) { sample in
                            LineMark(
                                x: .value("Zaman", sample.timestamp),
                                y: .value("RPM", sample.value)
                            )
                        }
                        .frame(height: 120)
                    }
                }

                if let boostAssessment = GenericBoostAnalyzer.assess(samples: samples) {
                    DisclosureGroup("Turbo / P0299 canlı veri analizi") {
                        Text(boostAssessment.summary)
                            .font(.caption.weight(.semibold))
                        ForEach(boostAssessment.findings, id: \.self) { finding in
                            Text("• " + finding)
                                .font(.caption2)
                        }
                        Text("Analiz güveni: \(Int(boostAssessment.confidence * 100))%")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                if !freezeFrame.isEmpty {
                    DisclosureGroup("Freeze Frame") {
                        ForEach(freezeFrame) { item in
                            LabeledContent(
                                item.label,
                                value: render(item.value, unit: item.unit)
                            )
                            .font(.caption2)
                        }
                    }
                }
            }
        }
    }

    private var latestValues: [ThinkDiagLiveSample] {
        let preferred: [UInt8] = [0x0C,0x04,0x0B,0x33,0x10,0x23,0x05,0x0F,0x42]
        return preferred.compactMap { pid in
            samples.last(where: { $0.pid == pid })
        }
    }

    private var mapSamples: [ThinkDiagLiveSample] {
        Array(samples.filter { $0.pid == 0x0B }.suffix(160))
    }

    private var rpmSamples: [ThinkDiagLiveSample] {
        Array(samples.filter { $0.pid == 0x0C }.suffix(160))
    }

    private func render(_ value: Double, unit: String) -> String {
        if unit == "rpm" || unit == "km/h" || unit == "kPa" || unit == "s" {
            return String(format: "%.0f %@", value, unit)
        }
        if unit == "V" {
            return String(format: "%.3f %@", value, unit)
        }
        return String(format: "%.2f %@", value, unit)
    }
}
