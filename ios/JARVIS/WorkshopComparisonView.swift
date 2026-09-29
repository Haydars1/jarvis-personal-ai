import SwiftUI

struct WorkshopComparisonView: View {
    let comparison: WorkshopDtcDiff

    var body: some View {
        DisclosureGroup("Önceki taramayla karşılaştır") {
            if !comparison.newCodes.isEmpty {
                comparisonLine(title: "Yeni", codes: comparison.newCodes)
            }
            if !comparison.resolvedCodes.isEmpty {
                comparisonLine(title: "Artık görünmüyor", codes: comparison.resolvedCodes)
            }
            if !comparison.persistentCodes.isEmpty {
                comparisonLine(title: "Devam eden", codes: comparison.persistentCodes)
            }
        }
    }

    @ViewBuilder
    private func comparisonLine(title: String, codes: [String]) -> some View {
        let value = codes.joined(separator: ", ")
        Text(verbatim: "\(title): \(value)")
            .font(.caption)
    }
}
