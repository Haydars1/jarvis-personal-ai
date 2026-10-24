// ECU Data Logger — Session recording, PID polling, CSV/JSON export
// Integrates with ecu-live-data.js PIDs and D1 storage

// ─── Log Profile Presets ────────────────────────────────────────────────

const LOG_PROFILES = {
  'basic-obd2': {
    name: 'Basic OBD2',
    pids: ['010C','010D','0105','010F','0104','0111'],
    pidNames: ['RPM','Speed','Coolant Temp','Intake Temp','Engine Load','Throttle'],
    sampleRate_hz: 10,
    application: 'General OBD2 diagnostics'
  },
  'fuel-tuning': {
    name: 'Fuel Tuning',
    pids: ['010C','0104','0106','0107','0114','0134','012F'],
    pidNames: ['RPM','Engine Load','Short Fuel Trim B1','Long Fuel Trim B1','O2 B1S1','O2 Wideband B1S1','Fuel Level'],
    sampleRate_hz: 20,
    application: 'Fuel map tuning and AFR monitoring'
  },
  'boost-monitoring': {
    name: 'Boost Monitoring',
    pids: ['010C','010B','010F','0104','0111','0133','0170'],
    pidNames: ['RPM','Intake MAP','Intake Temp','Engine Load','Throttle','Barometric','Boost Pressure'],
    sampleRate_hz: 20,
    application: 'Turbo/supercharged boost monitoring'
  },
  'emissions-check': {
    name: 'Emissions Check',
    pids: ['010C','0105','0114','0115','012C','0130','0144'],
    pidNames: ['RPM','Coolant Temp','O2 B1S1','O2 B1S2','EGR Command','Warmup Count','O2 Lambda B1S1'],
    sampleRate_hz: 5,
    application: 'Emissions readiness monitoring'
  },
  'performance-run': {
    name: 'Performance Run',
    pids: ['010C','010D','0104','0111','010B','0146','0170'],
    pidNames: ['RPM','Speed','Engine Load','Throttle','Intake MAP','Ambient Temp','Boost Pressure'],
    sampleRate_hz: 50,
    application: 'Acceleration run / dyno logging'
  },
  'knock-monitoring': {
    name: 'Knock Monitoring',
    pids: ['010C','010E','0104','0105','010B','0111'],
    pidNames: ['RPM','Timing Advance','Engine Load','Coolant Temp','Intake MAP','Throttle'],
    sampleRate_hz: 50,
    application: 'Knock detection and timing retard monitoring'
  },
  'idle-tuning': {
    name: 'Idle Tuning',
    pids: ['010C','0104','0106','0107','0105','010F','0111'],
    pidNames: ['RPM','Engine Load','Short Fuel Trim B1','Long Fuel Trim B1','Coolant Temp','Intake Temp','Throttle'],
    sampleRate_hz: 10,
    application: 'Idle quality and fuel trim analysis'
  },
  'transmission': {
    name: 'Transmission',
    pids: ['010C','010D','0104','010A','01A6','01A4'],
    pidNames: ['RPM','Speed','Engine Load','Fuel Pressure','Oil Temp','Trans Temp'],
    sampleRate_hz: 10,
    application: 'Transmission shift analysis'
  },
};


// ─── Trigger Types ──────────────────────────────────────────────────────

const TRIGGER_TYPES = {
  manual: { name: 'Manual', description: 'Start/stop by user command' },
  rpm_threshold: { name: 'RPM Threshold', description: 'Start when RPM exceeds value', paramName: 'threshold_rpm' },
  speed_threshold: { name: 'Speed Threshold', description: 'Start when speed exceeds value', paramName: 'threshold_kph' },
  throttle_threshold: { name: 'Throttle Threshold', description: 'Start when throttle exceeds % value', paramName: 'threshold_pct' },
  boost_threshold: { name: 'Boost Threshold', description: 'Start when boost exceeds value', paramName: 'threshold_kpa' },
  timed: { name: 'Timed', description: 'Start after countdown', paramName: 'delay_seconds' },
};


// ─── Data Analysis Functions ────────────────────────────────────────────

export function analyzeLogData(rows, pidNames) {
  if (!rows || rows.length === 0) return { error: 'No data to analyze' };

  const columns = pidNames || Object.keys(rows[0]).filter(k => k !== 'timestamp' && k !== 'time_ms');
  const stats = {};

  for (const col of columns) {
    const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    if (values.length === 0) { stats[col] = { count: 0 }; continue; }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

    stats[col] = {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean * 100) / 100,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      p5: sorted[Math.floor(sorted.length * 0.05)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  return {
    totalSamples: rows.length,
    duration_s: rows.length > 1 ? Math.round((rows[rows.length - 1].time_ms - rows[0].time_ms) / 1000 * 10) / 10 : 0,
    columns: columns.length,
    stats,
  };
}


export function detectAnomalies(rows, pidNames, sensitivity = 2.0) {
  if (!rows || rows.length < 10) return { error: 'Need at least 10 samples for anomaly detection' };

  const columns = pidNames || Object.keys(rows[0]).filter(k => k !== 'timestamp' && k !== 'time_ms');
  const anomalies = [];

  for (const col of columns) {
    const values = rows.map((r, i) => ({ index: i, value: parseFloat(r[col]), time_ms: r.time_ms })).filter(v => !isNaN(v.value));
    if (values.length < 10) continue;

    const mean = values.reduce((s, v) => s + v.value, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + (v.value - mean) ** 2, 0) / values.length);
    if (stdDev === 0) continue;

    for (const v of values) {
      const zScore = Math.abs(v.value - mean) / stdDev;
      if (zScore > sensitivity) {
        anomalies.push({
          pid: col,
          index: v.index,
          time_ms: v.time_ms,
          value: v.value,
          mean: Math.round(mean * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          severity: zScore > sensitivity * 2 ? 'critical' : zScore > sensitivity * 1.5 ? 'warning' : 'info',
        });
      }
    }
  }

  anomalies.sort((a, b) => b.zScore - a.zScore);

  return {
    totalAnomalies: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warnings: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
    anomalies: anomalies.slice(0, 50),
  };
}


export function correlateChannels(rows, channelA, channelB) {
  if (!rows || rows.length < 5) return { error: 'Need at least 5 samples' };

  const pairs = rows
    .map(r => ({ a: parseFloat(r[channelA]), b: parseFloat(r[channelB]) }))
    .filter(p => !isNaN(p.a) && !isNaN(p.b));

  if (pairs.length < 5) return { error: 'Insufficient valid data pairs' };

  const meanA = pairs.reduce((s, p) => s + p.a, 0) / pairs.length;
  const meanB = pairs.reduce((s, p) => s + p.b, 0) / pairs.length;

  let sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (const p of pairs) {
    const dA = p.a - meanA, dB = p.b - meanB;
    sumAB += dA * dB;
    sumA2 += dA * dA;
    sumB2 += dB * dB;
  }

  const denominator = Math.sqrt(sumA2 * sumB2);
  const r = denominator === 0 ? 0 : sumAB / denominator;

  return {
    channelA,
    channelB,
    pearsonR: Math.round(r * 10000) / 10000,
    rSquared: Math.round(r * r * 10000) / 10000,
    samples: pairs.length,
    interpretation: Math.abs(r) > 0.9 ? 'Very strong correlation' :
                    Math.abs(r) > 0.7 ? 'Strong correlation' :
                    Math.abs(r) > 0.5 ? 'Moderate correlation' :
                    Math.abs(r) > 0.3 ? 'Weak correlation' : 'Very weak or no correlation',
    direction: r > 0 ? 'positive' : r < 0 ? 'negative' : 'none',
  };
}


// ─── Export Formatters ──────────────────────────────────────────────────

export function toCSV(rows, pidNames) {
  if (!rows || rows.length === 0) return '';

  const cols = pidNames || Object.keys(rows[0]);
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(c => r[c] ?? '').join(','));
  return [header, ...lines].join('\n');
}

export function toMegaLogViewer(rows, pidNames, metadata = {}) {
  // MegaLogViewer / MegaSquirt MSL format
  const cols = pidNames || Object.keys(rows[0]).filter(k => k !== 'timestamp');
  const lines = [];
  lines.push(`MSII REV 0.001 - ${metadata.vehicleName || 'DataLog'}`);
  lines.push(`Date: ${metadata.date || new Date().toISOString().split('T')[0]}`);
  lines.push(`Time: ${metadata.time || new Date().toISOString().split('T')[1].split('.')[0]}`);
  lines.push(`RT: ${metadata.sampleRate_hz || 10}`);
  lines.push('');
  lines.push(cols.join('\t'));

  for (const r of rows) {
    lines.push(cols.map(c => r[c] ?? 0).join('\t'));
  }

  return lines.join('\n');
}

export function toVCDS(rows, pidNames, metadata = {}) {
  // VCDS-style CSV (Ross-Tech format)
  const cols = pidNames || Object.keys(rows[0]).filter(k => k !== 'timestamp');
  const lines = [];
  lines.push(`VCDS -- Log File -- ${metadata.date || new Date().toISOString()}`);
  lines.push(`Vehicle: ${metadata.vehicleName || 'Unknown'}`);
  lines.push(`Platform: JARVIS ECU Logger`);
  lines.push('');
  lines.push(['Time(s)', ...cols].join(','));

  for (const r of rows) {
    const t = ((r.time_ms || 0) / 1000).toFixed(3);
    lines.push([t, ...cols.map(c => r[c] ?? '')].join(','));
  }

  return lines.join('\n');
}


// ─── Calculators ────────────────────────────────────────────────────────

export function calcSampleBudget(numPIDs, targetRate_hz, busSpeed = 'fast') {
  // CAN bus throughput estimation
  const bytesPerPID = 12; // typical OBD2 request + response
  const busRates = { slow: 10400, medium: 41600, fast: 500000, hscan: 500000 };
  const bitsPerSec = busRates[busSpeed] || 500000;
  const bytesPerSec = bitsPerSec / 10; // 8 data + start + stop bits
  const overhead = 0.7; // bus utilization factor

  const availableBandwidth = bytesPerSec * overhead;
  const bytesPerCycle = numPIDs * bytesPerPID;
  const maxRate_hz = Math.floor(availableBandwidth / bytesPerCycle);
  const achievable_hz = Math.min(targetRate_hz, maxRate_hz);

  return {
    numPIDs,
    targetRate_hz,
    busSpeed,
    busRateBits: bitsPerSec,
    bytesPerCycle,
    maxAchievableRate_hz: maxRate_hz,
    actualRate_hz: achievable_hz,
    limited: achievable_hz < targetRate_hz,
    dataRate_KB_s: Math.round(bytesPerCycle * achievable_hz / 1024 * 100) / 100,
    storagePerMinute_KB: Math.round(bytesPerCycle * achievable_hz * 60 / 1024),
    notes: [
      achievable_hz < targetRate_hz ? `Bus limited: max ${maxRate_hz} Hz with ${numPIDs} PIDs` : `Achievable at ${achievable_hz} Hz`,
      numPIDs > 8 ? 'Consider reducing PID count for higher sample rates' : null,
      busSpeed === 'slow' ? 'Slow bus (10.4 kbps) — very limited bandwidth' : null,
    ].filter(Boolean),
  };
}


// ─── D1 Tables ──────────────────────────────────────────────────────────

export async function ensureDatalogTables(env) {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS ecu_datalog_sessions(
    id TEXT PRIMARY KEY, vehicle_id TEXT, profile TEXT, trigger_type TEXT,
    sample_rate_hz INTEGER DEFAULT 10, status TEXT DEFAULT 'active',
    started_at TEXT DEFAULT(datetime('now')), ended_at TEXT,
    total_samples INTEGER DEFAULT 0, metadata TEXT
  )`);
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS ecu_datalog_samples(
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
    time_ms INTEGER NOT NULL, data TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES ecu_datalog_sessions(id)
  )`);
}


// ─── Session Management ─────────────────────────────────────────────────

export async function startDatalogSession(env, vehicleId, profile, triggerType, sampleRate_hz, metadata) {
  await ensureDatalogTables(env);
  const sessionId = crypto.randomUUID();
  const prof = LOG_PROFILES[profile] || null;

  await env.DB.prepare(
    `INSERT INTO ecu_datalog_sessions(id,vehicle_id,profile,trigger_type,sample_rate_hz,metadata) VALUES(?,?,?,?,?,?)`
  ).bind(sessionId, vehicleId || null, profile || 'custom', triggerType || 'manual', sampleRate_hz || (prof?.sampleRate_hz || 10), JSON.stringify(metadata || {})).run();

  return {
    sessionId,
    profile: prof ? prof.name : 'Custom',
    pids: prof ? prof.pids : [],
    pidNames: prof ? prof.pidNames : [],
    sampleRate_hz: sampleRate_hz || (prof?.sampleRate_hz || 10),
    triggerType: triggerType || 'manual',
    status: 'active',
  };
}

export async function appendDatalogSamples(env, sessionId, samples) {
  await ensureDatalogTables(env);

  const stmt = env.DB.prepare(`INSERT INTO ecu_datalog_samples(session_id,time_ms,data) VALUES(?,?,?)`);
  const batch = samples.map(s => stmt.bind(sessionId, s.time_ms, JSON.stringify(s.data)));
  await env.DB.batch(batch);

  await env.DB.prepare(`UPDATE ecu_datalog_sessions SET total_samples=total_samples+? WHERE id=?`).bind(samples.length, sessionId).run();

  return { appended: samples.length };
}

export async function endDatalogSession(env, sessionId) {
  await ensureDatalogTables(env);
  await env.DB.prepare(`UPDATE ecu_datalog_sessions SET status='completed',ended_at=datetime('now') WHERE id=?`).bind(sessionId).run();
  const session = await env.DB.prepare(`SELECT * FROM ecu_datalog_sessions WHERE id=?`).bind(sessionId).first();
  return session;
}

export async function getDatalogSession(env, sessionId) {
  await ensureDatalogTables(env);
  const session = await env.DB.prepare(`SELECT * FROM ecu_datalog_sessions WHERE id=?`).bind(sessionId).first();
  if (!session) return null;

  const samples = await env.DB.prepare(`SELECT time_ms,data FROM ecu_datalog_samples WHERE session_id=? ORDER BY time_ms`).bind(sessionId).all();
  const rows = (samples?.results || []).map(s => ({ time_ms: s.time_ms, ...JSON.parse(s.data) }));

  return { ...session, metadata: JSON.parse(session.metadata || '{}'), samples: rows };
}

export async function listDatalogSessions(env, limit = 50) {
  await ensureDatalogTables(env);
  const result = await env.DB.prepare(`SELECT id,vehicle_id,profile,trigger_type,sample_rate_hz,status,started_at,ended_at,total_samples FROM ecu_datalog_sessions ORDER BY started_at DESC LIMIT ?`).bind(limit).all();
  return result?.results || [];
}

export async function deleteDatalogSession(env, sessionId) {
  await ensureDatalogTables(env);
  await env.DB.prepare(`DELETE FROM ecu_datalog_samples WHERE session_id=?`).bind(sessionId).run();
  await env.DB.prepare(`DELETE FROM ecu_datalog_sessions WHERE id=?`).bind(sessionId).run();
  return { deleted: sessionId };
}

export async function exportDatalogSession(env, sessionId, format = 'csv') {
  const session = await getDatalogSession(env, sessionId);
  if (!session) return null;

  const prof = LOG_PROFILES[session.profile] || null;
  const pidNames = prof?.pidNames || Object.keys(session.samples[0] || {}).filter(k => k !== 'time_ms');
  const meta = { vehicleName: session.vehicle_id, date: session.started_at, sampleRate_hz: session.sample_rate_hz };

  let content, contentType, filename;

  switch (format) {
    case 'megalogviewer':
    case 'msl':
      content = toMegaLogViewer(session.samples, pidNames, meta);
      contentType = 'text/plain';
      filename = `datalog_${sessionId}.msl`;
      break;
    case 'vcds':
      content = toVCDS(session.samples, pidNames, meta);
      contentType = 'text/csv';
      filename = `datalog_${sessionId}_vcds.csv`;
      break;
    case 'json':
      content = JSON.stringify({ session: { id: session.id, profile: session.profile, started_at: session.started_at, ended_at: session.ended_at, total_samples: session.total_samples }, data: session.samples }, null, 2);
      contentType = 'application/json';
      filename = `datalog_${sessionId}.json`;
      break;
    default: // csv
      content = toCSV(session.samples, ['time_ms', ...pidNames]);
      contentType = 'text/csv';
      filename = `datalog_${sessionId}.csv`;
      break;
  }

  return { content, contentType, filename, samples: session.samples.length };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listLogProfiles() {
  return Object.entries(LOG_PROFILES).map(([key, p]) => ({ key, ...p }));
}

export function getLogProfile(key) {
  return LOG_PROFILES[key] || null;
}

export function listTriggerTypes() {
  return Object.entries(TRIGGER_TYPES).map(([key, t]) => ({ key, ...t }));
}

export function dataloggerStats() {
  return {
    profiles: Object.keys(LOG_PROFILES).length,
    triggerTypes: Object.keys(TRIGGER_TYPES).length,
    exportFormats: ['csv', 'json', 'megalogviewer', 'vcds'],
    calculations: ['analyzeLogData', 'detectAnomalies', 'correlateChannels', 'calcSampleBudget', 'toCSV', 'toMegaLogViewer', 'toVCDS'],
  };
}

export { LOG_PROFILES, TRIGGER_TYPES };
