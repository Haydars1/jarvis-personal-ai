// ECU Tuning Engine v2 — strings-based bölge tespiti + action önerileri
// Gerçek adres haritası yok, ama dosyada EGR/DPF/AdBlue/Boost/... stringlerini bulup
// her birini bir action'a bağlar (bayrak byte'ını sıfırla, limit'i aç, vb.)
//
// Checksum correction: After applying actions, Bosch MED17/EDC17 checksums
// (ADD32/ADD16) are recalculated and corrected automatically.
import { fixChecksums, findBoschBlocks, validateAllChecksums } from './ecu-checksum.js';

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
function extractStrings(bytes, minLen = 3, maxLen = 80) {
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

// ---------- DPF akıllı tarama yardımcıları ----------

// Bir byte pozisyonunun ASCII string içinde olup olmadığını kontrol et
function isInsideAscii(bytes, pos, runLen) {
  runLen = runLen || 3;
  let count = 0;
  // Geriye bak
  for (let i = pos; i >= Math.max(0, pos - runLen); i--) {
    if (bytes[i] >= 0x20 && bytes[i] <= 0x7E) count++;
    else break;
  }
  if (count >= runLen) return true;
  // İleriye bak
  count = 0;
  for (let i = pos; i < Math.min(bytes.length, pos + runLen); i++) {
    if (bytes[i] >= 0x20 && bytes[i] <= 0x7E) count++;
    else break;
  }
  return count >= runLen;
}

// DPF kontrol byte'larını akıllı şekilde bul — blind offset+16 yerine
function findDpfControl(bytes, keywordOffset, keywordLen, dpfConfig) {
  const radius = dpfConfig?.searchRadius || 512;
  const start = Math.max(0, keywordOffset - radius);
  const end = Math.min(bytes.length, keywordOffset + (keywordLen || 4) + radius);
  const scoring = dpfConfig?.controlHeuristics?.regenSwitch?.scoring || {
    wordAligned: 10, valueIsOne: 25, nearbySmallScalars: 15,
    closeToKeyword: 0.2, notInAscii: 50
  };

  // --- Regen switch aday taraması ---
  let bestSwitchScore = -1;
  let bestSwitchOfs = -1;

  for (let i = start; i < end; i++) {
    const v = bytes[i];
    if (v !== 0x00 && v !== 0x01) continue;          // switch sadece 0 veya 1
    if (isInsideAscii(bytes, i, 3)) continue;          // ASCII string içinde değil

    let score = scoring.notInAscii;                    // base: ASCII değil
    if (i % 2 === 0) score += scoring.wordAligned;     // word-aligned bonus
    if (v === 0x01) score += scoring.valueIsOne;        // 0x01 = enabled, daha olası

    // Yakın çevrede küçük skaler değerler (kalibrasyon bölgesi göstergesi)
    if (i >= 2 && i < bytes.length - 2) {
      const neighbors = [bytes[i - 2], bytes[i - 1], bytes[i + 1], bytes[i + 2]];
      const smallCount = neighbors.filter(b => b <= 0x10).length;
      if (smallCount >= 2) score += scoring.nearbySmallScalars;
    }

    // Keyword'e yakınlık bonusu
    const dist = Math.abs(i - keywordOffset);
    score -= dist * scoring.closeToKeyword;

    // Dword-aligned ekstra bonus (kalibrasyon skaler değerleri genellikle 4-byte hizalı)
    if (i % 4 === 0) score += 5;

    if (score > bestSwitchScore) {
      bestSwitchScore = score;
      bestSwitchOfs = i;
    }
  }

  // --- Diferansiyel basınç eşiği aday taraması ---
  const pressRange = dpfConfig?.controlHeuristics?.diffPressure?.plausibleRange || [30, 3000];
  let bestPressScore = -1;
  let bestPressOfs = -1;

  for (let i = start; i < end - 1; i += 2) {
    if (isInsideAscii(bytes, i, 3)) continue;
    const val16 = bytes[i] | (bytes[i + 1] << 8);     // little-endian
    if (val16 < pressRange[0] || val16 > pressRange[1]) continue;

    let score = 50;
    const dist = Math.abs(i - keywordOffset);
    score -= dist * 0.15;
    if (i % 4 === 0) score += 10;                     // dword-aligned bonus

    if (score > bestPressScore) {
      bestPressScore = score;
      bestPressOfs = i;
    }
  }

  return {
    regenSwitch: bestSwitchOfs >= 0 ? {
      offset: bestSwitchOfs,
      score: bestSwitchScore,
      confidence: bestSwitchScore > 70 ? 'medium' : 'low',
      method: 'kontekst-analiz'
    } : null,
    pressureLimit: bestPressOfs >= 0 ? {
      offset: bestPressOfs,
      score: bestPressScore,
      confidence: 'low',
      method: 'kontekst-analiz'
    } : null
  };
}

// Genel switch-byte tarayıcı — EGR, AdBlue, vb. için findDpfControl ile aynı mantık
function findSwitchControl(bytes, keywordOffset, keywordLen, detectionConfig) {
  const radius = detectionConfig?.searchRadius || 512;
  const start = Math.max(0, keywordOffset - radius);
  const end = Math.min(bytes.length, keywordOffset + (keywordLen || 4) + radius);

  // İlk heuristic key'i bul
  const heuristics = detectionConfig?.controlHeuristics || {};
  const hKey = Object.keys(heuristics)[0];
  const scoring = hKey ? (heuristics[hKey].scoring || {}) : {};
  const sw = {
    wordAligned: scoring.wordAligned || 10,
    valueIsOne: scoring.valueIsOne || 25,
    nearbySmallScalars: scoring.nearbySmallScalars || 15,
    closeToKeyword: scoring.closeToKeyword || 0.2,
    notInAscii: scoring.notInAscii || 50,
  };

  let bestScore = -1;
  let bestOfs = -1;
  for (let i = start; i < end; i++) {
    const v = bytes[i];
    if (v !== 0x00 && v !== 0x01) continue;
    if (isInsideAscii(bytes, i, 3)) continue;
    let score = sw.notInAscii;
    if (i % 2 === 0) score += sw.wordAligned;
    if (v === 0x01) score += sw.valueIsOne;
    if (i >= 2 && i < bytes.length - 2) {
      const neighbors = [bytes[i - 2], bytes[i - 1], bytes[i + 1], bytes[i + 2]];
      const smallCount = neighbors.filter(b => b <= 0x10).length;
      if (smallCount >= 2) score += sw.nearbySmallScalars;
    }
    const dist = Math.abs(i - keywordOffset);
    score -= dist * sw.closeToKeyword;
    if (i % 4 === 0) score += 5;
    if (score > bestScore) { bestScore = score; bestOfs = i; }
  }

  return bestOfs >= 0 ? {
    offset: bestOfs, score: bestScore,
    confidence: bestScore > 70 ? 'medium' : 'low',
    method: 'kontekst-analiz'
  } : null;
}

// DAMOS etiketlerini tüm binary'de tara — yüksek güvenilirlikli tespit
function scanDamosLabels(bytes, damosLabels) {
  if (!damosLabels?.length) return [];
  const results = [];

  for (const damos of damosLabels) {
    const pat = te.encode(damos.id);
    for (let i = 0; i <= bytes.length - pat.length; i++) {
      let match = true;
      for (let j = 0; j < pat.length; j++) {
        if (bytes[i + j] !== pat[j]) { match = false; break; }
      }
      if (!match) continue;

      // DAMOS etiketi bulundu — etiket konumu
      results.push({
        type: damos.type,
        labelOffset: i,
        label: damos.id,
        desc: damos.desc,
        size: damos.size,
        offValue: damos.offValue,
        risk: damos.risk || 'medium',
        confidence: 'high',
        source: 'damos-label'
      });
      break; // Her etiket bir kez yeter
    }
  }
  return results;
}

// ---------- Sistem anahtar sözlüğü (strings → sistem) ----------
// Her sistem: regex, isim, kısa açıklama, detaylı açıklama, kapatınca ne olur, stage1 bilgisi, tahmini HP
const SYSTEMS = [
  { re: /EGR|AGR|Abgasrück|AGR_?[Vv]|EGR_?[Vv]|ExhGas|EGR_?Rate/i, system: 'EGR', icon: '🔄', desc: 'Egzoz gazı resirkülasyonu',
    explain: 'Egzoz gazının bir kısmını tekrar emişe gönderir. NOx emisyonunu azaltır ama zamanla karbonlaşma yapar.',
    offExplain: 'EGR kapatılınca: Egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır. Performans: +5-15 HP. Karbon birikimi durur.',
    stage1: true, hpGain: '5-15' },
  { re: /DPF|FAP|PartikelFilter|Rußfilter|Soot|Regen[_\s]|DPF_?[TtRr]|RussMen|DiffPres|PartFilter/i, system: 'DPF', icon: '🔥', desc: 'Dizel partikül filtre',
    explain: 'Egzozdaki kurum/partikül parçacıklarını tutar. Dolu olunca rejenerasyon (yakma) döngüsüne girer.',
    offExplain: 'DPF kapatılınca: Rejenerasyon döngüsü durur → yakıt tasarrufu (rejenerasyon sırasında fazladan yakıt harcanır). Contra basınç düşer → +10-20 HP. DPF fiziksel olarak da çıkarılmalı.',
    stage1: true, hpGain: '10-20' },
  { re: /AdBlue|SCR|DEF\b|Urea|Harnstoff|NOx|SCR_?[Cc]|DeNOx|BlueTec/i, system: 'AdBlue/SCR', icon: '💧', desc: 'AdBlue / NOx redüksiyon',
    explain: 'Egzoz gazına üre (AdBlue) püskürterek NOx gazını azaltır. Tank ve enjektör sistemi var.',
    offExplain: 'AdBlue kapatılınca: AdBlue tankı ve enjektör sistemi devre dışı olur. "AdBlue seviyesi düşük" uyarıları kaybolur. Motor güç kısıtlaması (limp mode) riski ortadan kalkar.',
    stage1: false, hpGain: '0-5' },
  { re: /Lambda|O2S|LSU|Sonde|KatDiag|O2_?[Ss]|HEGO|Breitband|Vorkat|Nachkat/i, system: 'Lambda', icon: '📊', desc: 'Oksijen sensörü',
    explain: 'Egzozdaki oksijen seviyesini ölçer. ECU buna göre yakıt/hava oranını ayarlar.',
    offExplain: 'Lambda kapatılınca: O2 sensör değerleri ECU tarafından ignore edilir. DPF/EGR off yapıldıktan sonra P0420/P0430 gibi hata kodlarını önler.',
    stage1: false, hpGain: '0' },
  { re: /Boost|LDR|Ladedruck|P2Soll|Turbo[_\s]|VTG|Wastegate|LDR_?[SsIi]|LadeDr|Ladetab/i, system: 'Boost', icon: '⚡', desc: 'Boost basınç kontrolü',
    explain: 'Turbo basınç limitleri. Stage 1 tuningde bu değer yükseltilir → daha fazla hava → daha fazla güç.',
    offExplain: 'Boost yükseltilince: Turbo basıncı artar → silindire daha fazla hava girer → daha fazla yakıt yanar → güç artar. Stage 1: +15-25% boost artışı tipik.',
    stage1: true, hpGain: '20-40' },
  { re: /Torque|Torq|M_Soll|Drehmoment|Moment[_\s]|MomentLim|Mmnt|MomFahr|MomBeg/i, system: 'Torque', icon: '💪', desc: 'Tork sınırlama',
    explain: 'ECU yazılımında tork limitleri var. Şanzıman ve drivetraini korumak için sınırlanır.',
    offExplain: 'Tork limiti yükseltilince: Motor daha fazla tork üretebilir. Stage 1 ile birlikte boost artışını destekler. Dikkat: Şanzıman kapasitesi kontrol edilmeli.',
    stage1: true, hpGain: '15-30' },
  { re: /Injection|Inj_Q|QNFLM|Einspritz|RailDr|InjVol|InjCrv|MengSoll|Einsp_Men|QSoll/i, system: 'Injection', icon: '💉', desc: 'Yakıt enjeksiyonu',
    explain: 'Enjektörlerin ne kadar yakıt püskürtüğünü kontrol eder. Enjeksiyon miktarı ve zamanlaması.',
    offExplain: 'Enjeksiyon artırılınca: Daha fazla yakıt → daha fazla güç. Boost artışıyla birlikte uygulanmalı. Stage 1 için enjeksiyon miktarı %10-20 artırılır.',
    stage1: true, hpGain: '10-25' },
  { re: /MAF|HFM|MAP|LMM|Luftmasse|AirMass|Saugrohr|LuftMeng|AirFlow/i, system: 'MAF/MAP', icon: '🌬️', desc: 'Hava akış sensörü',
    explain: 'Emişe giren hava miktarını ölçer. ECU buna göre yakıt dozunu ayarlar.',
    offExplain: 'MAF/MAP limitleri yükseltilince: Hava akış sensörünün ölçüm aralığı genişler. Büyük turbo veya intake upgrade sonrası gerekli olabilir.',
    stage1: false, hpGain: '0-5' },
  { re: /Vmax|Vfzg|SpeedLim|Geschwind|VehSpdLim|FzgMax/i, system: 'Hız sınırı', icon: '🏎️', desc: 'Araç hız sınırlayıcı',
    explain: 'Aracın maksimum hızını sınırlar. Genelde 250 km/h limiter (Alman araçlar).',
    offExplain: 'Hız sınırı kaldırılınca: Araç mekanik/aerodinamik limitine kadar hızlanabilir. Lastik ve fren kapasitesi kontrol edilmeli.',
    stage1: false, hpGain: '0' },
  { re: /Nmax|Nmot|RpmLim|Drehzahl|EngSpdLim|NmotMax/i, system: 'RPM sınırı', icon: '🔴', desc: 'Devir sınırlayıcı',
    explain: 'Motorun maksimum devrini sınırlar. Silindir kafası ve valf sistemini korur.',
    offExplain: 'RPM limiti yükseltilince: Motor daha yüksek devire çıkabilir. Dikkat: Mekanik limitler var — düzensiz RPM artışı motor hasarına neden olabilir.',
    stage1: false, hpGain: '0-5' },
  { re: /Pedal|PWG|TPS|FGR|GasPedal|AccPedal|FahrPed/i, system: 'Pedal', icon: '🦶', desc: 'Gaz pedalı karakteristiği',
    explain: 'Gaz pedalına basma yüzdesi ile kelebek açıklığı arasındaki haritayı kontrol eder.',
    offExplain: 'Pedal haritası değiştirilince: Gaz pedalı yanıtı daha agresif olur → pedalın ilk %30\'unda daha hızlı tepki. Gerçek güç artışı yok, ama sübjektif hız hissi artar.',
    stage1: false, hpGain: '0' },
  { re: /ColdStart|Kaltst|KSTT|HRMK/i, system: 'Soğuk marş', icon: '❄️', desc: 'Soğuk marş zenginleştirme',
    explain: 'Soğuk çalıştırmada fazladan yakıt verir. Isınana kadar devri biraz yüksek tutar.',
    offExplain: 'Soğuk marş zenginleştirme azaltılınca: Motor daha hızlı normal devire iner. Emisyon testi için dikkat — soğukta katalitik konvertör daha geç ısınır.',
    stage1: false, hpGain: '0' },
  { re: /Knock|Klopf|\bKR\b|KFKHFM|KnkDet|AntiKnock|KFZW/i, system: 'Vuruntu', icon: '🔨', desc: 'Vuruntu sensörü',
    explain: 'Motor vuruntusunu (knock) algılar ve ateşleme zamanlamasını geri çeker. Motoru korur.',
    offExplain: 'Vuruntu sensörü devre dışı bırakılınca: ECU vuruntu algılamaz → ateşleme ilerletilir. DİKKAT: Yanlış yapılırsa motor hasarı riski var. Sadece yüksek oktan yakıtla.',
    stage1: false, hpGain: '3-8' },
  { re: /Immo|Wegfahr|IMMOBILIZER/i, system: 'Immobilizer', icon: '🔑', desc: 'Immobilizer / anahtar',
    explain: 'Aracın çalınmasını önleyen elektronik kilit sistemi. Doğru anahtar olmadan çalışmaz.',
    offExplain: 'Immobilizer kapatılınca: Anahtar eşleşme kontrolü devre dışı olur. Motor herhangi bir anahtarla çalışır. Yedek ECU veya swap durumlarında kullanılır.',
    stage1: false, hpGain: '0' },
  { re: /Checksum|Prüfsumme|Chksum|CRC|CSM_|ChkS/i, system: 'Checksum', icon: '✅', desc: 'Dosya bütünlük kontrolü',
    explain: 'ECU dosyadaki değişiklikleri kontrol eder. Checksum hatalıysa dosyayı reddeder.',
    offExplain: 'Checksum düzeltilmeli: Herhangi bir değişiklik yaptıktan sonra checksum tekrar hesaplanmalı, yoksa ECU dosyayı reddeder veya hata verir.',
    stage1: false, hpGain: '0' },
  { re: /DTC|Fehler|Fehlerspeicher|DiagCode|FaultMem|DFES|P0[0-9A-F]{3}|P1[0-9A-F]{3}|P2[0-9A-F]{3}/i, system: 'DTC', icon: '🚨', desc: 'Hata kodu yönetimi',
    explain: 'Araçtaki hata kodlarını (DTC) kaydeder. Motor lambası yanmasına neden olur.',
    offExplain: 'DTC silme: Belirli hata kodlarını ECU hafızasından siler veya tetiklenmesini engeller. EGR/DPF off sonrası ilgili DTC\'ler kapatılmalı.',
    stage1: false, hpGain: '0' },
  { re: /Overrun|Überlauf|SchubAb|PopBang|Pop.?Bang|Crackle|Burble|ALS|Anti.?Lag|OvrFuel|DecFuel|SA_Ovr|ZW_Ovr|ÜberlaufEinspritz|Schubabschaltung|BurstFuel|ExhFlame|OvRnFl/i, system: 'Pop&Bang', icon: '💥', desc: 'Pop & Bang / Crackle Map',
    explain: 'Gaz bırakıldığında (deceleration) egzozdan patlama/çıtırtı sesi üretir. Overrun sırasında yakıt enjeksiyonu ve ateşleme geciktirme ile çalışır.',
    offExplain: 'Pop&Bang aktifleştirilince: Gaz bırakıldığında ECU yakıt kesmeyi geciktirir ve ateşlemeyi geri çeker → yanmamış yakıt sıcak egzoza gider → patlama sesi. Spor egzoz ile en iyi sonuç.',
    stage1: false, hpGain: '0' }
];

// ---------- Araç veritabanı (yaygın markalar) ----------
export const VEHICLE_DB = {
  makes: [
    { id: 'vw', name: 'Volkswagen', models: ['Golf','Passat','Polo','Tiguan','T-Roc','Arteon','Caddy','Transporter','Amarok','Touareg'] },
    { id: 'bmw', name: 'BMW', models: ['1 Serisi','2 Serisi','3 Serisi','4 Serisi','5 Serisi','X1','X3','X5'] },
    { id: 'mercedes', name: 'Mercedes', models: ['A Serisi','C Serisi','E Serisi','S Serisi','GLA','GLC','GLE','Sprinter','Vito'] },
    { id: 'audi', name: 'Audi', models: ['A1','A3','A4','A5','A6','Q3','Q5','Q7'] },
    { id: 'seat', name: 'SEAT', models: ['Ibiza','Leon','Ateca','Arona','Tarraco'] },
    { id: 'skoda', name: 'Skoda', models: ['Fabia','Octavia','Superb','Karoq','Kodiaq'] },
    { id: 'opel', name: 'Opel', models: ['Astra','Corsa','Insignia','Mokka','Grandland'] },
    { id: 'ford', name: 'Ford', models: ['Focus','Fiesta','Kuga','Puma','Transit','Ranger'] },
    { id: 'renault', name: 'Renault', models: ['Clio','Megane','Kadjar','Captur','Master','Trafic'] },
    { id: 'peugeot', name: 'Peugeot', models: ['208','308','3008','508','Partner','Expert'] },
    { id: 'citroen', name: 'Citroen', models: ['C3','C4','C5 Aircross','Berlingo','Jumpy'] },
    { id: 'fiat', name: 'Fiat', models: ['500','Tipo','Panda','Ducato','Doblo'] },
    { id: 'hyundai', name: 'Hyundai', models: ['i20','i30','Tucson','Kona','Santa Fe'] },
    { id: 'kia', name: 'Kia', models: ['Ceed','Sportage','Stonic','Sorento','Picanto'] },
    { id: 'toyota', name: 'Toyota', models: ['Corolla','Yaris','RAV4','C-HR','Hilux','Land Cruiser'] },
    { id: 'volvo', name: 'Volvo', models: ['XC40','XC60','XC90','V60','S60','V90'] },
    { id: 'dacia', name: 'Dacia', models: ['Sandero','Duster','Jogger','Spring'] },
    { id: 'nissan', name: 'Nissan', models: ['Qashqai','Juke','X-Trail','Navara'] },
    { id: 'mazda', name: 'Mazda', models: ['3','CX-3','CX-5','CX-30','MX-5'] },
    { id: 'other', name: 'Diğer', models: [] }
  ],
  ecuTypes: ['Bosch EDC17','Bosch MED17','Bosch ME7','Bosch EDC16','Bosch EDC15','Siemens SID','Siemens PCR','Continental SID','Delphi DCM','Denso','Marelli','Bilinmiyor'],
  years: Array.from({length:30}, (_,i) => String(2025-i))
};

// ---------- ECU-tip profilleri (benzinli vs dizel, beklenen sistemler) ----------
const ECU_PROFILES = {
  // Dizel ECU'lar
  'EDC17': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'EDC16': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'EDC15': { fuel: 'diesel', systems: ['EGR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum'] },
  'SID': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'PCR': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'DCM': { fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  // Benzinli ECU'lar
  'MED17': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  'MED9': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum'] },
  'ME7': { fuel: 'gasoline', systems: ['Lambda','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  'MEVD17': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  'SIMOS': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  'MG1': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'MD1': { fuel: 'diesel', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] },
  'MEVD': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  // Denso / Japon benzinli
  'DENSO': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] },
  'SH7058': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum'] },
  'SH7059': { fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum'] },
};

function detectEcuType(strings) {
  const allText = strings.map(s => s.text).join(' ');
  for (const [ecuType, profile] of Object.entries(ECU_PROFILES)) {
    const re = new RegExp(ecuType.replace(/\+/g, '\\+'), 'i');
    if (re.test(allText)) return { ecuType, ...profile };
  }
  // Yakıt tipi tahmini — string'lerde dizel veya benzinli ipuçları
  const dieselHints = /EDC|DPF|FAP|AdBlue|SCR|Diesel|TDI|CDI|HDI|dCi|CDTI|CRD|JTD|Rußfilter|Harnstoff|BlueTec|Einspritz|SID80[1237]|PCR2|DCM3|EA288|K9K|R9M/i;
  const gasolineHints = /MED|TFSI|TSI|FSI|GDI|Benzin|Ottomotor|Zündung|Klopf|Knock|VANOS|Valvetronic|VarioCam|DENSO|SH705[89]|EJ20|FA20|4U-GSE/i;
  if (dieselHints.test(allText)) return { ecuType: 'generic-diesel', fuel: 'diesel', systems: ['EGR','DPF','Lambda','Boost','Torque','Injection','MAF/MAP','Checksum','DTC'] };
  if (gasolineHints.test(allText)) return { ecuType: 'generic-gasoline', fuel: 'gasoline', systems: ['Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Pop&Bang','Checksum','DTC'] };
  // Bilinmeyen — en geniş küme
  return { ecuType: 'unknown', fuel: 'unknown', systems: ['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Vuruntu','Checksum','DTC'] };
}

// ---------- Stage 1 paket önerileri ----------
export function buildStage1Package(systems) {
  const found = new Set(systems);
  const pkg = { name: 'Stage 1 Performans Paketi', actions: [], totalHpGain: '', features: [] };
  if (found.has('Boost')) pkg.features.push({ system: 'Boost', text: 'Turbo basıncı %15-25 artır', hp: '20-40 HP' });
  if (found.has('Torque')) pkg.features.push({ system: 'Torque', text: 'Tork limitlerini yükselt', hp: '15-30 HP' });
  if (found.has('Injection')) pkg.features.push({ system: 'Injection', text: 'Enjeksiyon miktarını optimize et', hp: '10-25 HP' });
  if (found.has('EGR')) pkg.features.push({ system: 'EGR', text: 'EGR kapatarak emişi temizle', hp: '5-15 HP' });
  if (found.has('DPF')) pkg.features.push({ system: 'DPF', text: 'DPF rejenerasyon döngüsünü kapat', hp: '10-20 HP' });
  if (found.has('Hız sınırı')) pkg.features.push({ system: 'Hız sınırı', text: 'Hız limitini kaldır', hp: '' });
  const hpMin = pkg.features.reduce((s,f) => s + (parseInt(f.hp)||0), 0);
  const hpMax = pkg.features.reduce((s,f) => { const m = f.hp.match(/-(\d+)/); return s + (m ? parseInt(m[1]) : parseInt(f.hp)||0); }, 0);
  pkg.totalHpGain = hpMin && hpMax ? `+${hpMin} ile +${hpMax} HP arası` : '';
  return pkg;
}

// ---------- Sistem bilgisi export ----------
export function getSystemInfo(systemName) {
  const s = SYSTEMS.find(x => x.system === systemName);
  if (!s) return null;
  return { system: s.system, icon: s.icon, desc: s.desc, explain: s.explain, offExplain: s.offExplain, stage1: s.stage1, hpGain: s.hpGain };
}

// Her sistem için yapılabilecek "disable" / "modify" aksiyon tarifi
function buildActions(system, offset, bytes, dpfConfig, egrConfig, adblueConfig, popbangConfig) {
  const safe = ofs => ofs >= 0 && ofs + 1 < bytes.length;
  const flagOffset = offset + 16;
  const limitOffset = offset + 8;
  const list = [];
  const sysInfo = SYSTEMS.find(s => s.system === system);
  const icon = sysInfo?.icon || '⚙';

  switch (system) {
    case 'EGR': {
      // Akıllı EGR kontrol byte taraması — blind offset+16 yerine
      const egrCtrl = findSwitchControl(bytes, offset, 4, egrConfig);
      const egrOfs = egrCtrl ? egrCtrl.offset : flagOffset;
      if (safe(egrOfs)) list.push({
        id: 'egr_off_' + offset.toString(16),
        label: 'EGR Devre Dışı (OFF)',
        detail: `Adres ${hexAddr(egrOfs)}: 0x${hexByte(bytes[egrOfs])} → 0x00` + (egrCtrl ? ` [${egrCtrl.method}]` : ''),
        explain: 'EGR valfini kapatır. Egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır.',
        effect: 'Karbon birikimi durur, emme manifoldu temiz kalır',
        hpGain: '+5-15 HP',
        offset: egrOfs, currentByte: bytes[egrOfs], newByte: 0, risk: 'low',
        scanScore: egrCtrl?.score,
        scanConfidence: egrCtrl?.confidence
      });
      break;
    }

    case 'DPF': {
      // Akıllı DPF kontrol byte taraması — blind offset+16 yerine
      const dpfCtrl = findDpfControl(bytes, offset, 4, dpfConfig);

      if (dpfCtrl.regenSwitch && safe(dpfCtrl.regenSwitch.offset)) {
        const rs = dpfCtrl.regenSwitch;
        list.push({
          id: 'dpf_regen_off_' + rs.offset.toString(16),
          label: 'DPF Rejenerasyon Kapat (OFF)',
          detail: `Adres ${hexAddr(rs.offset)}: 0x${hexByte(bytes[rs.offset])} → 0x00 [${rs.method}]`,
          explain: 'DPF rejenerasyon döngüsünü devre dışı bırakır. Rejenerasyon sırasında harcanan ek yakıt ortadan kalkar.',
          effect: 'Yakıt tasarrufu, contra basınç düşer, DPF fiziksel olarak da çıkarılmalı',
          hpGain: '+10-20 HP',
          offset: rs.offset, currentByte: bytes[rs.offset], newByte: 0, risk: 'medium',
          scanScore: rs.score,
          scanConfidence: rs.confidence
        });
      }

      if (dpfCtrl.pressureLimit && safe(dpfCtrl.pressureLimit.offset)) {
        const dp = dpfCtrl.pressureLimit;
        list.push({
          id: 'dpf_diff_press_max_' + dp.offset.toString(16),
          label: 'DPF Diferansiyel Basınç Limiti Yükselt',
          detail: `Adres ${hexAddr(dp.offset)}: 0x${hexByte(bytes[dp.offset])} → 0xFF [${dp.method}]`,
          explain: 'DPF basınç farkı sensörünün uyarı eşiğini maksimuma çeker → DPF dolu uyarısı tetiklenmez.',
          effect: 'DPF uyarı lambası yanmaz, rejenerasyon talep edilmez',
          hpGain: '',
          offset: dp.offset, currentByte: bytes[dp.offset], newByte: 0xFF, risk: 'medium',
          scanScore: dp.score,
          scanConfidence: dp.confidence
        });
      }
      break;
    }

    case 'AdBlue/SCR': {
      // Akıllı AdBlue/SCR kontrol byte taraması — blind offset+16 yerine
      const scrCtrl = findSwitchControl(bytes, offset, 4, adblueConfig);
      const scrOfs = scrCtrl ? scrCtrl.offset : flagOffset;
      if (safe(scrOfs)) list.push({
        id: 'adblue_off_' + offset.toString(16),
        label: 'AdBlue Sistemi Kapat (OFF)',
        detail: `Adres ${hexAddr(scrOfs)}: 0x${hexByte(bytes[scrOfs])} → 0x00` + (scrCtrl ? ` [${scrCtrl.method}]` : ''),
        explain: 'SCR / AdBlue enjeksiyon sistemini tamamen devre dışı bırakır. Tank seviye uyarıları ve güç kısıtlaması (limp mode) ortadan kalkar.',
        effect: 'AdBlue tankı boşaltılabilir, limp mode riski yok, uyarı yok',
        hpGain: '0-5 HP',
        offset: scrOfs, currentByte: bytes[scrOfs], newByte: 0, risk: 'high',
        scanScore: scrCtrl?.score,
        scanConfidence: scrCtrl?.confidence
      });
      break;
    }

    case 'Lambda':
      if (safe(flagOffset)) list.push({
        id: 'lambda_off_' + offset.toString(16),
        label: 'Lambda Sensör Devre Dışı',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        explain: 'O2 sensör verilerini ECU hesaplamasından çıkarır. DPF/EGR off sonrası P0420/P0430 gibi hata kodlarını önler.',
        effect: 'Emisyon hata kodları tetiklenmez',
        hpGain: '',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'low'
      });
      break;

    case 'Hız sınırı':
      if (safe(limitOffset)) list.push({
        id: 'vmax_up_' + offset.toString(16),
        label: 'Hız Sınırını Kaldır (Vmax OFF)',
        detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF`,
        explain: 'Yazılımdaki elektronik hız sınırını kaldırır. Araç mekanik limitine kadar hızlanabilir.',
        effect: 'Elektronik hız kesme yok. Lastik ve fren kapasitesi kontrol edilmeli',
        hpGain: '',
        offset: limitOffset, currentByte: bytes[limitOffset], newByte: 0xFF, risk: 'medium'
      });
      break;

    case 'RPM sınırı':
      if (safe(limitOffset)) list.push({
        id: 'rpmlim_up_' + offset.toString(16),
        label: 'RPM Limiti Yükselt',
        detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF`,
        explain: 'Devir sınırlayıcıyı yükseltir. Dikkat: Mekanik limitler aşılmamalı.',
        effect: 'Motor daha yüksek devire çıkabilir',
        hpGain: '0-5 HP',
        offset: limitOffset, currentByte: bytes[limitOffset], newByte: 0xFF, risk: 'high'
      });
      break;

    case 'Boost':
      if (safe(limitOffset)) {
        const curr = bytes[limitOffset];
        const target = Math.min(0xFF, curr + 0x18);
        list.push({
          id: 'stage1_boost_' + offset.toString(16),
          label: 'Stage 1 — Boost Basınç +15-25%',
          detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)} (mevcut: ${curr}, hedef: ${target})`,
          explain: 'Turbo basınç soll değerini yükseltir. Daha fazla hava → daha fazla yakıt → daha fazla güç. Stage 1 tuningin temel adımı.',
          effect: 'Turbo basıncı artar, motor gücü yükselir',
          hpGain: '+20-40 HP',
          offset: limitOffset, currentByte: curr, newByte: target, risk: 'medium'
        });
      }
      break;

    case 'Torque':
      if (safe(limitOffset)) {
        const curr = bytes[limitOffset];
        const target = Math.min(0xFF, curr + 0x20);
        list.push({
          id: 'torque_up_' + offset.toString(16),
          label: 'Tork Limiti Yükselt +25%',
          detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)} (mevcut: ${curr}, hedef: ${target})`,
          explain: 'ECU tork sınırını yükseltir. Boost artışıyla birlikte uygulanmalı. Şanzıman kapasitesine dikkat.',
          effect: 'Daha yüksek tork çıkışı, daha güçlü kalkış ve orta kademe',
          hpGain: '+15-30 HP',
          offset: limitOffset, currentByte: curr, newByte: target, risk: 'high'
        });
      }
      break;

    case 'Injection':
      if (safe(limitOffset)) {
        const curr = bytes[limitOffset];
        const target = Math.min(0xFF, curr + 0x10);
        list.push({
          id: 'injection_up_' + offset.toString(16),
          label: 'Enjeksiyon Miktarı Artır +10-20%',
          detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)}`,
          explain: 'Yakıt enjeksiyon miktarını artırır. Boost artışıyla uyumlu olmalı — tek başına yapılmamalı.',
          effect: 'Daha fazla yakıt → boost artışını destekler',
          hpGain: '+10-25 HP',
          offset: limitOffset, currentByte: curr, newByte: target, risk: 'medium'
        });
      }
      break;

    case 'Pedal':
      if (safe(flagOffset)) list.push({
        id: 'pedal_map_' + offset.toString(16),
        label: 'Pedal Haritası Agresifleştir',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x${hexByte(Math.min(0xFF, bytes[flagOffset] + 0x30))}`,
        explain: 'Gaz pedalı yanıtını daha keskin yapar. İlk %30 pedalda daha fazla kelebek açıklığı.',
        effect: 'Daha canlı gaz tepkisi, sübjektif hız artışı',
        hpGain: '',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: Math.min(0xFF, bytes[flagOffset] + 0x30), risk: 'low'
      });
      break;

    case 'Immobilizer':
      if (safe(flagOffset)) list.push({
        id: 'immo_off_' + offset.toString(16),
        label: 'Immobilizer Kapat',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        explain: 'Anahtar eşleşme kontrolünü devre dışı bırakır. ECU swap veya yedek ECU durumlarında kullanılır.',
        effect: 'Anahtar eşleşme kontrolü yok, motor herhangi bir anahtarla çalışır',
        hpGain: '',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'high'
      });
      break;

    case 'DTC':
      if (safe(flagOffset)) list.push({
        id: 'dtc_clear_' + offset.toString(16),
        label: 'DTC Hata Kodları Sil / Engelle',
        detail: `Adres ${hexAddr(flagOffset)}: hata kodu bölgesi`,
        explain: 'Belirli hata kodlarını ECU hafızasından siler veya tetiklenmesini engeller. EGR/DPF off sonrası ilgili DTC\'ler kapatılmalı.',
        effect: 'Motor uyarı lambası yanmaz, ilgili hata kodları tetiklenmez',
        hpGain: '',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'medium'
      });
      break;

    case 'Pop&Bang': {
      // Overrun fuel injection — gaz bırakıldığında yakıt kesme gecikmesi
      const ovrFuelOffset = offset + 12;
      if (safe(ovrFuelOffset)) {
        const curr = bytes[ovrFuelOffset];
        // Overrun sırasında enjeksiyon süresini uzat (fuel cut-off delay)
        const target = Math.min(0xFF, curr + 0x40);
        list.push({
          id: 'popbang_overrun_fuel_' + offset.toString(16),
          label: 'Overrun Yakıt Enjeksiyonu Aktifleştir',
          detail: `Adres ${hexAddr(ovrFuelOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)} (overrun fuel cut-off delay)`,
          explain: 'Gaz bırakıldığında yakıt kesme süresini uzatır. Yanmamış yakıt sıcak egzoz manifolduna ulaşır ve patlar.',
          effect: 'Deceleration sırasında egzozdan patlama sesi, spor egzoz ile belirgin crackle',
          hpGain: '',
          offset: ovrFuelOffset, currentByte: curr, newByte: target, risk: 'medium'
        });
      }

      // Ignition retard — ateşleme geciktirme (overrun sırasında)
      const ignRetOffset = offset + 20;
      if (safe(ignRetOffset)) {
        const curr = bytes[ignRetOffset];
        // Ateşlemeyi geri çek → yanma geç olur → egzozda tamamlanır
        const target = Math.max(0x00, curr - 0x20);
        list.push({
          id: 'popbang_ign_retard_' + offset.toString(16),
          label: 'Overrun Ateşleme Geciktirme',
          detail: `Adres ${hexAddr(ignRetOffset)}: 0x${hexByte(curr)} → 0x${hexByte(target)} (ignition retard during overrun)`,
          explain: 'Gaz bırakıldığında ateşleme zamanlamasını geri çeker. Yanma geç olur ve egzozda tamamlanır → patlama/çıtırtı sesi.',
          effect: 'Daha belirgin pop ve crackle sesleri, özellikle yüksek devirden gaz bırakıldığında',
          hpGain: '',
          offset: ignRetOffset, currentByte: curr, newByte: target, risk: 'medium'
        });
      }

      // Overrun RPM eşiği — hangi devirden itibaren aktif
      const rpmThreshOffset = offset + 28;
      if (safe(rpmThreshOffset + 1)) {
        const currHi = bytes[rpmThreshOffset];
        const currLo = bytes[rpmThreshOffset + 1];
        const currRpm = (currHi << 8) | currLo;
        // Pop&Bang genelde 2000+ RPM'den aktif — eşiği düşür
        const targetRpm = Math.max(1500, Math.min(currRpm, 2500));
        const targetHi = (targetRpm >> 8) & 0xFF;
        const targetLo = targetRpm & 0xFF;
        list.push({
          id: 'popbang_rpm_thresh_' + offset.toString(16),
          label: 'Pop&Bang RPM Eşiği Ayarla',
          detail: `Adres ${hexAddr(rpmThreshOffset)}: ${currRpm} RPM → ${targetRpm} RPM (overrun activation threshold)`,
          explain: `Pop&Bang efektinin aktif olacağı minimum devir. Şu an ${currRpm} RPM, hedef ${targetRpm} RPM.`,
          effect: `${targetRpm} RPM üzerinde gaz bırakıldığında pop&bang aktif olur`,
          hpGain: '',
          offset: rpmThreshOffset, currentByte: currHi, newByte: targetHi, risk: 'low'
        });
      }
      break;
    }
  }

  return list;
}

// ---------- Ana tarama ----------
export async function scanRegions(bytes, definitions = null) {
  const strings = extractStrings(bytes, 3, 48);
  const regions = [];
  const perSystem = new Map();

  // Tier 0: Import edilmiş A2L/XDF tanımlarını binary ile eşleştir (en yüksek güven)
  if (definitions && definitions.length > 0) {
    try {
      const { matchDefinitions, definitionsToRegions } = await import('./ecu-definition-parser.js');
      const matched = matchDefinitions(bytes, definitions);
      if (matched.length) {
        const defRegions = definitionsToRegions(matched);
        regions.push(...defRegions);
      }
    } catch (_t0err) { /* Tier 0 hatası taramayı durdurmamalı */ }
  }

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

  // 1.5) DAMOS label taraması — yüksek güvenilirlik (DPF + EGR + AdBlue)
  let dpfConfig = null;
  let egrConfig = null;
  let adblueConfig = null;
  let popbangConfig = null;
  try {
    const { getDpfDetection, getEgrDetection, getAdblueDetection, getPopbangDetection } = await import('./ecu-rulepacks.js');
    dpfConfig = getDpfDetection(rulepackMatches);
    egrConfig = getEgrDetection(rulepackMatches);
    adblueConfig = getAdblueDetection(rulepackMatches);
    popbangConfig = getPopbangDetection(rulepackMatches);
  } catch (_e) { /* import hatasında devam */ }

  // Tüm DAMOS label setlerini birleştirerek tara
  const damosGroups = [
    { config: dpfConfig, system: 'DPF', prefix: 'DPF' },
    { config: egrConfig, system: 'EGR', prefix: 'EGR' },
    { config: adblueConfig, system: 'AdBlue/SCR', prefix: 'AdBlue' },
    { config: popbangConfig, system: 'Pop&Bang', prefix: 'Pop&Bang' },
  ];

  for (const { config: cfg, system: sysName, prefix } of damosGroups) {
    if (!cfg?.damosLabels?.length) continue;
    const damosHits = scanDamosLabels(bytes, cfg.damosLabels);
    for (const hit of damosHits) {
      const ofs = hit.labelOffset;
      const windowStart = Math.max(0, ofs - 8);
      const windowEnd = Math.min(bytes.length, ofs + hit.label.length + 24);
      const windowBytes = bytes.subarray(windowStart, windowEnd);

      regions.push({
        id: 'damos_' + hit.type + '_' + ofs.toString(16),
        system: sysName,
        desc: `DAMOS label: ${hit.label} — ${hit.desc}`,
        foundString: hit.label,
        offset: ofs,
        offsetHex: hexAddr(ofs),
        windowHex: hexDump(windowBytes),
        windowStart,
        source: 'damos-label',
        actions: [{
          id: 'damos_' + hit.type + '_' + ofs.toString(16),
          label: `${prefix} ${hit.desc} (DAMOS)`,
          detail: `DAMOS label ${hit.label} @ ${hexAddr(ofs)} — ${hit.size} byte → 0x${hit.offValue.toString(16).toUpperCase()}`,
          offset: ofs + hit.label.length + 1,
          currentByte: bytes[ofs + hit.label.length + 1],
          newByte: hit.offValue & 0xFF,
          risk: hit.risk,
          confidence: 'high',
          source: 'damos-label',
          scanConfidence: 'high'
        }]
      });
    }
  }

  // 1.5) DAMOS map label taraması — Bosch kalibrasyon harita isimleri
  const DAMOS_MAP_LABELS = [
    // DPF / Exhaust
    { re: /^KF_DPFPC/i, system: 'DPF', desc: 'DPF diferansiyel basınç haritası', mapAction: 'zero' },
    { re: /^KF_DPF/i, system: 'DPF', desc: 'DPF kontrol haritası', mapAction: 'zero' },
    { re: /^KF_EGAS/i, system: 'Pedal', desc: 'E-gaz pedalı haritası', mapAction: 'scale' },
    // EGR
    { re: /^KF_AGR/i, system: 'EGR', desc: 'EGR kontrol haritası', mapAction: 'zero' },
    { re: /^KF_EGRV/i, system: 'EGR', desc: 'EGR valf haritası', mapAction: 'zero' },
    // AdBlue / SCR
    { re: /^KF_SCR/i, system: 'AdBlue/SCR', desc: 'SCR dozaj haritası', mapAction: 'zero' },
    { re: /^KF_ADBLUE/i, system: 'AdBlue/SCR', desc: 'AdBlue enjeksiyon haritası', mapAction: 'zero' },
    // Torque / Power
    { re: /^KF_MDMXAS/i, system: 'Torque', desc: 'Maksimum tork sınır haritası', mapAction: 'scale' },
    { re: /^KF_MDSOL/i, system: 'Torque', desc: 'Hedef tork haritası', mapAction: 'scale' },
    { re: /^KF_MDRED/i, system: 'Torque', desc: 'Tork azaltma haritası', mapAction: 'zero' },
    // Boost
    { re: /^KF_LD/i, system: 'Boost', desc: 'Turbo basınç haritası', mapAction: 'scale' },
    { re: /^KFLDIMX/i, system: 'Boost', desc: 'Maksimum boost basınç haritası', mapAction: 'scale' },
    { re: /^KFLDRX/i, system: 'Boost', desc: 'Boost düzenleyici haritası', mapAction: 'scale' },
    // Injection
    { re: /^KF_EINSP/i, system: 'Injection', desc: 'Enjeksiyon zamanlama haritası', mapAction: 'scale' },
    { re: /^KF_MMEN/i, system: 'Injection', desc: 'Enjeksiyon miktar haritası', mapAction: 'scale' },
    // Vmax / Speed
    { re: /^KL_NMAX/i, system: 'RPM', desc: 'Maksimum devir sınır eğrisi', mapAction: 'fill' },
    { re: /^KL_VMAX/i, system: 'Vmax', desc: 'Maksimum hız sınır eğrisi', mapAction: 'fill' },
    { re: /^KF_VMAX/i, system: 'Vmax', desc: 'Hız sınır haritası', mapAction: 'fill' },
    // Lambda
    { re: /^KF_LAM/i, system: 'Lambda', desc: 'Lambda hedef haritası', mapAction: 'zero' },
    { re: /^KF_LSHK/i, system: 'Lambda', desc: 'Lambda sonda ısıtma haritası', mapAction: 'zero' },
    // Knock
    { re: /^KF_KLS/i, system: 'Knock', desc: 'Vuruntu koruma haritası', mapAction: 'scale' },
  ];

  for (const s of strings) {
    for (const damos of DAMOS_MAP_LABELS) {
      if (!damos.re.test(s.text)) continue;
      const key = 'damos_map_' + s.text + ':' + s.offset;
      if (perSystem.has(key)) continue;
      perSystem.set(key, true);

      const ofs = s.offset;
      const windowStart = Math.max(0, ofs - 8);
      const windowEnd = Math.min(bytes.length, ofs + s.text.length + 32);
      const windowBytes = bytes.subarray(windowStart, windowEnd);

      // DAMOS label'ın hemen ardından gelen veri bölgesinin boyutunu tahmin et
      // Tipik: label string + padding → axis refs → data block
      // Heuristik: label sonrası 64 byte'lık bölgede sıfır olmayan veri ara
      const dataStart = ofs + s.text.length + 1;
      let estSize = 0;
      if (dataStart < bytes.length) {
        // İlk 2 byte genellikle row×col veya element count ipucu verir
        const b0 = bytes[dataStart] || 0;
        const b1 = (dataStart + 1 < bytes.length) ? bytes[dataStart + 1] : 0;
        // Varsayılan: 2-byte elemanlarla küçük harita (16×16 max)
        const guessElements = Math.max(b0, 1) * Math.max(b1 || 1, 1);
        estSize = Math.min(guessElements * 2, 1024); // Max 1KB
      }
      if (estSize < 4) estSize = 64; // Minimum tahmini boyut

      const actions = [];
      if (damos.mapAction === 'zero') {
        actions.push({
          id: `damos_map_${s.text}_zero`,
          label: `${damos.desc} — sıfırla (${s.text})`,
          detail: `DAMOS harita ${s.text} @ ${hexAddr(dataStart)} — tahmini ${estSize} byte → 0x00`,
          offset: dataStart,
          dataSize: estSize,
          fillByte: 0x00,
          mapAction: 'zero',
          risk: 'high',
          confidence: 'medium',
          source: 'damos-map-label'
        });
      } else if (damos.mapAction === 'scale') {
        actions.push({
          id: `damos_map_${s.text}_scale`,
          label: `${damos.desc} — ölçekle (${s.text})`,
          detail: `DAMOS harita ${s.text} @ ${hexAddr(dataStart)} — tahmini ${estSize} byte, 2-byte LE elemanlar`,
          offset: dataStart,
          dataSize: estSize,
          elementSize: 2,
          elementCount: Math.floor(estSize / 2),
          mapAction: 'scale',
          scaleFactor: null, // Kullanıcı veya AI belirler
          risk: 'high',
          confidence: 'medium',
          source: 'damos-map-label'
        });
      } else if (damos.mapAction === 'fill') {
        actions.push({
          id: `damos_map_${s.text}_fill`,
          label: `${damos.desc} — limiti kaldır (${s.text})`,
          detail: `DAMOS harita ${s.text} @ ${hexAddr(dataStart)} — 2-byte elemanlar → max`,
          offset: dataStart,
          dataSize: estSize,
          elementSize: 2,
          elementCount: Math.floor(estSize / 2),
          mapAction: 'fill',
          fillValue: 0xFFFF,
          risk: 'high',
          confidence: 'medium',
          source: 'damos-map-label'
        });
      }

      if (actions.length) {
        regions.push({
          id: `damos_map_${s.text}_${ofs.toString(16)}`,
          system: damos.system,
          desc: `DAMOS harita: ${s.text} — ${damos.desc}`,
          foundString: s.text,
          offset: ofs,
          offsetHex: hexAddr(ofs),
          windowHex: hexDump(windowBytes),
          windowStart,
          source: 'damos-map-label',
          actions
        });
      }
      break; // Bir DAMOS label sadece bir sisteme eşleşir
    }
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

      const heuristicActions = buildActions(sys.system, s.offset, bytes, dpfConfig, egrConfig, adblueConfig, popbangConfig).map(a => ({
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

  // 3) ECU-tip profil çıkarımı — string'lerden bulunamayan sistemleri ekle
  //    Raw byte-scan ile keyword arayarak gerçek offset bulmaya çalış
  const ecuProfile = detectEcuType(strings);
  const foundSystems = new Set(regions.map(r => r.system));

  // Her sistem için raw byte-scan keyword'leri
  const SYSTEM_KEYWORDS = {
    'EGR': ['EGR','AGR','ExhGas','EGR_V','AGR_V','EGR_Rate'],
    'DPF': ['DPF','FAP','Regen','Soot','PartFilter','RussMen','DiffPres'],
    'AdBlue/SCR': ['AdBlue','SCR','Urea','Harnstoff','DeNOx','BlueTec'],
    'Lambda': ['Lambda','O2S','LSU','Sonde','HEGO','KatDiag','Vorkat'],
    'Boost': ['Boost','LDR','Ladedruck','P2Soll','Turbo','VTG','Wastegate','LadeDr'],
    'Torque': ['Torque','Drehmoment','M_Soll','MomentLim','MomFahr'],
    'Injection': ['Inj_Q','QNFLM','Einspritz','RailDr','InjVol','MengSoll'],
    'Hız sınırı': ['Vmax','V_Max','SpeedLim','GeschBeg'],
    'RPM sınırı': ['RPM','Drehzahl','nLim','N_Lim','nMax'],
    'Pedal': ['Pedal','FahrPed','APP_','Gaspedal','AccPedal'],
    'Immobilizer': ['Immo','IMMO','WFS','Wegfahr'],
    'DTC': ['DTC','FehlerSp','DiagErr','CEL_','MIL_'],
    'Pop&Bang': ['Overrun','SchubAb','SA_Ovr','OvrFuel','DecFuel','Ueberlauf','BurstF','ALS_','Crackle']
  };

  for (const expectedSys of ecuProfile.systems) {
    if (!foundSystems.has(expectedSys)) {
      const sysInfo = SYSTEMS.find(s => s.system === expectedSys);
      if (!sysInfo) continue;

      // Raw byte-scan: keyword'leri doğrudan binary'de ara
      let bestOffset = -1;
      let foundKeyword = '';
      const keywords = SYSTEM_KEYWORDS[expectedSys] || [expectedSys];
      for (const kw of keywords) {
        if (bestOffset >= 0) break;
        const kwBytes = te.encode(kw);
        for (let i = 0; i <= bytes.length - kwBytes.length; i++) {
          let match = true;
          for (let j = 0; j < kwBytes.length; j++) {
            if (bytes[i + j] !== kwBytes[j]) { match = false; break; }
          }
          if (match) { bestOffset = i; foundKeyword = kw; break; }
        }
      }

      if (bestOffset >= 0) {
        // Keyword bulundu — gerçek offset ile aksiyon oluştur
        const windowStart = Math.max(0, bestOffset - 8);
        const windowEnd = Math.min(bytes.length, bestOffset + foundKeyword.length + 24);
        const windowBytes = bytes.subarray(windowStart, windowEnd);

        const profileActions = buildActions(expectedSys, bestOffset, bytes, dpfConfig, egrConfig, adblueConfig).map(a => ({
          ...a,
          id: 'profile_' + a.id,
          confidence: 'medium',
          source: 'ecu-profile-bytescan',
          detail: a.detail + ' (profil byte-tarama)'
        }));

        regions.push({
          id: 'profile_' + expectedSys.toLowerCase().replace(/[^a-z]/g, '_') + '_' + bestOffset.toString(16),
          system: expectedSys,
          desc: sysInfo.desc + ` (${ecuProfile.ecuType} profil — "${foundKeyword}" bulundu)`,
          foundString: foundKeyword,
          offset: bestOffset,
          offsetHex: hexAddr(bestOffset),
          windowHex: hexDump(windowBytes),
          windowStart,
          source: 'ecu-profile-bytescan',
          actions: profileActions
        });
      } else {
        // Hiç bulunamadı — yine de region olarak göster, ama aksiyonsuz
        regions.push({
          id: 'profile_' + expectedSys.toLowerCase().replace(/[^a-z]/g, '_'),
          system: expectedSys,
          desc: sysInfo.desc + ` (${ecuProfile.ecuType} profil tahmini — konum bulunamadı)`,
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
  }

  regions.sort((a, b) => a.offset - b.offset);

  // Metadata eklentisi
  regions._rulepackMatches = rulepackMatches;
  regions._ecuProfile = ecuProfile;
  return regions;
}

// ---------- Dosya özetini LLM'e göndermeye hazırla ----------
export function summarizeForAI(bytes, regions, limit = 6000) {
  const stats = fileStats(bytes);
  const topRegions = regions.slice(0, 40).map(r => {
    const entry = {
      system: r.system,
      offset: r.offsetHex,
      string: r.foundString.slice(0, 40),
      bytes: r.windowHex.slice(0, 80)
    };
    // Harita meta verileri — AI'ın map aksiyonu üretebilmesi için
    if (r.definitionMeta) {
      entry.defType = r.definitionMeta.type;
      if (r.definitionMeta.elementCount > 1) entry.elements = r.definitionMeta.elementCount;
      if (r.definitionMeta.totalBytes) entry.totalBytes = r.definitionMeta.totalBytes;
      if (r.definitionMeta.datatype) entry.datatype = r.definitionMeta.datatype;
      if (r.definitionMeta.unit) entry.unit = r.definitionMeta.unit;
    }
    // Mevcut map aksiyonları varsa listele
    const mapActions = (r.actions || []).filter(a => a.mapAction);
    if (mapActions.length) entry.mapActions = mapActions.map(a => a.mapAction);
    return entry;
  });
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

// ---------- Uygulama (multi-byte destekli) ----------
export async function applyActions(originalBytes, selectedActions) {
  const tuned = new Uint8Array(originalBytes);
  const dv = new DataView(tuned.buffer, tuned.byteOffset, tuned.byteLength);
  const applied = [];

  for (const a of selectedActions) {
    if (a.offset == null || a.offset < 0 || a.offset >= tuned.length) continue;
    const ds = a.dataSize || 1;

    // Sınır kontrolü — yazılacak byte sayısı dosya sonunu aşmamalı
    if (a.offset + ds > tuned.length) continue;

    // ---- Harita aksiyonları (zero / scale / fill) ----
    if (a.mapAction) {
      const beforeBytes = [];
      for (let i = 0; i < ds; i++) beforeBytes.push(tuned[a.offset + i]);

      if (a.mapAction === 'zero') {
        // Tüm byte'ları sıfırla — DPF/EGR/AdBlue/Lambda/DTC haritaları
        for (let i = 0; i < ds; i++) tuned[a.offset + i] = a.fillByte ?? 0x00;

      } else if (a.mapAction === 'scale' && a.scaleFactor != null) {
        // Her hücreyi scaleFactor ile çarp — Boost/Torque/Injection haritaları
        const elSz = a.elementSize || 1;
        const count = a.elementCount || Math.floor(ds / elSz);
        for (let e = 0; e < count; e++) {
          const pos = a.offset + e * elSz;
          if (pos + elSz > tuned.length) break;
          let val;
          if (elSz === 1) val = tuned[pos];
          else if (elSz === 2) val = dv.getUint16(pos, true);
          else if (elSz === 4 && a.datatype === 'FLOAT32_IEEE') val = dv.getFloat32(pos, true);
          else if (elSz === 4) val = dv.getUint32(pos, true);
          else continue;

          let scaled = val * a.scaleFactor;
          if (a.datatype === 'FLOAT32_IEEE') {
            dv.setFloat32(pos, scaled, true);
          } else {
            scaled = Math.round(scaled);
            const maxVal = elSz === 1 ? 0xFF : elSz === 2 ? 0xFFFF : 0xFFFFFFFF;
            scaled = Math.max(0, Math.min(maxVal, scaled));
            if (elSz === 1) tuned[pos] = scaled;
            else if (elSz === 2) dv.setUint16(pos, scaled, true);
            else if (elSz === 4) dv.setUint32(pos, scaled >>> 0, true);
          }
        }

      } else if (a.mapAction === 'fill' && a.fillValue != null) {
        // Tüm hücreleri sabit değerle doldur — Vmax/RPM limiter
        const elSz = a.elementSize || 1;
        const count = a.elementCount || Math.floor(ds / elSz);
        for (let e = 0; e < count; e++) {
          const pos = a.offset + e * elSz;
          if (pos + elSz > tuned.length) break;
          if (elSz === 1) tuned[pos] = a.fillValue & 0xFF;
          else if (elSz === 2) dv.setUint16(pos, a.fillValue & 0xFFFF, true);
          else if (elSz === 4 && a.datatype === 'FLOAT32_IEEE') dv.setFloat32(pos, a.fillValue, true);
          else if (elSz === 4) dv.setUint32(pos, a.fillValue >>> 0, true);
        }
      }

      const afterBytes = [];
      for (let i = 0; i < ds; i++) afterBytes.push(tuned[a.offset + i]);

      applied.push({
        id: a.id, label: a.label, offset: a.offset,
        offsetHex: hexAddr(a.offset), dataSize: ds,
        mapAction: a.mapAction,
        beforeBytes, afterBytes,
        before: beforeBytes[0], after: afterBytes[0]
      });
      continue;
    }

    // ---- Multi-byte yazma ----
    if (ds >= 2 && a.newValue != null) {
      const beforeBytes = [];
      for (let i = 0; i < ds; i++) beforeBytes.push(tuned[a.offset + i]);

      if (ds === 2) {
        dv.setUint16(a.offset, a.newValue & 0xFFFF, true); // Little-endian
      } else if (ds === 4 && a.datatype === 'FLOAT32_IEEE') {
        dv.setFloat32(a.offset, a.newValue, true);
      } else if (ds === 4) {
        dv.setUint32(a.offset, a.newValue >>> 0, true);
      } else {
        // Genel: byte dizisi olarak yaz (büyük tablolar için)
        const val = BigInt(a.newValue);
        for (let i = 0; i < ds; i++) {
          tuned[a.offset + i] = Number((val >> BigInt(8 * i)) & 0xFFn);
        }
      }

      const afterBytes = [];
      for (let i = 0; i < ds; i++) afterBytes.push(tuned[a.offset + i]);

      applied.push({
        id: a.id,
        label: a.label,
        offset: a.offset,
        offsetHex: hexAddr(a.offset),
        dataSize: ds,
        beforeBytes,
        afterBytes,
        before: beforeBytes[0],
        after: afterBytes[0]
      });
      continue;
    }

    // ---- Tek-byte yazma (eski uyumluluk) ----
    const before = tuned[a.offset];
    tuned[a.offset] = (a.newByte ?? 0) & 0xFF;
    applied.push({
      id: a.id,
      label: a.label,
      offset: a.offset,
      offsetHex: hexAddr(a.offset),
      dataSize: 1,
      before,
      after: tuned[a.offset]
    });
  }

  // Checksum correction — Bosch MED17/EDC17 TriCore blocks
  let checksumResult = null;
  try {
    const csResult = fixChecksums(tuned);
    if (csResult.blocks > 0) {
      // Copy corrected bytes back into tuned
      tuned.set(csResult.modified);
      checksumResult = {
        blocks: csResult.blocks,
        variant: csResult.variant,
        corrected: csResult.corrected,
        crc32Valid: csResult.crc32Valid,
        crc32Invalid: csResult.crc32Invalid,
        skipped: csResult.skipped,
        log: csResult.log,
      };
    }
  } catch (csErr) {
    checksumResult = { error: csErr.message };
  }

  return {
    tuned,
    applied,
    hash: await sha256Hex(tuned),
    size: tuned.length,
    checksum: checksumResult,
  };
}

/**
 * Validate checksums of an ECU binary without modifying it.
 * Returns block info and per-structure validation status.
 */
export function validateChecksums(bytes) {
  const data = new Uint8Array(bytes);
  const blocks = findBoschBlocks(data);
  if (!blocks.length) return { blocks: 0, structures: [] };
  const results = validateAllChecksums(data, blocks);
  return { blocks: blocks.length, results };
}

// Legacy exports (eski kod kırılmasın diye no-op)
export function identifyVehicle() { return []; }
export function generateProposals() { return []; }
export async function applyTuning(bytes) { return { tuned: new Uint8Array(bytes), appliedPatches: [], hash: await sha256Hex(bytes), size: bytes.length }; }
export function validateTunedFile(a, b) { return a.length === b.length ? { valid: true } : { valid: false, error: 'SIZE_MISMATCH' }; }
