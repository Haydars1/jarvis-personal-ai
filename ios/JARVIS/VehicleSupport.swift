import Foundation

enum VehicleBrand: String, CaseIterable, Codable, Identifiable {
    case generic = "Genel OBD-II"
    case volkswagen = "Volkswagen"
    case audi = "Audi"
    case seat = "SEAT"
    case skoda = "Škoda"
    case mercedes = "Mercedes-Benz"
    case bmw = "BMW"
    case mini = "MINI"
    case opel = "Opel"
    case ford = "Ford"
    case toyota = "Toyota"
    case lexus = "Lexus"
    case honda = "Honda"
    case nissan = "Nissan"
    case renault = "Renault"
    case peugeot = "Peugeot"
    case citroen = "Citroën"
    case fiat = "Fiat"
    case alfaRomeo = "Alfa Romeo"
    case volvo = "Volvo"
    case kia = "Kia"
    case hyundai = "Hyundai"
    case mazda = "Mazda"
    case mitsubishi = "Mitsubishi"
    case porsche = "Porsche"
    case jaguar = "Jaguar"
    case landRover = "Land Rover"
    case tesla = "Tesla"
    case chevrolet = "Chevrolet"
    case jeep = "Jeep"

    var id: String { rawValue }

    static func detect(fromVIN vin: String) -> VehicleBrand {
        let upper = vin.uppercased()
        guard upper.count >= 3 else { return .generic }
        let wmi = String(upper.prefix(3))

        switch wmi {
        case "WVW", "WVG": return .volkswagen
        case "WAU", "TRU": return .audi
        case "VSS": return .seat
        case "TMB": return .skoda
        case "WDB", "WDD", "WDC", "W1K", "W1N": return .mercedes
        case "WBA", "WBS", "WBY": return .bmw
        case "WMW": return .mini
        case "W0L": return .opel
        case "WF0", "1FA", "1FB", "1FM": return .ford
        case "JTD", "JTE", "JT2": return .toyota
        case "JTH": return .lexus
        case "JHM", "SHH": return .honda
        case "JN1", "JN8": return .nissan
        case "VF1": return .renault
        case "VF3": return .peugeot
        case "VF7": return .citroen
        case "ZFA": return .fiat
        case "ZAR": return .alfaRomeo
        case "YV1", "YV4": return .volvo
        case "KNA", "KND": return .kia
        case "KMH", "TMA": return .hyundai
        case "JM1": return .mazda
        case "JMB": return .mitsubishi
        case "WP0", "WP1": return .porsche
        case "SAJ": return .jaguar
        case "SAL": return .landRover
        case "5YJ", "7SA": return .tesla
        case "1G1", "1GC": return .chevrolet
        case "1C4": return .jeep
        default: return .generic
        }
    }
}

enum VehicleProtocolFamily: String, Codable, CaseIterable {
    case obd2 = "OBD-II"
    case uds = "UDS / ISO 14229"
    case kwp2000 = "KWP2000"
    case manufacturerSpecific = "Üretici özel"
}

enum VehicleCapability: String, Codable, CaseIterable, Identifiable {
    case readDtcs = "Hata kodlarını oku"
    case clearDtcs = "Hata kodlarını sil"
    case freezeFrame = "Freeze Frame"
    case liveData = "Canlı veriler"
    case vin = "VIN oku"
    case moduleScan = "Tüm modülleri tara"
    case coding = "Kodlama"
    case adaptations = "Adaptasyon"
    case hiddenFeatures = "Gizli özellikler"
    case serviceFunctions = "Servis fonksiyonları"

    var id: String { rawValue }
}

enum CapabilitySupport: String, Codable {
    case supported = "Destekleniyor"
    case experimental = "Deneysel"
    case requiresPack = "Üretici paketi gerekli"
    case unavailable = "Desteklenmiyor"
}

struct VehicleCapabilityMatrix {
    static func support(for capability: VehicleCapability, brand: VehicleBrand, protocolConfirmed: Bool) -> CapabilitySupport {
        switch capability {
        case .readDtcs, .freezeFrame, .liveData, .vin:
            return protocolConfirmed ? .supported : .experimental
        case .clearDtcs:
            return protocolConfirmed ? .experimental : .unavailable
        case .moduleScan:
            return brand == .generic ? .requiresPack : .requiresPack
        case .coding, .adaptations, .hiddenFeatures, .serviceFunctions:
            return brand == .generic ? .requiresPack : .requiresPack
        }
    }
}
