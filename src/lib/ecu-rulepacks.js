// hayırlıevlad ECU Rulepacks — kamuya açık GitHub depolarından ve topluluk kaynaklarından
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
      { name: 'KFMIRL',  desc: 'İstek torku → yük (torque→load) haritası — Stage 1\'in kalbi', system: 'Torque',     mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'KFMIOP',  desc: 'Optimal yük haritası — torque çıkış sınırı',                   system: 'Torque',     mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'KFZWOP',  desc: 'Optimal ateşleme avansı haritası',                             system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'LDRXN',   desc: 'Boost soll (hedef türbin basıncı)',                            system: 'Boost',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'KFLDHBN', desc: 'Boost oran karakteristiği',                                    system: 'Boost',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'MLHFM',   desc: 'MAF (HFM) kalibrasyon tablosu',                                system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Speed Limiter', desc: 'Hız sınırı haritası',                                    system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'Rev Limiter',   desc: 'Devir sınırlama haritası',                               system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    popBangDetection: {
      damosLabels: [
        { id: 'KFSA',                type: 'overrun_fuel',    desc: 'Schubabschaltung — overrun fuel cut map',       size: 2, onValue: 0x0100, risk: 'medium' },
        { id: 'ZWOUT',               type: 'ign_retard',      desc: 'Ateşleme geciktirme — overrun ignition retard', size: 2, onValue: 0xF0E0, risk: 'medium' },
        { id: 'KFMIRL',              type: 'torque_request',  desc: 'İstek torku haritası (overrun bölgesi)',        size: 2, onValue: null,   risk: 'low' },
      ],
      controlHeuristics: {
        overrunFuelCut: {
          desc: 'Overrun fuel-cut delay byte',
          expectedValues: [0x00, 0x01],
          onValue: 0x01,
          size: 1,
          risk: 'medium',
          scoring: {
            wordAligned: 10,
            valueIsZero: 20,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
    notes: 'ME7 Stage 1 için gerçek haritalar aile çapında isim-tabanlıdır; MxT (XDF yüklemeli) veya TunerPro ile tam harita düzenleme yapılır. hayırlıevlad burada sadece string konumlarını işaretler.'
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
      { name: 'Driver Wish',    desc: 'Pedal → istek torku',                       system: 'Torque',     mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'Turbo Boost',    desc: 'Soll boost basıncı (bar)',                  system: 'Boost',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'N75 Duty Cycle', desc: 'Wastegate solenoid görev döngüsü',          system: 'Boost',      mapAction: 'scale', elementSize: 1, scaleFactor: 1.10 },
      { name: 'SOI',            desc: 'Start of Injection — enjeksiyon avansı',    system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Torque Limiter', desc: 'Tork sınırlama tabloları (gear/vmax tabanlı)', system: 'Torque',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'Smoke Limiter',  desc: 'Duman sınırı (MAF/pedal)',                  system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.30 },
      { name: 'IQ Limiter',     desc: 'Enjeksiyon miktarı limit (mg/stroke)',      system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'EGR Map',        desc: 'EGR valf pozisyon haritası',                system: 'EGR',        mapAction: 'zero',  elementSize: 2 },
      { name: 'EGR Rate',       desc: 'EGR oranı hedef haritası',                  system: 'EGR',        mapAction: 'zero',  elementSize: 2 },
      { name: 'Speed Limiter',  desc: 'Hız sınırlama haritası',                    system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'RPM Limiter',    desc: 'Devir sınırlama haritası',                  system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    egrDetection: {
      damosLabels: [
        { id: 'AGR_mSoll_C',            type: 'egr_valve',     desc: 'AGR hedef kütle akışı (EDC15/16)',  size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'AGR_stEnable_C',         type: 'egr_switch',    desc: 'AGR master switch (EDC15/16)',      size: 1, offValue: 0x00,   risk: 'low' },
        { id: 'EGR_rSoll_C',            type: 'egr_rate',      desc: 'EGR oran hedefi',                   size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_mDesRate_C',         type: 'egr_flow',      desc: 'EGR akış oranı hedef',              size: 2, offValue: 0x0000, risk: 'low' },
      ],
      controlHeuristics: {
        egrValve: {
          desc: 'EGR valf kontrol byte (EDC15/16)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'low',
          scoring: {
            wordAligned: 10,
            valueIsOne: 25,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
    dpfDetection: {
      damosLabels: [
        { id: 'DPF_stRegen_C',          type: 'regen_switch',   desc: 'DPF regen switch (EDC16)',          size: 1, offValue: 0x00,   risk: 'medium' },
        { id: 'DPF_tiRgnMax_C',         type: 'regen_duration', desc: 'Max regen süresi (EDC16)',          size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_dpThresh_C',         type: 'diff_pressure',  desc: 'Diferansiyel basınç eşiği',         size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_mSootLim_C',         type: 'soot_threshold', desc: 'Kurum eşiği (EDC16)',               size: 2, offValue: 0xFFFF, risk: 'medium' },
      ],
      controlHeuristics: {
        regenSwitch: {
          desc: 'Rejenerasyon aktif/pasif bayrağı (EDC16)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'medium',
          scoring: {
            wordAligned: 10,
            valueIsOne: 25,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        },
        diffPressure: {
          desc: 'Diferansiyel basınç eşiği (EDC16)',
          offValue: 0xFFFF,
          size: 2,
          risk: 'medium',
          plausibleRange: [30, 3000],
        }
      },
      searchRadius: 512,
    },
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
    // DPF-specific detection: DAMOS labels + production binary patterns
    egrDetection: {
      damosLabels: [
        { id: 'EGR_mDesCyl_C',        type: 'egr_valve',     desc: 'EGR valf hedef kütle akışı',       size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_rDesEGR_C',        type: 'egr_rate',      desc: 'EGR oranı hedef',                  size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_swtEGRActv_C',     type: 'egr_switch',    desc: 'EGR master enable switch',         size: 1, offValue: 0x00,   risk: 'low' },
        { id: 'AGR_stSollPos_C',      type: 'egr_position',  desc: 'AGR valf hedef pozisyonu',         size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'AGR_rSollEGR_C',       type: 'egr_rate_de',   desc: 'AGR hedef oran (DE)',               size: 2, offValue: 0x0000, risk: 'low' },
      ],
      controlHeuristics: {
        egrValve: {
          desc: 'EGR valf kontrol byte',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'low',
          scoring: {
            wordAligned: 10,
            valueIsOne: 25,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
    adblueDetection: {
      damosLabels: [
        { id: 'SCR_swtSCRActv_C',     type: 'scr_switch',    desc: 'SCR sistem master enable',         size: 1, offValue: 0x00,   risk: 'high' },
        { id: 'SCR_mDesNH3_C',        type: 'scr_dosing',    desc: 'SCR hedef NH3 doz miktarı',        size: 2, offValue: 0x0000, risk: 'high' },
        { id: 'SCR_rDesConvNOx_C',    type: 'scr_nox_conv',  desc: 'SCR hedef NOx dönüşüm oranı',     size: 2, offValue: 0x0000, risk: 'high' },
        { id: 'Urea_mDesUrea_C',      type: 'urea_dosing',   desc: 'Üre doz miktarı hedef',            size: 2, offValue: 0x0000, risk: 'high' },
        { id: 'Urea_swtUrActv_C',     type: 'urea_switch',   desc: 'Üre sistemi master enable',        size: 1, offValue: 0x00,   risk: 'high' },
        { id: 'SCR_tiDesHeat_C',      type: 'scr_heater',    desc: 'SCR ısıtıcı hedef süresi',         size: 2, offValue: 0x0000, risk: 'medium' },
      ],
      controlHeuristics: {
        scrSwitch: {
          desc: 'SCR/AdBlue sistem aktif/pasif bayrağı',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'high',
          scoring: {
            wordAligned: 10,
            valueIsOne: 25,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
    dpfDetection: {
      // DAMOS identifier strings — present in engineering/development binaries
      // When found: high-confidence detection, search calibration area for the value
      damosLabels: [
        { id: 'EGT_swtEGTActv_C',      type: 'regen_switch',   desc: 'DPF regen master enable switch', size: 1, offValue: 0x00, risk: 'medium' },
        { id: 'EGT_tiRegenMaxDrv_C',    type: 'regen_duration', desc: 'Max regen süresi',               size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_mSootMax_C',         type: 'soot_threshold', desc: 'Kurum kütle eşiği',              size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_dpDifMax_C',         type: 'diff_pressure',  desc: 'Diferansiyel basınç maksimum',   size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_tiRegenIntv_C',      type: 'regen_interval', desc: 'Rejenerasyon aralığı',           size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_stRegenReq_C',       type: 'regen_request',  desc: 'Rejenerasyon talep durumu',      size: 1, offValue: 0x00, risk: 'medium' },
        { id: 'EngPrt_facTempPreTrbn',   type: 'exhaust_temp',   desc: 'Türbin öncesi sıcaklık faktörü', size: 2, offValue: 0xFFFF, risk: 'high' },
      ],
      // Production binary heuristics — no DAMOS labels present
      // Used by tuning engine for context-aware scanning instead of blind offset+16
      controlHeuristics: {
        // DPF regen switch: typically single byte, 0x01=enabled 0x00=disabled
        regenSwitch: {
          desc: 'Rejenerasyon aktif/pasif bayrağı',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'medium',
          // Scoring weights for candidate selection
          scoring: {
            wordAligned: 10,          // prefer word-aligned addresses
            valueIsOne: 25,           // 0x01 more likely to be enable flag
            nearbySmallScalars: 15,   // surrounded by other calibration scalars
            closeToKeyword: 0.2,      // per-byte distance penalty (lower=closer)
            notInAscii: 50,           // must not be inside ASCII string
          }
        },
        // DPF differential pressure threshold
        diffPressure: {
          desc: 'Diferansiyel basınç eşiği',
          offValue: 0xFFFF,
          size: 2,
          risk: 'medium',
          plausibleRange: [30, 3000],  // raw sensor units — typical range for DPF dp threshold
        }
      },
      // Search window radius (bytes) around keyword hit
      searchRadius: 512,
    },
    familyMaps: [
      { name: 'IQ Base',         desc: 'Temel enjeksiyon miktarı',                 system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'IQ Limit MAF',    desc: 'MAF tabanlı IQ sınırı',                    system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Rail Pressure',   desc: 'Rail basınç haritası',                     system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Boost Soll',      desc: 'Boost hedef',                              system: 'Boost',        mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Boost IST Limit', desc: 'Boost üst sınır',                          system: 'Boost',        mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'Torque Limit',    desc: 'Tork sınırı (gear/rpm)',                   system: 'Torque',       mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'DPF Regen',       desc: 'DPF rejenerasyon tetikleri',               system: 'DPF',          mapAction: 'zero',  elementSize: 2 },
      { name: 'EGR Flow',        desc: 'EGR akış haritası',                        system: 'EGR',          mapAction: 'zero',  elementSize: 2 },
      { name: 'SCR Dosing',      desc: 'AdBlue doz haritası',                      system: 'AdBlue/SCR',   mapAction: 'zero',  elementSize: 2 },
      { name: 'Speed Limiter',   desc: 'Hız sınırlama haritası',                   system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'RPM Limiter',     desc: 'Devir sınırlama haritası',                 system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
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
      { name: 'Boost Soll',       desc: 'Hedef boost (soll)',                       system: 'Boost',       mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Torque Request',   desc: 'Pedal → istek tork',                      system: 'Torque',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'Lambda Target',    desc: 'Hedef lambda (yakıt zenginliği)',          system: 'Lambda',      mapAction: 'scale', elementSize: 2, scaleFactor: 0.95 },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı',                         system: 'Injection',   mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Speed Limiter',    desc: 'Hız sınırlama haritası',                   system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'RPM Limiter',      desc: 'Devir sınırlama haritası',                 system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    popBangDetection: {
      damosLabels: [
        { id: 'SA_OvRn_C',              type: 'overrun_fuel',    desc: 'Schubabschaltung overrun fuel map',              size: 2, onValue: 0x0100, risk: 'medium' },
        { id: 'ZW_OvRn_C',              type: 'ign_retard',      desc: 'Overrun ignition retard angle',                  size: 2, onValue: 0xF0E0, risk: 'medium' },
        { id: 'SA_tiDecFuel_C',         type: 'fuel_cut_delay',  desc: 'Fuel-cut deceleration delay timer',              size: 2, onValue: 0x0200, risk: 'medium' },
        { id: 'KD_tiOverrun_C',         type: 'overrun_timer',   desc: 'Overrun condition duration timer',               size: 2, onValue: 0x0300, risk: 'low' },
      ],
      controlHeuristics: {
        overrunFuelCut: {
          desc: 'Overrun fuel-cut delay byte — MED17 benzinli',
          expectedValues: [0x00, 0x01],
          onValue: 0x01,
          size: 1,
          risk: 'medium',
          scoring: {
            wordAligned: 10,
            valueIsZero: 20,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
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
      { name: 'Boost Target',     desc: 'Hedef boost',                              system: 'Boost',       mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Lambda Target',    desc: 'Hedef lambda',                             system: 'Lambda',      mapAction: 'scale', elementSize: 2, scaleFactor: 0.95 },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı',                         system: 'Injection',   mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Torque Limiters',  desc: 'Tork sınırları (çok katmanlı)',            system: 'Torque',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'Speed Limiter',    desc: 'Hız sınırlama haritası',                   system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'RPM Limiter',      desc: 'Devir sınırlama haritası',                 system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    popBangDetection: {
      damosLabels: [
        { id: 'SchubAb_tiDecFuel_C',    type: 'fuel_cut_delay',  desc: 'Schubabschaltung fuel-cut delay (Continental)',  size: 2, onValue: 0x0200, risk: 'medium' },
        { id: 'SchubAb_rOvFuel_C',      type: 'overrun_fuel',    desc: 'Overrun fuel enrichment ratio',                  size: 2, onValue: 0x0180, risk: 'medium' },
        { id: 'ZW_SA_retard_C',         type: 'ign_retard',      desc: 'Ignition retard during overrun (Simos)',          size: 2, onValue: 0xF0E0, risk: 'medium' },
        { id: 'SA_nOvRun_C',            type: 'rpm_threshold',   desc: 'Overrun RPM activation threshold',               size: 2, onValue: 0x05DC, risk: 'low' },
      ],
      controlHeuristics: {
        overrunFuelCut: {
          desc: 'Overrun fuel-cut delay byte — Simos benzinli',
          expectedValues: [0x00, 0x01],
          onValue: 0x01,
          size: 1,
          risk: 'medium',
          scoring: {
            wordAligned: 10,
            valueIsZero: 20,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
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
      { name: 'MLHFM/MAF',        desc: 'Hava akış kalibrasyonu',                  system: 'MAF/MAP',     mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Fuel Injection',   desc: 'Enjeksiyon süresi',                       system: 'Injection',   mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Ignition Timing',  desc: 'Ateşleme avansı',                         system: 'Injection',   mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'VANOS',            desc: 'Variable valve timing',                    system: 'Injection',   mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Rev Limiter',      desc: 'Devir sınırı',                             system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'VMax Limiter',     desc: 'Hız sınırı',                               system: 'Torque',      mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    popBangDetection: {
      damosLabels: [
        { id: 'FUELCUT_OVERRUN',        type: 'overrun_fuel',    desc: 'Fuel-cut overrun map (Siemens MS)',               size: 2, onValue: 0x0100, risk: 'medium' },
        { id: 'IGN_RETARD_OVERRUN',     type: 'ign_retard',      desc: 'Ignition retard during decel overrun',            size: 2, onValue: 0xF0E0, risk: 'medium' },
        { id: 'OVERRUN_RPM_THRESH',     type: 'rpm_threshold',   desc: 'Overrun activation RPM threshold',                size: 2, onValue: 0x05DC, risk: 'low' },
      ],
      controlHeuristics: {
        overrunFuelCut: {
          desc: 'Overrun fuel-cut byte — BMW MS4x',
          expectedValues: [0x00, 0x01],
          onValue: 0x01,
          size: 1,
          risk: 'medium',
          scoring: {
            wordAligned: 10,
            valueIsZero: 20,
            nearbySmallScalars: 15,
            closeToKeyword: 0.2,
            notInAscii: 50,
          }
        }
      },
      searchRadius: 512,
    },
    notes: 'BMW MS4x için bimmerstein-bin-analyzer araç çıktısına hayırlıevlad entegrasyonu önerilir. Hex görünümü + 2D/3D grafik aynı anda.'
  },

  // ========== Siemens SID 803 / SID 807 (PSA Diesel) ==========
  {
    family: 'siemens_sid80x',
    familyName: 'Siemens SID 803 / SID 807',
    description: 'PSA (Peugeot/Citroën) HDi + Ford TDCi dizel (1.6 HDi, 2.0 HDi, 2.2 HDi)',
    sources: [
      { name: 'FLASHFILES/SID803-SID807-maps', url: 'https://github.com/FLASHFILES/SID803-SID807-maps', note: 'SID803/807 kalibrasyon haritaları, XDF tanımları' },
      { name: 'Community: psa-tuning.co.uk', url: 'https://psa-tuning.co.uk', note: 'SID801/803/807 offset tabloları, map listesi' },
    ],
    identify: {
      sizeHints: [524288, 1048576, 2097152],
      strings: [/SID80[1237]/i, /SIEMENS/i, /9H[A-Z]\d{3}/, /PSA/i, /HDi/i]
    },
    firmwares: {},
    familyMaps: [
      { name: 'IQ Pilot / Driver Demand', desc: 'Sürücü talebi → enjeksiyon miktarı haritası', system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'Smoke Limiter',            desc: 'Duman sınır haritası (Air/Fuel sınırı)',       system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.30 },
      { name: 'Rail Pressure',            desc: 'Common-rail basınç hedefi',                   system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Boost Pressure',           desc: 'Turbo basınç hedefi',                         system: 'Boost',      mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Torque Limiters',          desc: 'Tork sınır haritaları (çok katmanlı)',         system: 'Torque',     mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'EGR Map',                  desc: 'EGR valf pozisyon haritası',                  system: 'EGR',        mapAction: 'zero',  elementSize: 2 },
      { name: 'Speed Limiter',            desc: 'Hız sınırı',                                  system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'DPF Regen',               desc: 'DPF rejenerasyon haritası',                   system: 'DPF',        mapAction: 'zero',  elementSize: 2 },
    ],
    dpfDetection: {
      damosLabels: [
        { id: 'DPF_Regen_Req',         type: 'regen_switch',     desc: 'DPF rejenerasyon istek bayrağı (SID80x)',     size: 1, offValue: 0x00,   risk: 'medium' },
        { id: 'DPF_DiffPress_Thresh',  type: 'diff_pressure',    desc: 'Diferansiyel basınç eşiği (SID80x)',          size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_Soot_Mass_Lim',     type: 'soot_threshold',   desc: 'Kurum kütle sınırı',                          size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_Regen_Interval',    type: 'regen_interval',   desc: 'Rejenerasyon aralığı (km)',                   size: 2, offValue: 0xFFFF, risk: 'medium' },
      ],
      controlHeuristics: {
        regenSwitch: {
          desc: 'Rejenerasyon aktif/pasif bayrağı (SID80x)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'medium',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    egrDetection: {
      damosLabels: [
        { id: 'EGR_Pos_Target',     type: 'egr_valve',    desc: 'EGR valf hedef pozisyonu (SID80x)',    size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_Enable_Sw',     type: 'egr_switch',   desc: 'EGR master switch (SID80x)',           size: 1, offValue: 0x00,   risk: 'low' },
        { id: 'EGR_Mass_Flow',     type: 'egr_flow',     desc: 'EGR kütle akışı hedefi',               size: 2, offValue: 0x0000, risk: 'low' },
      ],
      controlHeuristics: {
        egrValve: {
          desc: 'EGR valf kontrol byte (SID80x)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'low',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    notes: 'SID803 (Euro 3/4) ve SID807 (Euro 4/5) Siemens Continental ECU. FAP (DPF) off ve EGR off PSA tuning topluluğunda çok yaygın. Winols ve CMD flasher ile çalışılır.'
  },

  // ========== Continental PCR2.1 (VW EA288 Diesel) ==========
  {
    family: 'continental_pcr21',
    familyName: 'Continental PCR2.1',
    description: 'VW/Audi/Skoda/Seat EA288 2.0 TDI (Euro 6 dizel) — Continental ECU',
    sources: [
      { name: 'EA288-Community/pcr21-maps', url: 'https://github.com/EA288-Community/pcr21-maps', note: 'PCR2.1 kalibrasyon referansları' },
      { name: 'Community: digital-kaos.co.uk', url: 'https://digital-kaos.co.uk', note: 'PCR2.1 map locations, tuning bilgileri' },
    ],
    identify: {
      sizeHints: [4194304, 8388608],
      strings: [/PCR2\.1/i, /CONTINENTAL/i, /EA288/i, /04L\d{6}/, /CJAA|CRUA|DFGA|DFHA|DTUA/i]
    },
    firmwares: {},
    familyMaps: [
      { name: 'IQ Driver Demand',   desc: 'Sürücü talebi → enjeksiyon miktarı',    system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'IQ Smoke Limiter',   desc: 'Duman sınır haritası',                   system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.30 },
      { name: 'Rail Pressure Map',  desc: 'Common-rail basınç hedef haritası',      system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Boost Target Map',   desc: 'Turbo basınç hedefi (VTG/WG)',           system: 'Boost',        mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Torque Limiter',     desc: 'Tork sınırı (multi-layer)',              system: 'Torque',       mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'EGR Rate Target',    desc: 'EGR oran hedef haritası',                system: 'EGR',          mapAction: 'zero',  elementSize: 2 },
      { name: 'Injection Timing',   desc: 'Enjeksiyon zamanlaması',                 system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Speed Limiter',      desc: 'Hız sınırı',                             system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'DPF Regen',          desc: 'DPF rejenerasyon haritası',              system: 'DPF',          mapAction: 'zero',  elementSize: 2 },
      { name: 'SCR Dosing',         desc: 'AdBlue dozaj haritası',                  system: 'AdBlue/SCR',   mapAction: 'zero',  elementSize: 2 },
    ],
    dpfDetection: {
      damosLabels: [
        { id: 'DPF_stRegen_C',      type: 'regen_switch',    desc: 'DPF regen switch (PCR2.1)',               size: 1, offValue: 0x00,   risk: 'medium' },
        { id: 'DPF_dpThrsh_C',      type: 'diff_pressure',   desc: 'DPF diferansiyel basınç eşiği',           size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_mSootLm_C',      type: 'soot_threshold',  desc: 'Kurum yükleme eşiği (PCR2.1)',            size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'DPF_tiRgInt_C',      type: 'regen_interval',  desc: 'Rejenerasyon aralığı',                    size: 2, offValue: 0xFFFF, risk: 'medium' },
      ],
      controlHeuristics: {
        regenSwitch: {
          desc: 'Rejenerasyon aktif/pasif bayrağı (PCR2.1)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'medium',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    egrDetection: {
      damosLabels: [
        { id: 'EGR_rDes_C',        type: 'egr_rate',     desc: 'EGR oran hedefi (PCR2.1)',               size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_stEn_C',        type: 'egr_switch',   desc: 'EGR master switch (PCR2.1)',             size: 1, offValue: 0x00,   risk: 'low' },
        { id: 'EGR_mFlw_C',        type: 'egr_flow',     desc: 'EGR kütle akış hedefi (PCR2.1)',         size: 2, offValue: 0x0000, risk: 'low' },
      ],
      controlHeuristics: {
        egrValve: {
          desc: 'EGR valf kontrol byte (PCR2.1)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'low',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    adblueDetection: {
      damosLabels: [
        { id: 'SCR_stDos_C',       type: 'dosing_switch',   desc: 'AdBlue dozaj switch (PCR2.1)',          size: 1, offValue: 0x00,   risk: 'high' },
        { id: 'SCR_qDos_C',        type: 'dosing_quantity',  desc: 'AdBlue dozaj miktarı',                 size: 2, offValue: 0x0000, risk: 'high' },
        { id: 'SCR_tCat_C',        type: 'cat_temp',         desc: 'SCR katalizör sıcaklık eşiği',         size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'SCR_NOxTgt_C',      type: 'nox_target',       desc: 'NOx hedef çıkış değeri',               size: 2, offValue: 0x0000, risk: 'high' },
      ],
      controlHeuristics: {
        dosingSwitch: {
          desc: 'AdBlue dozaj açık/kapalı (PCR2.1)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'high',
          scoring: { wordAligned: 10, valueIsOne: 30, nearbySmallScalars: 15, closeToKeyword: 0.3, notInAscii: 50 }
        }
      },
      searchRadius: 1024,
    },
    notes: 'EA288 PCR2.1 Euro 6 dizel. AdBlue/SCR sistemi var. VW Dieselgate sonrası güncellenen kalibrasyon. CMD/KTAG ile boot-mode flash gerekir.'
  },

  // ========== Delphi DCM3.5 (Renault / Dacia) ==========
  {
    family: 'delphi_dcm35',
    familyName: 'Delphi DCM3.5',
    description: 'Renault/Dacia 1.5 dCi / 1.6 dCi dizel (K9K, R9M motorlar)',
    sources: [
      { name: 'Community: tunerpro.net/viewforum.php?f=55', url: 'https://tunerpro.net/viewforum.php?f=55', note: 'Delphi DCM XDF tanımları' },
      { name: 'Community: digital-kaos.co.uk', url: 'https://digital-kaos.co.uk', note: 'DCM3.5 map yerleşimleri, tuning bilgileri' },
    ],
    identify: {
      sizeHints: [1048576, 2097152, 4194304],
      strings: [/DCM3\.5/i, /DELPHI/i, /K9K/i, /R9M/i, /237\w{6}/, /RENAULT/i]
    },
    firmwares: {},
    familyMaps: [
      { name: 'IQ Driver Demand',  desc: 'Sürücü talebi → enjeksiyon miktarı',     system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.15 },
      { name: 'Smoke Limiter',     desc: 'Duman sınır haritası (AFR limiter)',       system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.30 },
      { name: 'Rail Pressure',     desc: 'Common-rail basınç hedefi',               system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Boost Target',      desc: 'Turbo basınç hedefi',                     system: 'Boost',        mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Torque Limit',      desc: 'Tork sınırı',                             system: 'Torque',       mapAction: 'scale', elementSize: 2, scaleFactor: 1.25 },
      { name: 'EGR Map',           desc: 'EGR pozisyon hedefi',                     system: 'EGR',          mapAction: 'zero',  elementSize: 2 },
      { name: 'Injection Timing',  desc: 'Ana enjeksiyon zamanlaması',              system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'DPF Regen',         desc: 'DPF rejenerasyon haritası',               system: 'DPF',          mapAction: 'zero',  elementSize: 2 },
      { name: 'Speed Limiter',     desc: 'Hız sınırı haritası',                     system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'RPM Limiter',       desc: 'Devir sınırlama haritası',                system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
    ],
    dpfDetection: {
      damosLabels: [
        { id: 'FAP_Regen_Enable',   type: 'regen_switch',    desc: 'FAP rejenerasyon switch (DCM3.5)',       size: 1, offValue: 0x00,   risk: 'medium' },
        { id: 'FAP_DiffP_Thresh',   type: 'diff_pressure',   desc: 'FAP diferansiyel basınç eşiği',          size: 2, offValue: 0xFFFF, risk: 'medium' },
        { id: 'FAP_Soot_Limit',     type: 'soot_threshold',  desc: 'Kurum kütle sınırı (DCM3.5)',            size: 2, offValue: 0xFFFF, risk: 'medium' },
      ],
      controlHeuristics: {
        regenSwitch: {
          desc: 'FAP rejenerasyon bayrağı (DCM3.5)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'medium',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    egrDetection: {
      damosLabels: [
        { id: 'EGR_Pos_Demand',    type: 'egr_valve',    desc: 'EGR valf hedef pozisyonu (DCM3.5)',     size: 2, offValue: 0x0000, risk: 'low' },
        { id: 'EGR_Switch',        type: 'egr_switch',   desc: 'EGR master switch (DCM3.5)',            size: 1, offValue: 0x00,   risk: 'low' },
      ],
      controlHeuristics: {
        egrValve: {
          desc: 'EGR valf kontrol byte (DCM3.5)',
          expectedValues: [0x00, 0x01],
          offValue: 0x00,
          size: 1,
          risk: 'low',
          scoring: { wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    notes: 'Delphi DCM3.5 Renault/Dacia K9K/R9M dizel. Çoğu Euro 4/5, bazıları Euro 6. FAP = DPF (Filtre à Particules). BDM/JTAG veya CMD flasher ile çalışılır.'
  },

  // ========== Denso SH7058 / SH7059 (Toyota / Subaru) ==========
  {
    family: 'denso_sh705x',
    familyName: 'Denso SH7058 / SH7059',
    description: 'Toyota/Subaru benzinli — Renesas SH7058/SH7059 tabanlı Denso ECU',
    sources: [
      { name: 'EcuFlash/SubaruDefs', url: 'https://github.com/EcuFlash/SubaruDefs', note: 'Subaru ECU tanım dosyaları (EcuFlash XML)' },
      { name: 'Community: romraider.com', url: 'https://www.romraider.com', note: 'Subaru/Toyota ECU düzenleme topluluğu, RomRaider tanımları' },
      { name: 'speeps/ecuern', url: 'https://github.com/speeps/ecuern', note: 'Renesas SH tabanlı ECU reverse-engineering araçları' },
    ],
    identify: {
      sizeHints: [524288, 1048576, 1572864],
      strings: [/DENSO/i, /SH705[89]/i, /A2[A-Z]\d{3}/, /SUBARU/i, /TOYOTA/i, /22611/]
    },
    firmwares: {},
    familyMaps: [
      { name: 'Fuel Map A/B',          desc: 'Yakıt haritası (dual-map A/B)',           system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Ignition Timing A/B',   desc: 'Ateşleme avansı (dual-map A/B)',          system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Boost Target',          desc: 'Turbo basınç hedefi (WRX/STI)',            system: 'Boost',        mapAction: 'scale', elementSize: 2, scaleFactor: 1.20 },
      { name: 'Wastegate Duty',        desc: 'Wastegate görev döngüsü',                 system: 'Boost',        mapAction: 'scale', elementSize: 1, scaleFactor: 1.10 },
      { name: 'MAF Scaling',           desc: 'MAF kalibrasyon ölçekleme',                system: 'Injection',    mapAction: 'scale', elementSize: 2, scaleFactor: 1.10 },
      { name: 'Rev Limiter',           desc: 'Devir sınırı (flat-foot shift)',           system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'Speed Limiter',         desc: 'Hız sınırı',                              system: 'Torque',       mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
      { name: 'Launch Control',        desc: 'Launch control RPM eşiği',                system: 'Torque',       mapAction: 'scale', elementSize: 2, scaleFactor: 0.85 },
    ],
    popBangDetection: {
      damosLabels: [
        { id: 'OvRnFuelCut_Map',       type: 'overrun_fuel',    desc: 'Overrun fuel-cut map (Denso)',            size: 2, onValue: 0x0100, risk: 'medium' },
        { id: 'OvRn_IgnRetard',        type: 'ign_retard',      desc: 'Overrun ignition retard (Denso)',         size: 2, onValue: 0xF0E0, risk: 'medium' },
        { id: 'OvRn_RPM_Thresh',       type: 'rpm_threshold',   desc: 'Overrun RPM aktivasyon eşiği (Denso)',    size: 2, onValue: 0x05DC, risk: 'low' },
        { id: 'OvRn_TPS_Thresh',       type: 'tps_threshold',   desc: 'Overrun gaz kelebeği eşiği (Denso)',      size: 2, onValue: 0x0000, risk: 'low' },
      ],
      controlHeuristics: {
        overrunFuelCut: {
          desc: 'Overrun fuel-cut byte — Denso SH705x',
          expectedValues: [0x00, 0x01],
          onValue: 0x01,
          size: 1,
          risk: 'medium',
          scoring: { wordAligned: 10, valueIsZero: 20, nearbySmallScalars: 15, closeToKeyword: 0.2, notInAscii: 50 }
        }
      },
      searchRadius: 512,
    },
    notes: 'Denso SH7058/7059 Renesas SuperH. EcuFlash veya RomRaider ile açılır. Subaru WRX/STI/Forester XT ve Toyota 86/BRZ yaygın hedefler. Tactrix OpenPort 2.0 ile OBD flash.'
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
      { name: 'A/F Target',    desc: 'Hava/yakıt oranı hedefi',    system: 'Lambda',     mapAction: 'scale', elementSize: 2, scaleFactor: 0.95 },
      { name: 'Ignition Map',  desc: 'Ateşleme haritası',          system: 'Injection',  mapAction: 'scale', elementSize: 2, scaleFactor: 1.05 },
      { name: 'Rev Limit',     desc: 'Devir sınırı',               system: 'Torque',     mapAction: 'fill',  elementSize: 2, fillValue: 0xFFFF },
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

// Sistem tespit konfigürasyonlarını getir — eşleşen rulepack ailesi için
export function getDpfDetection(familyMatches) {
  for (const m of familyMatches || []) {
    const pack = RULEPACKS.find(r => r.family === m.family);
    if (pack?.dpfDetection) return pack.dpfDetection;
  }
  return null;
}

export function getEgrDetection(familyMatches) {
  for (const m of familyMatches || []) {
    const pack = RULEPACKS.find(r => r.family === m.family);
    if (pack?.egrDetection) return pack.egrDetection;
  }
  return null;
}

export function getAdblueDetection(familyMatches) {
  for (const m of familyMatches || []) {
    const pack = RULEPACKS.find(r => r.family === m.family);
    if (pack?.adblueDetection) return pack.adblueDetection;
  }
  return null;
}

export function getPopbangDetection(familyMatches) {
  for (const m of familyMatches || []) {
    const pack = RULEPACKS.find(r => r.family === m.family);
    if (pack?.popBangDetection) return pack.popBangDetection;
  }
  return null;
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
