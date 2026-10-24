// ECU Live Data Module — PID definitions, unit conversions, data logging, alarms
// OBD-II Mode 01 + Mode 22 extended PIDs

import { q1, qall, run } from './d1.js';
import { id as genId, now } from './core.js';

// ─── OBD-II Standard PIDs (Mode 01) ──────────────────────────────────────

export const STANDARD_PIDS = {
  // Engine
  '010C': { name: 'Engine RPM', shortName: 'RPM', units: 'rpm', min: 0, max: 8000, formula: (a, b) => ((a * 256) + b) / 4, bytes: 2, category: 'engine' },
  '010D': { name: 'Vehicle Speed', shortName: 'Speed', units: 'km/h', min: 0, max: 300, formula: (a) => a, bytes: 1, category: 'engine' },
  '0105': { name: 'Coolant Temperature', shortName: 'CLT', units: '°C', min: -40, max: 215, formula: (a) => a - 40, bytes: 1, category: 'engine' },
  '010F': { name: 'Intake Air Temperature', shortName: 'IAT', units: '°C', min: -40, max: 215, formula: (a) => a - 40, bytes: 1, category: 'engine' },
  '0104': { name: 'Calculated Engine Load', shortName: 'Load', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'engine' },
  '0111': { name: 'Throttle Position', shortName: 'TPS', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'engine' },
  '010E': { name: 'Timing Advance', shortName: 'Timing', units: '°BTDC', min: -64, max: 63.5, formula: (a) => a / 2 - 64, bytes: 1, category: 'engine' },
  '010B': { name: 'Intake MAP', shortName: 'MAP', units: 'kPa', min: 0, max: 255, formula: (a) => a, bytes: 1, category: 'engine' },
  '0110': { name: 'MAF Flow Rate', shortName: 'MAF', units: 'g/s', min: 0, max: 655.35, formula: (a, b) => ((a * 256) + b) / 100, bytes: 2, category: 'engine' },
  '011F': { name: 'Runtime Since Start', shortName: 'RunTime', units: 's', min: 0, max: 65535, formula: (a, b) => a * 256 + b, bytes: 2, category: 'engine' },
  '0133': { name: 'Barometric Pressure', shortName: 'Baro', units: 'kPa', min: 0, max: 255, formula: (a) => a, bytes: 1, category: 'engine' },

  // Fuel System
  '0106': { name: 'Short Term Fuel Trim B1', shortName: 'STFT1', units: '%', min: -100, max: 99.2, formula: (a) => (a / 1.28) - 100, bytes: 1, category: 'fuel' },
  '0107': { name: 'Long Term Fuel Trim B1', shortName: 'LTFT1', units: '%', min: -100, max: 99.2, formula: (a) => (a / 1.28) - 100, bytes: 1, category: 'fuel' },
  '0108': { name: 'Short Term Fuel Trim B2', shortName: 'STFT2', units: '%', min: -100, max: 99.2, formula: (a) => (a / 1.28) - 100, bytes: 1, category: 'fuel' },
  '0109': { name: 'Long Term Fuel Trim B2', shortName: 'LTFT2', units: '%', min: -100, max: 99.2, formula: (a) => (a / 1.28) - 100, bytes: 1, category: 'fuel' },
  '010A': { name: 'Fuel Pressure', shortName: 'FP', units: 'kPa', min: 0, max: 765, formula: (a) => a * 3, bytes: 1, category: 'fuel' },
  '012F': { name: 'Fuel Tank Level', shortName: 'Fuel%', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'fuel' },
  '0103': { name: 'Fuel System Status', shortName: 'FuelSys', units: '', min: 0, max: 255, formula: (a) => a, bytes: 1, category: 'fuel' },
  '0134': { name: 'O2 Sensor B1S1 Lambda', shortName: 'O2_1_1', units: 'λ', min: 0, max: 2, formula: (a, b) => ((a * 256) + b) / 32768, bytes: 4, category: 'fuel' },
  '013C': { name: 'Catalyst Temp B1S1', shortName: 'CatT1', units: '°C', min: -40, max: 6513.5, formula: (a, b) => ((a * 256) + b) / 10 - 40, bytes: 2, category: 'fuel' },
  '0144': { name: 'Commanded Equivalence Ratio', shortName: 'CmdEqR', units: 'λ', min: 0, max: 2, formula: (a, b) => ((a * 256) + b) / 32768, bytes: 2, category: 'fuel' },
  '0151': { name: 'Fuel Type', shortName: 'FuelType', units: '', min: 0, max: 255, formula: (a) => a, bytes: 1, category: 'fuel' },

  // Diesel-specific
  '0159': { name: 'Absolute Fuel Rail Pressure', shortName: 'FRP', units: 'kPa', min: 0, max: 655350, formula: (a, b) => ((a * 256) + b) * 10, bytes: 2, category: 'diesel' },
  '015E': { name: 'Fuel Rate', shortName: 'FuelRate', units: 'L/h', min: 0, max: 3276.75, formula: (a, b) => ((a * 256) + b) * 0.05, bytes: 2, category: 'diesel' },
  '0161': { name: 'Driver Demand Torque', shortName: 'DemTq', units: '%', min: -125, max: 130, formula: (a) => a - 125, bytes: 1, category: 'diesel' },
  '0162': { name: 'Actual Engine Torque', shortName: 'ActTq', units: '%', min: -125, max: 130, formula: (a) => a - 125, bytes: 1, category: 'diesel' },
  '0163': { name: 'Reference Torque', shortName: 'RefTq', units: 'Nm', min: 0, max: 65535, formula: (a, b) => a * 256 + b, bytes: 2, category: 'diesel' },
  '014F': { name: 'Max MAF', shortName: 'MaxMAF', units: 'g/s', min: 0, max: 2550, formula: (a) => a * 10, bytes: 1, category: 'diesel' },

  // EGR / Exhaust
  '012C': { name: 'Commanded EGR', shortName: 'CmdEGR', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'emissions' },
  '012D': { name: 'EGR Error', shortName: 'EGRerr', units: '%', min: -100, max: 99.2, formula: (a) => (a / 1.28) - 100, bytes: 1, category: 'emissions' },
  '012E': { name: 'Commanded Evaporative Purge', shortName: 'EVAP', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'emissions' },

  // Boost / Turbo
  '0170': { name: 'Boost Pressure Control', shortName: 'BoostCtl', units: 'kPa', min: 0, max: 6553.5, formula: (a, b) => ((a * 256) + b) * 0.1, bytes: 2, category: 'turbo' },
  '0171': { name: 'VGT Control', shortName: 'VGT', units: '%', min: 0, max: 100, formula: (a, b) => ((a * 256) + b) / 655.35, bytes: 2, category: 'turbo' },
  '0173': { name: 'Exhaust Pressure', shortName: 'ExhP', units: 'kPa', min: 0, max: 6553.5, formula: (a, b) => ((a * 256) + b) * 0.1, bytes: 2, category: 'turbo' },
  '016C': { name: 'Commanded Throttle Actuator', shortName: 'CmdThrt', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'turbo' },

  // DPF
  '017C': { name: 'DPF Temperature', shortName: 'DPF_T', units: '°C', min: -40, max: 6513.5, formula: (a, b) => ((a * 256) + b) / 10 - 40, bytes: 2, category: 'dpf' },
  '017E': { name: 'DPF Differential Pressure', shortName: 'DPF_dP', units: 'kPa', min: -327.68, max: 327.67, formula: (a, b) => ((a * 256) + b) * 0.01 - 327.68, bytes: 2, category: 'dpf' },
  '017F': { name: 'DPF Soot Load', shortName: 'DPF_Soot', units: 'g', min: 0, max: 65535, formula: (a, b) => a * 256 + b, bytes: 2, category: 'dpf' },

  // Battery / Electrical
  '0142': { name: 'Control Module Voltage', shortName: 'BatV', units: 'V', min: 0, max: 65.535, formula: (a, b) => ((a * 256) + b) / 1000, bytes: 2, category: 'electrical' },
  '015B': { name: 'Battery Pack Remaining', shortName: 'BatPack%', units: '%', min: 0, max: 100, formula: (a) => a / 2.55, bytes: 1, category: 'electrical' },

  // Transmission
  '01A4': { name: 'Transmission Actual Gear', shortName: 'Gear', units: '', min: 0, max: 255, formula: (a) => a, bytes: 1, category: 'transmission' },
  '01A6': { name: 'Odometer', shortName: 'ODO', units: 'km', min: 0, max: 429496729.5, formula: (a, b, c, d) => ((a * 16777216) + (b * 65536) + (c * 256) + d) / 10, bytes: 4, category: 'transmission' },
};

// ─── Unit Conversion ──────────────────────────────────────────────────────

const CONVERSIONS = {
  '°C': { '°F': v => v * 9 / 5 + 32, 'K': v => v + 273.15 },
  'km/h': { 'mph': v => v * 0.621371 },
  'kPa': { 'psi': v => v * 0.145038, 'bar': v => v / 100, 'mbar': v => v * 10, 'atm': v => v / 101.325 },
  'bar': { 'psi': v => v * 14.5038, 'kPa': v => v * 100, 'mbar': v => v * 1000 },
  'g/s': { 'kg/h': v => v * 3.6, 'lb/min': v => v * 0.132277 },
  'L/h': { 'gal/h': v => v * 0.264172 },
  'Nm': { 'ft-lb': v => v * 0.737562, 'kgm': v => v * 0.101972 },
  'rpm': { 'rad/s': v => v * Math.PI / 30 },
  'km': { 'miles': v => v * 0.621371 },
  'V': { 'mV': v => v * 1000 },
};

export function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const conv = CONVERSIONS[fromUnit];
  if (!conv || !conv[toUnit]) return null;
  return conv[toUnit](value);
}

export function listConversions(unit) {
  return CONVERSIONS[unit] ? Object.keys(CONVERSIONS[unit]) : [];
}

// ─── PID Lookup ───────────────────────────────────────────────────────────

export function getPID(pidCode) {
  return STANDARD_PIDS[pidCode.toUpperCase()] || null;
}

export function searchPIDs(query) {
  const q = query.toLowerCase();
  return Object.entries(STANDARD_PIDS)
    .filter(([code, pid]) =>
      pid.name.toLowerCase().includes(q) ||
      pid.shortName.toLowerCase().includes(q) ||
      pid.category.toLowerCase().includes(q) ||
      code.toLowerCase().includes(q)
    )
    .map(([code, pid]) => ({ code, ...pid }));
}

export function getPIDsByCategory(category) {
  return Object.entries(STANDARD_PIDS)
    .filter(([_, pid]) => pid.category === category)
    .map(([code, pid]) => ({ code, ...pid }));
}

export function listPIDCategories() {
  const cats = {};
  for (const [code, pid] of Object.entries(STANDARD_PIDS)) {
    if (!cats[pid.category]) cats[pid.category] = 0;
    cats[pid.category]++;
  }
  return Object.entries(cats).map(([category, count]) => ({ category, count }));
}

// ─── Gauge Configurations ─────────────────────────────────────────────────

export const GAUGE_CONFIGS = {
  RPM: { type: 'radial', zones: [{ from: 0, to: 3000, color: '#4CAF50' }, { from: 3000, to: 5000, color: '#FFC107' }, { from: 5000, to: 6500, color: '#FF9800' }, { from: 6500, to: 8000, color: '#F44336' }], majorTicks: 1000, minorTicks: 500 },
  Speed: { type: 'radial', zones: [{ from: 0, to: 120, color: '#4CAF50' }, { from: 120, to: 200, color: '#FFC107' }, { from: 200, to: 300, color: '#F44336' }], majorTicks: 20, minorTicks: 10 },
  CLT: { type: 'linear', zones: [{ from: -40, to: 60, color: '#2196F3' }, { from: 60, to: 100, color: '#4CAF50' }, { from: 100, to: 120, color: '#FFC107' }, { from: 120, to: 215, color: '#F44336' }], majorTicks: 20, minorTicks: 10 },
  Load: { type: 'bar', zones: [{ from: 0, to: 70, color: '#4CAF50' }, { from: 70, to: 90, color: '#FFC107' }, { from: 90, to: 100, color: '#F44336' }], majorTicks: 10, minorTicks: 5 },
  TPS: { type: 'bar', zones: [{ from: 0, to: 100, color: '#2196F3' }], majorTicks: 10, minorTicks: 5 },
  BatV: { type: 'linear', zones: [{ from: 0, to: 11.5, color: '#F44336' }, { from: 11.5, to: 12.8, color: '#FFC107' }, { from: 12.8, to: 14.8, color: '#4CAF50' }, { from: 14.8, to: 16, color: '#F44336' }], majorTicks: 1, minorTicks: 0.5 },
  STFT1: { type: 'linear', zones: [{ from: -25, to: -10, color: '#FF9800' }, { from: -10, to: 10, color: '#4CAF50' }, { from: 10, to: 25, color: '#FF9800' }], majorTicks: 5, minorTicks: 1 },
  FRP: { type: 'radial', zones: [{ from: 0, to: 1000, color: '#4CAF50' }, { from: 1000, to: 1800, color: '#FFC107' }, { from: 1800, to: 2200, color: '#F44336' }], majorTicks: 200, minorTicks: 100 },
  BoostCtl: { type: 'radial', zones: [{ from: 0, to: 1500, color: '#4CAF50' }, { from: 1500, to: 2500, color: '#FFC107' }, { from: 2500, to: 3500, color: '#F44336' }], majorTicks: 500, minorTicks: 100 },
  DPF_T: { type: 'linear', zones: [{ from: 0, to: 400, color: '#4CAF50' }, { from: 400, to: 600, color: '#FFC107' }, { from: 600, to: 800, color: '#F44336' }], majorTicks: 100, minorTicks: 50 },
};

export function getGaugeConfig(shortName) {
  return GAUGE_CONFIGS[shortName] || null;
}

// ─── Data Logging ─────────────────────────────────────────────────────────

const LOG_DDL = `
CREATE TABLE IF NOT EXISTS ecu_data_logs (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  session_id TEXT,
  name TEXT,
  description TEXT,
  pid_list TEXT DEFAULT '[]',
  sample_rate_ms INTEGER DEFAULT 100,
  duration_ms INTEGER,
  data_points TEXT DEFAULT '[]',
  stats TEXT DEFAULT '{}',
  status TEXT DEFAULT 'recording',
  created_at INTEGER,
  ended_at INTEGER
)`;

export async function ensureLogTables(env) {
  try { await run(env, LOG_DDL); return true; } catch { return false; }
}

export async function startLog(env, data) {
  await ensureLogTables(env);
  const log = {
    id: genId(),
    upload_id: data.upload_id || null,
    session_id: data.session_id || null,
    name: data.name || `Log ${new Date().toISOString()}`,
    description: data.description || '',
    pid_list: JSON.stringify(data.pids || []),
    sample_rate_ms: data.sample_rate_ms || 100,
    duration_ms: null,
    data_points: '[]',
    stats: '{}',
    status: 'recording',
    created_at: now(),
    ended_at: null,
  };
  await run(env,
    `INSERT INTO ecu_data_logs (id,upload_id,session_id,name,description,pid_list,sample_rate_ms,duration_ms,data_points,stats,status,created_at,ended_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    log.id, log.upload_id, log.session_id, log.name, log.description,
    log.pid_list, log.sample_rate_ms, log.duration_ms, log.data_points,
    log.stats, log.status, log.created_at, log.ended_at
  );
  return parseLog(log);
}

export async function appendLogData(env, logId, dataPoints) {
  const row = await q1(env, 'SELECT data_points FROM ecu_data_logs WHERE id=?', logId);
  if (!row) return null;
  const existing = JSON.parse(row.data_points || '[]');
  const pts = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
  existing.push(...pts);
  await run(env, 'UPDATE ecu_data_logs SET data_points=? WHERE id=?', JSON.stringify(existing), logId);
  return true;
}

export async function endLog(env, logId) {
  const row = await q1(env, 'SELECT * FROM ecu_data_logs WHERE id=?', logId);
  if (!row) return null;
  const endedAt = now();
  const duration = endedAt - row.created_at;
  const points = JSON.parse(row.data_points || '[]');
  const pids = JSON.parse(row.pid_list || '[]');

  // compute stats per PID
  const stats = {};
  for (const pid of pids) {
    const vals = points.map(p => p[pid]).filter(v => v !== undefined && v !== null);
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    stats[pid] = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(sum / sorted.length * 100) / 100,
      samples: sorted.length,
    };
  }

  await run(env,
    'UPDATE ecu_data_logs SET status=?, ended_at=?, duration_ms=?, stats=? WHERE id=?',
    'completed', endedAt, duration, JSON.stringify(stats), logId
  );
  return { ...parseLog(row), status: 'completed', ended_at: endedAt, duration_ms: duration, stats };
}

export async function getLog(env, logId) {
  await ensureLogTables(env);
  const row = await q1(env, 'SELECT * FROM ecu_data_logs WHERE id=?', logId);
  return row ? parseLog(row) : null;
}

export async function listLogs(env, opts = {}) {
  await ensureLogTables(env);
  const { session_id, upload_id, status, limit = 50 } = opts;
  let sql = 'SELECT id,upload_id,session_id,name,description,pid_list,sample_rate_ms,duration_ms,stats,status,created_at,ended_at FROM ecu_data_logs';
  const conds = [], params = [];
  if (session_id) { conds.push('session_id=?'); params.push(session_id); }
  if (upload_id) { conds.push('upload_id=?'); params.push(upload_id); }
  if (status) { conds.push('status=?'); params.push(status); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  const rows = await qall(env, sql, ...params);
  return rows.map(r => ({
    ...r,
    pid_list: JSON.parse(r.pid_list || '[]'),
    stats: JSON.parse(r.stats || '{}'),
  }));
}

export async function deleteLog(env, logId) {
  await ensureLogTables(env);
  await run(env, 'DELETE FROM ecu_data_logs WHERE id=?', logId);
  return true;
}

// ─── Alarm Thresholds ─────────────────────────────────────────────────────

export const DEFAULT_ALARMS = {
  '010C': { high: 6500, critical: 7200, label: 'RPM Too High' },
  '0105': { high: 105, critical: 115, label: 'Coolant Overheat' },
  '010F': { high: 60, critical: 80, label: 'Intake Air Too Hot' },
  '0142': { low: 11.0, critical_low: 10.5, label: 'Battery Voltage Low' },
  '0159': { high: 2000, critical: 2200, label: 'Rail Pressure High' },
  '017C': { high: 650, critical: 800, label: 'DPF Temperature High' },
  '0106': { high: 20, low: -20, label: 'STFT Out of Range' },
  '0107': { high: 15, low: -15, label: 'LTFT Out of Range' },
  '0170': { high: 2800, critical: 3200, label: 'Boost Pressure High' },
  '0173': { high: 300, critical: 400, label: 'Exhaust Pressure High' },
};

export function checkAlarms(pidCode, value) {
  const alarm = DEFAULT_ALARMS[pidCode];
  if (!alarm) return { status: 'ok' };
  if (alarm.critical !== undefined && value >= alarm.critical) return { status: 'critical', label: alarm.label, value, threshold: alarm.critical };
  if (alarm.critical_low !== undefined && value <= alarm.critical_low) return { status: 'critical', label: alarm.label, value, threshold: alarm.critical_low };
  if (alarm.high !== undefined && value >= alarm.high) return { status: 'warning', label: alarm.label, value, threshold: alarm.high };
  if (alarm.low !== undefined && value <= alarm.low) return { status: 'warning', label: alarm.label, value, threshold: alarm.low };
  return { status: 'ok' };
}

export function getAlarmConfig(pidCode) {
  return DEFAULT_ALARMS[pidCode] || null;
}

export function listAlarms() {
  return Object.entries(DEFAULT_ALARMS).map(([code, alarm]) => {
    const pid = STANDARD_PIDS[code];
    return { code, pidName: pid?.name || code, ...alarm };
  });
}

// ─── Dashboard Layouts ────────────────────────────────────────────────────

export const DASHBOARD_PRESETS = {
  basic: {
    name: 'Basic',
    description: 'Essential engine gauges',
    pids: ['010C', '010D', '0105', '0104', '0111', '0142'],
    layout: '3x2',
  },
  diesel: {
    name: 'Diesel Tuning',
    description: 'Diesel-specific monitoring',
    pids: ['010C', '010D', '0105', '0159', '0170', '017C', '012C', '015E', '0162'],
    layout: '3x3',
  },
  gasoline: {
    name: 'Gasoline Tuning',
    description: 'Gasoline performance monitoring',
    pids: ['010C', '010D', '0105', '0110', '010E', '0106', '0107', '0111', '0134'],
    layout: '3x3',
  },
  dpf: {
    name: 'DPF Monitor',
    description: 'DPF regeneration tracking',
    pids: ['017C', '017E', '017F', '0105', '010C', '015E'],
    layout: '3x2',
  },
  emissions: {
    name: 'Emissions',
    description: 'Emissions-related data',
    pids: ['012C', '012D', '012E', '0134', '013C', '0144'],
    layout: '3x2',
  },
  fuel_economy: {
    name: 'Fuel Economy',
    description: 'Fuel consumption tracking',
    pids: ['010D', '010C', '0104', '015E', '012F', '0110'],
    layout: '3x2',
  },
};

export function getDashboardPreset(presetName) {
  return DASHBOARD_PRESETS[presetName] || null;
}

export function listDashboardPresets() {
  return Object.entries(DASHBOARD_PRESETS).map(([key, preset]) => ({
    key, name: preset.name, description: preset.description, pidCount: preset.pids.length,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseLog(row) {
  return {
    ...row,
    pid_list: JSON.parse(typeof row.pid_list === 'string' ? row.pid_list : '[]'),
    data_points: JSON.parse(typeof row.data_points === 'string' ? row.data_points : '[]'),
    stats: JSON.parse(typeof row.stats === 'string' ? row.stats : '{}'),
  };
}
