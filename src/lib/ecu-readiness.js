// ECU Readiness & Emissions Module
// OBD monitor readiness, I/M status, freeze frame, emissions test prep
// Language: JavaScript (ESM), Target: Cloudflare Workers

import { q1, qall, run } from './d1.js';
import { id as genId, now } from './core.js';

// ─── OBD Monitor Definitions ─────────────────────────────────────────────────

export const OBD_MONITORS = {
  // Continuous monitors (always running)
  MIS: { name: 'Misfire', type: 'continuous', description: 'Cylinder misfire detection', bit: 0, systems: ['gasoline','diesel'] },
  FUE: { name: 'Fuel System', type: 'continuous', description: 'Fuel system monitoring (closed-loop, rich/lean)', bit: 1, systems: ['gasoline'] },
  CCM: { name: 'Comprehensive Component', type: 'continuous', description: 'Sensors and actuators monitoring', bit: 2, systems: ['gasoline','diesel'] },

  // Non-continuous monitors — Spark Ignition (gasoline)
  CAT: { name: 'Catalyst', type: 'non-continuous', description: 'Catalytic converter efficiency', bit: 0, systems: ['gasoline'] },
  HCA: { name: 'Heated Catalyst', type: 'non-continuous', description: 'Heated catalytic converter', bit: 1, systems: ['gasoline'] },
  EVA: { name: 'Evaporative System', type: 'non-continuous', description: 'EVAP leak detection and purge flow', bit: 2, systems: ['gasoline'] },
  AIR: { name: 'Secondary Air System', type: 'non-continuous', description: 'Secondary air injection system', bit: 3, systems: ['gasoline'] },
  AC:  { name: 'A/C Refrigerant', type: 'non-continuous', description: 'A/C system refrigerant monitoring', bit: 4, systems: ['gasoline'] },
  O2S: { name: 'Oxygen Sensor', type: 'non-continuous', description: 'O2 sensor response and heater circuit', bit: 5, systems: ['gasoline'] },
  HTR: { name: 'O2 Sensor Heater', type: 'non-continuous', description: 'Oxygen sensor heater circuit', bit: 6, systems: ['gasoline'] },
  EGR: { name: 'EGR/VVT System', type: 'non-continuous', description: 'EGR flow and VVT system', bit: 7, systems: ['gasoline'] },

  // Non-continuous monitors — Compression Ignition (diesel)
  NMHC: { name: 'NMHC Catalyst', type: 'non-continuous', description: 'Non-methane hydrocarbon catalytic converter', bit: 0, systems: ['diesel'] },
  NOX:  { name: 'NOx/SCR', type: 'non-continuous', description: 'NOx aftertreatment / SCR system', bit: 1, systems: ['diesel'] },
  BP:   { name: 'Boost Pressure', type: 'non-continuous', description: 'Turbo/supercharger boost control', bit: 3, systems: ['diesel'] },
  EGS:  { name: 'Exhaust Gas Sensor', type: 'non-continuous', description: 'Exhaust gas sensor monitoring', bit: 5, systems: ['diesel'] },
  PM:   { name: 'PM Filter (DPF)', type: 'non-continuous', description: 'Diesel particulate filter monitoring', bit: 6, systems: ['diesel'] },
  EGRD: { name: 'EGR System', type: 'non-continuous', description: 'Exhaust Gas Recirculation', bit: 7, systems: ['diesel'] },
};

/**
 * Parse Mode 01 PID 01 response — Monitor status since DTCs cleared
 * Returns MIL status, DTC count, and monitor readiness
 */
export function parseMonitorStatus(bytesArr) {
  if (!bytesArr || bytesArr.length < 4) return null;
  const A = bytesArr[0], B = bytesArr[1], C = bytesArr[2], D = bytesArr[3];

  const milOn = !!(A & 0x80);
  const dtcCount = A & 0x7F;
  const isCompression = !!(B & 0x08); // bit 3 of B = compression ignition
  const fuelType = isCompression ? 'diesel' : 'gasoline';

  // Continuous monitors — available (bit set in B) and complete (bit NOT set in B upper nibble)
  const continuous = {};
  const contMonitors = ['MIS', 'FUE', 'CCM'];
  for (const key of contMonitors) {
    const mon = OBD_MONITORS[key];
    if (!mon || !mon.systems.includes(fuelType)) continue;
    const available = !!(B & (1 << mon.bit));
    const incomplete = !!(B & (1 << (mon.bit + 4)));
    continuous[key] = { ...mon, available, complete: available && !incomplete, incomplete: available && incomplete };
  }

  // Non-continuous monitors
  const nonContinuous = {};
  const ncBytes = { available: C, incomplete: D };

  const ncKeys = fuelType === 'diesel'
    ? ['NMHC', 'NOX', 'BP', 'EGS', 'PM', 'EGRD']
    : ['CAT', 'HCA', 'EVA', 'AIR', 'AC', 'O2S', 'HTR', 'EGR'];

  for (const key of ncKeys) {
    const mon = OBD_MONITORS[key];
    if (!mon) continue;
    const available = !!(ncBytes.available & (1 << mon.bit));
    const incomplete = !!(ncBytes.incomplete & (1 << mon.bit));
    nonContinuous[key] = { ...mon, available, complete: available && !incomplete, incomplete: available && incomplete };
  }

  return { milOn, dtcCount, fuelType, continuous, nonContinuous };
}

/**
 * Get readiness summary from parsed monitor status
 */
export function readinessSummary(parsed) {
  if (!parsed) return null;

  const allMonitors = { ...parsed.continuous, ...parsed.nonContinuous };
  const available = Object.entries(allMonitors).filter(([, m]) => m.available);
  const complete = available.filter(([, m]) => m.complete);
  const incomplete = available.filter(([, m]) => m.incomplete);

  const readyForTest = incomplete.length === 0 && !parsed.milOn;
  const readyWithWaiver = incomplete.length <= 1 && !parsed.milOn; // Most states allow 1 incomplete

  return {
    milOn: parsed.milOn,
    dtcCount: parsed.dtcCount,
    fuelType: parsed.fuelType,
    totalMonitors: available.length,
    completeCount: complete.length,
    incompleteCount: incomplete.length,
    readyForTest,
    readyWithWaiver,
    completeMonitors: complete.map(([k, m]) => ({ code: k, name: m.name })),
    incompleteMonitors: incomplete.map(([k, m]) => ({ code: k, name: m.name })),
    notAvailable: Object.entries(allMonitors).filter(([, m]) => !m.available).map(([k, m]) => ({ code: k, name: m.name })),
  };
}

// ─── Freeze Frame Data ────────────────────────────────────────────────────────

export const FREEZE_FRAME_PIDS = {
  '02': { name: 'DTC that caused freeze frame', bytes: 2 },
  '04': { name: 'Calculated engine load', bytes: 1, unit: '%', formula: (A) => A * 100 / 255 },
  '05': { name: 'Engine coolant temperature', bytes: 1, unit: '°C', formula: (A) => A - 40 },
  '06': { name: 'Short term fuel trim — Bank 1', bytes: 1, unit: '%', formula: (A) => (A - 128) * 100 / 128 },
  '07': { name: 'Long term fuel trim — Bank 1', bytes: 1, unit: '%', formula: (A) => (A - 128) * 100 / 128 },
  '0C': { name: 'Engine RPM', bytes: 2, unit: 'rpm', formula: (A, B) => (A * 256 + B) / 4 },
  '0D': { name: 'Vehicle speed', bytes: 1, unit: 'km/h', formula: (A) => A },
  '0E': { name: 'Timing advance', bytes: 1, unit: '° before TDC', formula: (A) => A / 2 - 64 },
  '0F': { name: 'Intake air temperature', bytes: 1, unit: '°C', formula: (A) => A - 40 },
  '10': { name: 'MAF air flow rate', bytes: 2, unit: 'g/s', formula: (A, B) => (A * 256 + B) / 100 },
  '11': { name: 'Throttle position', bytes: 1, unit: '%', formula: (A) => A * 100 / 255 },
  '0B': { name: 'Intake manifold absolute pressure', bytes: 1, unit: 'kPa', formula: (A) => A },
};

/**
 * Parse a freeze frame response
 * dataMap: { pidHex: [byte1, byte2, ...] }
 */
export function parseFreezeFrame(dataMap) {
  if (!dataMap) return null;
  const result = {};

  for (const [pid, bytes] of Object.entries(dataMap)) {
    const def = FREEZE_FRAME_PIDS[pid.toUpperCase()];
    if (!def) {
      result[pid] = { name: `Unknown PID 0x${pid}`, raw: bytes };
      continue;
    }
    let value = null;
    if (def.formula && bytes.length >= def.bytes) {
      value = def.formula(...bytes);
    }
    result[pid] = { name: def.name, value, unit: def.unit || '', raw: bytes };
  }
  return result;
}

// ─── I/M Readiness Drive Cycle Guide ──────────────────────────────────────────

export const DRIVE_CYCLES = {
  generic_obd2: {
    name: 'Generic OBD-II Drive Cycle',
    description: 'Standard drive cycle to reset all monitors after clearing DTCs',
    steps: [
      { step: 1, action: 'Cold start', detail: 'Engine coolant below 50°C. Let the engine idle for 2-3 minutes.', duration: '2-3 min' },
      { step: 2, action: 'Accelerate to 90 km/h', detail: 'Accelerate steadily at moderate throttle. Hold speed for 3-5 minutes.', duration: '3-5 min' },
      { step: 3, action: 'Steady cruise', detail: 'Maintain constant speed between 60-100 km/h, avoid large throttle changes.', duration: '5-10 min' },
      { step: 4, action: 'Decelerate to 30 km/h', detail: 'Coast down without braking. Lift throttle completely for 10+ seconds.', duration: '1-2 min' },
      { step: 5, action: 'Accelerate again', detail: 'From 30 km/h, accelerate back to 90 km/h at ½ throttle.', duration: '1-2 min' },
      { step: 6, action: 'Steady cruise', detail: 'Maintain 90 km/h for 5 minutes. Catalyst monitor typically completes here.', duration: '5 min' },
      { step: 7, action: 'Decelerate and stop', detail: 'Coast to a stop. Let engine idle for 2 minutes. EVAP monitor triggers.', duration: '2 min' },
      { step: 8, action: 'Final idle soak', detail: 'Turn off engine. Wait 8+ hours (overnight soak). EVAP leak check runs during soak.', duration: '8+ hrs' },
    ],
    notes: 'Some monitors may need 2-3 drive cycles. EVAP monitor often requires an overnight cold soak.'
  },

  vw_audi: {
    name: 'VW/Audi Drive Cycle',
    description: 'Specific drive cycle for VAG vehicles (EA888, EA211, TDI)',
    steps: [
      { step: 1, action: 'Cold start (below 50°C)', detail: 'Start engine. Idle for 90 seconds.', duration: '90 sec' },
      { step: 2, action: 'Drive at 30-50 km/h', detail: 'Drive in 2nd or 3rd gear, light throttle.', duration: '2 min' },
      { step: 3, action: 'Accelerate to 80 km/h', detail: 'Steady acceleration in 4th gear.', duration: '1-2 min' },
      { step: 4, action: 'Cruise at 80-120 km/h', detail: 'Maintain steady speed, light load. O2 sensor monitor runs.', duration: '5-10 min' },
      { step: 5, action: 'Decelerate without braking', detail: 'Lift throttle, engine brake from 100 to 50 km/h.', duration: '30 sec' },
      { step: 6, action: 'Idle for 3 minutes', detail: 'Stop and idle. Secondary air and EVAP monitors trigger.', duration: '3 min' },
      { step: 7, action: 'Repeat highway cruise', detail: 'Drive at 100 km/h steady for catalyst monitor completion.', duration: '5 min' },
    ],
    notes: 'VAG vehicles often need 2-3 cycles. VCDS/OBDeleven can show individual monitor status.'
  },

  bmw: {
    name: 'BMW Drive Cycle',
    description: 'BMW specific drive cycle (N20/B48/N55/B58)',
    steps: [
      { step: 1, action: 'Cold start', detail: 'Coolant below 40°C. Engine off for 6+ hours.', duration: '- ' },
      { step: 2, action: 'Idle 2.5 minutes', detail: 'Start engine, let idle. A/C OFF, headlights ON.', duration: '2.5 min' },
      { step: 3, action: 'Accelerate to 90 km/h', detail: 'Moderate acceleration, shift at 3000 RPM.', duration: '2 min' },
      { step: 4, action: 'Cruise at 90 km/h', detail: 'Maintain steady speed. Do NOT use cruise control.', duration: '3 min' },
      { step: 5, action: 'Decelerate to 50 km/h', detail: 'Lift throttle completely, coast down. No braking.', duration: '30 sec' },
      { step: 6, action: 'Cruise at 50 km/h', detail: 'Maintain speed in highest gear possible.', duration: '3 min' },
      { step: 7, action: 'Full stop, idle', detail: 'Come to complete stop. Idle 2 minutes.', duration: '2 min' },
    ],
    notes: 'ISTA/INPA shows individual readiness bits. Some monitors need highway + city combined.'
  },

  toyota: {
    name: 'Toyota/Lexus Drive Cycle',
    description: 'Toyota/Lexus specific drive cycle',
    steps: [
      { step: 1, action: 'Cold start (below 50°C)', detail: 'Start engine cold. Idle until coolant reaches 75°C.', duration: '5-10 min' },
      { step: 2, action: 'Drive at 40-60 km/h', detail: 'Steady speed for 8 minutes. O2 heater monitor runs.', duration: '8 min' },
      { step: 3, action: 'Accelerate to 90-100 km/h', detail: 'Half throttle acceleration. Hold for 5 minutes.', duration: '5 min' },
      { step: 4, action: 'Decelerate by coasting', detail: 'Release accelerator, coast to 65 km/h. Do NOT brake.', duration: '30 sec' },
      { step: 5, action: 'Repeat accel/decel 3 times', detail: 'Accelerate to 90, coast to 65, repeat. Catalyst monitor triggers.', duration: '5 min' },
      { step: 6, action: 'Stop and idle', detail: 'Come to stop. Idle for 3 minutes. EVAP purge runs.', duration: '3 min' },
    ],
    notes: 'Toyota typically needs 1-2 cycles. EVAP may require overnight cold soak (fuel tank 30-70% full).'
  },

  ford: {
    name: 'Ford Drive Cycle',
    description: 'Ford specific drive cycle (EcoBoost, Coyote)',
    steps: [
      { step: 1, action: 'Cold start', detail: 'Engine off 8+ hours. Fuel tank 30-70% full.', duration: '-' },
      { step: 2, action: 'Idle for 2 minutes', detail: 'Start engine, A/C and defrost OFF.', duration: '2 min' },
      { step: 3, action: 'Drive 25-35 mph (40-56 km/h)', detail: 'Moderate acceleration to 35 mph. Hold 1 minute.', duration: '1 min' },
      { step: 4, action: 'Accelerate to 55 mph (88 km/h)', detail: 'Half throttle, hold speed for 3 minutes.', duration: '3 min' },
      { step: 5, action: 'Cruise at 55-60 mph', detail: 'Maintain steady speed. Catalyst and O2 monitors run.', duration: '5 min' },
      { step: 6, action: 'Decelerate to 25 mph', detail: 'Coast down, no braking. Fuel shutoff triggers.', duration: '30 sec' },
      { step: 7, action: 'Accelerate to 55 mph', detail: 'Repeat step 4-5.', duration: '3 min' },
      { step: 8, action: 'Stop and idle', detail: 'Full stop, idle 2 minutes. EVAP runs.', duration: '2 min' },
    ],
    notes: 'Ford FORScan shows individual readiness. EcoBoost may need extra cycles for boost monitor.'
  },

  mercedes: {
    name: 'Mercedes-Benz Drive Cycle',
    description: 'Mercedes-Benz specific drive cycle (M274/M276/OM654)',
    steps: [
      { step: 1, action: 'Cold start (below 50°C)', detail: 'Engine off 6+ hours. Start and idle.', duration: '3 min' },
      { step: 2, action: 'Drive at 50 km/h', detail: 'Smooth acceleration, maintain 50 km/h.', duration: '2 min' },
      { step: 3, action: 'Accelerate to 100 km/h', detail: 'Gradual acceleration. Hold for 5 minutes.', duration: '5 min' },
      { step: 4, action: 'Lift throttle', detail: 'Coast from 100 to 70 km/h. No braking.', duration: '30 sec' },
      { step: 5, action: 'Resume 100 km/h', detail: 'Light throttle back to 100, hold 3 min.', duration: '3 min' },
      { step: 6, action: 'Stop and idle', detail: 'Come to complete stop. Idle for 3 minutes.', duration: '3 min' },
    ],
    notes: 'Xentry/DAS shows per-monitor readiness. OM654 diesel needs additional DPF regen cycle.'
  },

  hyundai_kia: {
    name: 'Hyundai/Kia Drive Cycle',
    description: 'Hyundai/Kia specific drive cycle (Theta II, Smartstream)',
    steps: [
      { step: 1, action: 'Cold start', detail: 'Engine cold (below 40°C). Start and idle 2 min.', duration: '2 min' },
      { step: 2, action: 'Accelerate to 55 km/h', detail: 'Moderate throttle. Drive in city conditions.', duration: '2 min' },
      { step: 3, action: 'Steady 55 km/h', detail: 'Maintain speed for 3 minutes.', duration: '3 min' },
      { step: 4, action: 'Accelerate to 100 km/h', detail: 'Gradual acceleration to highway speed.', duration: '1-2 min' },
      { step: 5, action: 'Cruise at 100 km/h', detail: 'Maintain steady speed for 5 minutes.', duration: '5 min' },
      { step: 6, action: 'Coast to 60 km/h', detail: 'Release throttle, coast. No braking.', duration: '30 sec' },
      { step: 7, action: 'Stop and idle 2 minutes', detail: 'Full stop. Let engine idle for EVAP check.', duration: '2 min' },
    ],
    notes: 'GDS/KDS shows individual monitor status. Catalyst monitor often needs 2+ cycles.'
  },
};

export function getDriveCycle(make) {
  const key = make?.toLowerCase().replace(/[-\s]/g, '_');
  if (!key) return DRIVE_CYCLES.generic_obd2;
  const map = {
    vw: 'vw_audi', volkswagen: 'vw_audi', audi: 'vw_audi', seat: 'vw_audi', skoda: 'vw_audi',
    bmw: 'bmw', mini: 'bmw',
    toyota: 'toyota', lexus: 'toyota', scion: 'toyota',
    ford: 'ford', lincoln: 'ford', mercury: 'ford',
    mercedes: 'mercedes', 'mercedes_benz': 'mercedes',
    hyundai: 'hyundai_kia', kia: 'hyundai_kia', genesis: 'hyundai_kia',
  };
  return DRIVE_CYCLES[map[key] || 'generic_obd2'];
}

export function listDriveCycles() {
  return Object.entries(DRIVE_CYCLES).map(([key, dc]) => ({ key, name: dc.name, description: dc.description, stepCount: dc.steps.length }));
}

// ─── Emissions Test Preparation ───────────────────────────────────────────────

export const EMISSIONS_STANDARDS = {
  euro6d: {
    name: 'Euro 6d', region: 'EU',
    limits: {
      gasoline: { CO: 1.0, THC: 0.10, NMHC: 0.068, NOx: 0.060, PM: 0.0045, PN: 6e11 },
      diesel:   { CO: 0.50, THC_NOx: 0.17, NOx: 0.080, PM: 0.0045, PN: 6e11 },
    },
    units: { CO: 'g/km', THC: 'g/km', NMHC: 'g/km', NOx: 'g/km', PM: 'g/km', PN: '#/km', THC_NOx: 'g/km' },
  },
  euro5: {
    name: 'Euro 5', region: 'EU',
    limits: {
      gasoline: { CO: 1.0, THC: 0.10, NMHC: 0.068, NOx: 0.060, PM: 0.005 },
      diesel:   { CO: 0.50, THC_NOx: 0.23, NOx: 0.18, PM: 0.005, PN: 6e11 },
    },
    units: { CO: 'g/km', THC: 'g/km', NMHC: 'g/km', NOx: 'g/km', PM: 'g/km', PN: '#/km', THC_NOx: 'g/km' },
  },
  tier3_bin125: {
    name: 'US EPA Tier 3 Bin 125', region: 'US',
    limits: {
      gasoline: { NMOG_NOx: 0.125, CO: 2.1, PM: 0.003 },
      diesel:   { NMOG_NOx: 0.125, CO: 2.1, PM: 0.003 },
    },
    units: { NMOG_NOx: 'g/mi', CO: 'g/mi', PM: 'g/mi' },
  },
  tier3_bin70: {
    name: 'US EPA Tier 3 Bin 70', region: 'US',
    limits: {
      gasoline: { NMOG_NOx: 0.070, CO: 1.7, PM: 0.003 },
      diesel:   { NMOG_NOx: 0.070, CO: 1.7, PM: 0.003 },
    },
    units: { NMOG_NOx: 'g/mi', CO: 'g/mi', PM: 'g/mi' },
  },
  tr_egzoz: {
    name: 'Turkey Exhaust Emissions', region: 'TR',
    limits: {
      gasoline: { CO: 3.50, HC: 0.40, lambda_min: 0.97, lambda_max: 1.03 },
      diesel:   { opacity: 1.5 }, // k value (absorption coefficient)
    },
    units: { CO: '%vol', HC: 'ppm', lambda_min: '', lambda_max: '', opacity: 'm⁻¹' },
    notes: 'Turkey follows EU standards but uses simplified tailpipe test at muayene istasyonu',
  },
};

/**
 * Check emissions readings against a standard
 */
export function checkEmissions(readings, standard, fuelType) {
  const std = EMISSIONS_STANDARDS[standard];
  if (!std) return { error: 'UNKNOWN_STANDARD' };
  const limits = std.limits[fuelType || 'gasoline'];
  if (!limits) return { error: 'NO_LIMITS_FOR_FUEL_TYPE' };

  const results = {};
  let allPass = true;

  for (const [param, limit] of Object.entries(limits)) {
    if (readings[param] === undefined) {
      results[param] = { status: 'not_tested', limit, unit: std.units[param] || '' };
      continue;
    }
    const val = readings[param];
    const pass = val <= limit;
    if (!pass) allPass = false;
    const margin = ((limit - val) / limit * 100).toFixed(1);
    results[param] = { value: val, limit, pass, margin: `${margin}%`, unit: std.units[param] || '' };
  }

  return { standard: std.name, region: std.region, fuelType, allPass, results, notes: std.notes };
}

export function listEmissionsStandards() {
  return Object.entries(EMISSIONS_STANDARDS).map(([key, s]) => ({
    key, name: s.name, region: s.region, fuelTypes: Object.keys(s.limits), notes: s.notes,
  }));
}

// ─── Emissions Pre-Check Advisor ──────────────────────────────────────────────

export function emissionsAdvisor(monitorStatus, dtcList = []) {
  const advice = [];
  const blockers = [];
  const warnings = [];

  // MIL check
  if (monitorStatus?.milOn) {
    blockers.push({ issue: 'MIL_ON', description: 'Check Engine Light is ON. This is an automatic fail in all emissions tests.', fix: 'Diagnose and repair the root cause DTC, then clear codes and complete a drive cycle.' });
  }

  // DTC check
  if (monitorStatus?.dtcCount > 0) {
    blockers.push({ issue: 'ACTIVE_DTCS', description: `${monitorStatus.dtcCount} active DTC(s) present.`, fix: 'Repair all fault codes before testing.' });
  }

  if (dtcList.length > 0) {
    const emissionDtcs = dtcList.filter(d => d.startsWith('P0') || d.startsWith('P2'));
    if (emissionDtcs.length > 0) {
      warnings.push({ issue: 'EMISSION_DTCS', description: `Emission-related DTCs: ${emissionDtcs.join(', ')}`, fix: 'These DTCs directly affect emissions test results.' });
    }
  }

  // Monitor readiness
  const summary = readinessSummary(monitorStatus);
  if (summary) {
    if (summary.incompleteCount > 0) {
      const names = summary.incompleteMonitors.map(m => m.name).join(', ');
      if (summary.incompleteCount > 1) {
        blockers.push({ issue: 'MONITORS_INCOMPLETE', description: `${summary.incompleteCount} monitors not ready: ${names}`, fix: 'Complete a full drive cycle. Most states allow 0-1 incomplete monitors.' });
      } else {
        warnings.push({ issue: 'ONE_MONITOR_INCOMPLETE', description: `1 monitor not ready: ${names}`, fix: 'Many testing stations allow 1 incomplete non-continuous monitor. Check local rules.' });
      }
    }

    // Specific monitor advice
    if (summary.incompleteMonitors.some(m => m.code === 'CAT' || m.code === 'NMHC')) {
      advice.push({ topic: 'Catalyst Monitor', tip: 'Catalyst monitor needs sustained highway driving (80-110 km/h) for 5-10 minutes with light load. Avoid heavy acceleration.' });
    }
    if (summary.incompleteMonitors.some(m => m.code === 'EVA')) {
      advice.push({ topic: 'EVAP Monitor', tip: 'EVAP monitor often requires overnight cold soak with fuel tank between 30-70% full. Tighten gas cap and park level.' });
    }
    if (summary.incompleteMonitors.some(m => m.code === 'O2S' || m.code === 'HTR')) {
      advice.push({ topic: 'O2 Sensor Monitor', tip: 'O2 sensor monitor runs during varied driving — mix city and highway, with throttle changes (not constant speed).' });
    }
    if (summary.incompleteMonitors.some(m => m.code === 'EGR' || m.code === 'EGRD')) {
      advice.push({ topic: 'EGR Monitor', tip: 'EGR monitor needs medium-load driving and deceleration phases. Drive in traffic or simulate stop-go conditions.' });
    }
    if (summary.incompleteMonitors.some(m => m.code === 'PM')) {
      advice.push({ topic: 'DPF Monitor', tip: 'DPF monitor requires a passive or active regeneration cycle. Drive at highway speeds for 20+ minutes with medium load.' });
    }
  }

  // General advice
  advice.push({ topic: 'Engine Oil', tip: 'Fresh oil reduces HC/CO emissions. Change oil if overdue before the test.' });
  advice.push({ topic: 'Pre-Test Drive', tip: 'Drive 20-30 minutes to bring engine and catalyst to full operating temperature before arriving at the test station.' });
  advice.push({ topic: 'Fuel', tip: 'Use quality fuel. Fill up 1-2 days before the test. Avoid E85 on test day unless the engine is flex-fuel rated.' });

  const verdict = blockers.length > 0 ? 'NOT_READY' : warnings.length > 0 ? 'READY_WITH_WARNINGS' : 'READY';

  return { verdict, blockers, warnings, advice, summary: summary || null };
}

// ─── D1 Persistence — Readiness History ───────────────────────────────────────

const READINESS_HISTORY_DDL = `
CREATE TABLE IF NOT EXISTS ecu_readiness_history (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  vehicle_id TEXT,
  mil_on INTEGER DEFAULT 0,
  dtc_count INTEGER DEFAULT 0,
  fuel_type TEXT,
  monitors_json TEXT DEFAULT '{}',
  summary_json TEXT DEFAULT '{}',
  freeze_frame_json TEXT,
  created_at INTEGER
)`;

export async function ensureReadinessTables(env) {
  try { await run(env, READINESS_HISTORY_DDL); return true; } catch { return false; }
}

export async function saveReadiness(env, data) {
  await ensureReadinessTables(env);
  const entry = {
    id: genId(),
    upload_id: data.upload_id || null,
    vehicle_id: data.vehicle_id || null,
    mil_on: data.milOn ? 1 : 0,
    dtc_count: data.dtcCount || 0,
    fuel_type: data.fuelType || 'gasoline',
    monitors_json: JSON.stringify(data.monitors || {}),
    summary_json: JSON.stringify(data.summary || {}),
    freeze_frame_json: data.freezeFrame ? JSON.stringify(data.freezeFrame) : null,
    created_at: now(),
  };
  await run(env,
    `INSERT INTO ecu_readiness_history (id,upload_id,vehicle_id,mil_on,dtc_count,fuel_type,monitors_json,summary_json,freeze_frame_json,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    entry.id, entry.upload_id, entry.vehicle_id, entry.mil_on, entry.dtc_count, entry.fuel_type,
    entry.monitors_json, entry.summary_json, entry.freeze_frame_json, entry.created_at
  );
  return entry;
}

export async function getReadinessHistory(env, opts = {}) {
  await ensureReadinessTables(env);
  let sql = 'SELECT * FROM ecu_readiness_history';
  const params = [], conds = [];
  if (opts.vehicle_id) { conds.push('vehicle_id=?'); params.push(opts.vehicle_id); }
  if (opts.upload_id) { conds.push('upload_id=?'); params.push(opts.upload_id); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(opts.limit || 50);
  const rows = await qall(env, sql, ...params);
  return rows.map(r => ({ ...r, mil_on: !!r.mil_on, monitors: JSON.parse(r.monitors_json || '{}'), summary: JSON.parse(r.summary_json || '{}'), freeze_frame: r.freeze_frame_json ? JSON.parse(r.freeze_frame_json) : null }));
}

// ─── OBD Mode Support ─────────────────────────────────────────────────────────

export const OBD_MODES = {
  '01': { name: 'Show current data', description: 'Live sensor data — engine RPM, coolant temp, fuel trims, etc.' },
  '02': { name: 'Show freeze frame data', description: 'Snapshot of data at the time a DTC was set' },
  '03': { name: 'Show stored DTCs', description: 'Stored (confirmed) diagnostic trouble codes' },
  '04': { name: 'Clear DTCs & freeze frame', description: 'Clear codes, reset MIL, reset monitors' },
  '05': { name: 'O2 sensor monitoring', description: 'Oxygen sensor test results (non-CAN)' },
  '06': { name: 'On-board monitoring results', description: 'Test results for continuously and non-continuously monitored systems' },
  '07': { name: 'Show pending DTCs', description: 'Pending (not yet confirmed) fault codes' },
  '08': { name: 'Control on-board system', description: 'Bi-directional control of on-board components' },
  '09': { name: 'Vehicle information', description: 'VIN, calibration IDs, CVN, ECU name' },
  '0A': { name: 'Permanent DTCs', description: 'Confirmed DTCs that survive a code clear — cleared only by repair + drive cycle' },
};

export function getOBDMode(mode) {
  return OBD_MODES[mode?.toUpperCase()] || null;
}

export function listOBDModes() {
  return Object.entries(OBD_MODES).map(([code, info]) => ({ code, ...info }));
}
