import Foundation

enum ManufacturerPackCandidateGenerator {
    static func makeCandidate(
        brand: VehicleBrand,
        observations: [ProtocolObservation]
    ) -> ManufacturerDiagnosticPackManifest {
        let grouped = Dictionary(grouping: observations, by: \.opcode)
        var modules: [ManufacturerModuleRecipe] = []

        for (index, pair) in grouped.sorted(by: { $0.key < $1.key }).enumerated() {
            let opcode = pair.key
            let items = pair.value

            let dids: [ManufacturerDIDDefinition] = items.compactMap { item in
                guard item.service == 0x62,
                      let range = item.detail.range(of: "0x") else { return nil }
                let hex = String(item.detail[range.upperBound...]).prefix(4)
                guard let did = UInt16(hex, radix: 16) else { return nil }
                return .init(
                    did: did,
                    label: String(format: "DID 0x%04X", did),
                    unit: nil,
                    scale: nil,
                    offset: nil,
                    signed: nil
                )
            }
            .reduce(into: [UInt16:ManufacturerDIDDefinition]()) { $0[$1.did] = $1 }
            .values
            .sorted { $0.did < $1.did }

            modules.append(.init(
                id: "learned-\(index + 1)",
                name: "Öğrenilen modül \(index + 1)",
                address: "unknown",
                protocolFamily: .uds,
                transport: .init(
                    vciOpcode: opcode,
                    requestPrefixHex: nil,
                    responsePrefixHex: nil
                ),
                enterSessionHex: "1001",
                keepAliveHex: "3E00",
                readDtcHex: "1902FF",
                clearDtcHex: nil,
                identificationDIDs: dids,
                liveDataDIDs: dids
            ))
        }

        return .init(
            schemaVersion: 2,
            brand: brand,
            packVersion: "learned-candidate",
            supportedVINPrefixes: nil,
            modules: modules,
            codingRecipes: []
        )
    }

    static func exportCandidate(
        brand: VehicleBrand,
        observations: [ProtocolObservation]
    ) throws -> Data {
        let manifest = makeCandidate(brand: brand, observations: observations)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(manifest)
    }
}
