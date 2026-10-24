// Tuning Maps Engine — 2D/3D calibration map editor
// Interpolation, smoothing, scaling, diff, copy/paste, percentage adjustments

import { q1, qall, run } from './d1.js';
import { id as genId, now } from './core.js';

// ─── Map Data Structures ──────────────────────────────────────────────────

/**
 * Map format:
 * {
 *   id, name, description, mapType ('2d'|'3d'),
 *   xAxis: { label, units, values: number[] },
 *   yAxis: { label, units, values: number[] },   // 3D only
 *   zValues: number[] (2d) | number[][] (3d),
 *   precision: number,
 *   units: string,
 *   category: string,     // fuel, ignition, boost, vvt, etc.
 *   address: number|null,
 *   size: number|null,
 * }
 */

// ─── Interpolation ────────────────────────────────────────────────────────

/**
 * Bilinear interpolation on a 3D map
 */
export function interpolate3D(map, x, y) {
  const xa = map.xAxis.values;
  const ya = map.yAxis.values;
  const z = map.zValues;

  // clamp to axis bounds
  const xc = Math.max(xa[0], Math.min(xa[xa.length - 1], x));
  const yc = Math.max(ya[0], Math.min(ya[ya.length - 1], y));

  // find surrounding indices
  let xi = 0;
  for (let i = 0; i < xa.length - 1; i++) { if (xa[i + 1] >= xc) { xi = i; break; } }
  let yi = 0;
  for (let i = 0; i < ya.length - 1; i++) { if (ya[i + 1] >= yc) { yi = i; break; } }

  const xi2 = Math.min(xi + 1, xa.length - 1);
  const yi2 = Math.min(yi + 1, ya.length - 1);

  // interpolation factors
  const xf = xa[xi2] !== xa[xi] ? (xc - xa[xi]) / (xa[xi2] - xa[xi]) : 0;
  const yf = ya[yi2] !== ya[yi] ? (yc - ya[yi]) / (ya[yi2] - ya[yi]) : 0;

  // bilinear
  const q11 = z[yi][xi];
  const q12 = z[yi][xi2];
  const q21 = z[yi2][xi];
  const q22 = z[yi2][xi2];

  const r1 = q11 * (1 - xf) + q12 * xf;
  const r2 = q21 * (1 - xf) + q22 * xf;
  return r1 * (1 - yf) + r2 * yf;
}

/**
 * Linear interpolation on a 2D map
 */
export function interpolate2D(map, x) {
  const xa = map.xAxis.values;
  const z = map.zValues;
  const xc = Math.max(xa[0], Math.min(xa[xa.length - 1], x));

  let xi = 0;
  for (let i = 0; i < xa.length - 1; i++) { if (xa[i + 1] >= xc) { xi = i; break; } }
  const xi2 = Math.min(xi + 1, xa.length - 1);
  const xf = xa[xi2] !== xa[xi] ? (xc - xa[xi]) / (xa[xi2] - xa[xi]) : 0;
  return z[xi] * (1 - xf) + z[xi2] * xf;
}

// ─── Smoothing ────────────────────────────────────────────────────────────

/**
 * Gaussian smooth a 2D map (1D array)
 */
export function smooth2D(values, passes = 1, weight = 0.5) {
  let arr = [...values];
  for (let p = 0; p < passes; p++) {
    const next = [...arr];
    for (let i = 1; i < arr.length - 1; i++) {
      next[i] = arr[i] * (1 - weight) + (arr[i - 1] + arr[i + 1]) / 2 * weight;
    }
    arr = next;
  }
  return arr;
}

/**
 * Gaussian smooth a 3D map (2D array)
 */
export function smooth3D(matrix, passes = 1, weight = 0.5) {
  let m = matrix.map(r => [...r]);
  const rows = m.length;
  const cols = m[0].length;

  for (let p = 0; p < passes; p++) {
    const next = m.map(r => [...r]);
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const neighbors = (m[r - 1][c] + m[r + 1][c] + m[r][c - 1] + m[r][c + 1]) / 4;
        next[r][c] = m[r][c] * (1 - weight) + neighbors * weight;
      }
    }
    m = next;
  }
  return m;
}

// ─── Map Operations ───────────────────────────────────────────────────────

/**
 * Scale map values by percentage
 */
export function scaleMap(map, percentage) {
  const factor = percentage / 100;
  if (map.mapType === '2d') {
    return { ...map, zValues: map.zValues.map(v => round(v * factor, map.precision)) };
  }
  return {
    ...map,
    zValues: map.zValues.map(row => row.map(v => round(v * factor, map.precision)))
  };
}

/**
 * Add constant offset to all values
 */
export function offsetMap(map, offset) {
  if (map.mapType === '2d') {
    return { ...map, zValues: map.zValues.map(v => round(v + offset, map.precision)) };
  }
  return {
    ...map,
    zValues: map.zValues.map(row => row.map(v => round(v + offset, map.precision)))
  };
}

/**
 * Fill a region with a constant value
 */
export function fillRegion(map, value, region = null) {
  if (!region) {
    if (map.mapType === '2d') {
      return { ...map, zValues: map.zValues.map(() => value) };
    }
    return { ...map, zValues: map.zValues.map(row => row.map(() => value)) };
  }

  const { xStart = 0, xEnd, yStart = 0, yEnd } = region;
  if (map.mapType === '2d') {
    const z = [...map.zValues];
    const xe = xEnd ?? z.length - 1;
    for (let i = xStart; i <= xe; i++) z[i] = value;
    return { ...map, zValues: z };
  }
  const z = map.zValues.map(r => [...r]);
  const ye = yEnd ?? z.length - 1;
  const xe = xEnd ?? z[0].length - 1;
  for (let r = yStart; r <= ye; r++) {
    for (let c = xStart; c <= xe; c++) z[r][c] = value;
  }
  return { ...map, zValues: z };
}

/**
 * Scale a region by percentage
 */
export function scaleRegion(map, percentage, region) {
  const factor = percentage / 100;
  const { xStart = 0, xEnd, yStart = 0, yEnd } = region;

  if (map.mapType === '2d') {
    const z = [...map.zValues];
    const xe = xEnd ?? z.length - 1;
    for (let i = xStart; i <= xe; i++) z[i] = round(z[i] * factor, map.precision);
    return { ...map, zValues: z };
  }
  const z = map.zValues.map(r => [...r]);
  const ye = yEnd ?? z.length - 1;
  const xe = xEnd ?? z[0].length - 1;
  for (let r = yStart; r <= ye; r++) {
    for (let c = xStart; c <= xe; c++) z[r][c] = round(z[r][c] * factor, map.precision);
  }
  return { ...map, zValues: z };
}

/**
 * Clamp all values between min and max
 */
export function clampMap(map, min, max) {
  const cl = v => Math.max(min, Math.min(max, v));
  if (map.mapType === '2d') {
    return { ...map, zValues: map.zValues.map(cl) };
  }
  return { ...map, zValues: map.zValues.map(row => row.map(cl)) };
}

// ─── Map Comparison / Diff ────────────────────────────────────────────────

/**
 * Compute diff between two maps (absolute and percentage)
 */
export function diffMaps(original, modified) {
  if (original.mapType !== modified.mapType) {
    throw new Error('Cannot diff maps of different types');
  }

  if (original.mapType === '2d') {
    const absDiff = modified.zValues.map((v, i) => round(v - original.zValues[i], 4));
    const pctDiff = modified.zValues.map((v, i) => {
      const o = original.zValues[i];
      return o !== 0 ? round((v - o) / o * 100, 2) : (v !== 0 ? Infinity : 0);
    });
    return {
      mapType: '2d',
      xAxis: original.xAxis,
      absolute: absDiff,
      percentage: pctDiff,
      stats: arrayStats(absDiff),
    };
  }

  const absDiff = modified.zValues.map((row, r) =>
    row.map((v, c) => round(v - original.zValues[r][c], 4))
  );
  const pctDiff = modified.zValues.map((row, r) =>
    row.map((v, c) => {
      const o = original.zValues[r][c];
      return o !== 0 ? round((v - o) / o * 100, 2) : (v !== 0 ? Infinity : 0);
    })
  );
  const flat = absDiff.flat();
  return {
    mapType: '3d',
    xAxis: original.xAxis,
    yAxis: original.yAxis,
    absolute: absDiff,
    percentage: pctDiff,
    stats: arrayStats(flat),
  };
}

// ─── Map Statistics ───────────────────────────────────────────────────────

export function mapStats(map) {
  const flat = map.mapType === '2d' ? map.zValues : map.zValues.flat();
  return {
    ...arrayStats(flat),
    cellCount: flat.length,
    xAxisRange: [map.xAxis.values[0], map.xAxis.values[map.xAxis.values.length - 1]],
    yAxisRange: map.yAxis ? [map.yAxis.values[0], map.yAxis.values[map.yAxis.values.length - 1]] : null,
  };
}

function arrayStats(arr) {
  const sorted = [...arr].filter(v => isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { min: 0, max: 0, avg: 0, median: 0, stddev: 0 };
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const variance = sorted.reduce((a, v) => a + (v - avg) ** 2, 0) / sorted.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: round(avg, 4),
    median: sorted[Math.floor(sorted.length / 2)],
    stddev: round(Math.sqrt(variance), 4),
  };
}

// ─── Axis Rescaling ───────────────────────────────────────────────────────

/**
 * Rescale X axis with new breakpoints, interpolating Z values
 */
export function rescaleXAxis(map, newXValues) {
  if (map.mapType === '2d') {
    const newZ = newXValues.map(x => interpolate2D(map, x));
    return { ...map, xAxis: { ...map.xAxis, values: newXValues }, zValues: newZ.map(v => round(v, map.precision)) };
  }

  const newZ = map.yAxis.values.map((_, yi) => {
    const row2d = { mapType: '2d', xAxis: map.xAxis, zValues: map.zValues[yi], precision: map.precision };
    return newXValues.map(x => round(interpolate2D(row2d, x), map.precision));
  });
  return { ...map, xAxis: { ...map.xAxis, values: newXValues }, zValues: newZ };
}

/**
 * Rescale Y axis (3D only) with new breakpoints
 */
export function rescaleYAxis(map, newYValues) {
  if (map.mapType !== '3d') throw new Error('rescaleYAxis only for 3D maps');

  const cols = map.xAxis.values.length;
  const newZ = newYValues.map(y => {
    return map.xAxis.values.map((_, ci) => {
      // build a 2D map from the column
      const col2d = {
        mapType: '2d',
        xAxis: map.yAxis,
        zValues: map.zValues.map(row => row[ci]),
        precision: map.precision,
      };
      return round(interpolate2D(col2d, y), map.precision);
    });
  });
  return { ...map, yAxis: { ...map.yAxis, values: newYValues }, zValues: newZ };
}

// ─── Map Copy / Paste ─────────────────────────────────────────────────────

/**
 * Copy a region from a map
 */
export function copyRegion(map, region) {
  const { xStart = 0, xEnd, yStart = 0, yEnd } = region;
  if (map.mapType === '2d') {
    const xe = xEnd ?? map.zValues.length - 1;
    return { values: map.zValues.slice(xStart, xe + 1), mapType: '2d' };
  }
  const ye = yEnd ?? map.zValues.length - 1;
  const xe = xEnd ?? map.zValues[0].length - 1;
  return {
    values: map.zValues.slice(yStart, ye + 1).map(row => row.slice(xStart, xe + 1)),
    mapType: '3d',
  };
}

/**
 * Paste values into a map at a position
 */
export function pasteRegion(map, clipboard, xStart = 0, yStart = 0) {
  if (map.mapType === '2d') {
    const z = [...map.zValues];
    const vals = clipboard.values;
    for (let i = 0; i < vals.length && xStart + i < z.length; i++) {
      z[xStart + i] = vals[i];
    }
    return { ...map, zValues: z };
  }
  const z = map.zValues.map(r => [...r]);
  const vals = clipboard.values;
  for (let r = 0; r < vals.length && yStart + r < z.length; r++) {
    for (let c = 0; c < vals[r].length && xStart + c < z[0].length; c++) {
      z[yStart + r][xStart + c] = vals[r][c];
    }
  }
  return { ...map, zValues: z };
}

// ─── Map Templates / Presets ──────────────────────────────────────────────

export const MAP_TEMPLATES = {
  // Fuel injection quantity maps (diesel)
  dieselInjQuantity: {
    name: 'Diesel Injection Quantity',
    category: 'fuel',
    mapType: '3d',
    units: 'mg/stroke',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500] },
    yAxis: { label: 'Accelerator Pedal', units: '%', values: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100] },
    precision: 2,
  },
  // Boost pressure target (diesel)
  dieselBoostTarget: {
    name: 'Diesel Boost Pressure Target',
    category: 'boost',
    mapType: '3d',
    units: 'mbar',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500] },
    yAxis: { label: 'Injection Quantity', units: 'mg/stroke', values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
    precision: 0,
  },
  // Rail pressure target (diesel)
  dieselRailPressure: {
    name: 'Diesel Rail Pressure Target',
    category: 'fuel',
    mapType: '3d',
    units: 'bar',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4500] },
    yAxis: { label: 'Injection Quantity', units: 'mg/stroke', values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
    precision: 0,
  },
  // Ignition timing (gasoline)
  gasolineIgnition: {
    name: 'Gasoline Ignition Timing',
    category: 'ignition',
    mapType: '3d',
    units: '°BTDC',
    xAxis: { label: 'RPM', units: 'rpm', values: [600, 800, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000] },
    yAxis: { label: 'Engine Load', units: '%', values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
    precision: 1,
  },
  // VVT intake timing
  vvtIntake: {
    name: 'VVT Intake Timing',
    category: 'vvt',
    mapType: '3d',
    units: '°CA',
    xAxis: { label: 'RPM', units: 'rpm', values: [600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500] },
    yAxis: { label: 'Load', units: '%', values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
    precision: 1,
  },
  // Torque limiter
  torqueLimiter: {
    name: 'Torque Limiter',
    category: 'torque',
    mapType: '2d',
    units: 'Nm',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500] },
    precision: 0,
  },
  // Speed limiter
  speedLimiter: {
    name: 'Speed Limiter',
    category: 'limiter',
    mapType: '2d',
    units: 'km/h',
    xAxis: { label: 'Gear', units: '', values: [1, 2, 3, 4, 5, 6] },
    precision: 0,
  },
  // EGR valve position
  egrValve: {
    name: 'EGR Valve Position',
    category: 'emissions',
    mapType: '3d',
    units: '%',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000] },
    yAxis: { label: 'Injection Quantity', units: 'mg/stroke', values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 50] },
    precision: 1,
  },
  // Boost pressure duty cycle (wastegate / VNT)
  boostDutyCycle: {
    name: 'Boost Duty Cycle',
    category: 'boost',
    mapType: '3d',
    units: '%',
    xAxis: { label: 'RPM', units: 'rpm', values: [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500] },
    yAxis: { label: 'Target Boost', units: 'mbar', values: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400] },
    precision: 1,
  },
  // Lambda target (gasoline)
  lambdaTarget: {
    name: 'Lambda Target',
    category: 'fuel',
    mapType: '3d',
    units: 'λ',
    xAxis: { label: 'RPM', units: 'rpm', values: [600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000] },
    yAxis: { label: 'Engine Load', units: '%', values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
    precision: 3,
  },
};

export function getMapTemplate(templateName) {
  return MAP_TEMPLATES[templateName] || null;
}

export function listMapTemplates() {
  return Object.entries(MAP_TEMPLATES).map(([key, t]) => ({
    key, name: t.name, category: t.category, mapType: t.mapType, units: t.units,
  }));
}

// ─── Map Storage (D1) ─────────────────────────────────────────────────────

const MAPS_DDL = `
CREATE TABLE IF NOT EXISTS ecu_stored_maps (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  map_type TEXT DEFAULT '3d',
  units TEXT,
  precision INTEGER DEFAULT 2,
  x_axis TEXT,
  y_axis TEXT,
  z_values TEXT,
  address INTEGER,
  size INTEGER,
  version INTEGER DEFAULT 1,
  tags TEXT DEFAULT '[]',
  created_at INTEGER,
  updated_at INTEGER
)`;

export async function ensureMapTables(env) {
  try { await run(env, MAPS_DDL); return true; } catch { return false; }
}

export async function storeMap(env, mapData) {
  await ensureMapTables(env);
  const m = {
    id: mapData.id || genId(),
    upload_id: mapData.upload_id || null,
    project_id: mapData.project_id || null,
    name: mapData.name || 'Unnamed Map',
    description: mapData.description || '',
    category: mapData.category || '',
    map_type: mapData.mapType || '3d',
    units: mapData.units || '',
    precision: mapData.precision ?? 2,
    x_axis: JSON.stringify(mapData.xAxis || {}),
    y_axis: JSON.stringify(mapData.yAxis || null),
    z_values: JSON.stringify(mapData.zValues || []),
    address: mapData.address ?? null,
    size: mapData.size ?? null,
    version: 1,
    tags: JSON.stringify(mapData.tags || []),
    created_at: now(),
    updated_at: now(),
  };
  await run(env,
    `INSERT INTO ecu_stored_maps (id,upload_id,project_id,name,description,category,map_type,units,precision,x_axis,y_axis,z_values,address,size,version,tags,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    m.id, m.upload_id, m.project_id, m.name, m.description, m.category,
    m.map_type, m.units, m.precision, m.x_axis, m.y_axis, m.z_values,
    m.address, m.size, m.version, m.tags, m.created_at, m.updated_at
  );
  return parseStoredMap(m);
}

export async function getStoredMap(env, mapId) {
  await ensureMapTables(env);
  const row = await q1(env, 'SELECT * FROM ecu_stored_maps WHERE id=?', mapId);
  return row ? parseStoredMap(row) : null;
}

export async function listStoredMaps(env, opts = {}) {
  await ensureMapTables(env);
  const { upload_id, project_id, category, limit = 100 } = opts;
  let sql = 'SELECT * FROM ecu_stored_maps';
  const conds = [], params = [];
  if (upload_id) { conds.push('upload_id=?'); params.push(upload_id); }
  if (project_id) { conds.push('project_id=?'); params.push(project_id); }
  if (category) { conds.push('category=?'); params.push(category); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);
  const rows = await qall(env, sql, ...params);
  return rows.map(parseStoredMap);
}

export async function updateStoredMap(env, mapId, updates) {
  await ensureMapTables(env);
  const fields = [], vals = [];
  if (updates.name !== undefined) { fields.push('name=?'); vals.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description=?'); vals.push(updates.description); }
  if (updates.category !== undefined) { fields.push('category=?'); vals.push(updates.category); }
  if (updates.zValues !== undefined) { fields.push('z_values=?'); vals.push(JSON.stringify(updates.zValues)); fields.push('version=version+1'); }
  if (updates.xAxis !== undefined) { fields.push('x_axis=?'); vals.push(JSON.stringify(updates.xAxis)); }
  if (updates.yAxis !== undefined) { fields.push('y_axis=?'); vals.push(JSON.stringify(updates.yAxis)); }
  if (updates.tags !== undefined) { fields.push('tags=?'); vals.push(JSON.stringify(updates.tags)); }
  if (fields.length === 0) return getStoredMap(env, mapId);
  fields.push('updated_at=?'); vals.push(now());
  vals.push(mapId);
  await run(env, `UPDATE ecu_stored_maps SET ${fields.join(',')} WHERE id=?`, ...vals);
  return getStoredMap(env, mapId);
}

export async function deleteStoredMap(env, mapId) {
  await ensureMapTables(env);
  await run(env, 'DELETE FROM ecu_stored_maps WHERE id=?', mapId);
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseStoredMap(row) {
  return {
    ...row,
    xAxis: JSON.parse(row.x_axis || '{}'),
    yAxis: JSON.parse(row.y_axis || 'null'),
    zValues: JSON.parse(row.z_values || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    mapType: row.map_type,
  };
}

function round(v, precision = 2) {
  const f = 10 ** precision;
  return Math.round(v * f) / f;
}
