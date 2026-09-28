import Foundation

enum EvidenceBackedFeatureCatalog {
    static let all: [EvidenceBackedCodingFeature] = passatB8 + bmwConvenience

    static let passatB8: [EvidenceBackedCodingFeature] = [
        .init(
            id: "vw.passat-b8.comfort-turn-signals",
            title: "Konfor sinyali sayısı",
            description: "Tek dokunuş sinyal tekrar sayısını 1–5 aralığında değiştirir.",
            category: "Konfor",
            risk: .low,
            applicability: .init(
                brands: [.volkswagen],
                modelContains: ["Passat"],
                platformContains: ["B8", "MQB"],
                yearMin: 2014,
                yearMax: 2023,
                requiredModules: ["09", "Central Electrics", "Cent.Elect"],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: []
            ),
            operations: [
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "IDE04923-ENG116587-Turn signal control-Komfortblinken Blinkzyklen",
                    value: "4",
                    securityAccess: "31347"
                )
            ],
            evidence: [
                source(
                    "passat-b8-gist-comfort-blink",
                    .github,
                    "VW Passat B8 VCDS codes",
                    "https://gist.github.com/hesnet/ee39116e0efa3c37aa16480d97074d87",
                    0.82
                ),
                source(
                    "carcoding-passsat-b8-komfortblinker",
                    .forum,
                    "Passat B8 Komfortblinker adaptation",
                    "https://carcoding.at/vw-passat-b8-anpassung-komfortblinker/",
                    0.80
                ),
                source(
                    "motortalk-passat-b8-coding",
                    .forum,
                    "Passat B8 VCDS coding collection",
                    "https://www.motor-talk.de/forum/sammelthread-moegliche-codierungen-mit-vcds-beim-passat-b8-t5076275.html",
                    0.72
                )
            ],
            rollbackRequired: true,
            notes: ["Bazı araçlarda infotainment ışık ayarlarının fabrika ayarına alınması gerekebilir."]
        ),
        .init(
            id: "vw.passat-b8.lock-acoustic-feedback",
            title: "Kilit / açma sesli onayı",
            description: "Uyumlu alarm/BCM donanımında kilitleme ve açma için akustik geri bildirimi etkinleştirir.",
            category: "Konfor",
            risk: .low,
            applicability: .init(
                brands: [.volkswagen],
                modelContains: ["Passat"],
                platformContains: ["B8", "MQB"],
                yearMin: 2014,
                yearMax: 2023,
                requiredModules: ["09"],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: []
            ),
            operations: [
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "Acknowledgement Signals-Akustische Rueckmeldung entriegeln",
                    value: "active",
                    securityAccess: "31347"
                ),
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "Acknowledgement Signals-Akustische Rueckmeldung verriegeln",
                    value: "active",
                    securityAccess: "31347"
                ),
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "Acknowledgement Signals-Menuesteuerung akustische Rueckmeldung",
                    value: "active",
                    securityAccess: "31347"
                )
            ],
            evidence: [
                source(
                    "passat-b8-gist-acoustic-feedback",
                    .github,
                    "VW Passat B8 VCDS codes",
                    "https://gist.github.com/hesnet/ee39116e0efa3c37aa16480d97074d87",
                    0.82
                )
            ],
            rollbackRequired: true,
            notes: ["Araçta uygun siren/alarm donanımı yoksa özellik görünse bile çalışmayabilir."]
        ),
        .init(
            id: "vw.passat-b8.lock-with-ignition-on",
            title: "Kontak açıkken kumandadan kilitle",
            description: "Kontak terminal 15 aktifken uzaktan kumandayla kilitlemeye izin veren BCM adaptasyonunu etkinleştirir.",
            category: "Konfor",
            risk: .low,
            applicability: .init(
                brands: [.volkswagen],
                modelContains: ["Passat"],
                platformContains: ["B8", "MQB"],
                yearMin: 2014,
                yearMax: 2023,
                requiredModules: ["09"],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: []
            ),
            operations: [
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "ENG141651-ENG115754-ZV allgemein-Funk bei Klemme 15 ein",
                    value: "active",
                    securityAccess: "31347"
                )
            ],
            evidence: [
                source(
                    "passat-b8-gist-lock-ignition",
                    .github,
                    "VW Passat B8 VCDS codes",
                    "https://gist.github.com/hesnet/ee39116e0efa3c37aa16480d97074d87",
                    0.82
                )
            ],
            rollbackRequired: true,
            notes: []
        ),
        .init(
            id: "vw.passat-b8.mirror-dip-reverse",
            title: "Geri viteste sağ aynayı indir",
            description: "Desteklenen yolcu kapısı modülü ve elektrikli ayna donanımında geri viteste sağ aynanın aşağı inmesini etkinleştirir.",
            category: "Ayna",
            risk: .low,
            applicability: .init(
                brands: [.volkswagen],
                modelContains: ["Passat"],
                platformContains: ["B8", "MQB"],
                yearMin: 2014,
                yearMax: 2023,
                requiredModules: ["52", "09"],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: ["electric_mirror"]
            ),
            operations: [
                .longCodingBit(module: "52-Door Elect. Pass.", byte: 4, bit: 2, enabled: true),
                .longCodingBit(module: "52-Door Elect. Pass.", byte: 4, bit: 3, enabled: true),
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "ENG141635-ENG116650-Spiegelverstellung-Spiegelabsenkung bei Rueckwaertsfahrt",
                    value: "active",
                    securityAccess: "31347"
                ),
                .adaptation(
                    module: "09-Cent.Elect.",
                    channel: "ENG141635-ENG116657-Spiegelverstellung-Menuesteuerung Spiegelabsenkung",
                    value: "active",
                    securityAccess: "31347"
                )
            ],
            evidence: [
                source(
                    "passat-b8-forum-mirror-dip",
                    .forum,
                    "Passat B8 mirror dip coding",
                    "https://www.passat-b8-forum.de/forum/user-post-list/1009-stroma/",
                    0.78
                ),
                source(
                    "gtiklubben-passsat-b8-mirror-dip",
                    .forum,
                    "Passat B8 VCDS coding archive",
                    "https://www.gtiklubben.nu/forum/archive/index.php/t-23874.html",
                    0.76
                )
            ],
            rollbackRequired: true,
            notes: ["Infotainment menüsündeki ayna ayarı da etkin olmalı."]
        ),
        .init(
            id: "vw.passat-b8.needle-sweep",
            title: "Gösterge ibre selamlaması",
            description: "Uyumlu gösterge panelinde kontak açılışında ibre taramasını etkinleştirir.",
            category: "Gösterge",
            risk: .low,
            applicability: .init(
                brands: [.volkswagen],
                modelContains: ["Passat"],
                platformContains: ["B8", "MQB"],
                yearMin: 2014,
                yearMax: 2023,
                requiredModules: ["17", "Instruments"],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: []
            ),
            operations: [
                .longCodingBit(module: "17-Instruments", byte: 1, bit: 0, enabled: true)
            ],
            evidence: [
                source(
                    "passat-b8-gist-needle-sweep",
                    .github,
                    "VW Passat B8 VCDS codes",
                    "https://gist.github.com/hesnet/ee39116e0efa3c37aa16480d97074d87",
                    0.82
                )
            ],
            rollbackRequired: true,
            notes: []
        )
    ]

    static let bmwConvenience: [EvidenceBackedCodingFeature] = [
        .init(
            id: "bmw.common.mirror-fold-on-lock",
            title: "Kilitlerken aynaları katla",
            description: "Desteklenen BMW/MINI gövde kontrol modülünde kilitlemeyle otomatik ayna katlamayı etkinleştirir.",
            category: "Ayna",
            risk: .low,
            applicability: .init(
                brands: [.bmw, .mini],
                modelContains: [],
                platformContains: [],
                yearMin: 2011,
                yearMax: nil,
                requiredModules: [],
                requiredPartPrefixes: [],
                requiredSoftwareContains: [],
                requiredEquipmentTokens: ["folding_mirrors"]
            ),
            operations: [],
            evidence: [
                source(
                    "reddit-bmw-bimmercode-mirror-fold",
                    .reddit,
                    "BMW owners reporting mirror-fold coding via BimmerCode",
                    "https://www.reddit.com/r/BMW/comments/v5pfv5/is_bimmercode_worth_it_and_what_are_some_of_the/",
                    0.55
                )
            ],
            rollbackRequired: true,
            notes: ["Bu kayıt yalnızca özellik keşfi içindir; exact FDL parametresi araç CAFD sürümüne göre doğrulanmadan tek-tık yazma açılmaz."]
        )
    ]

    private static func source(
        _ id: String,
        _ kind: EvidenceSourceKind,
        _ title: String,
        _ url: String,
        _ confidence: Double
    ) -> CodingEvidenceSource {
        .init(id: id, kind: kind, title: title, url: url, note: nil, confidence: confidence)
    }
}
