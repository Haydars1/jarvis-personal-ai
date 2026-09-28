import Foundation

struct DtcExplanation: Identifiable, Hashable {
    var id: String { code }
    let code: String
    let title: String
    let meaning: String
    let likelyCauses: [String]
    let checks: [String]
    let severity: String
}

enum DiagnosticDtcCatalog {
    private static let known: [String:DtcExplanation] = [
        "P0299": .init(
            code: "P0299",
            title: "Turbo / kompresör düşük basınç",
            meaning: "Motor kontrol ünitesi hedeflenen şarj basıncına ulaşılamadığını algıladı.",
            likelyCauses: [
                "Intercooler veya turbo hortumunda kaçak",
                "Vakum / boost kontrol problemi",
                "Turbo aktüatörü veya değişken geometrinin sıkışması",
                "MAP/MAF ölçüm hatası",
                "Egzoz karşı basıncı veya hava yönetimi problemi"
            ],
            checks: [
                "İstenen ve gerçek boost basıncını karşılaştır",
                "MAF, MAP ve aktüatör komutunu aynı anda kaydet",
                "Basınç hattında kaçak testi yap"
            ],
            severity: "Orta"
        ),
        "P0401": .init(
            code: "P0401",
            title: "EGR akışı yetersiz",
            meaning: "ECU beklediği EGR akışını göremiyor.",
            likelyCauses: ["EGR valfi/kanalı tıkalı", "EGR valfi hareket etmiyor", "MAF/EGR hesaplaması uyuşmuyor"],
            checks: ["EGR istenen/gerçek değer", "MAF değişimi", "EGR mekanik hareketi"],
            severity: "Orta"
        ),
        "P2002": .init(
            code: "P2002",
            title: "DPF verimi eşik altında",
            meaning: "ECU partikül filtresinin beklenen filtreleme davranışını görmüyor.",
            likelyCauses: ["DPF doluluğu", "Diferansiyel basınç sensörü", "Egzoz kaçağı", "Rejenerasyon problemi"],
            checks: ["DPF diferansiyel basınç", "Kurum yükü", "Egzoz sıcaklık sensörleri"],
            severity: "Orta"
        ),
        "P0101": .init(
            code: "P0101",
            title: "MAF performans/aralık hatası",
            meaning: "Ölçülen hava kütlesi beklenen model aralığıyla uyuşmuyor.",
            likelyCauses: ["MAF kirli/arıza", "Emme kaçağı", "EGR hava modeli", "Turbo basınç problemi"],
            checks: ["MAF gerçek/hesaplanan", "Boost", "Emme hattı kaçak kontrolü"],
            severity: "Orta"
        ),
        "P0234": .init(
            code: "P0234",
            title: "Turbo aşırı basınç",
            meaning: "ECU izin verilenin üzerinde şarj basıncı algıladı.",
            likelyCauses: ["VNT/wastegate sıkışması", "Boost kontrol valfi", "Yanlış kalibrasyon", "Basınç sensörü"],
            checks: ["İstenen/gerçek boost", "Aktüatör konumu", "N75/boost duty"],
            severity: "Yüksek"
        )
    ]

    static func explain(_ code: String) -> DtcExplanation {
        let normalized = code.uppercased()
        if let known = known[normalized] { return known }

        let family: String
        switch normalized.first {
        case "P": family = "Güç aktarma / motor"
        case "C": family = "Şasi"
        case "B": family = "Gövde"
        case "U": family = "Haberleşme / ağ"
        default: family = "Araç sistemi"
        }

        let generic = normalized.count >= 2 && normalized[normalized.index(after: normalized.startIndex)] == "0"
        return .init(
            code: normalized,
            title: generic ? "Standart OBD-II arıza kodu" : "Üreticiye özel arıza kodu",
            meaning: "\(family) alanında bir arıza kaydı bulundu.",
            likelyCauses: generic
                ? ["Kesin neden için freeze frame ve canlı veriler birlikte incelenmeli."]
                : ["Kesin açıklama için marka/model/ECU üretici veri paketi gerekli."],
            checks: ["Freeze frame oku", "İlgili modülün canlı verilerini kaydet", "Aynı anda oluşan diğer DTC'leri kontrol et"],
            severity: "Belirsiz"
        )
    }
}
