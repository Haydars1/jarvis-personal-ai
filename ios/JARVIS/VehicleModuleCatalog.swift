import Foundation

enum VehicleModuleKind: String, CaseIterable, Codable, Identifiable {
    case engine = "Motor"
    case transmission = "Şanzıman"
    case abs = "ABS / ESP"
    case airbag = "Airbag / SRS"
    case body = "BCM / Gövde"
    case steering = "Direksiyon"
    case cluster = "Gösterge"
    case hvac = "Klima"
    case gateway = "Gateway"
    case parking = "Park sistemi"
    case infotainment = "Multimedya"
    case doors = "Kapı modülleri"
    case battery = "Akü / Enerji"
    case suspension = "Süspansiyon"
    case awd = "4x4 / AWD"

    var id: String { rawValue }
}

struct VehicleModuleDescriptor: Identifiable, Hashable {
    var id: String { "\(kind.rawValue)|\(logicalName)" }
    let kind: VehicleModuleKind
    let logicalName: String
    let protocolFamily: VehicleProtocolFamily
    let manufacturerPackRequired: Bool
}

enum VehicleModuleCatalog {
    static func modules(for brand: VehicleBrand) -> [VehicleModuleDescriptor] {
        let standard: [VehicleModuleDescriptor] = [
            .init(kind: .engine, logicalName: "Engine ECU", protocolFamily: .obd2, manufacturerPackRequired: false),
            .init(kind: .transmission, logicalName: "Transmission", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .abs, logicalName: "ABS/ESP", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .airbag, logicalName: "SRS", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .body, logicalName: "Body Control", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .steering, logicalName: "Steering", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .cluster, logicalName: "Instrument Cluster", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .hvac, logicalName: "HVAC", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .gateway, logicalName: "Gateway", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .parking, logicalName: "Parking", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .infotainment, logicalName: "Infotainment", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .doors, logicalName: "Door Electronics", protocolFamily: .uds, manufacturerPackRequired: true),
            .init(kind: .battery, logicalName: "Energy Management", protocolFamily: .uds, manufacturerPackRequired: true)
        ]

        switch brand {
        case .bmw, .mini:
            return standard + [.init(kind: .suspension, logicalName: "EDC", protocolFamily: .manufacturerSpecific, manufacturerPackRequired: true)]
        case .mercedes:
            return standard + [.init(kind: .suspension, logicalName: "AIRMATIC", protocolFamily: .manufacturerSpecific, manufacturerPackRequired: true)]
        case .volkswagen, .audi, .seat, .skoda:
            return standard + [.init(kind: .awd, logicalName: "AWD/Haldex", protocolFamily: .uds, manufacturerPackRequired: true)]
        default:
            return standard
        }
    }
}
