import SwiftUI

struct ManufacturerLiveValueRow: View {
    let item: ManufacturerLiveValue

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.label)
                Text(verbatim: "\(item.moduleName) • DID 0x\(String(format: "%04X", item.did))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(verbatim: displayValue)
                .font(.caption.monospaced())
        }
    }

    private var displayValue: String {
        guard let unit = item.unit, !unit.isEmpty else { return item.textValue }
        return item.textValue + " " + unit
    }
}
