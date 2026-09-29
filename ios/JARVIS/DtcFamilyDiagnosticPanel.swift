import SwiftUI

struct DtcFamilyDiagnosticPanel: View {
    let assessments: [DtcFamilyAssessment]
    let moduleAssessments: [ManufacturerModuleAssessment]

    var body: some View {
        if !assessments.isEmpty || !moduleAssessments.isEmpty {
            Section("Akıllı Arıza Teşhisi") {
                ForEach(assessments) { item in
                    DisclosureGroup {
                        Text(item.summary)
                            .font(.caption)

                        if !item.evidence.isEmpty {
                            Text("Kanıt")
                                .font(.caption.weight(.semibold))
                            ForEach(item.evidence, id: \.self) {
                                Text("• " + $0)
                                    .font(.caption2)
                            }
                        }

                        Text("Kontrol sırası")
                            .font(.caption.weight(.semibold))
                        ForEach(item.recommendedChecks, id: \.self) {
                            Text("• " + $0)
                                .font(.caption2)
                        }

                        if !item.requestedPids.isEmpty {
                            Text(
                                "İlgili PID: " +
                                item.requestedPids.map { String(format: "0x%02X", $0) }.joined(separator: ", ")
                            )
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                        }

                        Text("Güven: \(Int(item.confidence * 100))%")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title)
                                Text(item.domain.rawValue + " • " + item.codes.joined(separator: ", "))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("P\(item.priority)")
                                .font(.caption2.monospaced())
                        }
                    }
                }

                ForEach(moduleAssessments) { item in
                    DisclosureGroup {
                        Text("Adres: \(item.address)")
                            .font(.caption2.monospaced())
                        Text("DTC: " + item.dtcCodes.joined(separator: ", "))
                            .font(.caption2.monospaced())
                            .textSelection(.enabled)
                        ForEach(item.checks, id: \.self) {
                            Text("• " + $0)
                                .font(.caption2)
                        }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title)
                                Text(item.moduleName)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("P\(item.priority)")
                                .font(.caption2.monospaced())
                        }
                    }
                }
            }
        }
    }
}
