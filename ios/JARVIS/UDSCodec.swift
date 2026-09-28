import Foundation

enum UDSService: UInt8, Codable {
    case diagnosticSessionControl = 0x10
    case ecuReset = 0x11
    case readDataByIdentifier = 0x22
    case readMemoryByAddress = 0x23
    case securityAccess = 0x27
    case communicationControl = 0x28
    case writeDataByIdentifier = 0x2E
    case routineControl = 0x31
    case requestDownload = 0x34
    case transferData = 0x36
    case requestTransferExit = 0x37
    case testerPresent = 0x3E
    case controlDTCSetting = 0x85
    case readDTCInformation = 0x19
}

struct UDSNegativeResponse: Hashable {
    let rejectedService: UInt8
    let code: UInt8

    var message: String {
        switch code {
        case 0x10: return "Genel ret"
        case 0x11: return "Servis desteklenmiyor"
        case 0x12: return "Alt fonksiyon desteklenmiyor"
        case 0x13: return "Mesaj uzunluğu/format hatası"
        case 0x21: return "ECU meşgul"
        case 0x22: return "Koşullar uygun değil"
        case 0x24: return "İstek sırası hatalı"
        case 0x31: return "İstek aralık dışında"
        case 0x33: return "Güvenlik erişimi reddedildi"
        case 0x35: return "Geçersiz anahtar"
        case 0x36: return "Deneme sayısı aşıldı"
        case 0x37: return "Gerekli bekleme süresi dolmadı"
        case 0x78: return "Yanıt bekleniyor"
        default: return String(format: "NRC 0x%02X", code)
        }
    }
}

struct UDSDTCRecord: Identifiable, Hashable {
    var id: String { String(format: "%06X", rawCode) + "-" + String(format: "%02X", status) }
    let rawCode: UInt32
    let status: UInt8

    var hexCode: String { String(format: "%06X", rawCode) }
    var isTestFailed: Bool { status & 0x01 != 0 }
    var isPending: Bool { status & 0x04 != 0 }
    var isConfirmed: Bool { status & 0x08 != 0 }
    var warningIndicatorRequested: Bool { status & 0x80 != 0 }
}

enum UDSCodec {
    static func diagnosticSession(_ session: UInt8) -> Data {
        Data([UDSService.diagnosticSessionControl.rawValue, session])
    }

    static func testerPresent() -> Data {
        Data([UDSService.testerPresent.rawValue, 0x00])
    }

    static func readDID(_ did: UInt16) -> Data {
        Data([
            UDSService.readDataByIdentifier.rawValue,
            UInt8((did >> 8) & 0xFF),
            UInt8(did & 0xFF)
        ])
    }

    static func readAllDTCs(statusMask: UInt8 = 0xFF) -> Data {
        Data([UDSService.readDTCInformation.rawValue, 0x02, statusMask])
    }

    static func clearDiagnosticInformation(group: UInt32 = 0xFFFFFF) -> Data {
        Data([
            0x14,
            UInt8((group >> 16) & 0xFF),
            UInt8((group >> 8) & 0xFF),
            UInt8(group & 0xFF)
        ])
    }

    static func writeDID(_ did: UInt16, value: Data) -> Data {
        var out = Data([
            UDSService.writeDataByIdentifier.rawValue,
            UInt8((did >> 8) & 0xFF),
            UInt8(did & 0xFF)
        ])
        out.append(value)
        return out
    }

    static func parseNegative(_ data: Data) -> UDSNegativeResponse? {
        let b = [UInt8](data)
        guard b.count >= 3, b[0] == 0x7F else { return nil }
        return .init(rejectedService: b[1], code: b[2])
    }

    static func parseReadDID(_ data: Data) -> (did: UInt16, payload: Data)? {
        let b = [UInt8](data)
        guard b.count >= 3, b[0] == 0x62 else { return nil }
        let did = (UInt16(b[1]) << 8) | UInt16(b[2])
        return (did, Data(b.dropFirst(3)))
    }

    static func parseDTCResponse(_ data: Data) -> [UDSDTCRecord] {
        let b = [UInt8](data)
        guard b.count >= 3, b[0] == 0x59 else { return [] }

        var offset = 2
        if b.count >= 3 { offset = 3 } // status availability mask after subfunction

        var result: [UDSDTCRecord] = []
        while offset + 3 < b.count {
            let raw = (UInt32(b[offset]) << 16)
                | (UInt32(b[offset + 1]) << 8)
                | UInt32(b[offset + 2])
            let status = b[offset + 3]
            result.append(.init(rawCode: raw, status: status))
            offset += 4
        }
        return result
    }
}
