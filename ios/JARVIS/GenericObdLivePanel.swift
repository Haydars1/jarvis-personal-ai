import SwiftUI
import Charts

struct GenericObdLivePanel: View {
    let samples: [ThinkDiagLiveSample]
    let supportedPids: Set<UInt8>
    let freezeFrame: [ThinkDiagFreezeFrameValue]
    let p0299Active: Bool

    var body: some View {
        if !samples.isEmpty || !supportedPids.isEmpty || !freezeFrame.isEmpty {
            Section("Genel OBD Canlı Teşhis") {
                if !supportedPids.isEmpty {
                    DisclosureGroup("Desteklenen PID'ler • (supportedPids.count)") {
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

                if chartSamples.count >= 3 {
                    Chart(chartSamples) { sample in
                        LineMark(
                            x: .value("Zaman", sample.timestamp),
                            y: .value(sample.label, sample.value),
                            series: .value("PID", sample.label)
                        )
                    }
                    .frame(height: 180)
                    .chartLegend(position: .bottom)
                }

                if p0299Active, let assessment = GenericBoostAnalyzer.assess(samples: samples) {
                    DisclosureGroup("P0299 sürüş verisi analizi") {
                        Text(assessment.summary)
                            .font(.caption.weight(.semibold))
                        ForEach(assessment.findings, id: .self) { finding in
                            Text("• " + finding)
                                .font(.caption2)
                        }
                        Text("Güven: (Int(assessment.confidence * 100))%")
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

    private var chartSamples: [ThinkDiagLiveSample] {
        let chartPids: Set<UInt8> = [0x0B,0x10,0x0C]
        return Array(samples.filter { chartPids.contains($0.pid) }.suffix(240))
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
