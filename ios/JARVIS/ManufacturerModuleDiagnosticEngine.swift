import Foundation

struct ManufacturerModuleAssessment: Identifiable, Hashable {
    var id: String { moduleID }
    let moduleID: String
    let moduleName: String
    let address: String
    let dtcCodes: [String]
    let priority: Int
    let title: String
    let checks: [String]
}

enum ManufacturerModuleDiagnosticEngine {
    static func analyze(_ modules: [ModuleScanResult]) -> [ManufacturerModuleAssessment] {
        modules.compactMap { module in
            guard !module.dtcs.isEmpty else { return nil }

            let lower = module.moduleName.lowercased()
            let domain: (priority: Int, title: String, checks: [String])

            if lower.contains("airbag") || lower.contains("srs") || lower.contains("restraint") {
                domain = (
                    95,
                    "SRS / airbag modülünü önceliklendir",
                    [
                        "DTC status bitlerini ve crash/event durumunu üretici verisiyle doğrula",
                        "Besleme/şase ve konektörleri üretici prosedürüne göre kontrol et",
                        "Ateşleyici devrelerine rastgele enerji/direnç uygulama"
                    ]
                )
            } else if lower.contains("abs") || lower.contains("esp") || lower.contains("brake") {
                domain = (
                    88,
                    "ABS / ESP modülünü canlı teker verisiyle ayır",
                    [
                        "Dört teker hızını aynı zaman ekseninde karşılaştır",
                        "Direksiyon açısı/fren basıncı/yaw sensörü plausibility değerlerini oku",
                        "Sensör kablosu, rulman encoder ve modül beslemesini kontrol et"
                    ]
                )
            } else if lower.contains("trans") || lower.contains("gear") || lower.contains("tcm") {
                domain = (
                    86,
                    "Şanzıman modülünü üretici canlı verisiyle doğrula",
                    [
                        "Yağ sıcaklığı ile giriş/çıkış devirlerini kaydet",
                        "Seçili ve gerçek vites/aktuator durumunu karşılaştır",
                        "Besleme/şase ve şanzıman tesisatını kontrol et"
                    ]
                )
            } else if lower.contains("engine") || lower.contains("motor") || lower.contains("ecu") {
                domain = (
                    84,
                    "Motor ECU DTC'lerini freeze-frame ve canlı veriyle korele et",
                    [
                        "DTC status ve oluşma koşullarını kaydet",
                        "İlgili üretici DID'lerini generic OBD ile aynı zaman ekseninde izle",
                        "Birden fazla kod varsa ortak hava/yakıt/besleme zincirini önce ele"
                    ]
                )
            } else if lower.contains("gateway") {
                domain = (
                    92,
                    "Gateway / ağ topolojisini önce kontrol et",
                    [
                        "Çevrimdışı kalan modülleri topolojiyle karşılaştır",
                        "CAN/LIN ağları ve ortak besleme/şaseyi kontrol et",
                        "Tek tek modül değiştirmeden önce gateway DTC zincirini çöz"
                    ]
                )
            } else if lower.contains("body") || lower.contains("bcm") || lower.contains("door") {
                domain = (
                    68,
                    "Gövde modülü DTC'lerini ekipman durumuyla eşleştir",
                    [
                        "Modül parça/SW kimliğini ve araç opsiyonlarını doğrula",
                        "LIN/CAN alt ağ ve besleme/şaseyi kontrol et",
                        "Adaptasyon/kodlama sonrası oluştuysa mevcut coding ile backup'ı karşılaştır"
                    ]
                )
            } else {
                domain = (
                    60,
                    "\(module.moduleName) DTC'lerini üretici paketinden doğrula",
                    [
                        "DTC status bitlerini kaydet",
                        "İlgili modül identification/live-data değerlerini oku",
                        "Besleme/şase ve ağ bağlantısını kontrol et"
                    ]
                )
            }

            return .init(
                moduleID: module.moduleID,
                moduleName: module.moduleName,
                address: module.address,
                dtcCodes: module.dtcs.map(\.hexCode).sorted(),
                priority: domain.priority,
                title: domain.title,
                checks: domain.checks
            )
        }
        .sorted {
            if $0.priority != $1.priority { return $0.priority > $1.priority }
            return $0.moduleName < $1.moduleName
        }
    }
}
