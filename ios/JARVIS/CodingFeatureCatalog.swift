import Foundation

enum CodingRisk: String, Codable, CaseIterable, Hashable {
    case low = "Düşük"
    case medium = "Orta"
    case high = "Yüksek"
}

enum CodingOperationKind: String, Codable, Hashable {
    case coding = "Kodlama"
    case adaptation = "Adaptasyon"
    case hiddenFeature = "Gizli özellik"
    case service = "Servis fonksiyonu"
}

struct CodingFeatureDescriptor: Identifiable, Hashable {
    let id: String
    let brand: VehicleBrand
    let module: String
    let title: String
    let description: String
    let kind: CodingOperationKind
    let risk: CodingRisk
    let requiresBackup: Bool
    let requiresSecurityAccess: Bool
    let supportedTransports: [VehicleProtocolFamily]
}

struct CodingFeaturePack {
    let brand: VehicleBrand
    let features: [CodingFeatureDescriptor]
}

enum CodingFeatureCatalog {
    static func pack(for brand: VehicleBrand) -> CodingFeaturePack {
        switch brand {
        case .volkswagen, .audi, .seat, .skoda:
            return .init(brand: brand, features: [
                feature("vag.comfortBlink", brand, "BCM", "Konfor sinyal sayısı", "Tek dokunuş sinyal tekrar sayısını değiştirir.", .adaptation, .low),
                feature("vag.autoLock", brand, "BCM", "Hareket halinde otomatik kilit", "Belirli hızdan sonra kapıları otomatik kilitler.", .hiddenFeature, .low),
                feature("vag.mirrorFold", brand, "Door/BCM", "Kilitlerken aynaları katla", "Uyumlu kapı modüllerinde kilitlemeyle ayna katlamayı etkinleştirir.", .hiddenFeature, .low),
                feature("vag.needleSweep", brand, "Instrument Cluster", "Gösterge ibre testi", "Kontak açılışında ibre selamlamasını etkinleştirir.", .hiddenFeature, .low),
                feature("vag.drlBehavior", brand, "BCM", "DRL davranışı", "Uyumlu araçlarda gündüz farı davranışını değiştirir.", .coding, .medium)
            ])
        case .mercedes:
            return .init(brand: brand, features: [
                feature("mb.lockFeedback", brand, "SAM", "Kilit geri bildirimi", "Uyumlu SAM modülünde kilit geri bildirim seçeneklerini değiştirir.", .coding, .low),
                feature("mb.welcomeLights", brand, "SAM", "Welcome / coming-home ışıkları", "Uyumlu araçlarda karşılama aydınlatmasını yapılandırır.", .hiddenFeature, .low),
                feature("mb.mirrorFold", brand, "Door/SAM", "Kilitlerken aynaları katla", "Uyumlu donanımda otomatik ayna katlamayı etkinleştirir.", .hiddenFeature, .low)
            ])
        case .bmw, .mini:
            return .init(brand: brand, features: [
                feature("bmw.digitalSpeed", brand, "KOMBI", "Dijital hız göstergesi", "Uyumlu gösterge panelinde dijital hız bilgisini etkinleştirir.", .hiddenFeature, .low),
                feature("bmw.mirrorFold", brand, "FEM/BDC", "Kilitlerken aynaları katla", "Uyumlu araçlarda otomatik ayna katlama davranışını değiştirir.", .hiddenFeature, .low),
                feature("bmw.startStopMemory", brand, "FEM/BDC", "Start/Stop hafızası", "Uyumlu araçlarda son seçimin hatırlanmasını yapılandırır.", .coding, .medium)
            ])
        default:
            return .init(brand: brand, features: [])
        }
    }

    static var coveredBrands: [VehicleBrand] {
        VehicleBrand.allCases.filter { $0 != .generic }
    }

    private static func feature(
        _ id: String,
        _ brand: VehicleBrand,
        _ module: String,
        _ title: String,
        _ description: String,
        _ kind: CodingOperationKind,
        _ risk: CodingRisk
    ) -> CodingFeatureDescriptor {
        .init(
            id: id,
            brand: brand,
            module: module,
            title: title,
            description: description,
            kind: kind,
            risk: risk,
            requiresBackup: true,
            requiresSecurityAccess: false,
            supportedTransports: [.uds, .manufacturerSpecific]
        )
    }
}

struct CodingBackupRecord: Codable, Identifiable {
    let id: UUID
    let createdAt: Date
    let vin: String?
    let brand: VehicleBrand
    let module: String
    let featureID: String
    let originalValueHex: String
}

enum CodingSafetyPolicy {
    static let blockedKeywords = [
        "immobilizer", "immo", "odometer", "mileage", "airbag crash", "srs crash",
        "key programming", "anahtar programlama", "kilometre", "emniyet kemeri devre dışı"
    ]

    static func isAllowed(_ feature: CodingFeatureDescriptor) -> Bool {
        let text = "\(feature.title) \(feature.description)".lowercased()
        return !blockedKeywords.contains(where: { text.contains($0) })
    }
}
