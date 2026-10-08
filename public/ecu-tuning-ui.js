// JARVIS ECU Tuning UI — v3: araç seçimi + zengin aksiyon kartları + Stage 1 + AI önerisi
(() => {
  const state = {
    uploadId: null,
    fileName: '',
    fileSize: 0,
    regions: [],
    systems: [],
    systemInfos: [],
    stage1: null,
    stats: null,
    vehicle: { make: '', model: '', year: '', ecuType: '' },
    vehicleDB: null,
    selectedActions: new Map(),
    tunedId: null,
    aiLoading: false,
    aiSuggestions: [],
    aiProvider: '',
    rulepackMatches: [],
    lastComparison: null
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m]));
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
  const hex2 = n => Number(n).toString(16).padStart(2, '0').toUpperCase();
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };
  const riskColor = r => ({ low: '#35df9a', medium: '#ffbe55', high: '#ff5578', info: '#31dfff' }[r] || '#8ba4b7');
  const riskLabel = r => ({ low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk', info: 'Bilgi' }[r] || r || '?');
  const hexAddr = n => '0x' + n.toString(16).toUpperCase().padStart(6, '0');
  const hexByte = b => b.toString(16).padStart(2, '0').toUpperCase();

  // ===== CLIENT-SIDE ECU ANALİZ MOTORU (offline fallback) =====
  const LOCAL_SYSTEMS = [
    { re: /EGR|AGR|Abgasrück|AGR_?[Vv]|EGR_?[Vv]|ExhGas|EGR_?Rate/i, system: 'EGR', icon: '🔄', explain: 'Egzoz gazı resirkülasyonu. Karbon birikimini artırır.', offExplain: 'EGR kapatılınca: intake manifold temiz kalır, motor rahat nefes alır.', stage1: true, hpGain: '5-15' },
    { re: /DPF|FAP|PartikelFilter|Rußfilter|Soot|Regen[_\s]|DPF_?[TtRr]|RussMen|DiffPres|PartFilter/i, system: 'DPF', icon: '🔥', explain: 'Dizel partikül filtre. Rejenerasyon döngüsüne girer.', offExplain: 'DPF kapatılınca: Yakıt tasarrufu, contra basınç düşer.', stage1: true, hpGain: '10-20' },
    { re: /AdBlue|SCR|DEF\b|Urea|Harnstoff|NOx|SCR_?[Cc]|DeNOx|BlueTec/i, system: 'AdBlue/SCR', icon: '💧', explain: 'AdBlue / NOx redüksiyon sistemi.', offExplain: 'Kapatılınca limp mode riski ortadan kalkar.', stage1: false, hpGain: '0-5' },
    { re: /Lambda|O2S|LSU|Sonde|KatDiag|O2_?[Ss]|HEGO|Breitband|Vorkat|Nachkat/i, system: 'Lambda', icon: '📊', explain: 'Oksijen sensörü. Yakıt/hava oranını ayarlar.', offExplain: 'Kapatılınca P0420/P0430 hata kodları önlenir.', stage1: false, hpGain: '0' },
    { re: /Boost|LDR|Ladedruck|P2Soll|Turbo[_\s]|VTG|Wastegate|LDR_?[SsIi]|LadeDr|Ladetab/i, system: 'Boost', icon: '⚡', explain: 'Turbo basınç kontrolü.', offExplain: 'Yükseltilince daha fazla güç.', stage1: true, hpGain: '20-40' },
    { re: /Torque|Torq|M_Soll|Drehmoment|Moment[_\s]|MomentLim|Mmnt|MomFahr|MomBeg/i, system: 'Torque', icon: '💪', explain: 'Tork sınırlama haritaları.', offExplain: 'Yükseltilince motor daha fazla tork üretir.', stage1: true, hpGain: '15-30' },
    { re: /Injection|Inj_Q|QNFLM|Einspritz|RailDr|InjVol|InjCrv|MengSoll|Einsp_Men|QSoll/i, system: 'Injection', icon: '💉', explain: 'Yakıt enjeksiyonu kontrolü.', offExplain: 'Artırılınca daha fazla güç.', stage1: true, hpGain: '10-25' },
    { re: /MAF|HFM|MAP|LMM|Luftmasse|AirMass|Saugrohr|LuftMeng|AirFlow/i, system: 'MAF/MAP', icon: '🌬️', explain: 'Hava akış sensörü.', offExplain: 'Limitleri yükseltilince büyük turbo desteklenir.', stage1: false, hpGain: '0-5' },
    { re: /Vmax|Vfzg|SpeedLim|Geschwind|VehSpdLim|FzgMax/i, system: 'Hız sınırı', icon: '🏎️', explain: 'Araç hız sınırlayıcı.', offExplain: 'Kaldırılınca mekanik limite kadar hızlanır.', stage1: false, hpGain: '0' },
    { re: /Nmax|Nmot|RpmLim|Drehzahl|EngSpdLim|NmotMax/i, system: 'RPM sınırı', icon: '🔴', explain: 'Devir sınırlayıcı.', offExplain: 'Yükseltilince motor daha yüksek devire çıkar.', stage1: false, hpGain: '0-5' },
    { re: /Pedal|PWG|TPS|FGR|GasPedal|AccPedal|FahrPed/i, system: 'Pedal', icon: '🦶', explain: 'Gaz pedalı karakteristiği.', offExplain: 'Agresifleştirilince tepki artar.', stage1: false, hpGain: '0' },
    { re: /ColdStart|Kaltst|KSTT|HRMK/i, system: 'Soğuk marş', icon: '❄️', explain: 'Soğuk marş zenginleştirme.', offExplain: 'Azaltılınca motor hızlı normal devire iner.', stage1: false, hpGain: '0' },
    { re: /Knock|Klopf|\bKR\b|KFKHFM|KnkDet|AntiKnock|KFZW/i, system: 'Vuruntu', icon: '🔨', explain: 'Vuruntu sensörü.', offExplain: 'Devre dışı bırakılınca ateşleme ilerler — DİKKAT.', stage1: false, hpGain: '3-8' },
    { re: /Immo|Wegfahr|IMMOBILIZER/i, system: 'Immobilizer', icon: '🔑', explain: 'Anahtar eşleşme sistemi.', offExplain: 'Kapatılınca motor herhangi bir anahtarla çalışır.', stage1: false, hpGain: '0' },
    { re: /Checksum|Prüfsumme|Chksum|CRC|CSM_|ChkS/i, system: 'Checksum', icon: '✅', explain: 'Dosya bütünlük kontrolü.', offExplain: 'Değişiklik sonrası tekrar hesaplanmalı.', stage1: false, hpGain: '0' },
    { re: /DTC|Fehler|Fehlerspeicher|DiagCode|FaultMem|DFES|P0[0-9A-F]{3}|P1[0-9A-F]{3}|P2[0-9A-F]{3}/i, system: 'DTC', icon: '🚨', explain: 'Hata kodu yönetimi.', offExplain: 'DTC silme: EGR/DPF off sonrası ilgili hata kodları kapatılmalı.', stage1: false, hpGain: '0' }
  ];

  function localExtractStrings(bytes, minLen = 3, maxLen = 48) {
    const results = []; let cur = '', start = 0;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 0x20 && b <= 0x7E) {
        if (!cur) start = i;
        cur += String.fromCharCode(b);
        if (cur.length >= maxLen) { results.push({ offset: start, text: cur }); cur = ''; }
      } else {
        if (cur.length >= minLen) results.push({ offset: start, text: cur });
        cur = '';
      }
    }
    if (cur.length >= minLen) results.push({ offset: start, text: cur });
    return results;
  }

  function localBuildActions(system, offset, bytes) {
    const safe = ofs => ofs >= 0 && ofs + 1 < bytes.length;
    const fo = offset + 16, lo = offset + 8, list = [];
    const actions = {
      'EGR': () => safe(fo) && list.push({ id: 'egr_off_' + offset.toString(16), label: 'EGR Devre Dışı (OFF)', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x00`, explain: 'EGR valfini kapatır.', effect: 'Karbon birikimi durur', hpGain: '+5-15 HP', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'low' }),
      'DPF': () => { if (safe(fo)) list.push({ id: 'dpf_regen_off_' + offset.toString(16), label: 'DPF Rejenerasyon Kapat (OFF)', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x00`, explain: 'DPF rejenerasyonu devre dışı.', effect: 'Yakıt tasarrufu, contra basınç düşer', hpGain: '+10-20 HP', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'medium' }); },
      'AdBlue/SCR': () => safe(fo) && list.push({ id: 'adblue_off_' + offset.toString(16), label: 'AdBlue Sistemi Kapat (OFF)', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x00`, explain: 'AdBlue enjeksiyonunu kapatır.', effect: 'Limp mode riski yok', hpGain: '0-5 HP', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'high' }),
      'Lambda': () => safe(fo) && list.push({ id: 'lambda_off_' + offset.toString(16), label: 'Lambda Sensör Devre Dışı', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x00`, explain: 'O2 sensör verileri devre dışı.', effect: 'Emisyon hata kodları önlenir', hpGain: '', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'low' }),
      'Hız sınırı': () => safe(lo) && list.push({ id: 'vmax_up_' + offset.toString(16), label: 'Hız Sınırını Kaldır (Vmax OFF)', detail: `Adres ${hexAddr(lo)}: 0x${hexByte(bytes[lo])} → 0xFF`, explain: 'Elektronik hız sınırını kaldırır.', effect: 'Mekanik limite kadar hızlanır', hpGain: '', offset: lo, currentByte: bytes[lo], newByte: 0xFF, risk: 'medium' }),
      'RPM sınırı': () => safe(lo) && list.push({ id: 'rpmlim_up_' + offset.toString(16), label: 'RPM Limiti Yükselt', detail: `Adres ${hexAddr(lo)}: 0x${hexByte(bytes[lo])} → 0xFF`, explain: 'Devir sınırlayıcıyı yükseltir.', effect: 'Motor daha yüksek devire çıkar', hpGain: '0-5 HP', offset: lo, currentByte: bytes[lo], newByte: 0xFF, risk: 'high' }),
      'Boost': () => { if (safe(lo)) { const c = bytes[lo], t = Math.min(0xFF, c + 0x18); list.push({ id: 'stage1_boost_' + offset.toString(16), label: 'Stage 1 — Boost Basınç +15-25%', detail: `Adres ${hexAddr(lo)}: 0x${hexByte(c)} → 0x${hexByte(t)}`, explain: 'Turbo basıncını yükseltir.', effect: 'Motor gücü artar', hpGain: '+20-40 HP', offset: lo, currentByte: c, newByte: t, risk: 'medium' }); } },
      'Torque': () => { if (safe(lo)) { const c = bytes[lo], t = Math.min(0xFF, c + 0x20); list.push({ id: 'torque_up_' + offset.toString(16), label: 'Tork Limiti Yükselt +25%', detail: `Adres ${hexAddr(lo)}: 0x${hexByte(c)} → 0x${hexByte(t)}`, explain: 'Tork sınırını yükseltir.', effect: 'Daha güçlü kalkış', hpGain: '+15-30 HP', offset: lo, currentByte: c, newByte: t, risk: 'high' }); } },
      'Injection': () => { if (safe(lo)) { const c = bytes[lo], t = Math.min(0xFF, c + 0x10); list.push({ id: 'injection_up_' + offset.toString(16), label: 'Enjeksiyon Miktarı Artır +10-20%', detail: `Adres ${hexAddr(lo)}: 0x${hexByte(c)} → 0x${hexByte(t)}`, explain: 'Yakıt enjeksiyonunu artırır.', effect: 'Boost artışını destekler', hpGain: '+10-25 HP', offset: lo, currentByte: c, newByte: t, risk: 'medium' }); } },
      'Pedal': () => safe(fo) && list.push({ id: 'pedal_map_' + offset.toString(16), label: 'Pedal Haritası Agresifleştir', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x${hexByte(Math.min(0xFF, bytes[fo] + 0x30))}`, explain: 'Gaz pedalı yanıtını keskinleştirir.', effect: 'Daha canlı gaz tepkisi', hpGain: '', offset: fo, currentByte: bytes[fo], newByte: Math.min(0xFF, bytes[fo] + 0x30), risk: 'low' }),
      'Immobilizer': () => safe(fo) && list.push({ id: 'immo_off_' + offset.toString(16), label: 'Immobilizer Kapat', detail: `Adres ${hexAddr(fo)}: 0x${hexByte(bytes[fo])} → 0x00`, explain: 'Anahtar eşleşme kontrolünü kapatır.', effect: 'Motor herhangi bir anahtarla çalışır', hpGain: '', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'high' }),
      'DTC': () => safe(fo) && list.push({ id: 'dtc_clear_' + offset.toString(16), label: 'DTC Hata Kodları Sil / Engelle', detail: `Adres ${hexAddr(fo)}: hata kodu bölgesi`, explain: 'EGR/DPF off sonrası ilgili hata kodları kapatılır.', effect: 'Motor uyarı lambası yanmaz', hpGain: '', offset: fo, currentByte: bytes[fo], newByte: 0, risk: 'medium' })
    };
    if (actions[system]) actions[system]();
    return list;
  }

  // ECU profil tablosu (client-side)
  const LOCAL_ECU_PROFILES = {
    'EDC17': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'EDC16': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'EDC15': { fuel: 'diesel', systems: ['EGR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum'] },
    'MED17': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] },
    'ME7': { fuel: 'gasoline', systems: ['Lambda','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] },
    'SID': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'PCR': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'DCM': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'SIMOS': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] },
    'MG1': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
    'MD1': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  };

  function localDetectEcuType(strings) {
    const allText = strings.map(s => s.text).join(' ');
    for (const [ecuType, profile] of Object.entries(LOCAL_ECU_PROFILES)) {
      if (new RegExp(ecuType.replace(/\+/g, '\\+'), 'i').test(allText)) return { ecuType, ...profile };
    }
    const dieselHints = /EDC|DPF|FAP|AdBlue|SCR|Diesel|TDI|CDI|HDI|dCi|CDTI|Rußfilter|Harnstoff|BlueTec|Einspritz/i;
    const gasolineHints = /MED|TFSI|TSI|FSI|GDI|Benzin|Ottomotor|Zündung|Klopf|Knock/i;
    if (dieselHints.test(allText)) return { ecuType: 'generic-diesel', fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] };
    if (gasolineHints.test(allText)) return { ecuType: 'generic-gasoline', fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] };
    return { ecuType: 'unknown', fuel: 'unknown', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] };
  }

  function localScanRegions(bytes) {
    const strings = localExtractStrings(bytes);
    const regions = [], perSystem = new Map();
    for (const s of strings) {
      for (const sys of LOCAL_SYSTEMS) {
        if (!sys.re.test(s.text)) continue;
        const key = sys.system + ':' + s.offset;
        if (perSystem.has(key)) continue;
        const sysHits = [...perSystem.values()].filter(r => r.system === sys.system).length;
        if (sysHits >= 4) continue;
        const ws = Math.max(0, s.offset - 8);
        const we = Math.min(bytes.length, s.offset + s.text.length + 24);
        const acts = localBuildActions(sys.system, s.offset, bytes).map(a => ({ ...a, confidence: 'low', source: 'scanner-heuristic', sourceUrl: null }));
        const region = { id: sys.system.toLowerCase().replace(/[^a-z]/g, '_') + '_' + s.offset.toString(16), system: sys.system, desc: sys.desc || '', foundString: s.text, offset: s.offset, offsetHex: hexAddr(s.offset), windowHex: '', windowStart: ws, source: 'scanner-heuristic', actions: acts };
        perSystem.set(key, region);
        regions.push(region);
      }
    }

    // ECU-tip profil çıkarımı — string'lerden bulunamayan sistemleri ekle
    const ecuProfile = localDetectEcuType(strings);
    const foundSystems = new Set(regions.map(r => r.system));
    for (const expectedSys of ecuProfile.systems) {
      if (!foundSystems.has(expectedSys)) {
        const sysInfo = LOCAL_SYSTEMS.find(ls => ls.system === expectedSys);
        if (!sysInfo) continue;
        regions.push({
          id: 'profile_' + expectedSys.toLowerCase().replace(/[^a-z]/g, '_'),
          system: expectedSys,
          desc: `${ecuProfile.ecuType} profil tahmini`,
          foundString: `ECU tipi: ${ecuProfile.ecuType} (${ecuProfile.fuel})`,
          offset: 0,
          offsetHex: '0x000000',
          windowHex: '',
          windowStart: 0,
          source: 'ecu-profile',
          actions: []
        });
      }
    }

    regions.sort((a, b) => a.offset - b.offset);
    const systems = [...new Set(regions.map(r => r.system))];
    const systemInfos = systems.map(s => { const info = LOCAL_SYSTEMS.find(ls => ls.system === s); return { system: s, icon: info?.icon || '⚙', explain: info?.explain || '', offExplain: info?.offExplain || '', stage1: info?.stage1 || false, hpGain: info?.hpGain || '' }; });
    const s1Features = systemInfos.filter(s => s.stage1);
    return { regions, systems, systemInfos, stage1: s1Features.length ? { features: s1Features, totalHpGain: s1Features.map(f => f.hpGain).join(' + ') } : null, rulepackMatches: [], ecuProfile };
  }

  // ===== HİZMET KATALOĞU (dosya yüklemeden önce görünür) =====
  const TUNING_SERVICES = [
    { id: 'stage1', name: 'Stage 1 Performans Paketi', icon: '🏁', tag: 'POPÜLER', tagColor: '#35df9a',
      desc: 'Boost basıncı artırma, tork limiti yükseltme, enjeksiyon optimizasyonu — tek pakette.',
      detail: 'Turbo basıncını %15-25 artırır, tork limitlerini yükseltir, enjeksiyon miktarını optimize eder. EGR ve DPF kapatmayla birlikte en etkili sonucu verir.',
      hp: '+40-90 HP', risk: 'medium', systems: ['Boost','Torque','Injection','EGR','DPF'] },
    { id: 'egr', name: 'EGR OFF', icon: '🔄', tag: 'EN YAYGIN', tagColor: '#31dfff',
      desc: 'Egzoz gazı resirkülasyonunu devre dışı bırakır.',
      detail: 'EGR valfini kapatır → egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır. Karbon birikimi durur.',
      hp: '+5-15 HP', risk: 'low', systems: ['EGR'] },
    { id: 'dpf', name: 'DPF OFF', icon: '🔥', tag: '', tagColor: '',
      desc: 'Dizel partikül filtre rejenerasyonunu kapatır.',
      detail: 'Rejenerasyon döngüsünü devre dışı bırakır → yakıt tasarrufu. Contra basınç düşer → güç artar. DPF fiziksel olarak da çıkarılmalı.',
      hp: '+10-20 HP', risk: 'medium', systems: ['DPF'] },
    { id: 'adblue', name: 'AdBlue / SCR OFF', icon: '💧', tag: '', tagColor: '',
      desc: 'AdBlue (üre) enjeksiyon sistemini tamamen devre dışı bırakır.',
      detail: 'AdBlue tankı boşaltılabilir. "Seviye düşük" uyarıları ve limp mode (güç kısıtlaması) riski ortadan kalkar.',
      hp: '0-5 HP', risk: 'high', systems: ['AdBlue/SCR'] },
    { id: 'lambda', name: 'Lambda OFF', icon: '📊', tag: '', tagColor: '',
      desc: 'O2 sensör verilerini ECU hesaplamasından çıkarır.',
      detail: 'EGR/DPF kapatıldıktan sonra P0420/P0430 gibi hata kodlarını önler. Genelde EGR+DPF off ile birlikte uygulanır.',
      hp: '', risk: 'low', systems: ['Lambda'] },
    { id: 'vmax', name: 'Hız Sınırı Kaldırma', icon: '🏎️', tag: '', tagColor: '',
      desc: 'Elektronik hız sınırını (Vmax limiter) kaldırır.',
      detail: 'Araç mekanik/aerodinamik limitine kadar hızlanabilir. Lastik ve fren kapasitesi kontrol edilmeli.',
      hp: '', risk: 'medium', systems: ['Hız sınırı'] },
    { id: 'immo', name: 'Immobilizer OFF', icon: '🔑', tag: '', tagColor: '',
      desc: 'Anahtar eşleşme kontrolünü devre dışı bırakır.',
      detail: 'ECU swap veya yedek ECU durumlarında kullanılır. Motor herhangi bir anahtarla çalışır.',
      hp: '', risk: 'high', systems: ['Immobilizer'] },
    { id: 'pedal', name: 'Pedal Haritası', icon: '🦶', tag: '', tagColor: '',
      desc: 'Gaz pedalı yanıtını daha agresif yapar.',
      detail: 'İlk %30 pedalda daha fazla kelebek açıklığı. Gerçek güç artışı yok ama sübjektif hız hissi artar.',
      hp: '', risk: 'low', systems: ['Pedal'] }
  ];

  function renderServicesCatalog() {
    const el = $('#ecuServicesCatalog');
    if (!el) return;

    el.innerHTML = `
      <div class="ecuServicesWrap">
        <div class="ecuServicesHead">
          <span class="stepNum">⚙</span>
          <div>
            <h2 style="margin:0;font-size:16px">Tuning Hizmetleri</h2>
            <small class="muted">Dosya yükledikten sonra tespit edilen sistemler aktif olur</small>
          </div>
        </div>
        <div class="ecuServicesList">
          ${TUNING_SERVICES.map(s => `
            <div class="ecuServiceCard" data-svc="${esc(s.id)}">
              <div class="ecuServiceTop">
                <span class="ecuServiceIcon">${s.icon}</span>
                <div class="ecuServiceInfo">
                  <div class="ecuServiceName">
                    <b>${esc(s.name)}</b>
                    ${s.tag ? `<span class="ecuServiceTag" style="background:${s.tagColor}22;color:${s.tagColor}">${esc(s.tag)}</span>` : ''}
                    ${s.hp ? `<span class="ecuHpPill">${esc(s.hp)}</span>` : ''}
                  </div>
                  <div class="ecuServiceDesc">${esc(s.desc)}</div>
                </div>
                <span class="ecuServiceArrow">›</span>
              </div>
              <div class="ecuServiceDetail hidden">
                <p>${esc(s.detail)}</p>
                <div class="ecuServiceMeta">
                  <span class="ecuRiskPill" style="background:${riskColor(s.risk)}22;color:${riskColor(s.risk)}">${riskLabel(s.risk)}</span>
                  <span class="muted" style="font-size:11px">Sistemler: ${s.systems.join(', ')}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Toggle detail on card click
    el.querySelectorAll('.ecuServiceCard').forEach(card => {
      card.querySelector('.ecuServiceTop').addEventListener('click', () => {
        const det = card.querySelector('.ecuServiceDetail');
        const arrow = card.querySelector('.ecuServiceArrow');
        const wasOpen = !det.classList.contains('hidden');
        // Close all
        el.querySelectorAll('.ecuServiceDetail').forEach(d => d.classList.add('hidden'));
        el.querySelectorAll('.ecuServiceArrow').forEach(a => a.textContent = '›');
        if (!wasOpen) {
          det.classList.remove('hidden');
          arrow.textContent = '⌄';
        }
      });
    });
  }

  // ===== INIT =====
  function init() {
    const drop = $('#ecuDrop');
    if (!drop) { setTimeout(init, 200); return; }
    rebindDrop();
    $('#ecuReset')?.addEventListener('click', resetAll);
    $('#ecuAgain')?.addEventListener('click', resetAll);
    $('#ecuGo')?.addEventListener('click', applySelected);
    $('#ecuDownload')?.addEventListener('click', downloadTuned);
    $('#ecuDeviceBtn')?.addEventListener('click', openDeviceSheet);
    $('#ecuDeviceClose')?.addEventListener('click', closeDeviceSheet);
    $('#ecuDeviceRefresh')?.addEventListener('click', loadBridges);
    $('#ecuDeviceNewToken')?.addEventListener('click', newBridgeToken);
    loadBridges(true);
    window.__ecuRetryAI = () => requestAISuggestions();
    renderServicesCatalog();
    loadVehicleDB().then(() => {
      const vSel = $('#ecuVehicleSelect');
      if (vSel && state.vehicleDB) {
        vSel.innerHTML = '<label class="muted">Araç Bilgisi (opsiyonel)</label>' + renderVehicleSelect();
        bindVehicleSelects();
      }
    });
  }

  // ===== VEHICLE DB =====
  async function loadVehicleDB() {
    try {
      const res = await fetch('/api/ecu/vehicle-db');
      const data = await res.json();
      if (data.ok !== false) {
        state.vehicleDB = data;
      }
    } catch { /* silent */ }
  }

  function renderVehicleSelect() {
    const db = state.vehicleDB;
    if (!db) return '<div class="muted" style="padding:8px;font-size:12px">Araç veritabanı yüklenemedi</div>';

    const makes = db.makes || [];
    const ecuTypes = db.ecuTypes || [];
    const years = db.years || [];

    return `
      <div class="ecuVehicleGrid">
        <div class="ecuField">
          <label>Marka</label>
          <select id="vMake" class="ecuSelect">
            <option value="">Seç...</option>
            ${makes.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="ecuField">
          <label>Model</label>
          <select id="vModel" class="ecuSelect" disabled>
            <option value="">Önce marka seç</option>
          </select>
        </div>
        <div class="ecuField">
          <label>Yıl</label>
          <select id="vYear" class="ecuSelect">
            <option value="">Seç...</option>
            ${years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('')}
          </select>
        </div>
        <div class="ecuField">
          <label>ECU Tipi</label>
          <select id="vEcu" class="ecuSelect">
            <option value="">Bilinmiyor</option>
            ${ecuTypes.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }

  function bindVehicleSelects() {
    const mkSel = $('#vMake');
    const mdSel = $('#vModel');
    if (!mkSel || !mdSel) return;

    mkSel.addEventListener('change', () => {
      const makeId = mkSel.value;
      state.vehicle.make = mkSel.options[mkSel.selectedIndex]?.text || '';
      const db = state.vehicleDB;
      const found = db?.makes?.find(m => m.id === makeId);
      if (found) {
        mdSel.disabled = false;
        mdSel.innerHTML = '<option value="">Seç...</option>' + found.models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      } else {
        mdSel.disabled = true;
        mdSel.innerHTML = '<option value="">Önce marka seç</option>';
      }
      state.vehicle.model = '';
    });
    mdSel.addEventListener('change', () => { state.vehicle.model = mdSel.value; });
    $('#vYear')?.addEventListener('change', e => { state.vehicle.year = e.target.value; });
    $('#vEcu')?.addEventListener('change', e => { state.vehicle.ecuType = e.target.value; });
  }

  // ===== FILE DROP =====
  function rebindDrop() {
    const drop = $('#ecuDrop');
    const file = $('#ecuFile');
    if (!drop._bound) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
      drop._bound = true;
    }
    drop.onclick = () => file.click();
    file.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  }

  async function handleFile(f) {
    if (f.size > 12 * 1024 * 1024) { toast('Dosya 12 MB sınırını aşıyor'); return; }
    const drop = $('#ecuDrop');
    state.fileName = f.name;
    state.fileSize = f.size;
    drop.classList.add('has');
    drop.innerHTML = `
      <div class="ecuDropIcon" style="color:#35df9a">⏳</div>
      <b>${esc(f.name)}</b>
      <p>${fmtSize(f.size)} · yükleniyor ve taranıyor...</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    rebindDrop();

    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let data = null;
      let isOffline = false;

      // Önce sunucuya dene
      try {
        const CHUNK = 0x8000;
        let bin = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
        }
        const b64 = btoa(bin);
        const res = await fetch('/api/ecu/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: f.name, fileData: b64,
            make: state.vehicle.make, model: state.vehicle.model,
            year: state.vehicle.year, ecuType: state.vehicle.ecuType
          })
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
      } catch (netErr) {
        // Sunucu erişilemezse client-side analiz yap
        isOffline = true;
        data = localScanRegions(bytes);
        toast('⚡ Offline analiz — sunucu bağlantısı yok');
      }

      state.uploadId = data.uploadId || data.upload_id || null;
      state.regions = data.regions || [];
      state.systems = data.systems || [];
      state.systemInfos = data.systemInfos || [];
      state.stage1 = data.stage1 || null;
      state.stats = data.stats || null;
      state.rulepackMatches = data.rulepackMatches || [];
      state.fileMemory = data.fileMemory || null;
      state.ecuProfile = data.ecuProfile || null;
      state.selectedActions.clear();

      drop.querySelector('.ecuDropIcon').textContent = '✓';
      drop.querySelector('.ecuDropIcon').style.color = '#35df9a';
      const modeTag = isOffline ? ' · ⚡ offline' : '';
      const rpInfo = state.rulepackMatches.length ? ` · ✓ ${state.rulepackMatches[0].familyName}` : '';
      const ecuTag = data.ecuProfile?.ecuType && data.ecuProfile.ecuType!=='unknown' ? ` · ${data.ecuProfile.ecuType} (${data.ecuProfile.fuel})` : '';
      const memTag = data.fileMemory?.known ? ` · 🧠 ${data.fileMemory.timesUploaded}x tanınan` : '';
      drop.querySelector('p').textContent = `${fmtSize(f.size)} · ${state.regions.length} bölge · ${state.systems.length} sistem${ecuTag}${rpInfo}${memTag}${modeTag}`;
      // Tanınan dosya banneri
      if (data.fileMemory?.known) showFileMemoryBanner(data.fileMemory, drop);
      renderStep2();
      if (!isOffline) requestAISuggestions();
    } catch (err) {
      const msg = err.message === 'Load failed' || err.message === 'Failed to fetch'
        ? 'Sunucuya bağlanılamadı — internet bağlantınızı kontrol edin veya tekrar deneyin'
        : err.message;
      drop.classList.remove('has');
      drop.innerHTML = `
        <div class="ecuDropIcon" style="color:#ff5578">✗</div>
        <b>Yüklenemedi</b>
        <p>${esc(msg)}</p>
        <button class="softBtn" style="margin-top:10px" onclick="document.querySelector('#ecuFile')?.click()">🔄 Tekrar Dene</button>
        <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
      `;
      rebindDrop();
      toast(msg);
    }
  }

  // ===== STEP 2: REGIONS + ACTIONS =====
  function renderStep2() {
    const step2 = $('#step2');
    step2.classList.remove('hidden');
    // Hizmet kataloğunu gizle — artık gerçek sonuçlar var
    const catalog = $('#ecuServicesCatalog');
    if (catalog) catalog.classList.add('hidden');

    const vehicleLabel = [state.vehicle.make, state.vehicle.model, state.vehicle.year].filter(Boolean).join(' ');
    const ecuLabel = state.vehicle.ecuType || '';
    const vehicleBanner = vehicleLabel ? `
      <div class="ecuVehicleBanner">
        <span class="ecuVehicleIcon">🚗</span>
        <div>
          <b>${esc(vehicleLabel)}</b>
          ${ecuLabel ? `<small>${esc(ecuLabel)}</small>` : ''}
        </div>
      </div>
    ` : '';

    const rpBanner = state.rulepackMatches?.length ? `
      <div class="ecuRulepackHit">
        <b>✓ ${esc(state.rulepackMatches[0].familyName)}</b>
        <small>${esc(state.rulepackMatches[0].description || '')}</small>
        ${state.rulepackMatches[0].firmware ? `<div class="ecuFirmwareHit">◉ Firmware: <b>${esc(state.rulepackMatches[0].firmware.name)}</b></div>` : ''}
      </div>
    ` : '';

    const stage1Html = renderStage1Banner();

    step2.innerHTML = `
      <div class="stepHead"><span class="stepNum">2</span><h2>Tuning Seçenekleri</h2></div>

      ${vehicleBanner}
      ${rpBanner}

      ${state.stats ? `<div class="ecuStatRow">
        <span>📦 ${fmtSize(state.stats.size)}</span>
        <span>🔢 Entropi: ${state.stats.entropy.toFixed(2)}</span>
        <span>Ø ${state.stats.zeroPct.toFixed(1)}%</span>
        <span>FF ${state.stats.ffPct.toFixed(1)}%</span>
      </div>` : ''}

      ${stage1Html}

      <div class="ecuTabs">
        <button class="ecuTab active" data-tab="manual">🔧 Bulunan Sistemler</button>
        <button class="ecuTab" data-tab="ai">🤖 AI Önerisi</button>
      </div>

      <div id="ecuTabManual" class="ecuTabPanel">
        ${state.regions.length ? renderRegionsHTML() : '<div class="muted" style="padding:14px">Bu dosyada bilinen sistem stringi bulunamadı.</div>'}
      </div>

      <div id="ecuTabAI" class="ecuTabPanel hidden">
        <div id="ecuAIBody"><div class="muted" style="padding:14px">🤖 AI önerileri hazırlanıyor...</div></div>
      </div>

      <div class="ecuWarn">⚠ Her değişikliği uygulamadan önce dosyanı yedekle. Offset'ler heuristik konumlardır — ilk denemeyi test bench'te yap.</div>

      <div class="stepActions">
        <button id="ecuReset" class="softBtn">BAŞA DÖN</button>
        <button id="ecuGo" class="primaryBig">SEÇİLİ AKSİYONLARI UYGULA (<span id="ecuGoCount">0</span>)</button>
      </div>
    `;

    // Tab switching
    step2.querySelectorAll('.ecuTab').forEach(t => t.addEventListener('click', () => {
      step2.querySelectorAll('.ecuTab').forEach(x => x.classList.toggle('active', x === t));
      $('#ecuTabManual').classList.toggle('hidden', t.dataset.tab !== 'manual');
      $('#ecuTabAI').classList.toggle('hidden', t.dataset.tab !== 'ai');
    }));

    $('#ecuReset').addEventListener('click', resetAll);
    $('#ecuGo').addEventListener('click', applySelected);

    // Bind action cards
    bindActionCards();

    // Stage 1 quick-select
    const s1Btn = $('#ecuStage1Btn');
    if (s1Btn) s1Btn.addEventListener('click', selectStage1Actions);

    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderAITab();
  }

  function renderStage1Banner() {
    const s1 = state.stage1;
    if (!s1 || !s1.features || !s1.features.length) return '';

    return `
      <div class="ecuStage1">
        <div class="ecuStage1Head">
          <div>
            <b>🏁 ${esc(s1.name)}</b>
            ${s1.totalHpGain ? `<span class="ecuHpBadge">+${esc(s1.totalHpGain)}</span>` : ''}
          </div>
          <button id="ecuStage1Btn" class="ecuStage1Apply">STAGE 1 UYGULA</button>
        </div>
        <div class="ecuStage1Features">
          ${s1.features.map(f => `
            <div class="ecuStage1Feature">
              <span class="ecuStage1Sys">${esc(f.system)}</span>
              <span>${esc(f.text)}</span>
              ${f.hp ? `<span class="ecuHpSmall">${esc(f.hp)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderRegionsHTML() {
    const bySystem = {};
    state.regions.forEach(r => {
      if (!bySystem[r.system]) bySystem[r.system] = [];
      bySystem[r.system].push(r);
    });

    return Object.entries(bySystem).map(([sys, regs]) => {
      const info = state.systemInfos.find(s => s.system === sys) || {};
      const isStage1 = info.stage1;

      // Aksiyonları label'a göre grupla, aksiyonsuz bölgeleri ayır
      const actionsByLabel = {};
      let noActionCount = 0;
      regs.forEach(r => {
        if (!r.actions.length) { noActionCount++; return; }
        r.actions.forEach(a => {
          if (!actionsByLabel[a.label]) actionsByLabel[a.label] = [];
          actionsByLabel[a.label].push({ action: a, region: r });
        });
      });
      const actionGroups = Object.entries(actionsByLabel);
      const hasActions = actionGroups.length > 0;

      return `
        <div class="ecuSysGroup${hasActions ? '' : ' ecuSysNoAction'}">
          <div class="ecuSysHead">
            <div class="ecuSysTitle">
              <span class="ecuSysIcon">${esc(info.icon || '⚙')}</span>
              <b>${esc(sys)}</b>
              ${isStage1 ? '<span class="ecuStage1Tag">Stage 1</span>' : ''}
              ${info.hpGain && hasActions ? `<span class="ecuHpSmall">+${esc(info.hpGain)} HP</span>` : ''}
            </div>
            <small>${regs.length} konum${hasActions ? '' : ' · aksiyon yok'}</small>
          </div>

          ${hasActions && info.explain ? `<div class="ecuSysExplain">
            <div class="ecuExplainWhat"><b>Ne yapar:</b> ${esc(info.explain)}</div>
            ${info.offExplain ? `<div class="ecuExplainOff"><b>Kapatınca:</b> ${esc(info.offExplain)}</div>` : ''}
          </div>` : ''}

          ${actionGroups.map(([label, items]) => {
            const first = items[0].action;
            const isRulepack = first.source && first.source.startsWith('rulepack:');
            const isProfile = first.source === 'ecu-profile-bytescan';
            const srcLabel = isRulepack ? '✓ Doğrulanmış' : isProfile ? '🔍 Profil Tarama' : '⚠ Heuristik';
            const srcColor = isRulepack ? '#35df9a' : isProfile ? '#5e9eff' : '#ffbe55';

            if (items.length === 1) {
              // Tek offset — klasik kart (div, label değil — iOS uyumluluğu)
              const a = first;
              return `
                <div class="ecuActionCard ecuActionSingle" data-id="${esc(a.id)}">
                  <div class="ecuActionTop">
                    <div class="ecuActionLabel">
                      <input type="checkbox" class="ecuActionCheck" data-id="${esc(a.id)}">
                      <b>${esc(a.label)}</b>
                    </div>
                    <div class="ecuActionBadges">
                      <span class="ecuRiskPill" style="background:${srcColor}22;color:${srcColor}">${srcLabel}</span>
                      <span class="ecuRiskPill" style="background:${riskColor(a.risk)}22;color:${riskColor(a.risk)}">${riskLabel(a.risk)}</span>
                      ${a.hpGain ? `<span class="ecuHpPill">${esc(a.hpGain)}</span>` : ''}
                    </div>
                  </div>
                  ${a.explain ? `<div class="ecuActionExplain">${esc(a.explain)}</div>` : ''}
                  ${a.effect ? `<div class="ecuActionEffect">→ ${esc(a.effect)}</div>` : ''}
                  <div class="ecuActionDetail"><code>${esc(a.detail)}</code></div>
                  ${a.sourceUrl ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener" class="ecuActionSource">→ kaynak</a>` : ''}
                </div>
              `;
            }

            // Çoklu offset — gruplanmış kart
            return `
              <div class="ecuActionCard ecuActionGrouped">
                <div class="ecuActionTop">
                  <div class="ecuActionLabel">
                    <b>${esc(label)}</b>
                    <span class="ecuOffsetCount">${items.length} konum</span>
                  </div>
                  <div class="ecuActionBadges">
                    <span class="ecuRiskPill" style="background:${srcColor}22;color:${srcColor}">${srcLabel}</span>
                    <span class="ecuRiskPill" style="background:${riskColor(first.risk)}22;color:${riskColor(first.risk)}">${riskLabel(first.risk)}</span>
                    ${first.hpGain ? `<span class="ecuHpPill">${esc(first.hpGain)}</span>` : ''}
                  </div>
                </div>
                ${first.explain ? `<div class="ecuActionExplain">${esc(first.explain)}</div>` : ''}
                ${first.effect ? `<div class="ecuActionEffect">→ ${esc(first.effect)}</div>` : ''}
                <div class="ecuActionOffsets">
                  ${items.map(item => `
                    <div class="ecuOffsetRow" data-aid="${esc(item.action.id)}">
                      <input type="checkbox" class="ecuActionCheck" data-id="${esc(item.action.id)}">
                      <code>${esc(item.action.detail)}</code>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}

          ${noActionCount && hasActions ? `<div class="ecuNoActionNote">${noActionCount} ek konum — otomatik aksiyon önerisi yok</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function toggleAction(cb) {
    const aid = cb.dataset.id;
    const action = findActionById(aid);
    if (!action) {
      // Debug: ID eşleşmedi — kullanıcıya göster
      console.warn('[ECU] findActionById NULL for:', aid, 'regions:', state.regions.map(r => r.actions.map(a => a.id)));
      toast('⚠ Aksiyon bulunamadı (ID: ' + aid + ')');
      cb.checked = !cb.checked; // Görsel toggle'ı geri al
      return;
    }
    const card = cb.closest('.ecuActionCard');
    if (cb.checked) {
      state.selectedActions.set(aid, action);
      card?.classList.add('selected');
    } else {
      state.selectedActions.delete(aid);
      const anyChecked = card && card.querySelector('.ecuActionCheck:checked');
      if (!anyChecked) card?.classList.remove('selected');
    }
    updateGoCount();
  }

  function bindActionCards() {
    // Label yerine div kullanıyoruz (iOS Safari label-checkbox bug'ı)
    // Tüm toggle'lar click handler'lar üzerinden

    // 1) Tek-aksiyon kartları — kartın HER YERİNE dokunma ile toggle
    $$('.ecuActionCard.ecuActionSingle').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('a')) return; // Link tıklaması
        e.preventDefault();
        const cb = card.querySelector('.ecuActionCheck');
        if (!cb) return;
        cb.checked = !cb.checked;
        toggleAction(cb);
      });
    });

    // 2) Gruplanmış kartlarda her offset satırına dokunma ile toggle
    $$('.ecuOffsetRow').forEach(row => {
      row.addEventListener('click', e => {
        e.preventDefault();
        const cb = row.querySelector('.ecuActionCheck');
        if (!cb) return;
        cb.checked = !cb.checked;
        toggleAction(cb);
      });
    });

    // 3) Checkbox'a doğrudan tıklamayı da yakala (change event, kart handler ile çakışmasın)
    $$('.ecuActionCheck').forEach(cb => {
      cb.addEventListener('click', e => {
        e.stopPropagation(); // Kart/satır handler'ına da gitmesini engelle
        // checked zaten browser tarafından toggle edildi
        toggleAction(cb);
      });
    });
  }

  function updateGoCount() {
    const el = $('#ecuGoCount');
    if (el) el.textContent = state.selectedActions.size;
  }

  function selectStage1Actions() {
    // Select all actions belonging to stage1 systems
    const s1Systems = new Set((state.stage1?.features || []).map(f => f.system));
    let count = 0;
    $$('.ecuActionCheck').forEach(cb => {
      const aid = cb.dataset.id;
      const action = findActionById(aid);
      if (action && s1Systems.has(action.system || findSystemForAction(aid))) {
        cb.checked = true;
        state.selectedActions.set(aid, action);
        cb.closest('.ecuActionCard')?.classList.add('selected');
        count++;
      }
    });
    updateGoCount();
    toast(`Stage 1: ${count} aksiyon seçildi`);
  }

  function findSystemForAction(actionId) {
    for (const r of state.regions) {
      for (const a of r.actions) if (a.id === actionId) return r.system;
    }
    return '';
  }

  function findActionById(aid) {
    for (const r of state.regions) {
      for (const a of r.actions) if (a.id === aid) return { ...a, system: r.system };
    }
    return null;
  }

  // ===== AI SUGGESTIONS =====
  async function requestAISuggestions() {
    state.aiLoading = true;
    renderAITab();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch('/api/ecu/ai-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadId: state.uploadId }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      state.aiSuggestions = data.suggestions || [];
      state.aiProvider = data.provider || '';
      state.aiError = data.error || data.detail || '';
    } catch (err) {
      state.aiSuggestions = [];
      state.aiError = err.name === 'AbortError'
        ? 'AI zaman aşımına uğradı (45sn). Tekrar deneyin.'
        : 'Ağ hatası: ' + (err.message || 'bilinmiyor');
    } finally {
      clearTimeout(timeout);
      state.aiLoading = false;
      renderAITab();
    }
  }

  function renderAITab() {
    const el = $('#ecuAIBody');
    if (!el) return;

    if (state.aiLoading) {
      el.innerHTML = `
        <div style="padding:20px;text-align:center">
          <div style="font-size:24px;margin-bottom:8px">🤖</div>
          <div class="muted">AI analiz ediyor... (5-15 sn)</div>
          <div class="ecuAIProgress"></div>
        </div>
      `;
      return;
    }

    if (!state.aiSuggestions.length) {
      const detail = state.aiError || '';
      el.innerHTML = `
        <div style="padding:20px;text-align:center">
          <div style="font-size:24px;margin-bottom:8px">🤖</div>
          <div class="muted">AI şu anda öneri döndüremedi.</div>
          ${detail ? `<div class="muted" style="font-size:11px;margin-top:6px;color:#f88">${esc(detail)}</div>` : ''}
          <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
            <button class="softBtn ecuRetryAI" onclick="window.__ecuRetryAI && window.__ecuRetryAI()">🔄 Tekrar Dene</button>
            <button class="softBtn" onclick="document.querySelector('.ecuTab[data-tab=manual]')?.click()">Manuel Seçeneklere Dön</button>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="ecuAIProviderTag">🤖 ${esc(state.aiProvider)}</div>
      <div class="ecuAISuggList">
        ${state.aiSuggestions.map(s => `
          <div class="ecuAICard">
            <div class="ecuAICardHead">
              <b>${esc(s.system || '?')}</b>
              <div>
                <span class="ecuRiskPill" style="background:${riskColor(s.risk)}22;color:${riskColor(s.risk)}">${riskLabel(s.risk)}</span>
                ${s.hpGain ? `<span class="ecuHpPill">${esc(s.hpGain)}</span>` : ''}
              </div>
            </div>
            <div class="ecuAICardBody">
              <div class="ecuAIAction"><b>Yapılacak:</b> ${esc(s.action || '-')}</div>
              <div class="ecuAIResult"><b>Sonuç:</b> ${esc(s.result || '-')}</div>
              ${s.explain ? `<div class="ecuAIExplain">${esc(s.explain)}</div>` : ''}
              <div class="ecuAIAddr">
                <code>Offset: ${esc(s.offset || '-')}</code>
                <code>${esc(s.currentByte || '-')} → ${esc(s.newByte || '-')}</code>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="muted" style="font-size:11px;padding:8px;text-align:center">AI önerileri referans amaçlıdır. Manuel sekmeden doğrulanmış aksiyonları uygulayın.</div>
    `;
  }

  // ===== APPLY + DOWNLOAD =====
  async function applySelected() {
    if (!state.uploadId) { toast('Önce dosya yükle'); return; }
    if (!state.selectedActions.size) { toast('En az bir aksiyon seç'); return; }

    const btn = $('#ecuGo');
    btn.disabled = true;
    const origTxt = btn.innerHTML;
    btn.innerHTML = '⏳ UYGULANIYOR...';

    try {
      const actionsArr = [...state.selectedActions.values()].map(a => ({
        id: a.id, offset: a.offset, newByte: a.newByte,
        currentByte: a.currentByte, label: a.label, system: a.system,
        risk: a.risk
      }));
      const res = await fetch('/api/ecu/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: state.uploadId,
          actionIds: [...state.selectedActions.keys()],
          actions: actionsArr
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.tunedId = data.tunedId || data.tuned_id;
      state.lastComparison = data.comparison || null;
      const outName = state.fileName.replace(/(\.[^.]+)$/, '_tuned$1');
      $('#ecuDoneName').textContent = outName;
      $('#ecuDoneInfo').textContent = `${fmtSize(data.size || state.fileSize)} · ${data.applied?.length || state.selectedActions.size} yama uygulandı`;

      $('#step2').classList.add('hidden');
      $('#step3').classList.remove('hidden');
      renderComparisonPanel(data.comparison, data.applied);
      $('#step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('✓ Tuned dosya hazır');
    } catch (err) {
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origTxt;
    }
  }

  function downloadTuned() {
    if (!state.tunedId) return;
    const a = document.createElement('a');
    a.href = `/api/ecu/download?tunedId=${encodeURIComponent(state.tunedId)}`;
    a.download = $('#ecuDoneName')?.textContent || 'tuned.bin';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===== OTOMATİK KARŞILAŞTIRMA PANELİ =====
  function renderComparisonPanel(comparison, applied) {
    let panel = $('#ecuComparePanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ecuComparePanel';
      const step3 = $('#step3');
      const actions = step3?.querySelector('.stepActions');
      if (actions) step3.insertBefore(panel, actions);
      else step3?.appendChild(panel);
    }
    if (!comparison || !applied?.length) {
      panel.innerHTML = '';
      return;
    }
    const systems = comparison.bySystem || {};
    const sysKeys = Object.keys(systems);
    const sysHtml = sysKeys.map(sys => {
      const s = systems[sys];
      const changesHtml = (s.changes || []).map(c =>
        `<div style="font-size:11px;color:#9fb6c9;padding:2px 0">• ${esc(c.label || ('Offset ' + (c.offset != null ? '0x' + c.offset.toString(16).toUpperCase() : '?')))}</div>`
      ).join('');
      return `<div style="background:#0a1628;border:1px solid #203653;border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <b style="color:#9fe3ff;font-size:13px">${esc(sys)}</b>
          <span style="background:#1a3a52;color:#35df9a;padding:2px 8px;border-radius:10px;font-size:10px">${s.count} değişiklik</span>
        </div>
        ${changesHtml}
      </div>`;
    }).join('');

    const changesHtml = (comparison.changes || applied || []).map(c => {
      const bef = c.before != null ? '0x' + c.before.toString(16).toUpperCase().padStart(2, '0') : '?';
      const aft = c.after != null ? '0x' + c.after.toString(16).toUpperCase().padStart(2, '0') : '?';
      const addr = c.offsetHex || (c.offset != null ? '0x' + c.offset.toString(16).toUpperCase() : '?');
      return `<tr>
        <td style="padding:4px 8px;font-family:monospace;color:#728899;font-size:11px">${addr}</td>
        <td style="padding:4px 8px;font-family:monospace;color:#f88;font-size:11px">${bef}</td>
        <td style="padding:4px 2px;color:#555;font-size:10px">→</td>
        <td style="padding:4px 8px;font-family:monospace;color:#35df9a;font-size:11px">${aft}</td>
        <td style="padding:4px 8px;color:#9fb6c9;font-size:11px">${esc(c.label || c.id || '')}</td>
      </tr>`;
    }).join('');

    panel.innerHTML = `
      <div style="margin-top:16px;padding:14px;background:linear-gradient(135deg,#060a15,#0d1a2e);border:1px solid #203653;border-radius:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:20px">🔍</span>
          <div>
            <b style="color:#d0dfe8;font-size:14px">Orijinal vs Modifiye Karşılaştırma</b>
            <small style="display:block;color:#728899;font-size:11px">${fmtSize(comparison.totalBytes || state.fileSize)} dosya · ${comparison.changedBytes || applied.length} byte değişti · ${sysKeys.length} sistem etkilendi</small>
          </div>
        </div>

        ${sysKeys.length ? `<div style="margin-bottom:12px"><div style="color:#9fb6c9;font-size:12px;font-weight:600;margin-bottom:6px">Sistem Bazlı Özet</div>${sysHtml}</div>` : ''}

        <details style="cursor:pointer">
          <summary style="color:#9fe3ff;font-size:12px;font-weight:600;padding:6px 0;user-select:none">📊 Byte Değişim Tablosu (${comparison.changes?.length || applied.length} satır)</summary>
          <div style="overflow-x:auto;margin-top:8px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="border-bottom:1px solid #203653">
                <th style="padding:6px 8px;text-align:left;color:#728899;font-size:10px;font-weight:500">ADRES</th>
                <th style="padding:6px 8px;text-align:left;color:#728899;font-size:10px;font-weight:500">ESKİ</th>
                <th style="padding:6px 2px"></th>
                <th style="padding:6px 8px;text-align:left;color:#728899;font-size:10px;font-weight:500">YENİ</th>
                <th style="padding:6px 8px;text-align:left;color:#728899;font-size:10px;font-weight:500">AÇIKLAMA</th>
              </tr></thead>
              <tbody>${changesHtml}</tbody>
            </table>
          </div>
        </details>

        <div style="margin-top:10px;padding:8px;background:#0f1d2f;border-radius:8px;display:flex;align-items:center;gap:6px">
          <span style="color:#35df9a;font-size:14px">✓</span>
          <small style="color:#9fb6c9;font-size:11px">Dosya boyutu korundu · Sadece hedef byte'lar değiştirildi · Orijinal dosya dokunulmadı</small>
        </div>
      </div>
    `;
  }

  // ===== DOSYA HAFIZA BANNERİ =====
  function showFileMemoryBanner(mem, container) {
    const existing = container.parentElement?.querySelector('.fileMemBanner');
    if (existing) existing.remove();
    const prevModsHtml = mem.previousMods?.length ? `<div style="margin-top:6px"><small style="color:#9fb6c9">Son modifikasyonlar:</small><ul style="margin:4px 0 0 16px;padding:0;list-style:disc">${mem.previousMods.slice(-5).map(m => `<li style="font-size:11px;color:#d0dfe8">${new Date(m.date).toLocaleDateString('tr-TR')} — ${(m.actions||[]).join(', ')}</li>`).join('')}</ul></div>` : '';
    const tagsHtml = mem.tags?.length ? `<div style="margin-top:4px">${mem.tags.map(t => `<span style="background:#1a3a52;color:#9fe3ff;padding:2px 8px;border-radius:10px;font-size:10px;margin-right:4px">${esc(t)}</span>`).join('')}</div>` : '';
    const banner = document.createElement('div');
    banner.className = 'fileMemBanner';
    banner.style.cssText = 'margin-top:10px;padding:12px;background:linear-gradient(135deg,#0a1628,#122240);border:1px solid #2a7b5b;border-radius:10px';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:20px">🧠</span>
        <div>
          <b style="color:#35df9a;font-size:13px">Bu dosya tanındı!</b>
          <small style="display:block;color:#9fb6c9;font-size:11px">${mem.timesUploaded}. yükleme · İlk: ${new Date(mem.firstSeen).toLocaleDateString('tr-TR')}</small>
        </div>
      </div>
      ${mem.notes ? `<div style="color:#d0dfe8;font-size:12px;margin-top:4px">📝 ${esc(mem.notes)}</div>` : ''}
      ${tagsHtml}
      ${prevModsHtml}
    `;
    container.parentElement?.insertBefore(banner, container.nextSibling);
  }

  // ===== DOSYA GEÇMİŞİ PANELİ =====
  async function loadFileHistory() {
    const el = $('#ecuFileHistory');
    if (!el) return;
    el.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Dosya geçmişi yükleniyor...</div>';
    try {
      const res = await fetch('/api/ecu/file-memory/list?limit=50');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (!data.files?.length) {
        el.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz dosya hafızası yok. Dosya yükledikçe burada görünecek.</div>';
        return;
      }
      el.innerHTML = `
        <div style="margin-bottom:12px;display:flex;gap:8px">
          <input type="text" id="fileMemSearch" placeholder="Ara: dosya adı, marka, model, ECU tipi..." style="flex:1;padding:8px 12px;background:#0a1628;border:1px solid #203653;border-radius:8px;color:#d0dfe8;font-size:13px">
          <button class="softBtn" onclick="window.__searchFileMemory?.()">🔍</button>
        </div>
        <div style="color:#9fb6c9;font-size:11px;margin-bottom:8px">${data.total} dosya kayıtlı</div>
        <div id="fileMemList">${renderFileMemList(data.files)}</div>
      `;
      window.__searchFileMemory = async () => {
        const q = document.getElementById('fileMemSearch')?.value?.trim();
        if (!q) { loadFileHistory(); return; }
        try {
          const res2 = await fetch('/api/ecu/file-memory/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) });
          const d2 = await res2.json();
          const list = document.getElementById('fileMemList');
          if (list) list.innerHTML = d2.files?.length ? renderFileMemList(d2.files) : '<div class="muted" style="padding:12px">Sonuç bulunamadı</div>';
        } catch (e) { toast('Arama hatası: ' + e.message); }
      };
      document.getElementById('fileMemSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') window.__searchFileMemory?.(); });
    } catch (err) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Dosya geçmişi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  function renderFileMemList(files) {
    return files.map(f => {
      const systems = f.detected_systems || [];
      const sysTags = systems.slice(0, 6).map(s => `<span style="background:#1a2a40;color:#9fe3ff;padding:1px 6px;border-radius:6px;font-size:10px">${esc(s)}</span>`).join(' ');
      const mods = f.last_modifications || [];
      const lastMod = mods.length ? `<small style="color:#ffbe55">Son mod: ${new Date(mods[mods.length - 1].date).toLocaleDateString('tr-TR')}</small>` : '';
      const vehicle = [f.vehicle_make, f.vehicle_model, f.vehicle_year].filter(Boolean).join(' ');
      return `<div style="padding:10px;background:#060a15;border:1px solid #203653;border-radius:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <b style="color:#d0dfe8;font-size:13px">📄 ${esc(f.filename)}</b>
            <div style="font-size:11px;color:#9fb6c9;margin-top:2px">
              ${f.ecu_type && f.ecu_type !== 'unknown' ? `<span style="color:#9fe3ff">${esc(f.ecu_type)}</span> · ` : ''}
              ${f.fuel_type && f.fuel_type !== 'unknown' ? `<span>${f.fuel_type === 'diesel' ? '🛢️ Dizel' : '⛽ Benzin'}</span> · ` : ''}
              ${vehicle ? `🚗 ${esc(vehicle)} · ` : ''}
              ${fmtSize(f.file_size)}
            </div>
          </div>
          <div style="text-align:right">
            <span style="background:#1a3a52;color:#35df9a;padding:2px 8px;border-radius:10px;font-size:10px">${f.times_uploaded}x yüklendi</span>
          </div>
        </div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px">${sysTags}</div>
        <div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center">
          ${lastMod}
          <small style="color:#728899">${new Date(f.last_seen_at).toLocaleDateString('tr-TR')}</small>
        </div>
      </div>`;
    }).join('');
  }

  // ===== RESET =====
  function resetAll() {
    Object.assign(state, {
      uploadId: null, fileName: '', fileSize: 0, regions: [], systems: [],
      systemInfos: [], stage1: null, stats: null, tunedId: null,
      aiSuggestions: [], aiProvider: '', rulepackMatches: [],
      fileMemory: null, ecuProfile: null
    });
    state.selectedActions.clear();

    const drop = $('#ecuDrop');
    drop.classList.remove('has');
    drop.innerHTML = `
      <div class="ecuDropIcon">⬆</div>
      <b>ECU dosyasını buraya bırak</b>
      <p>veya tıkla · .bin / .hex / .ori / .rom · maks 12 MB</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    drop._bound = false;
    rebindDrop();
    $('#step2').classList.add('hidden');
    $('#step3').classList.add('hidden');
    const catalog = $('#ecuServicesCatalog');
    if (catalog) catalog.classList.remove('hidden');
    $('#step1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== KT200 BRIDGE =====
  function openDeviceSheet() { $('#ecuDevicePanel').classList.remove('hidden'); loadBridges(); }
  function closeDeviceSheet() { $('#ecuDevicePanel').classList.add('hidden'); }

  async function loadBridges(silent) {
    try {
      const res = await fetch('/api/ecu/device/bridges');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const bridges = data.bridges || [];
      const online = bridges.filter(b => b.online || (b.last_seen_at && Date.now() - new Date(b.last_seen_at).getTime() < 60000));
      const s = $('#ecuDeviceStatus');
      if (online.length) { s.textContent = `KT200 · ${online.length} bridge bağlı`; s.style.color = '#35df9a'; }
      else if (bridges.length) { s.textContent = `KT200 · ${bridges.length} kayıtlı · çevrimdışı`; s.style.color = '#ffbe55'; }
      else { s.textContent = 'KT200 bridge yok'; s.style.color = '#8ba4b7'; }

      const el = $('#ecuDeviceBridges');
      if (!bridges.length) { el.innerHTML = '<div class="muted">Henüz bridge yok.</div>'; return; }
      el.innerHTML = bridges.map(b => {
        const on = b.online || (b.last_seen_at && Date.now() - new Date(b.last_seen_at).getTime() < 60000);
        return `<div class="item"><b>${esc(b.name || b.id || 'bridge')}</b><small>${on ? '● çevrimiçi' : '○ çevrimdışı'} · ${esc(b.last_seen_at || 'hiç bağlanmadı')}</small></div>`;
      }).join('');
    } catch (err) {
      if (!silent) toast('Bridge: ' + err.message);
      const s = $('#ecuDeviceStatus');
      if (s) { s.textContent = 'KT200 · bağlantı yok'; s.style.color = '#8ba4b7'; }
    }
  }

  async function newBridgeToken() {
    try {
      const res = await fetch('/api/ecu/device/bridges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'KT200-' + Date.now().toString(36) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
      const token = data.token || data.bridgeToken || data.secret || '(token yok)';
      const box = $('#ecuDeviceTokenBox');
      box.classList.remove('hidden');
      box.innerHTML = `<b style="color:#9df0c5;display:block;margin-bottom:6px">Token (sadece bir kez):</b><div style="user-select:all">${esc(token)}</div>`;
      loadBridges();
    } catch (err) { toast('Token: ' + err.message); }
  }

  // ===== RULEPACK + REPO LISTS (settings page) =====
  async function loadRulepackList() {
    const el = $('#rulepackList');
    if (!el) return;
    try {
      const res = await fetch('/api/ecu/rulepacks');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'FAILED');
      el.innerHTML = data.packs.map(p => `
        <div class="rulepackItem">
          <b>${esc(p.familyName)}</b>
          <small>${esc(p.description)}</small>
          <div class="meta">${p.sourceCount} kaynak · ${p.firmwareCount} firmware · ${p.mapCount} harita</div>
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = '<div class="muted">Rulepack listesi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  async function loadEcuRepoList() {
    const el = $('#ecuRepoList');
    if (!el) return;
    try {
      const res = await fetch('/api/ecu/related-repos');
      const data = await res.json();
      const accepted = data.accepted || [];
      el.innerHTML = `
        <div class="rulepackItem" style="border-color:#35df9a44">
          <b>✓ Accepted (${accepted.length})</b>
          <div style="margin-top:8px;display:grid;gap:6px">
            ${accepted.slice(0, 30).map(r => `
              <div style="padding:8px;background:#060a15;border:1px solid #203653;border-radius:8px">
                <a href="https://github.com/${esc(r.repo)}" target="_blank" rel="noopener" style="color:#9fe3ff;font-weight:700;font-size:12px">${esc(r.repo)}</a>
                <small style="display:block;color:#9fb6c9;margin-top:3px;font-size:11px">${esc(r.purpose || '')}</small>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      el.innerHTML = '<div class="muted">Repo listesi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) settingsBtn.addEventListener('click', () => setTimeout(() => { loadRulepackList(); loadEcuRepoList(); }, 300));

  // Dosya hafızası accordion açılınca yükle
  const fmAccordion = document.getElementById('fileMemoryAccordion');
  if (fmAccordion) fmAccordion.addEventListener('toggle', () => { if (fmAccordion.open) loadFileHistory(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
