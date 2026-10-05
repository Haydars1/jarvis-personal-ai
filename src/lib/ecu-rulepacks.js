// JARVIS ECU Rulepacks — kamuya açık GitHub depolarından ve topluluk kaynaklarından
// derlenmiş ECU ailesi/firmware tanım paketleri.
//
// HER KALEMDE kaynak linki var. Hiçbir proprietary DAMOS/A2L içermez — sadece
// açık lisanslı (GPL/MIT) depolardan + nefmoto/digital-kaos benzeri topluluk
// forumlarında belgelenmiş bilgiler.
//
// Haydar başlangıçta bu paketleri aldığı dosyalar için kullanır; zamanla kendi
// XDF/A2L dosyalarını yükleyerek genişletir.

export const RULEPACKS = [

  // ========== BOSCH ME7 / ME7.5 (VAG 1.8T 20V, 2.7TT era) ==========
  {
    family: 'bosch_me7',
    familyName: 'Bosch ME7 / ME7.5',
    description: 'VAG 1.8T 20V, 2.7TT (Audi/VW/Skoda/Seat 1997-2006 benzinli)',
    sources: [
      { name: 'gunnar-die/Bosch-ME7-Tuning', url: 'https://github.com/gunnar-die/Bosch-ME7-Tuning', license: 'GPL-3.0' },
      { name: 'TracqiTechnology/MxT', url: 'https://github.com/TracqiTechnology/MxT', note: 'ME7 M-box, B5 S4/RS4 2.7T, B5/B6 A4 1.8T, Audi TT 1.8T, VW Golf 1.8T' },
      { name: 'AmesisProject/ME7Tuner', url: 'https://github.com/AmesisProject/ME7Tuner', license: 'MIT' },
      { name: 'bonacci31/20VT-Tuner-Helper', url: 'https://github.com/bonacci31/20VT-Tuner-Helper', note: 'KFMIRL/KFMIOP/KFZWOP/LDRXN hesapları' }
    ],
    // Dosya kimliği: tipik boyut + marker string'ler
    identify: {
      sizeHints: [524288, 1048576],
      strings: [/ME7\.5?[\.\s]/i, /BOSCH/i, /03G\d{6}/, /8E09\d{5}/, /06A\d{6}/]
    },
    // Firmware'e özel bilinen adresler
    firmwares: {
      '8E0909518AK_368072': {
        name: 'Audi B6/B7 1.8T — 8E0909518AK (SW 368072)',
        source: 'https://github.com/gunnar-die/Bosch-ME7-Tuning (TylerW XDF)',
        hwMarkers: ['8E0909518AK'],
        actions: [
          { id: 'me7_8E0909518AK_sai_off', label: 'SAI Off (Secondary Air Injection)', detail: 'CDSLS @ 0x181B0 → 0x00 (SAI monitörü devre dışı; EOBD DTC\'leri temizlenir)', offset: 0x181B0, expectedByte: null, newByte: 0x00, risk: 'low', confidence: 'high' }
        ]
      }
    },
    // Aile çapında yardımcı aramalar — ZedSuite tarzı
    familyMaps: [
      { name: 'KFMIRL',  desc: 'İstek torku → yük (torque→load) haritası — Stage 1\'in kalbi' },
      { name: 'KFMIOP',  desc: 'Optimal yük haritası — torque çıkış sınırı' },
      { name: 'KFZWOP',  desc: 'Optimal ateşleme avansı haritası' },
      { name: 'LDRXN',   desc: 'Boost soll (hedef türbin basıncı)' },
      { name: 'KFLDHBN', desc: 'Boost oran karakteristiği' },
      { name: 'MLHFM',   desc: 'MAF (HFM) kalibrasyon tablosu' }
    ],
    notes: 'ME7 Stage 1 için gerçek haritalar aile çapında isim-tabanlıdır; MxT (XDF yüklemeli) veya TunerPro ile tam harita düzenleme yapılır. JARVIS burada sadece string konumlarını işaretler.'
  },

  // ========== BOSCH EDC15 / EDC16 (VAG dizel, eski nesil) ==========
  {
    family: 'bosch_edc15_edc16',
    familyName: 'Bosch EDC15 / EDC16',
    description: 'VAG 1.9/2.0 TDI (A4 B5/B6/B7, Golf 4/5, Passat B5/B6, Octavia 1/2) — 1998-2008',
    sources: [
      { name: 'tremaudanlenny-arch/breizhreprog (ZedSuite)', url: 'https://github.com/tremaudanlenny-arch/breizhreprog', note: 'EDC15/EDC16 otomatik harita tespiti: Driver Wish, Turbo Boost, N75, SOI, torque limiters' },
      { name: 'LeZed97/ZedSuite', url: 'https://github.com/LeZed97/ZedSuite', note: 'Aynı proje — Rust tabanlı motor' },
      { name: 'H-ishak/ZedSuite', url: 'https://github.com/H-ishak/ZedSuite', note: '"EGR off/DPF off otomatik değil, dosyayı anla" felsefesi' }
    ],
    identify: {
      sizeHints: [524288, 1048576],
      strings: [/EDC1[56]/i, /^EDC/, /038906019/, /03G906016/, /03L906022/]
    },
    firmwares: {},
    familyMaps: [
      { name: 'Driver Wish',    desc: 'Pedal → istek torku' },
      { name: 'Turbo Boost',    desc: 'Soll boost basıncı (bar)' },
      { name: 'N75 Duty Cycle', desc: 'Wastegate solenoid görev döngüsü' },
      { name: 'SOI',            desc: 'Start of Injection — enjeksiyon avansı' },
      { name: 'Torque Limiter', desc: 'Tork sınırlama tabloları (gear/vmax tabanlı)' },
      { name: 'Smoke Limiter',  desc: 'Duman sınırı (MAF/pedal)' },
      { name: 'IQ Limiter',     desc: 'Enjeksiyon miktarı limit (mg/stroke)' }
    ],
    notes: 'EDC15/16 için ZedSuite\'in Rust motoru otomatik harita bulma yapar; sonuçları XDF/JSON olarak dışa aktarabilirsin.'
  },

  // ========== BOSCH EDC17 (modern dizel) ==========
  {
    family: 'bosch_edc17',
    familyName: 'Bosch EDC17',
    description: 'VAG/BMW/Mercedes/Opel/Ford modern dizel (EDC17C/CP/CV, 2008-2020+)',
    sources: [
      { name: 'ConnorHowell/medc17-checksum-tool', url: 'https://github.com/ConnorHowell/medc17-checksum-tool', note: 'Checksum/CVN düzeltme — modifiye dosyayı yazmadan ÖNCE şart' },
      { name: 'bri3d/a2l2xdf', url: 'https://github.com/bri3d/a2l2xdf', note: 'A2L → TunerPro XDF dönüşüm (müşteriden A2L alırsan)' },
      { name: 'Nefarious Motorsports forum', url: 'http://nefariousmotorsports.com/forum/', note: 'EDC17CP14 ve varyantları için XDF istek/paylaşımı' }
    ],
    identify: {
      sizeHints: [2097152, 4194304, 8388608],
      strings: [/EDC17/i, /0281\d{6}/, /03L906018/, /03L906019/, /03L906021/]
    },
    firmwares: {},
    familyMaps: [
      { name: 'IQ Base',         desc: 'Temel enjeksiyon miktarı' },
      { name: 'IQ Limit MAF',    desc: 'MAF tabanlı IQ sınırı' },
      { name: 'Rail Pressure',   desc: 'Rail basınç haritası' },
      { name: 'Boost Soll',      desc: 'Boost hedef' },
      { name: 'Boost IST Limit', desc: 'Boost üst sınır' },
      { name: 'Torque Limit',    desc: 'Tork sınırı (gear/rpm)' },
      { name: 'DPF Regen',       desc: 'DPF rejenerasyon tetikleri' },
      { name: 'EGR Flow',        desc: 'EGR akış haritası' },
      { name: 'SCR Dosing',      desc: 'AdBlue doz haritası' }
    ],
    notes: 'EDC17 TriCore işlemcili — modifikasyondan SONRA mutlaka checksum düzelt. medc17-checksum-tool bunu yapar. KT200 ile oku, map düzenle, checksum düzelt, geri yaz.'
  },

  // ========== VAG MED17 / MED9 (modern benzin) ==========
  {
    family: 'vag_med17',
    familyName: 'VAG MED17 / MED9',
    description: 'Audi/VW/Skoda modern benzin (MED17 EA888 Gen2/3, MED9 2.0 TFSI, EA113)',
    sources: [
      { name: 'TracqiTechnology/MxT', url: 'https://github.com/TracqiTechnology/MxT', note: 'Audi RS3/TTRS 2.5T TFSI (MED17), VW Golf GTI 2.0 TFSI (MED9) bundled XDF' }
    ],
    identify: {
      sizeHints: [2097152, 4194304],
      strings: [/MED17/i, /MED9/i, /8V0906\d{3}/, /06K906\d{3}/, /06J906\d{3}/]
    },
    firmwares: {},
    familyMaps: [
      { name: 'Boost Soll',       desc: 'Hedef boost (soll)' },
      { name: 'Torque Request',   desc: 'Pedal → istek tork' },
      { name: 'Lambda Target',    desc: 'Hedef lambda (yakıt zenginliği)' },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı' }
    ],
    notes: 'MED17 modern benzinli — EGR/DPF yok ama lambda, boost, timing haritaları aktif.'
  },

  // ========== VAG Simos12 / Simos18 ==========
  {
    family: 'vag_simos18',
    familyName: 'VAG Simos 12 / 18',
    description: 'Audi A3 8V EA888 Gen3 (1.8/2.0 TFSI), MQB platformu — Continental Simos',
    sources: [
      { name: 'TheFlashBold/tune-editor', url: 'https://github.com/TheFlashBold/tune-editor', note: '8V0906264, 06K906071 için A2L/XDF/JSON desteği, 3D harita görünümü, bench flash için ayrı tool' },
      { name: 'TheFlashBold/simos12-to-simos18-conversion', url: 'https://github.com/TheFlashBold/simos12-to-simos18-conversion', note: 'ECU swap guide + immo-off bench flash' },
      { name: 'bri3d/a2l2xdf', url: 'https://github.com/bri3d/a2l2xdf', note: 'A2L → XDF (Simos18 için en iyi, Continental axis\'leri uyumlu)' }
    ],
    identify: {
      sizeHints: [4194304, 8388608],
      strings: [/Simos/i, /8V0906264/, /06K906071/, /0D930001/, /CJSA/]
    },
    firmwares: {},
    familyMaps: [
      { name: 'Boost Target',     desc: 'Hedef boost' },
      { name: 'Lambda Target',    desc: 'Hedef lambda' },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı' },
      { name: 'Torque Limiters',  desc: 'Tork sınırları (çok katmanlı)' }
    ],
    notes: 'Simos18 TriCore — password-protected flash alanları var. bench flash için TheFlashBold\'un Pi 5 + ESP32 kurulumu gerekir. KT200 OBD üzerinden çoğu alanı okur ama bazı Simos variant\'ları full-read için bench ister.'
  },

  // ========== BMW Siemens MS41 / MS42 / MS43 / MSS52 ==========
  {
    family: 'bmw_ms4x',
    familyName: 'BMW MS41 / MS42 / MS43 / MSS52',
    description: 'BMW E36/E39/E46 benzinli (M52/M54/S62B50) — Siemens Motronic',
    sources: [
      { name: 'CAATZ/bimmerstein-bin-analyzer', url: 'https://github.com/CAATZ/bimmerstein-bin-analyzer', note: 'MS41/42/43 için otomatik harita + axis tespiti, checksum düzeltme, XDF/CSV/JSON export' },
      { name: 'kmalinich/MSS52-XDF', url: 'https://github.com/kmalinich/MSS52-XDF', note: 'S62B50 (M5 E39) için TunerPro XDF' }
    ],
    identify: {
      sizeHints: [524288, 1048576],
      strings: [/MS4[123]/i, /MSS52/i, /SIEMENS/i, /S62B50/i]
    },
    firmwares: {},
    familyMaps: [
      { name: 'MLHFM/MAF',        desc: 'Hava akış kalibrasyonu' },
      { name: 'Fuel Injection',   desc: 'Enjeksiyon süresi' },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı' },
      { name: 'VANOS',            desc: 'Variable valve timing' },
      { name: 'Rev Limiter',      desc: 'Devir sınırı' },
      { name: 'VMax Limiter',     desc: 'Hız sınırı' }
    ],
    notes: 'BMW MS4x için bimmerstein-bin-analyzer araç çıktısına JARVIS entegrasyonu önerilir. Hex görünümü + 2D/3D grafik aynı anda.'
  },

  // ========== Honda CBR250RR (örnek motosiklet) ==========
  {
    family: 'honda_cbr250rr',
    familyName: 'Honda CBR250RR',
    description: 'Keihin motosiklet ECU — stock tune analizi',
    sources: [
      { name: 'kelvinvalencio/cbr250rr-ecu-binary-definition', url: 'https://github.com/kelvinvalencio/cbr250rr-ecu-binary-definition', note: 'Stock binary definition + XDF' }
    ],
    identify: {
      sizeHints: [262144, 524288],
      strings: [/KEIHIN/i, /CBR250/i]
    },
    firmwares: {},
    familyMaps: [
      { name: 'A/F Target',    desc: 'Hava/yakıt oranı hedefi' },
      { name: 'Ignition Map',  desc: 'Ateşleme haritası' },
      { name: 'Rev Limit',     desc: 'Devir sınırı' }
    ],
    notes: 'Motosiklet için örnek — rulepack sisteminin motor dışı araçlara da genişleyebildiğini gösterir.'
  }
];

// ---------- Yardımcı yardımcı ----------

// Verilen baytları tüm rulepack'lere karşı dene; eşleşenleri döndür
export function identifyRulepacks(bytes, strings) {
  const matches = [];
  const stringTexts = (strings || []).map(s => s.text || s);
  const fullText = stringTexts.join(' ');

  for (const pack of RULEPACKS) {
    const id = pack.identify || {};
    let score = 0;
    const hits = [];

    // Boyut ipucu
    if (id.sizeHints?.some(s => Math.abs(bytes.length - s) < s * 0.05)) {
      score += 1;
      hits.push('size:' + bytes.length);
    }

    // String desenleri
    if (id.strings) {
      for (const re of id.strings) {
        const match = fullText.match(re);
        if (match) {
          score += 2;
          hits.push('str:' + match[0].slice(0, 20));
        }
      }
    }

    if (score > 0) {
      // Firmware eşleşmesi var mı
      let firmwareHit = null;
      for (const [fwId, fw] of Object.entries(pack.firmwares || {})) {
        if (fw.hwMarkers?.some(m => fullText.includes(m))) {
          firmwareHit = { id: fwId, ...fw };
          score += 5;
          hits.push('fw:' + fwId);
          break;
        }
      }

      matches.push({
        family: pack.family,
        familyName: pack.familyName,
        description: pack.description,
        sources: pack.sources,
        familyMaps: pack.familyMaps,
        notes: pack.notes,
        firmware: firmwareHit,
        score,
        hits
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// Eşleşen rulepack'lerden tüm aksiyonları topla
export function rulepackActions(matches) {
  const actions = [];
  for (const m of matches) {
    if (m.firmware?.actions) {
      for (const a of m.firmware.actions) {
        actions.push({
          ...a,
          system: m.familyName,
          source: 'rulepack:' + m.family + '/' + (m.firmware.id || 'generic'),
          sourceUrl: m.firmware.source || m.sources?.[0]?.url,
          sourceConfidence: a.confidence || 'high'
        });
      }
    }
  }
  return actions;
}

// Tüm rulepack kaynaklarını listele (UI için)
export function allSources() {
  const out = [];
  for (const pack of RULEPACKS) {
    for (const src of pack.sources || []) {
      out.push({ family: pack.familyName, name: src.name, url: src.url, license: src.license, note: src.note });
    }
  }
  return out;
}
