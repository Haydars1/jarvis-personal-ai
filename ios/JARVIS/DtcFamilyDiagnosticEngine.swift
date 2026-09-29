import Foundation

enum DtcDiagnosticDomain: String, CaseIterable, Hashable {
    case boostAir = "Turbo / hava yönetimi"
    case fuelMixture = "Yakıt / karışım"
    case misfire = "Ateşleme / misfire"
    case egrDpf = "EGR / DPF / egzoz"
    case temperature = "Sıcaklık / soğutma"
    case electrical = "Besleme / sensör elektriği"
    case network = "CAN / haberleşme"
    case transmission = "Şanzıman"
    case chassis = "ABS / şasi"
    case body = "Gövde / konfor"
    case restraint = "Airbag / SRS"
    case generic = "Genel teşhis"
}

struct DtcFamilyAssessment: Identifiable, Hashable {
    var id: String { domain.rawValue + "|" + codes.joined(separator: ",") }
    let domain: DtcDiagnosticDomain
    let priority: Int
    let codes: [String]
    let title: String
    let summary: String
    let evidence: [String]
    let recommendedChecks: [String]
    let requestedPids: [UInt8]
    let confidence: Double
}

enum DtcFamilyDiagnosticEngine {
    static func analyze(
        codes: [String],
        samples: [ThinkDiagLiveSample],
        freezeFrame: [ThinkDiagFreezeFrameValue],
        observations: [ThinkDiagPassiveObservation]
    ) -> [DtcFamilyAssessment] {
        let normalized = Array(Set(codes.map { $0.uppercased() })).sorted()
        guard !normalized.isEmpty else { return [] }

        var results: [DtcFamilyAssessment] = []

        appendElectrical(normalized, observations, into: &results)
        appendNetwork(normalized, into: &results)
        appendMisfire(normalized, samples, freezeFrame, into: &results)
        appendFuelMixture(normalized, samples, freezeFrame, into: &results)
        appendBoostAir(normalized, samples, freezeFrame, into: &results)
        appendEgrDpf(normalized, samples, freezeFrame, into: &results)
        appendTemperature(normalized, samples, freezeFrame, into: &results)
        appendTransmission(normalized, into: &results)
        appendChassis(normalized, into: &results)
        appendBody(normalized, into: &results)

        let covered = Set(results.flatMap(\.codes))
        let uncovered = normalized.filter { !covered.contains($0) }
        if !uncovered.isEmpty {
            results.append(.init(
                domain: .generic,
                priority: 45,
                codes: uncovered,
                title: "Diğer DTC'leri freeze-frame ile doğrula",
                summary: "Bu kodlar için genel teşhis akışı kullanılacak; üreticiye özel açıklama/paket varsa onunla zenginleştirilecek.",
                evidence: [],
                recommendedChecks: [
                    "Kodları silmeden önce freeze-frame ve oluşma koşullarını kaydet",
                    "Aynı anda oluşan diğer DTC'lerle ortak besleme/şase/sensör zincirini kontrol et",
                    "İlgili modülün canlı verisini ve ECU parça/yazılım kimliğini kaydet"
                ],
                requestedPids: [0x01,0x04,0x05,0x0C,0x0D,0x42],
                confidence: 0.45
            ))
        }

        return results.sorted {
            if $0.priority != $1.priority { return $0.priority > $1.priority }
            if $0.confidence != $1.confidence { return $0.confidence > $1.confidence }
            return $0.domain.rawValue < $1.domain.rawValue
        }
    }

    static func requestedPids(for codes: [String]) -> [UInt8] {
        let assessments = analyze(
            codes: codes,
            samples: [],
            freezeFrame: [],
            observations: []
        )
        var seen = Set<UInt8>()
        return assessments.flatMap(\.requestedPids).filter { seen.insert($0).inserted }
    }

    private static func appendElectrical(
        _ codes: [String],
        _ observations: [ThinkDiagPassiveObservation],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            $0 == "P0560" || $0 == "P0561" || $0 == "P0562" || $0 == "P0563"
                || $0.hasPrefix("U")
        }
        let voltage = VehicleWriteSafetyGate.latestVoltage(observations)
        guard !matches.isEmpty || voltage.map({ $0 < 12.0 || $0 > 15.5 }) == true else { return }

        var evidence: [String] = []
        var confidence = 0.62
        if let voltage {
            evidence.append(String(format: "Kontrol modülü voltajı %.2f V", voltage))
            if voltage < 12.0 || voltage > 15.5 { confidence += 0.18 }
        }

        results.append(.init(
            domain: .electrical,
            priority: 100,
            codes: matches,
            title: "Besleme voltajı / şaseyi önce doğrula",
            summary: "Düşük/yüksek besleme veya ortak şase sorunu, birden fazla modülde ikincil ve yanıltıcı DTC üretebilir.",
            evidence: evidence,
            recommendedChecks: [
                "Akü açık-devre ve yük altı voltajını ölç",
                "Alternatör şarj voltajını kontrol et",
                "Ana şase noktaları, sigortalar ve ECU beslemelerinde voltaj düşümü testi yap"
            ],
            requestedPids: [0x42],
            confidence: min(confidence, 0.95)
        ))
    }

    private static func appendNetwork(
        _ codes: [String],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter { $0.hasPrefix("U") }
        guard !matches.isEmpty else { return }

        let priority = matches.count >= 2 ? 95 : 72
        results.append(.init(
            domain: .network,
            priority: priority,
            codes: matches,
            title: matches.count >= 2 ? "Çoklu CAN / gateway iletişim sorunu" : "Modül haberleşme arızası",
            summary: matches.count >= 2
                ? "Birden fazla U-kodu ortak besleme, gateway veya CAN hattı problemine işaret edebilir; modülleri tek tek suçlamadan ortak nedeni ele."
                : "Tek haberleşme kodunda ilgili modül beslemesi, bağlantı ve CAN hattı önce doğrulanmalı.",
            evidence: ["\(matches.count) adet U-kodu mevcut"],
            recommendedChecks: [
                "Akü ve modül besleme/şase durumunu doğrula",
                "Gateway ve CAN-H/CAN-L fiziksel hattını kontrol et",
                "İlgili modülün taramada gerçekten çevrimiçi olup olmadığını karşılaştır"
            ],
            requestedPids: [0x42],
            confidence: matches.count >= 2 ? 0.82 : 0.66
        ))
    }

    private static func appendMisfire(
        _ codes: [String],
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            $0 == "P0300" || ($0.count == 5 && $0.hasPrefix("P030"))
        }
        guard !matches.isEmpty else { return }

        let leanPresent = codes.contains("P0171") || codes.contains("P0174")
        let richPresent = codes.contains("P0172") || codes.contains("P0175")
        let stft = latest(pid: 0x06, samples, freeze)
        let ltft = latest(pid: 0x07, samples, freeze)

        var evidence: [String] = []
        if let stft { evidence.append(String(format: "STFT B1 %.1f %%", stft)) }
        if let ltft { evidence.append(String(format: "LTFT B1 %.1f %%", ltft)) }
        if leanPresent { evidence.append("Fakir karışım DTC'si eşlik ediyor") }
        if richPresent { evidence.append("Zengin karışım DTC'si eşlik ediyor") }

        let commonCause = leanPresent || richPresent || abs(stft ?? 0) > 15 || abs(ltft ?? 0) > 15
        results.append(.init(
            domain: .misfire,
            priority: commonCause ? 90 : 82,
            codes: matches,
            title: commonCause ? "Misfire + karışım: ortak nedeni önce ara" : "Misfire'ı silindir bazında ayır",
            summary: commonCause
                ? "Yakıt düzeltmeleri/karışım kodları, tek bir bobinden önce ortak hava-yakıt nedenini kontrol etmeyi gerektiriyor."
                : "Ateşleme, enjektör ve mekanik kompresyon silindir bazında karşılaştırılmalı.",
            evidence: evidence,
            recommendedChecks: [
                "Freeze-frame RPM/yük/sıcaklık koşullarını kaydet",
                "STFT/LTFT, MAF ve yakıt basıncını birlikte değerlendir",
                "Silindir bazında buji/bobin/enjektör swap testi ve gerekirse kompresyon/leak-down yap"
            ],
            requestedPids: [0x04,0x05,0x06,0x07,0x0B,0x0C,0x10,0x23,0x42],
            confidence: commonCause ? 0.84 : 0.72
        ))
    }

    private static func appendFuelMixture(
        _ codes: [String],
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue],
        into results: inout [DtcFamilyAssessment]
    ) {
        let lean = codes.filter { ["P0171","P0174"].contains($0) }
        let rich = codes.filter { ["P0172","P0175"].contains($0) }
        let pressure = codes.filter { $0.hasPrefix("P0087") || $0.hasPrefix("P0088") || $0.hasPrefix("P019") }
        let matches = lean + rich + pressure
        guard !matches.isEmpty else { return }

        let stft = latest(pid: 0x06, samples, freeze)
        let ltft = latest(pid: 0x07, samples, freeze)
        let maf = latest(pid: 0x10, samples, freeze)
        let rail = latest(pid: 0x23, samples, freeze)

        var evidence: [String] = []
        if let stft { evidence.append(String(format: "STFT %.1f %%", stft)) }
        if let ltft { evidence.append(String(format: "LTFT %.1f %%", ltft)) }
        if let maf { evidence.append(String(format: "MAF %.1f g/s", maf)) }
        if let rail { evidence.append(String(format: "Rail %.0f kPa", rail)) }

        let title: String
        let summary: String
        if !lean.isEmpty {
            title = "Fakir karışımın kaynağını ayır"
            summary = "Vakum/emme kaçağı, MAF sapması ve yakıt basıncı aynı anda değerlendirilmelidir."
        } else if !rich.isEmpty {
            title = "Zengin karışımın kaynağını ayır"
            summary = "Enjektör kaçırması, yüksek yakıt basıncı, yanlış MAF/MAP veya purge/EGR etkisi karşılaştırılmalıdır."
        } else {
            title = "Yakıt basıncı kontrol zincirini doğrula"
            summary = "İstenen-gerçek rail basıncı, besleme hattı, pompa ve basınç sensörü/regülatörü birlikte kontrol edilmelidir."
        }

        results.append(.init(
            domain: .fuelMixture,
            priority: 84,
            codes: matches.sorted(),
            title: title,
            summary: summary,
            evidence: evidence,
            recommendedChecks: [
                "STFT/LTFT değerlerini rölanti ve yük altında karşılaştır",
                "MAF/MAP plausibility ve emme kaçak testi yap",
                "Yakıt basıncı/rail değerini yük altında kaydet"
            ],
            requestedPids: [0x04,0x06,0x07,0x08,0x09,0x0B,0x0C,0x10,0x23,0x2E,0x44],
            confidence: evidence.isEmpty ? 0.64 : 0.80
        ))
    }

    private static func appendBoostAir(
        _ codes: [String],
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            ["P0299","P0234","P0236","P0237","P0238","P0100","P0101","P0102","P0103","P0104"].contains($0)
        }
        guard !matches.isEmpty else { return }

        let rpm = latest(pid: 0x0C, samples, freeze)
        let map = latest(pid: 0x0B, samples, freeze)
        let baro = latest(pid: 0x33, samples, freeze)
        let maf = latest(pid: 0x10, samples, freeze)
        let load = latest(pid: 0x04, samples, freeze)

        var evidence: [String] = []
        if let rpm { evidence.append(String(format: "RPM %.0f", rpm)) }
        if let map { evidence.append(String(format: "MAP %.0f kPa", map)) }
        if let baro { evidence.append(String(format: "BARO %.0f kPa", baro)) }
        if let map, let baro { evidence.append(String(format: "Gauge boost %.0f kPa", map - baro)) }
        if let maf { evidence.append(String(format: "MAF %.1f g/s", maf)) }
        if let load { evidence.append(String(format: "Yük %.0f %%", load)) }

        let under = matches.contains("P0299")
        let over = matches.contains("P0234")
        let title = under ? "Düşük boost / hava akış zincirini doğrula"
            : over ? "Aşırı boost kontrol zincirini doğrula"
            : "Hava ölçümü / boost plausibility kontrolü"

        results.append(.init(
            domain: .boostAir,
            priority: under || over ? 86 : 76,
            codes: matches,
            title: title,
            summary: "MAP, BARO, MAF, motor yükü ve üretici özel hedef boost/aktüatör verileri aynı zaman ekseninde karşılaştırılmalı.",
            evidence: evidence,
            recommendedChecks: [
                "Basınç/emme hattına kaçak testi yap",
                "MAP/BARO kontağı açık motor kapalı plausibility kontrolü yap",
                "MAF ve MAP'i yük altında kaydet; üretici DID'i varsa hedef-gerçek boost ve aktüatör komutunu ekle"
            ],
            requestedPids: [0x04,0x0B,0x0C,0x0F,0x10,0x33,0x42],
            confidence: evidence.count >= 3 ? 0.80 : 0.68
        ))
    }

    private static func appendEgrDpf(
        _ codes: [String],
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            $0.hasPrefix("P040") || ["P2002","P242F","P244A","P244B","P2452","P2453","P2454","P2455","P2463"].contains($0)
        }
        guard !matches.isEmpty else { return }

        let egrCommand = latest(pid: 0x2C, samples, freeze)
        let egrError = latest(pid: 0x2D, samples, freeze)
        let maf = latest(pid: 0x10, samples, freeze)
        let catTemp = latest(pid: 0x3C, samples, freeze)

        var evidence: [String] = []
        if let egrCommand { evidence.append(String(format: "EGR komutu %.1f %%", egrCommand)) }
        if let egrError { evidence.append(String(format: "EGR hata %.1f %%", egrError)) }
        if let maf { evidence.append(String(format: "MAF %.1f g/s", maf)) }
        if let catTemp { evidence.append(String(format: "Egzoz/katalizör sıcaklığı %.0f °C", catTemp)) }

        results.append(.init(
            domain: .egrDpf,
            priority: 81,
            codes: matches,
            title: "EGR / DPF / egzoz zincirini birlikte değerlendir",
            summary: "Akış, diferansiyel basınç ve sıcaklık hataları birbirini etkileyebilir; tek parçaya odaklanmadan egzoz-hava yönetimini bir sistem olarak değerlendir.",
            evidence: evidence,
            recommendedChecks: [
                "EGR komutu/gerçek ve MAF tepkisini karşılaştır",
                "DPF diferansiyel basınç, kurum yükü ve rejenerasyon durumunu üretici DID'lerinden oku",
                "EGT sensörlerinin soğuk ve sıcak plausibility değerlerini karşılaştır"
            ],
            requestedPids: [0x04,0x0C,0x10,0x2C,0x2D,0x3C,0x3D,0x3E,0x3F,0x42],
            confidence: evidence.isEmpty ? 0.64 : 0.79
        ))
    }

    private static func appendTemperature(
        _ codes: [String],
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            ["P0115","P0116","P0117","P0118","P0119","P0125","P0128","P0217"].contains($0)
                || $0.hasPrefix("P007")
        }
        guard !matches.isEmpty else { return }

        let ect = latest(pid: 0x05, samples, freeze)
        let iat = latest(pid: 0x0F, samples, freeze)
        let ambient = latest(pid: 0x46, samples, freeze)

        var evidence: [String] = []
        if let ect { evidence.append(String(format: "ECT %.0f °C", ect)) }
        if let iat { evidence.append(String(format: "IAT %.0f °C", iat)) }
        if let ambient { evidence.append(String(format: "Ortam %.0f °C", ambient)) }

        results.append(.init(
            domain: .temperature,
            priority: matches.contains("P0217") ? 96 : 75,
            codes: matches,
            title: matches.contains("P0217") ? "Aşırı sıcaklığı önce güvenli hale getir" : "Sıcaklık sensörü / termostat plausibility kontrolü",
            summary: "Soğuk motorda ECT/IAT/ortam değerleri birbirine yakın olmalı; ısınma eğrisi termostat ve sensör sorunlarını ayırmaya yardımcı olur.",
            evidence: evidence,
            recommendedChecks: [
                "Soğuk başlangıçta ECT, IAT ve ortam sıcaklığını karşılaştır",
                "Isınma süresini ve termostat açılma davranışını kaydet",
                "Sensör besleme/şase ve tesisatını kontrol et"
            ],
            requestedPids: [0x05,0x0F,0x46,0x0C,0x42],
            confidence: evidence.count >= 2 ? 0.82 : 0.66
        ))
    }

    private static func appendTransmission(
        _ codes: [String],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            $0.hasPrefix("P07") || $0.hasPrefix("P17")
        }
        guard !matches.isEmpty else { return }

        results.append(.init(
            domain: .transmission,
            priority: 80,
            codes: matches,
            title: "Şanzıman arızasını TCM verisiyle ayır",
            summary: "Generic güç aktarma kodu tek başına mekanik şanzıman arızası anlamına gelmez; TCM üretici kodları ve canlı değerler gerekli.",
            evidence: [],
            recommendedChecks: [
                "TCM'yi üretici modül taramasında ayrı tara",
                "Yağ sıcaklığı, giriş/çıkış devirleri ve seçili/gerçek vitesi kaydet",
                "Besleme voltajı ve şanzıman tesisatını kontrol et"
            ],
            requestedPids: [0x0C,0x0D,0x42],
            confidence: 0.62
        ))
    }

    private static func appendChassis(
        _ codes: [String],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter { $0.hasPrefix("C") }
        guard !matches.isEmpty else { return }

        results.append(.init(
            domain: .chassis,
            priority: 78,
            codes: matches,
            title: "ABS / şasi üretici modül verisini tara",
            summary: "C-kodlarının kesin anlamı marka/modül bazında değişebilir. Teker hızları, direksiyon açısı, fren basıncı ve besleme durumu modül paketiyle okunmalı.",
            evidence: [],
            recommendedChecks: [
                "ABS/ESP modülündeki üretici DTC açıklamasını kullan",
                "Dört teker hızını aynı anda karşılaştır",
                "Sensör kablosu, rulman encoder halkası ve modül beslemesini kontrol et"
            ],
            requestedPids: [0x0D,0x42],
            confidence: 0.58
        ))
    }

    private static func appendBody(
        _ codes: [String],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter { $0.hasPrefix("B") }
        guard !matches.isEmpty else { return }

        results.append(.init(
            domain: .body,
            priority: 62,
            codes: matches,
            title: "Gövde/konfor modülünü üretici verisiyle doğrula",
            summary: "B-kodları BCM, kapı, klima, aydınlatma ve diğer gövde modüllerinde üreticiye özgüdür.",
            evidence: [],
            recommendedChecks: [
                "İlgili gövde modülünün parça/SW kimliğini doğrula",
                "Üretici DTC açıklaması ve measuring values kullan",
                "Besleme, şase ve LIN/CAN alt ağlarını kontrol et"
            ],
            requestedPids: [0x42],
            confidence: 0.55
        ))
    }

    private static func appendRestraint(
        _ codes: [String],
        into results: inout [DtcFamilyAssessment]
    ) {
        let matches = codes.filter {
            $0.hasPrefix("B0") && ($0.contains("0") || $0.contains("1"))
        }
        guard !matches.isEmpty else { return }

        results.append(.init(
            domain: .restraint,
            priority: 92,
            codes: matches,
            title: "SRS / airbag arızasını önceliklendir",
            summary: "SRS kodlarında üretici modül açıklaması ve bağlantı durumu esas alınmalı; direnç/ateşleyici devresine rastgele enerji uygulanmamalı.",
            evidence: [],
            recommendedChecks: [
                "SRS modülü üretici DTC açıklamasını oku",
                "Akü/besleme ve konektör durumunu üretici prosedürüne göre kontrol et",
                "Ateşleyici devrelerinde yalnız uygun ölçüm prosedürünü kullan"
            ],
            requestedPids: [0x42],
            confidence: 0.60
        ))
    }

    private static func latest(
        pid: UInt8,
        _ samples: [ThinkDiagLiveSample],
        _ freeze: [ThinkDiagFreezeFrameValue]
    ) -> Double? {
        samples.last(where: { $0.pid == pid })?.value
            ?? freeze.last(where: { $0.pid == pid })?.value
    }
}
