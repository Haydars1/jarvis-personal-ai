// src/lib/obd-bridge.js
// ELM327 → hayırlıevlad OBD-II Bridge
// Cloudflare Workers ESM — WebSocket live-stream + REST decode
// Handles: ELM327 AT init, OBD-II Mode 01 PID decode, DTC parse, session logging

// ─── Standard OBD-II Mode 01 PID Registry ───────────────────────────
// Each entry: { name, desc, unit, min, max, bytes, decode(A,B,C,D) }
const PID_REGISTRY = Object.freeze({
  '00': { name: 'PIDs_Supported_01_20', desc: 'Desteklenen PID bitmap (01-20)', unit: 'bitmap', bytes: 4,
    decode: (A,B,C,D) => ((A<<24)|(B<<16)|(C<<8)|D) >>> 0 },
  '01': { name: 'Monitor_Status',    desc: 'MIL durumu ve monitor sayısı', unit: '', bytes: 4,
    decode: (A) => ({ mil: !!(A & 0x80), dtcCount: A & 0x7F }) },
  '03': { name: 'Fuel_System_Status', desc: 'Yakıt sistemi durumu',     unit: '', bytes: 2,
    decode: (A,B) => ({ bank1: A, bank2: B }) },
  '04': { name: 'Engine_Load',        desc: 'Hesaplanan motor yükü',    unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '05': { name: 'Coolant_Temp',       desc: 'Motor soğutma suyu sıcaklığı', unit: '°C', min: -40, max: 215, bytes: 1,
    decode: (A) => A - 40 },
  '06': { name: 'Short_Fuel_Trim_1',  desc: 'Kısa vadeli yakıt trim Bank 1', unit: '%', min: -100, max: 99.2, bytes: 1,
    decode: (A) => +((A - 128) * 100 / 128).toFixed(1) },
  '07': { name: 'Long_Fuel_Trim_1',   desc: 'Uzun vadeli yakıt trim Bank 1', unit: '%', min: -100, max: 99.2, bytes: 1,
    decode: (A) => +((A - 128) * 100 / 128).toFixed(1) },
  '08': { name: 'Short_Fuel_Trim_2',  desc: 'Kısa vadeli yakıt trim Bank 2', unit: '%', min: -100, max: 99.2, bytes: 1,
    decode: (A) => +((A - 128) * 100 / 128).toFixed(1) },
  '09': { name: 'Long_Fuel_Trim_2',   desc: 'Uzun vadeli yakıt trim Bank 2', unit: '%', min: -100, max: 99.2, bytes: 1,
    decode: (A) => +((A - 128) * 100 / 128).toFixed(1) },
  '0A': { name: 'Fuel_Pressure',      desc: 'Yakıt basıncı (gauge)',   unit: 'kPa', min: 0, max: 765, bytes: 1,
    decode: (A) => A * 3 },
  '0B': { name: 'Intake_MAP',         desc: 'Emme manifold basıncı',   unit: 'kPa', min: 0, max: 255, bytes: 1,
    decode: (A) => A },
  '0C': { name: 'RPM',                desc: 'Motor devri',             unit: 'rpm', min: 0, max: 16383.75, bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 4).toFixed(1) },
  '0D': { name: 'Speed',              desc: 'Araç hızı',               unit: 'km/h', min: 0, max: 255, bytes: 1,
    decode: (A) => A },
  '0E': { name: 'Timing_Advance',     desc: 'Ateşleme avansı',         unit: '°', min: -64, max: 63.5, bytes: 1,
    decode: (A) => +(A / 2 - 64).toFixed(1) },
  '0F': { name: 'Intake_Air_Temp',    desc: 'Emme havası sıcaklığı',   unit: '°C', min: -40, max: 215, bytes: 1,
    decode: (A) => A - 40 },
  '10': { name: 'MAF_Rate',           desc: 'Kütle hava akışı (MAF)',  unit: 'g/s', min: 0, max: 655.35, bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 100).toFixed(2) },
  '11': { name: 'Throttle_Position',  desc: 'Gaz kelebeği pozisyonu',  unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '13': { name: 'O2_Sensors_Present', desc: 'O2 sensör konumları',     unit: 'bitmap', bytes: 1,
    decode: (A) => A },
  '14': { name: 'O2_Voltage_B1S1', desc: 'O2 gerilim Bank1 Sensor1', unit: 'V', min: 0, max: 1.275, bytes: 2,
    decode: (A,B) => ({ voltage: +(A * 0.005).toFixed(3), trim: B === 0xFF ? null : +((B - 128) * 100 / 128).toFixed(1) }) },
  '1C': { name: 'OBD_Standard',    desc: 'OBD standart tipi',       unit: '', bytes: 1,
    decode: (A) => OBD_STANDARDS[A] || `Unknown(${A})` },
  '1F': { name: 'Run_Time',        desc: 'Motor çalışma süresi',    unit: 's', min: 0, max: 65535, bytes: 2,
    decode: (A,B) => A * 256 + B },
  '20': { name: 'PIDs_Supported_21_40', desc: 'Desteklenen PID bitmap (21-40)', unit: 'bitmap', bytes: 4,
    decode: (A,B,C,D) => ((A<<24)|(B<<16)|(C<<8)|D) >>> 0 },
  '21': { name: 'Distance_MIL_On', desc: 'MIL açıkken mesafe',       unit: 'km', min: 0, max: 65535, bytes: 2,
    decode: (A,B) => A * 256 + B },
  '23': { name: 'Fuel_Rail_Pressure_Direct', desc: 'Yakıt rayı basıncı (direkt enjeksiyon)', unit: 'kPa', min: 0, max: 655350, bytes: 2,
    decode: (A,B) => (A * 256 + B) * 10 },
  '24': { name: 'O2_Equiv_Ratio_B1S1', desc: 'Lambda oranı B1S1', unit: 'ratio', bytes: 4,
    decode: (A,B) => +((A * 256 + B) * 2 / 65536).toFixed(4) },
  '2F': { name: 'Fuel_Tank_Level', desc: 'Yakıt seviyesi',           unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '30': { name: 'Warmup_Since_Clear', desc: 'DTC temizlenmesinden beri ısınma', unit: 'count', bytes: 1,
    decode: (A) => A },
  '31': { name: 'Distance_Since_Clear', desc: 'DTC temizlenmesinden beri mesafe', unit: 'km', min: 0, max: 65535, bytes: 2,
    decode: (A,B) => A * 256 + B },
  '33': { name: 'Barometric_Pressure', desc: 'Barometrik basınç',    unit: 'kPa', min: 0, max: 255, bytes: 1,
    decode: (A) => A },
  '3C': { name: 'Catalyst_Temp_B1S1', desc: 'Katalizör sıcaklığı B1S1', unit: '°C', min: -40, max: 6513.5, bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 10 - 40).toFixed(1) },
  '40': { name: 'PIDs_Supported_41_60', desc: 'Desteklenen PID bitmap (41-60)', unit: 'bitmap', bytes: 4,
    decode: (A,B,C,D) => ((A<<24)|(B<<16)|(C<<8)|D) >>> 0 },
  '42': { name: 'ECU_Voltage',     desc: 'ECU gerilimi',              unit: 'V', min: 0, max: 65.535, bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 1000).toFixed(3) },
  '43': { name: 'Absolute_Load',   desc: 'Mutlak motor yükü',        unit: '%', min: 0, max: 25700, bytes: 2,
    decode: (A,B) => +((A * 256 + B) * 100 / 255).toFixed(1) },
  '44': { name: 'Commanded_Equiv_Ratio', desc: 'Komut edilen eşdeğerlik oranı', unit: 'ratio', bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 32768).toFixed(4) },
  '45': { name: 'Relative_Throttle', desc: 'Göreceli gaz kelebeği pozisyonu', unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '46': { name: 'Ambient_Air_Temp', desc: 'Ortam hava sıcaklığı',    unit: '°C', min: -40, max: 215, bytes: 1,
    decode: (A) => A - 40 },
  '47': { name: 'Absolute_Throttle_B', desc: 'Mutlak gaz kelebeği pozisyonu B', unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '49': { name: 'Accel_Pedal_D', desc: 'Gaz pedalı pozisyonu D', unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '4A': { name: 'Accel_Pedal_E', desc: 'Gaz pedalı pozisyonu E', unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '4C': { name: 'Commanded_Throttle', desc: 'Komut edilen gaz kelebeği aktüatörü', unit: '%', min: 0, max: 100, bytes: 1,
    decode: (A) => +(A * 100 / 255).toFixed(1) },
  '4D': { name: 'Run_Time_MIL_On', desc: 'MIL açıkken motor çalışma süresi', unit: 'min', min: 0, max: 65535, bytes: 2,
    decode: (A,B) => A * 256 + B },
  '51': { name: 'Fuel_Type',       desc: 'Yakıt tipi',                unit: '', bytes: 1,
    decode: (A) => FUEL_TYPES[A] || `Unknown(${A})` },
  '5C': { name: 'Oil_Temp',        desc: 'Motor yağı sıcaklığı',     unit: '°C', min: -40, max: 210, bytes: 1,
    decode: (A) => A - 40 },
  '5E': { name: 'Fuel_Rate',       desc: 'Motor yakıt tüketimi',     unit: 'L/h', min: 0, max: 3212.75, bytes: 2,
    decode: (A,B) => +((A * 256 + B) / 20).toFixed(2) },
  '60': { name: 'PIDs_Supported_61_80', desc: 'Desteklenen PID bitmap (61-80)', unit: 'bitmap', bytes: 4,
    decode: (A,B,C,D) => ((A<<24)|(B<<16)|(C<<8)|D) >>> 0 },
  '61': { name: 'Driver_Torque_Demand', desc: 'Sürücü talep torku', unit: '%', min: -125, max: 130, bytes: 1,
    decode: (A) => A - 125 },
  '62': { name: 'Actual_Torque', desc: 'Gerçek motor torku', unit: '%', min: -125, max: 130, bytes: 1,
    decode: (A) => A - 125 },
  '63': { name: 'Reference_Torque', desc: 'Referans tork', unit: 'Nm', min: 0, max: 65535, bytes: 2,
    decode: (A,B) => A * 256 + B },
});

const OBD_STANDARDS = Object.freeze({
  1: 'OBD-II CARB', 2: 'OBD EPA', 3: 'OBD/OBD-II', 4: 'OBD-I',
  5: 'Not OBD', 6: 'EOBD', 7: 'EOBD/OBD-II', 8: 'EOBD/OBD',
  9: 'EOBD/OBD/OBD-II', 10: 'JOBD', 11: 'JOBD/OBD-II', 12: 'JOBD/EOBD',
  13: 'JOBD/EOBD/OBD-II', 17: 'EMD', 18: 'EMD+', 19: 'HD OBD-C',
  20: 'HD OBD', 21: 'WWH OBD', 23: 'HD EOBD-I', 24: 'HD EOBD-I N',
  25: 'HD EOBD-II', 26: 'HD EOBD-II N', 28: 'OBDBr-1', 29: 'OBDBr-2',
  33: 'KOBD', 34: 'IOBD I', 35: 'IOBD II',
});

const FUEL_TYPES = Object.freeze({
  0: 'Not available', 1: 'Gasoline', 2: 'Methanol', 3: 'Ethanol',
  4: 'Diesel', 5: 'LPG', 6: 'CNG', 7: 'Propane', 8: 'Electric',
  9: 'Bifuel (Gasoline)', 10: 'Bifuel (Methanol)', 11: 'Bifuel (Ethanol)',
  12: 'Bifuel (LPG)', 13: 'Bifuel (CNG)', 14: 'Bifuel (Propane)',
  15: 'Bifuel (Electric)', 16: 'Bifuel (Gasoline/Electric)',
  17: 'Hybrid (Gasoline)', 18: 'Hybrid (Ethanol)', 19: 'Hybrid (Diesel)',
  20: 'Hybrid (Electric)', 21: 'Hybrid (Mixed)', 22: 'Hybrid (Regenerative)',
  23: 'Bifuel (Diesel)',
});


// ─── DTC (Diagnostic Trouble Code) Decoder ──────────────────────────
const DTC_PREFIXES = { '0': 'P0', '1': 'P1', '2': 'P2', '3': 'P3',
  '4': 'C0', '5': 'C1', '6': 'C2', '7': 'C3',
  '8': 'B0', '9': 'B1', 'A': 'B2', 'B': 'B3',
  'C': 'U0', 'D': 'U1', 'E': 'U2', 'F': 'U3' };

const DTC_CATEGORIES = Object.freeze({
  P: 'Powertrain', C: 'Chassis', B: 'Body', U: 'Network',
});

function decodeDTC(hexPair) {
  // hexPair = 4 hex chars e.g. "0133" → P0133
  if (!hexPair || hexPair.length < 4 || hexPair === '0000') return null;
  const firstNibble = hexPair[0].toUpperCase();
  const prefix = DTC_PREFIXES[firstNibble];
  if (!prefix) return null;
  const code = prefix + hexPair.slice(1).toUpperCase();
  const category = DTC_CATEGORIES[code[0]];
  return { code, category, raw: hexPair };
}

function decodeDTCResponse(raw) {
  // Mode 03 response: "43 01 33 02 00 00 00"
  const clean = raw.replace(/[\s\r\n]/g, '').replace(/^43/i, '');
  const codes = [];
  for (let i = 0; i < clean.length - 3; i += 4) {
    const dtc = decodeDTC(clean.slice(i, i + 4));
    if (dtc) codes.push(dtc);
  }
  return codes;
}


// ─── ELM327 Protocol Handler ────────────────────────────────────────
const ELM327_PROTOCOLS = Object.freeze({
  '0': 'Automatic',
  '1': 'SAE J1850 PWM (41.6 kBaud)',
  '2': 'SAE J1850 VPW (10.4 kBaud)',
  '3': 'ISO 9141-2 (5 Baud init)',
  '4': 'ISO 14230-4 KWP (5 Baud init)',
  '5': 'ISO 14230-4 KWP (Fast init)',
  '6': 'ISO 15765-4 CAN (11-bit 500 kBaud)',
  '7': 'ISO 15765-4 CAN (29-bit 500 kBaud)',
  '8': 'ISO 15765-4 CAN (11-bit 250 kBaud)',
  '9': 'ISO 15765-4 CAN (29-bit 250 kBaud)',
  'A': 'SAE J1939 CAN (29-bit 250 kBaud)',
  'B': 'User1 CAN (11-bit 125 kBaud)',
  'C': 'User2 CAN (11-bit 50 kBaud)',
});

// Standard ELM327 AT command init sequence
const ELM327_INIT_SEQUENCE = Object.freeze([
  { cmd: 'ATZ',     desc: 'Reset ELM327',            expect: /ELM327/i, delay: 1500 },
  { cmd: 'ATE0',    desc: 'Echo kapatma',             expect: /OK/,     delay: 200 },
  { cmd: 'ATL0',    desc: 'Linefeed kapatma',         expect: /OK/,     delay: 200 },
  { cmd: 'ATS0',    desc: 'Boşluk kapatma',           expect: /OK/,     delay: 200 },
  { cmd: 'ATH1',    desc: 'Header gösterme açma',     expect: /OK/,     delay: 200 },
  { cmd: 'ATSP0',   desc: 'Protokol otomatik seçim',  expect: /OK/,     delay: 200 },
  { cmd: 'ATDPN',   desc: 'Protokol numarası sorgula', expect: /[0-9A-C]/i, delay: 500 },
  { cmd: '0100',    desc: 'Desteklenen PID sorgula',  expect: /41 00/i, delay: 2000 },
]);

// Commonly monitored PID groups for live dashboards
const PID_GROUPS = Object.freeze({
  essential: ['0C', '0D', '05', '04', '11'],       // RPM, Speed, Coolant, Load, Throttle
  performance: ['0C', '0D', '0B', '10', '11', '0E', '23'], // + MAP, MAF, TimingAdv, FuelRail
  economy: ['0C', '0D', '04', '10', '5E', '2F'],   // + MAF, FuelRate, TankLevel
  emissions: ['05', '06', '07', '3C', '44'],         // Coolant, Trims, CatTemp, Lambda
  diagnostics: ['01', '04', '05', '42', '5C', '1F'], // Monitor, Load, Coolant, Voltage, OilTemp, RunTime
});


// ─── ELM327 Response Parser ─────────────────────────────────────────
function parseELM327Response(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'EMPTY_RESPONSE' };

  const trimmed = raw.trim().replace(/\r/g, '\n').replace(/\n{2,}/g, '\n');

  // ELM327 error responses
  if (/NO DATA/i.test(trimmed)) return { ok: false, error: 'NO_DATA', desc: 'ECU yanıt vermedi' };
  if (/UNABLE TO CONNECT/i.test(trimmed)) return { ok: false, error: 'NO_CONNECT', desc: 'OBD bağlantısı kurulamadı' };
  if (/BUS INIT.*ERROR/i.test(trimmed)) return { ok: false, error: 'BUS_INIT_ERROR', desc: 'CAN/K-Line başlatma hatası' };
  if (/CAN ERROR/i.test(trimmed)) return { ok: false, error: 'CAN_ERROR', desc: 'CAN bus iletişim hatası' };
  if (/BUFFER FULL/i.test(trimmed)) return { ok: false, error: 'BUFFER_FULL', desc: 'ELM327 buffer dolu' };
  if (/\?/i.test(trimmed) && trimmed.length < 5) return { ok: false, error: 'UNKNOWN_CMD', desc: 'Komut anlaşılmadı' };
  if (/STOPPED/i.test(trimmed)) return { ok: false, error: 'STOPPED', desc: 'Sorgu durduruldu' };
  if (/ERR/i.test(trimmed) && trimmed.length < 10) return { ok: false, error: 'ELM_ERROR', desc: 'ELM327 genel hata' };

  // AT command responses
  if (/^OK$/m.test(trimmed)) return { ok: true, type: 'at_ok' };
  if (/ELM327\s+v/i.test(trimmed)) {
    const m = trimmed.match(/ELM327\s+v([\d.]+)/i);
    return { ok: true, type: 'elm_version', version: m ? m[1] : 'unknown' };
  }

  // OBD-II Mode response: starts with 4X where X = mode+0x40
  const lines = trimmed.split('\n').map(l => l.replace(/[\s>]/g, '')).filter(Boolean);
  const hexLine = lines.find(l => /^[0-9A-Fa-f]+$/.test(l) && l.length >= 4);
  if (!hexLine) return { ok: true, type: 'raw', data: trimmed };

  const responseMode = parseInt(hexLine.slice(0, 2), 16);

  // Mode 41 = response to Mode 01 (current data)
  if (responseMode === 0x41) {
    const pid = hexLine.slice(2, 4).toUpperCase();
    const dataBytes = [];
    for (let i = 4; i < hexLine.length; i += 2) {
      dataBytes.push(parseInt(hexLine.slice(i, i + 2), 16));
    }
    const reg = PID_REGISTRY[pid];
    if (!reg) return { ok: true, type: 'pid', mode: '01', pid, raw: dataBytes, decoded: null };
    try {
      const value = reg.decode(...dataBytes);
      return { ok: true, type: 'pid', mode: '01', pid, name: reg.name, desc: reg.desc, unit: reg.unit, value, raw: dataBytes };
    } catch {
      return { ok: true, type: 'pid', mode: '01', pid, name: reg.name, raw: dataBytes, decoded: null, error: 'DECODE_FAIL' };
    }
  }

  // Mode 43 = response to Mode 03 (stored DTCs)
  if (responseMode === 0x43) {
    const dtcs = decodeDTCResponse(hexLine);
    return { ok: true, type: 'dtc', mode: '03', codes: dtcs, count: dtcs.length };
  }

  // Mode 47 = response to Mode 07 (pending DTCs)
  if (responseMode === 0x47) {
    const dtcs = decodeDTCResponse(hexLine.replace(/^47/, '43'));
    return { ok: true, type: 'dtc_pending', mode: '07', codes: dtcs, count: dtcs.length };
  }

  // Mode 49 = response to Mode 09 (vehicle info)
  if (responseMode === 0x49) {
    const infoPid = hexLine.slice(2, 4).toUpperCase();
    if (infoPid === '02') {
      // VIN
      const vinBytes = [];
      for (let i = 6; i < hexLine.length; i += 2) {
        vinBytes.push(parseInt(hexLine.slice(i, i + 2), 16));
      }
      const vin = vinBytes.filter(b => b >= 0x20 && b <= 0x7E).map(b => String.fromCharCode(b)).join('');
      return { ok: true, type: 'vin', mode: '09', vin };
    }
    if (infoPid === '0A') {
      // ECU name
      const nameBytes = [];
      for (let i = 6; i < hexLine.length; i += 2) {
        nameBytes.push(parseInt(hexLine.slice(i, i + 2), 16));
      }
      const ecuName = nameBytes.filter(b => b >= 0x20 && b <= 0x7E).map(b => String.fromCharCode(b)).join('').trim();
      return { ok: true, type: 'ecu_name', mode: '09', ecuName };
    }
    return { ok: true, type: 'vehicle_info', mode: '09', pid: infoPid, raw: hexLine };
  }

  return { ok: true, type: 'raw', data: trimmed };
}

// Build the OBD-II command string for a Mode 01 PID request
function buildPIDCommand(pid) {
  const p = String(pid).toUpperCase().replace(/^0X/, '');
  if (!/^[0-9A-F]{2}$/.test(p)) return null;
  return '01' + p;
}

// Parse supported-PIDs bitmap into an array of supported PID hex strings
function parseSupportedPIDs(bitmapValue, startPid = 0x01) {
  const supported = [];
  for (let bit = 31; bit >= 0; bit--) {
    if (bitmapValue & (1 << bit)) {
      const pid = (startPid + (31 - bit)).toString(16).toUpperCase().padStart(2, '0');
      supported.push(pid);
    }
  }
  return supported;
}


// ─── Live Session Manager ────────────────────────────────────────────
// Handles OBD data logging sessions stored in D1

async function createSession(env, meta = {}) {
  const sessionId = crypto.randomUUID();
  const ts = Date.now();
  await env.DB.prepare(
    `INSERT INTO obd_sessions(id, vehicle_info, protocol, status, started_at, created_at)
     VALUES(?, ?, ?, 'active', ?, ?)`
  ).bind(sessionId, JSON.stringify(meta.vehicle || {}), meta.protocol || 'auto', ts, ts).run();
  return sessionId;
}

async function addReading(env, sessionId, readings) {
  const ts = Date.now();
  const batch = Array.isArray(readings) ? readings : [readings];
  const stmts = batch.map(r =>
    env.DB.prepare(
      `INSERT INTO obd_readings(id, session_id, pid, name, value, unit, raw_hex, ts)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), sessionId, r.pid, r.name || '', JSON.stringify(r.value), r.unit || '', r.rawHex || '', ts)
  );
  if (stmts.length > 0) await env.DB.batch(stmts);
  return { stored: stmts.length, ts };
}

async function endSession(env, sessionId) {
  const ts = Date.now();
  await env.DB.prepare(
    `UPDATE obd_sessions SET status='completed', ended_at=?, updated_at=? WHERE id=?`
  ).bind(ts, ts, sessionId).run();
  return { ok: true, sessionId, endedAt: ts };
}

async function getSession(env, sessionId) {
  const session = await env.DB.prepare(
    'SELECT * FROM obd_sessions WHERE id=?'
  ).bind(sessionId).first();
  if (!session) return null;
  const readings = (await env.DB.prepare(
    'SELECT pid, name, value, unit, raw_hex rawHex, ts FROM obd_readings WHERE session_id=? ORDER BY ts DESC LIMIT 500'
  ).bind(sessionId).all()).results || [];
  return { ...session, vehicle_info: JSON.parse(session.vehicle_info || '{}'), readings };
}

async function listSessions(env, limit = 20) {
  return (await env.DB.prepare(
    'SELECT id, vehicle_info, protocol, status, started_at, ended_at FROM obd_sessions ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all()).results || [];
}


// ─── WebSocket Handler (Cloudflare Workers WebSocket API) ────────────
function handleWebSocketUpgrade(env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  let sessionId = null;
  let pingInterval = null;

  server.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'init': {
          // Client requests a new logging session
          sessionId = await createSession(env, {
            vehicle: msg.vehicle || {},
            protocol: msg.protocol || 'auto',
          });
          server.send(JSON.stringify({
            type: 'session_started',
            sessionId,
            initSequence: ELM327_INIT_SEQUENCE,
            pidGroups: PID_GROUPS,
          }));
          break;
        }

        case 'elm_response': {
          // Client relays raw ELM327 response for server-side decode
          const parsed = parseELM327Response(msg.raw);
          if (sessionId && parsed.ok && parsed.type === 'pid') {
            await addReading(env, sessionId, {
              pid: parsed.pid,
              name: parsed.name,
              value: parsed.value,
              unit: parsed.unit,
              rawHex: msg.raw,
            });
          }
          server.send(JSON.stringify({ type: 'decoded', requestId: msg.requestId, ...parsed }));
          break;
        }

        case 'batch_response': {
          // Client sends multiple ELM327 responses at once
          const results = (msg.responses || []).map(r => parseELM327Response(r.raw));
          const pidResults = results.filter(r => r.ok && r.type === 'pid');
          if (sessionId && pidResults.length > 0) {
            await addReading(env, sessionId, pidResults.map(r => ({
              pid: r.pid, name: r.name, value: r.value, unit: r.unit, rawHex: '',
            })));
          }
          server.send(JSON.stringify({ type: 'batch_decoded', requestId: msg.requestId, results }));
          break;
        }

        case 'dtc_response': {
          // Client sends Mode 03 / 07 DTC response
          const parsed = parseELM327Response(msg.raw);
          server.send(JSON.stringify({ type: 'dtc_decoded', requestId: msg.requestId, ...parsed }));
          break;
        }

        case 'request_pids': {
          // Client asks which PIDs to poll
          const group = msg.group || 'essential';
          const pids = PID_GROUPS[group] || PID_GROUPS.essential;
          const commands = pids.map(pid => ({
            pid,
            command: buildPIDCommand(pid),
            name: PID_REGISTRY[pid]?.name || pid,
            desc: PID_REGISTRY[pid]?.desc || '',
          }));
          server.send(JSON.stringify({ type: 'pid_commands', group, commands }));
          break;
        }

        case 'end_session': {
          if (sessionId) {
            await endSession(env, sessionId);
            server.send(JSON.stringify({ type: 'session_ended', sessionId }));
            sessionId = null;
          }
          break;
        }

        case 'ping': {
          server.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          break;
        }

        default:
          server.send(JSON.stringify({ type: 'error', error: 'UNKNOWN_TYPE', message: `Bilinmeyen mesaj tipi: ${msg.type}` }));
      }
    } catch (e) {
      server.send(JSON.stringify({ type: 'error', error: 'PARSE_ERROR', message: e.message }));
    }
  });

  server.addEventListener('close', async () => {
    if (pingInterval) clearInterval(pingInterval);
    if (sessionId) {
      try { await endSession(env, sessionId); } catch {}
    }
  });

  server.addEventListener('error', () => {
    if (pingInterval) clearInterval(pingInterval);
  });

  return new Response(null, { status: 101, webSocket: client });
}


// ─── REST API Handlers ──────────────────────────────────────────────

// POST /api/obd/decode — decode a single ELM327 response
function handleDecode(raw) {
  return parseELM327Response(raw);
}

// POST /api/obd/decode-batch — decode multiple responses
function handleDecodeBatch(responses) {
  return (responses || []).map(r => ({
    input: r,
    ...parseELM327Response(r),
  }));
}

// GET /api/obd/pids — list all supported PIDs with metadata
function handleListPIDs() {
  return Object.entries(PID_REGISTRY).map(([pid, reg]) => ({
    pid,
    command: '01' + pid,
    name: reg.name,
    desc: reg.desc,
    unit: reg.unit,
    bytes: reg.bytes,
    ...(reg.min !== undefined ? { min: reg.min, max: reg.max } : {}),
  }));
}

// GET /api/obd/pid-groups — list PID groups for dashboards
function handleListPIDGroups() {
  return Object.entries(PID_GROUPS).map(([group, pids]) => ({
    group,
    pids: pids.map(pid => ({
      pid,
      command: '01' + pid,
      name: PID_REGISTRY[pid]?.name || pid,
      desc: PID_REGISTRY[pid]?.desc || '',
      unit: PID_REGISTRY[pid]?.unit || '',
    })),
  }));
}

// POST /api/obd/dtc/decode — decode DTC hex pairs
function handleDTCDecode(hexPairs) {
  if (typeof hexPairs === 'string') return decodeDTCResponse(hexPairs);
  return (hexPairs || []).map(h => decodeDTC(h)).filter(Boolean);
}

// GET /api/obd/protocols — list ELM327 protocols
function handleListProtocols() {
  return Object.entries(ELM327_PROTOCOLS).map(([id, name]) => ({ id, name }));
}

// GET /api/obd/init-sequence — return ELM327 init command sequence
function handleInitSequence() {
  return { commands: ELM327_INIT_SEQUENCE, pidGroups: PID_GROUPS };
}


// ─── Main Router ─────────────────────────────────────────────────────
export async function obdBridgeRouter(request, env, p, m) {

  // WebSocket upgrade: GET /api/obd/live
  if (p === '/api/obd/live' && request.headers.get('Upgrade') === 'websocket') {
    return handleWebSocketUpgrade(env);
  }

  const j = (data, status = 200) =>
    new Response(JSON.stringify({ ok: true, ...data }), {
      status, headers: { 'content-type': 'application/json' },
    });
  const err = (error, status = 400) =>
    new Response(JSON.stringify({ ok: false, error }), {
      status, headers: { 'content-type': 'application/json' },
    });

  // REST endpoints
  if (p === '/api/obd/decode' && m === 'POST') {
    try {
      const body = await request.json();
      return j({ result: handleDecode(body.raw || body.data || '') });
    } catch (e) { return err(e.message); }
  }

  if (p === '/api/obd/decode-batch' && m === 'POST') {
    try {
      const body = await request.json();
      return j({ results: handleDecodeBatch(body.responses || []) });
    } catch (e) { return err(e.message); }
  }

  if (p === '/api/obd/pids' && m === 'GET') {
    return j({ pids: handleListPIDs(), count: Object.keys(PID_REGISTRY).length });
  }

  if (p === '/api/obd/pid-groups' && m === 'GET') {
    return j({ groups: handleListPIDGroups() });
  }

  if (p === '/api/obd/dtc/decode' && m === 'POST') {
    try {
      const body = await request.json();
      return j({ codes: handleDTCDecode(body.raw || body.codes || []) });
    } catch (e) { return err(e.message); }
  }

  if (p === '/api/obd/protocols' && m === 'GET') {
    return j({ protocols: handleListProtocols() });
  }

  if (p === '/api/obd/init-sequence' && m === 'GET') {
    return j(handleInitSequence());
  }

  // Session management
  if (p === '/api/obd/sessions' && m === 'GET') {
    try {
      const sessions = await listSessions(env);
      return j({ sessions });
    } catch (e) { return err(e.message, 500); }
  }

  if (p === '/api/obd/sessions' && m === 'POST') {
    try {
      const body = await request.json();
      const sessionId = await createSession(env, body);
      return j({ sessionId }, 201);
    } catch (e) { return err(e.message, 500); }
  }

  if (p.startsWith('/api/obd/sessions/') && m === 'GET') {
    try {
      const sessionId = p.split('/api/obd/sessions/')[1].split('/')[0];
      if (p.endsWith('/end')) {
        const result = await endSession(env, sessionId);
        return j(result);
      }
      const session = await getSession(env, sessionId);
      if (!session) return err('SESSION_NOT_FOUND', 404);
      return j({ session });
    } catch (e) { return err(e.message, 500); }
  }

  if (p.startsWith('/api/obd/sessions/') && p.endsWith('/readings') && m === 'POST') {
    try {
      const sessionId = p.split('/api/obd/sessions/')[1].split('/')[0];
      const body = await request.json();
      const result = await addReading(env, sessionId, body.readings || body);
      return j(result, 201);
    } catch (e) { return err(e.message, 500); }
  }

  if (p.startsWith('/api/obd/sessions/') && p.endsWith('/end') && m === 'POST') {
    try {
      const sessionId = p.split('/api/obd/sessions/')[1].split('/')[0];
      const result = await endSession(env, sessionId);
      return j(result);
    } catch (e) { return err(e.message, 500); }
  }

  return null; // not handled — fall through
}


// ─── Exports ─────────────────────────────────────────────────────────
export {
  PID_REGISTRY,
  PID_GROUPS,
  ELM327_PROTOCOLS,
  ELM327_INIT_SEQUENCE,
  OBD_STANDARDS,
  FUEL_TYPES,
  DTC_CATEGORIES,
  parseELM327Response,
  buildPIDCommand,
  parseSupportedPIDs,
  decodeDTC,
  decodeDTCResponse,
  handleDecode,
  handleDecodeBatch,
  handleListPIDs,
  handleListPIDGroups,
  handleDTCDecode,
  handleListProtocols,
  handleInitSequence,
  createSession,
  addReading,
  endSession,
  getSession,
  listSessions,
};
