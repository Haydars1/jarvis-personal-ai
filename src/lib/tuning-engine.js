// ECU Tuning Engine v2 — strings-based bölge tespiti + action önerileri
// Gerçek adres haritası yok, ama dosyada EGR/DPF/AdBlue/Boost/... stringlerini bulup
// her birini bir action'a bağlar (bayrak byte'ını sıfırla, limit'i aç, vb.)

const te = new TextEncoder();
const td = new TextDecoder('utf-8', { fatal: false });

// ---------- Yardımcılar ----------
function hexByte(b) { return b.toString(16).padStart(2, '0').toUpperCase(); }
function hexAddr(n) { return '0x' + n.toString(16).toUpperCase().padStart(6, '0'); }
function hexDump(bytes) { return Array.from(bytes).map(hexByte).join(' '); }

// Chunked base64 — büyük Uint8Array için güvenli
export function uint8ToBase64(bytes) {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(bin);
}
export function base64ToUint8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map(hexByte).join('').toLowerCase();
}

// ---------- Format tespiti ----------
export function detectFileFormat(bytes) {
  // Intel HEX: ':' ile başlar + ASCII
  if (bytes.length > 4 && bytes[0] === 0x3A) {
    let ascii = true;
    for (let i = 0; i < Math.min(bytes.length, 200); i++) {
      const b = bytes[i];
      if (!(b === 0x3A || b === 0x0A || b === 0x0D || (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66))) {
        ascii = false; break;
      }
    }
    if (ascii) return { format: 'ihex', size: bytes.length };
  }
  // S-record
  if (bytes.length > 4 && bytes[0] === 0x53 && bytes[1] >= 0x30 && bytes[1] <= 0x39) {
    return { format: 'srec', size: bytes.length };
  }
  // Motorola PowerPC / Infineon TriCore signature guess (yardımcı)
  return { format: 'bin', size: bytes.length };
}

// ---------- İstatistik ----------
export function fileStats(bytes) {
  if (!bytes.length) return { zeroPct: 0, ffPct: 0, entropy: 0 };
  let zeros = 0, ffs = 0;
  const freq = new Uint32Array(256);
  for (const b of bytes) {
    freq[b]++;
    if (b === 0) zeros++;
    if (b === 255) ffs++;
  }
  let entropy = 0;
  for (const n of freq) {
    if (!n) continue;
    const p = n / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return {
    size: bytes.length,
    zeroPct: +(zeros * 100 / bytes.length).toFixed(2),
    ffPct: +(ffs * 100 / bytes.length).toFixed(2),
    entropy: +entropy.toFixed(3)
  };
}

// ---------- String çıkarma ----------
function extractStrings(bytes, minLen = 4, maxLen = 80) {
  const results = [];
  let current = '';
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const printable = (b >= 0x20 && b <= 0x7E);
    if (printable) {
      if (!current) start = i;
      current += String.fromCharCode(b);
      if (current.length >= maxLen) {
        results.push({ offset: start, text: current });
        current = '';
      }
    } else {
      if (current.length >= minLen) results.push({ offset: start, text: current });
      current = '';
    }
  }
  if (current.length >= minLen) results.push({ offset: start, text: current });
  return results;
}

// ---------- Sistem anahtar sözlüğü (strings → sistem) ----------
const SYSTEMS = [
  { re: /\bEGR\b|AGR|Abgasrück/i,                system: 'EGR',          desc: 'Egzoz gazı resirkülasyonu' },
  { re: /\bDPF\b|\bFAP\b|PartikelFilter|Rußfilter/i, system: 'DPF',          desc: 'Dizel partikül filtre' },
  { re: /AdBlue|SCR|DEF\b|Urea|Harnstoff|NOx/i,  system: 'AdBlue/SCR',   desc: 'AdBlue / NOx redüksiyon' },
  { re: /Lambda|\bO2S?\b|LSU/i,                   system: 'Lambda',       desc: 'Oksijen sensörü' },
  { re: /Boost|LDR|Ladedruck|P2Soll/i,            system: 'Boost',        desc: 'Boost basınç kontrolü' },
  { re: /Torque|Torq|M_Soll|Drehmoment/i,         system: 'Torque',       desc: 'Tork sınırlama' },
  { re: /Injection|Inj_Q|QNFLM|Einspritz/i,       system: 'Injection',    desc: 'Yakıt enjeksiyonu' },
  { re: /\bMAF\b|HFM|\bMAP\b|LMM/i,               system: 'MAF/MAP',      desc: 'Hava akış sensörü' },
  { re: /Vmax|Vfzg|SpeedLim|Geschwind/i,          system: 'Hız sınırı',   desc: 'Araç hız sınırlayıcı' },
  { re: /Nmax|Nmot|RpmLim|Drehzahl/i,             system: 'RPM sınırı',   desc: 'Devir sınırlayıcı' },
  { re: /Pedal|PWG|TPS\b|FGR/i,                   system: 'Pedal',        desc: 'Gaz pedalı karakteristiği' },
  { re: /ColdStart|Kaltst|KSTT|HRMK/i,            system: 'Soğuk marş',   desc: 'Soğuk marş zenginleştirme' },
  { re: /Knock|Klopf|\bKR\b|KFKHFM/i,             system: 'Vuruntu',      desc: 'Vuruntu sensörü' },
  { re: /Immo|Wegfahr|IMMOBILIZER/i,              system: 'Immobilizer',  desc: 'Immobilizer / anahtar' },
  { re: /Checksum|Prüfsumme|Chksum|CRC/i,         system: 'Checksum',     desc: 'Dosya bütünlük kontrolü' }
];

// Her sistem için yapılabilecek "disable" / "modify" aksiyon tarifi
function buildActions(system, offset, bytes) {
  const read = (ofs, n = 1) => Array.from(bytes.subarray(ofs, ofs + n));
  const safe = ofs => ofs >= 0 && ofs + 1 < bytes.length;

  // String'in hemen sonrası — tipik olarak konfig flag'leri burada
  const flagOffset = offset + 16; // 16 byte sonra heuristik
  const limitOffset = offset + 8;

  const list = [];

  switch (system) {
    case 'EGR':
      if (safe(flagOffset)) list.push({
        id: 'egr_off_' + offset.toString(16),
        label: 'EGR Devre Dışı',
        detail: `${hexAddr(flagOffset)} konumundaki aktivasyon bayrağını 0'a çek. Mevcut: 0x${hexByte(bytes[flagOffset])} → yeni: 0x00`,
        offset: flagOffset,
        currentByte: bytes[flagOffset],
        newByte: 0,
        risk: 'low'
      });
      break;

    case 'DPF':
      if (safe(flagOffset)) list.push({
        id: 'dpf_regen_off_' + offset.toString(16),
        label: 'DPF Rejenerasyon Kapat',
        detail: `${hexAddr(flagOffset)} konumundaki trigger byte'ını sıfırla. Mevcut: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        offset: flagOffset,
        currentByte: bytes[flagOffset],
        newByte: 0,
        risk: 'medium'
      });
      if (safe(limitOffset)) list.push({
        id: 'dpf_diff_press_max_' + offset.toString(16),
        label: 'DPF Diff. Basınç Limiti Yükselt',
        detail: `${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF (sensör uyarı eşiği devre dışı)`,
        offset: limitOffset,
        currentByte: bytes[limitOffset],
        newByte: 0xFF,
        risk: 'medium'
      });
      break;

    case 'AdBlue/SCR':
      if (safe(flagOffset)) list.push({
        id: 'adblue_off_' + offset.toString(16),
        label: 'AdBlue Sistem Bayrağı Kapat',
        detail: `${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        offset: flagOffset,
        currentByte: bytes[flagOffset],
        newByte: 0,
        risk: 'high'
      });
      break;

    case 'Hız sınırı':
      if (safe(limitOffset)) list.push({
        id: 'vmax_up_' + offset.toString(16),
        label: 'Hız Sınırı Kaldır',
        detail: `${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF (sınır etkisizleşir)`,
        offset: limitOffset,
        currentByte: bytes[limitOffset],
        newByte: 0xFF,
        risk: 'medium'
      });
      break;

    case 'RPM sınırı':
      if (safe(limitOffset)) list.push({
        id: 'rpmlim_up_' + offset.toString(16),
        label: 'RPM Limiti Yükselt',
        detail: `${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF`,
        offset: limitOffset,
        currentByte: bytes[limitOffset],
        newByte: 0xFF,
        risk: 'high'
      });
      break;

    case 'Boost':
      if (safe(limitOffset)) {
        const curr = bytes[limitOffset];
        const target = Math.min(0xFF, curr + 0x18);
        list.push({
          id: 'stage1_boost_' + offset.toString(16),
          label: 'Stage 1 — Boost Soll +15%',
          detail: `${hexAddr(limitOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)}`,
          offset: limitOffset,
          currentByte: curr,
          newByte: target,
          risk: 'medium'
        });
      }
      break;

    case 'Torque':
      if (safe(limitOffset)) {
        const curr = bytes[limitOffset];
        const target = Math.min(0xFF, curr + 0x20);
        list.push({
          id: 'torque_up_' + offset.toString(16),
          label: 'Tork Limiti +25%',
          detail: `${hexAddr(limitOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)}`,
          offset: limitOffset,
          currentByte: curr,
          newByte: target,
          risk: 'high'
        });
      }
      break;
  }

  return list;
}

// ---------- Ana tarama ----------
export async function scanRegions(bytes) {
  const strings = extractStrings(bytes, 4, 48);
  const regions = [];
  const perSystem = new Map();

  // 1) Önce rulepack araması — biliniyor mu bu dosya?
  let rulepackMatches = [];
  let knownActions = [];
  try {
    const { identifyRulepacks, rulepackActions } = await import('./ecu-rulepacks.js');
    rulepackMatches = identifyRulepacks(bytes, strings);
    knownActions = rulepackActions(rulepackMatches);
  } catch (err) {
    // Rulepack yüklenemezse sorun değil, scanner devam eder
  }

  // Rulepack aksiyonlarını region'lara dönüştür (eşleşen her firmware için)
  for (const action of knownActions) {
    const ofs = action.offset;
    const windowStart = Math.max(0, ofs - 8);
    const windowEnd = Math.min(bytes.length, ofs + 24);
    const windowBytes = bytes.subarray(windowStart, windowEnd);
    const currentByte = bytes[ofs];

    regions.push({
      id: 'rp_' + action.id,
      system: action.system,
      desc: '✓ Doğrulanmış kaynak (rulepack)',
      foundString: action.label,
      offset: ofs,
      offsetHex: hexAddr(ofs),
      windowHex: hexDump(windowBytes),
      windowStart,
      source: action.source,
      sourceUrl: action.sourceUrl,
      actions: [{
        id: action.id,
        label: action.label,
        detail: action.detail,
        offset: ofs,
        currentByte,
        newByte: action.newByte,
        risk: action.risk,
        confidence: 'high',
        source: action.source,
        sourceUrl: action.sourceUrl
      }]
    });
  }

  // 2) Scanner heuristiği — string tabanlı
  for (const s of strings) {
    for (const sys of SYSTEMS) {
      if (!sys.re.test(s.text)) continue;

      const key = sys.system + ':' + s.offset;
      if (perSystem.has(key)) continue;

      // En fazla sistem başına 4 hit
      const sysHits = [...perSystem.values()].filter(r => r.system === sys.system).length;
      if (sysHits >= 4) continue;

      const windowStart = Math.max(0, s.offset - 8);
      const windowEnd = Math.min(bytes.length, s.offset + s.text.length + 24);
      const windowBytes = bytes.subarray(windowStart, windowEnd);

      const heuristicActions = buildActions(sys.system, s.offset, bytes).map(a => ({
        ...a,
        confidence: 'low',
        source: 'scanner-heuristic',
        sourceUrl: null
      }));

      const region = {
        id: sys.system.toLowerCase().replace(/[^a-z]/g, '_') + '_' + s.offset.toString(16),
        system: sys.system,
        desc: sys.desc + ' (heuristik)',
        foundString: s.text,
        offset: s.offset,
        offsetHex: hexAddr(s.offset),
        windowHex: hexDump(windowBytes),
        windowStart,
        source: 'scanner-heuristic',
        actions: heuristicActions
      };
      perSystem.set(key, region);
      regions.push(region);
    }
  }

  regions.sort((a, b) => a.offset - b.offset);

  // Metadata eklentisi
  regions._rulepackMatches = rulepackMatches;
  return regions;
}

// ---------- Dosya özetini LLM'e göndermeye hazırla ----------
export function summarizeForAI(bytes, regions, limit = 6000) {
  const stats = fileStats(bytes);
  const topRegions = regions.slice(0, 40).map(r => ({
    system: r.system,
    offset: r.offsetHex,
    string: r.foundString.slice(0, 40),
    bytes: r.windowHex.slice(0, 80)
  }));
  return {
    sizeBytes: stats.size,
    entropy: stats.entropy,
    zeroPct: stats.zeroPct,
    ffPct: stats.ffPct,
    regionCount: regions.length,
    systems: [...new Set(regions.map(r => r.system))],
    regions: topRegions
  };
}

// ---------- Uygulama ----------
export async function applyActions(originalBytes, selectedActions) {
  const tuned = new Uint8Array(originalBytes);
  const applied = [];

  for (const a of selectedActions) {
    if (a.offset == null || a.offset < 0 || a.offset >= tuned.length) continue;
    const before = tuned[a.offset];
    tuned[a.offset] = a.newByte & 0xFF;
    applied.push({
      id: a.id,
      label: a.label,
      offset: a.offset,
      offsetHex: hexAddr(a.offset),
      before,
      after: tuned[a.offset]
    });
  }

  return {
    tuned,
    applied,
    hash: await sha256Hex(tuned),
    size: tuned.length
  };
}

// Legacy exports (eski kod kırılmasın diye no-op)
export function identifyVehicle() { return []; }
export function generateProposals() { return []; }
export async function applyTuning(bytes) { return { tuned: new Uint8Array(bytes), appliedPatches: [], hash: await sha256Hex(bytes), size: bytes.length }; }
export function validateTunedFile(a, b) { return a.length === b.length ? { valid: true } : { valid: false, error: 'SIZE_MISMATCH' }; }
