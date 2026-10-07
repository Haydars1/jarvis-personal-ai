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
// Her sistem: regex, isim, kısa açıklama, detaylı açıklama, kapatınca ne olur, stage1 bilgisi, tahmini HP
const SYSTEMS = [
  { re: /\bEGR\b|AGR|Abgasrück/i, system: 'EGR', icon: '🔄', desc: 'Egzoz gazı resirkülasyonu',
    explain: 'Egzoz gazının bir kısmını tekrar emişe gönderir. NOx emisyonunu azaltır ama zamanla karbonlaşma yapar.',
    offExplain: 'EGR kapatılınca: Egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır. Performans: +5-15 HP. Karbon birikimi durur.',
    stage1: true, hpGain: '5-15' },
  { re: /\bDPF\b|\bFAP\b|PartikelFilter|Rußfilter/i, system: 'DPF', icon: '🔥', desc: 'Dizel partikül filtre',
    explain: 'Egzozdaki kurum/partikül parçacıklarını tutar. Dolu olunca rejenerasyon (yakma) döngüsüne girer.',
    offExplain: 'DPF kapatılınca: Rejenerasyon döngüsü durur → yakıt tasarrufu (rejenerasyon sırasında fazladan yakıt harcanır). Contra basınç düşer → +10-20 HP. DPF fiziksel olarak da çıkarılmalı.',
    stage1: true, hpGain: '10-20' },
  { re: /AdBlue|SCR|DEF\b|Urea|Harnstoff|NOx/i, system: 'AdBlue/SCR', icon: '💧', desc: 'AdBlue / NOx redüksiyon',
    explain: 'Egzoz gazına üre (AdBlue) püskürterek NOx gazını azaltır. Tank ve enjektör sistemi var.',
    offExplain: 'AdBlue kapatılınca: AdBlue tankı ve enjektör sistemi devre dışı olur. "AdBlue seviyesi düşük" uyarıları kaybolur. Motor güç kısıtlaması (limp mode) riski ortadan kalkar.',
    stage1: false, hpGain: '0-5' },
  { re: /Lambda|\bO2S?\b|LSU/i, system: 'Lambda', icon: '📊', desc: 'Oksijen sensörü',
    explain: 'Egzozdaki oksijen seviyesini ölçer. ECU buna göre yakıt/hava oranını ayarlar.',
    offExplain: 'Lambda kapatılınca: O2 sensör değerleri ECU tarafından ignore edilir. DPF/EGR off yapıldıktan sonra P0420/P0430 gibi hata kodlarını önler.',
    stage1: false, hpGain: '0' },
  { re: /Boost|LDR|Ladedruck|P2Soll/i, system: 'Boost', icon: '⚡', desc: 'Boost basınç kontrolü',
    explain: 'Turbo basınç limitleri. Stage 1 tuningde bu değer yükseltilir → daha fazla hava → daha fazla güç.',
    offExplain: 'Boost yükseltilince: Turbo basıncı artar → silindire daha fazla hava girer → daha fazla yakıt yanar → güç artar. Stage 1: +15-25% boost artışı tipik.',
    stage1: true, hpGain: '20-40' },
  { re: /Torque|Torq|M_Soll|Drehmoment/i, system: 'Torque', icon: '💪', desc: 'Tork sınırlama',
    explain: 'ECU yazılımında tork limitleri var. Şanzıman ve drivetraini korumak için sınırlanır.',
    offExplain: 'Tork limiti yükseltilince: Motor daha fazla tork üretebilir. Stage 1 ile birlikte boost artışını destekler. Dikkat: Şanzıman kapasitesi kontrol edilmeli.',
    stage1: true, hpGain: '15-30' },
  { re: /Injection|Inj_Q|QNFLM|Einspritz/i, system: 'Injection', icon: '💉', desc: 'Yakıt enjeksiyonu',
    explain: 'Enjektörlerin ne kadar yakıt püskürtüğünü kontrol eder. Enjeksiyon miktarı ve zamanlaması.',
    offExplain: 'Enjeksiyon artırılınca: Daha fazla yakıt → daha fazla güç. Boost artışıyla birlikte uygulanmalı. Stage 1 için enjeksiyon miktarı %10-20 artırılır.',
    stage1: true, hpGain: '10-25' },
  { re: /\bMAF\b|HFM|\bMAP\b|LMM/i, system: 'MAF/MAP', icon: '🌬️', desc: 'Hava akış sensörü',
    explain: 'Emişe giren hava miktarını ölçer. ECU buna göre yakıt dozunu ayarlar.',
    offExplain: 'MAF/MAP limitleri yükseltilince: Hava akış sensörünün ölçüm aralığı genişler. Büyük turbo veya intake upgrade sonrası gerekli olabilir.',
    stage1: false, hpGain: '0-5' },
  { re: /Vmax|Vfzg|SpeedLim|Geschwind/i, system: 'Hız sınırı', icon: '🏎️', desc: 'Araç hız sınırlayıcı',
    explain: 'Aracın maksimum hızını sınırlar. Genelde 250 km/h limiter (Alman araçlar).',
    offExplain: 'Hız sınırı kaldırılınca: Araç mekanik/aerodinamik limitine kadar hızlanabilir. Lastik ve fren kapasitesi kontrol edilmeli.',
    stage1: false, hpGain: '0' },
  { re: /Nmax|Nmot|RpmLim|Drehzahl/i, system: 'RPM sınırı', icon: '🔴', desc: 'Devir sınırlayıcı',
    explain: 'Motorun maksimum devrini sınırlar. Silindir kafası ve valf sistemini korur.',
    offExplain: 'RPM limiti yükseltilince: Motor daha yüksek devire çıkabilir. Dikkat: Mekanik limitler var — düzensiz RPM artışı motor hasarına neden olabilir.',
    stage1: false, hpGain: '0-5' },
  { re: /Pedal|PWG|TPS\b|FGR/i, system: 'Pedal', icon: '🦶', desc: 'Gaz pedalı karakteristiği',
    explain: 'Gaz pedalına basma yüzdesi ile kelebek açıklığı arasındaki haritayı kontrol eder.',
    offExplain: 'Pedal haritası değiştirilince: Gaz pedalı yanıtı daha agresif olur → pedalın ilk %30\'unda daha hızlı tepki. Gerçek güç artışı yok, ama sübjektif hız hissi artar.',
    stage1: false, hpGain: '0' },
  { re: /ColdStart|Kaltst|KSTT|HRMK/i, system: 'Soğuk marş', icon: '❄️', desc: 'Soğuk marş zenginleştirme',
    explain: 'Soğuk çalıştırmada fazladan yakıt verir. Isınana kadar devri biraz yüksek tutar.',
    offExplain: 'Soğuk marş zenginleştirme azaltılınca: Motor daha hızlı normal devire iner. Emisyon testi için dikkat — soğukta katalitik konvertör daha geç ısınır.',
    stage1: false, hpGain: '0' },
  { re: /Knock|Klopf|\bKR\b|KFKHFM/i, system: 'Vuruntu', icon: '🔨', desc: 'Vuruntu sensörü',
    explain: 'Motor vuruntusunu (knock) algılar ve ateşleme zamanlamasını geri çeker. Motoru korur.',
    offExplain: 'Vuruntu sensörü devre dışı bırakılınca: ECU vuruntu algılamaz → ateşleme ilerletilir. DİKKAT: Yanlış yapılırsa motor hasarı riski var. Sadece yüksek oktan yakıtla.',
    stage1: false, hpGain: '3-8' },
  { re: /Immo|Wegfahr|IMMOBILIZER/i, system: 'Immobilizer', icon: '🔑', desc: 'Immobilizer / anahtar',
    explain: 'Aracın çalınmasını önleyen elektronik kilit sistemi. Doğru anahtar olmadan çalışmaz.',
    offExplain: 'Immobilizer kapatılınca: Anahtar eşleşme kontrolü devre dışı olur. Motor herhangi bir anahtarla çalışır. Yedek ECU veya swap durumlarında kullanılır.',
    stage1: false, hpGain: '0' },
  { re: /Checksum|Prüfsumme|Chksum|CRC/i, system: 'Checksum', icon: '✅', desc: 'Dosya bütünlük kontrolü',
    explain: 'ECU dosyadaki değişiklikleri kontrol eder. Checksum hatalıysa dosyayı reddeder.',
    offExplain: 'Checksum düzeltilmeli: Herhangi bir değişiklik yaptıktan sonra checksum tekrar hesaplanmalı, yoksa ECU dosyayı reddeder veya hata verir.',
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
function buildActions(system, offset, bytes) {
  const safe = ofs => ofs >= 0 && ofs + 1 < bytes.length;
  const flagOffset = offset + 16;
  const limitOffset = offset + 8;
  const list = [];
  const sysInfo = SYSTEMS.find(s => s.system === system);
  const icon = sysInfo?.icon || '⚙';

  switch (system) {
    case 'EGR':
      if (safe(flagOffset)) list.push({
        id: 'egr_off_' + offset.toString(16),
        label: 'EGR Devre Dışı (OFF)',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        explain: 'EGR valfini kapatır. Egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır.',
        effect: 'Karbon birikimi durur, emme manifoldu temiz kalır',
        hpGain: '+5-15 HP',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'low'
      });
      break;

    case 'DPF':
      if (safe(flagOffset)) list.push({
        id: 'dpf_regen_off_' + offset.toString(16),
        label: 'DPF Rejenerasyon Kapat (OFF)',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        explain: 'DPF rejenerasyon döngüsünü devre dışı bırakır. Rejenerasyon sırasında harcanan ek yakıt ortadan kalkar.',
        effect: 'Yakıt tasarrufu, contra basınç düşer, DPF fiziksel olarak da çıkarılmalı',
        hpGain: '+10-20 HP',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'medium'
      });
      if (safe(limitOffset)) list.push({
        id: 'dpf_diff_press_max_' + offset.toString(16),
        label: 'DPF Diferansiyel Basınç Limiti Yükselt',
        detail: `Adres ${hexAddr(limitOffset)}: 0x${hexByte(bytes[limitOffset])} → 0xFF`,
        explain: 'DPF basınç farkı sensörünün uyarı eşiğini maksimuma çeker → DPF dolu uyarısı tetiklenmez.',
        effect: 'DPF uyarı lambası yanmaz, rejenerasyon talep edilmez',
        hpGain: '',
        offset: limitOffset, currentByte: bytes[limitOffset], newByte: 0xFF, risk: 'medium'
      });
      break;

    case 'AdBlue/SCR':
      if (safe(flagOffset)) list.push({
        id: 'adblue_off_' + offset.toString(16),
        label: 'AdBlue Sistemi Kapat (OFF)',
        detail: `Adres ${hexAddr(flagOffset)}: 0x${hexByte(bytes[flagOffset])} → 0x00`,
        explain: 'SCR / AdBlue enjeksiyon sistemini tamamen devre dışı bırakır. Tank seviye uyarıları ve güç kısıtlaması (limp mode) ortadan kalkar.',
        effect: 'AdBlue tankı boşaltılabilir, limp mode riski yok, uyarı yok',
        hpGain: '0-5 HP',
        offset: flagOffset, currentByte: bytes[flagOffset], newByte: 0, risk: 'high'
      });
      break;

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
