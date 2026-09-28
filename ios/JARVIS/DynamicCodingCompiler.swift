import Foundation

enum DynamicCodingMutation: Codable, Hashable {
    case setBit(byte: Int, bit: Int, enabled: Bool)
    case setBitField(byte: Int, bitStart: Int, bitLength: Int, value: Int)
}

struct DynamicCodingTemplate: Codable, Hashable {
    let id: String
    let brand: VehicleBrand
    let moduleID: String
    let moduleName: String
    let codingDID: UInt16
    let enterSessionHex: String?
    let securityAccessHint: String?
    let mutations: [DynamicCodingMutation]
    let sourceIDs: [String]
}

struct DynamicCodingPreparedWrite: Hashable {
    let template: DynamicCodingTemplate
    let originalCoding: Data
    let modifiedCoding: Data
    let readRequest: Data
    let writeRequest: Data
    let verifyRequest: Data
}

enum DynamicCodingCompiler {
    static func prepare(
        template: DynamicCodingTemplate,
        readResponse: Data
    ) throws -> DynamicCodingPreparedWrite {
        guard let parsed = UDSCodec.parseReadDID(readResponse),
              parsed.did == template.codingDID else {
            throw NSError(
                domain: "JARVIS.DynamicCoding",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Kodlama bloğu okunamadı"]
            )
        }

        let original = parsed.payload
        var bytes = [UInt8](original)

        for mutation in template.mutations {
            switch mutation {
            case .setBit(let byte, let bit, let enabled):
                guard byte >= 0, byte < bytes.count, bit >= 0, bit < 8 else {
                    throw NSError(
                        domain: "JARVIS.DynamicCoding",
                        code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Byte/bit kodlama alanı araçtaki blokla uyuşmuyor"]
                    )
                }
                let mask = UInt8(1 << bit)
                if enabled {
                    bytes[byte] |= mask
                } else {
                    bytes[byte] &= ~mask
                }

            case .setBitField(let byte, let bitStart, let bitLength, let value):
                guard byte >= 0, byte < bytes.count,
                      bitStart >= 0, bitStart < 8,
                      bitLength > 0, bitStart + bitLength <= 8,
                      value >= 0, value < (1 << bitLength) else {
                    throw NSError(
                        domain: "JARVIS.DynamicCoding",
                        code: 3,
                        userInfo: [NSLocalizedDescriptionKey: "Bit alanı tanımı geçersiz"]
                    )
                }

                let maskInt = ((1 << bitLength) - 1) << bitStart
                let mask = UInt8(maskInt)
                let encoded = UInt8(value << bitStart)
                bytes[byte] = (bytes[byte] & ~mask) | (encoded & mask)
            }
        }

        let modified = Data(bytes)
        return .init(
            template: template,
            originalCoding: original,
            modifiedCoding: modified,
            readRequest: UDSCodec.readDID(template.codingDID),
            writeRequest: UDSCodec.writeDID(template.codingDID, value: modified),
            verifyRequest: UDSCodec.readDID(template.codingDID)
        )
    }
}

enum DynamicCodingTemplateFactory {
    static func from(
        feature: EvidenceBackedCodingFeature,
        brand: VehicleBrand,
        moduleID: String,
        moduleName: String,
        codingDID: UInt16,
        sourceIDs: [String]
    ) -> DynamicCodingTemplate? {
        var mutations: [DynamicCodingMutation] = []

        for operation in feature.operations {
            switch operation {
            case .longCodingBit(let module, let byte, let bit, let enabled):
                guard module.localizedCaseInsensitiveContains(moduleName)
                        || moduleName.localizedCaseInsensitiveContains(module)
                        || module.localizedCaseInsensitiveContains(moduleID) else {
                    continue
                }
                mutations.append(.setBit(byte: byte, bit: bit, enabled: enabled))

            case .longCodingValue(let module, let byte, let bitStart, let bitLength, let value):
                guard module.localizedCaseInsensitiveContains(moduleName)
                        || moduleName.localizedCaseInsensitiveContains(module)
                        || module.localizedCaseInsensitiveContains(moduleID) else {
                    continue
                }
                mutations.append(.setBitField(
                    byte: byte,
                    bitStart: bitStart,
                    bitLength: bitLength,
                    value: value
                ))

            case .adaptation:
                continue
            }
        }

        guard !mutations.isEmpty else { return nil }

        return .init(
            id: "dynamic|\(feature.id)|\(moduleID)",
            brand: brand,
            moduleID: moduleID,
            moduleName: moduleName,
            codingDID: codingDID,
            enterSessionHex: "1003",
            securityAccessHint: nil,
            mutations: mutations,
            sourceIDs: sourceIDs
        )
    }
}
