// Ignition Timing Calculator
// MBT timing, knock-limited, advance curves, dwell time, spark energy

// ─── Ignition Coil Database ─────────────────────────────────────────────

const COIL_DATABASE = {
  'bosch-0221504470': { name: 'Bosch 0221504470', type: 'COP', primaryResistance_ohm: 0.5, secondaryResistance_kohm: 7.5, sparkEnergy_mJ: 80, maxRPM: 8000, dwellTime_ms: 3.5, maxVoltage_kV: 40, application: 'BMW N54/N55, VW/Audi 2.0T' },
  'denso-673-1301': { name: 'Denso 673-1301', type: 'COP', primaryResistance_ohm: 0.6, secondaryResistance_kohm: 8.0, sparkEnergy_mJ: 65, maxRPM: 9000, dwellTime_ms: 3.0, maxVoltage_kV: 38, application: 'Toyota 2JZ-GTE, Lexus IS-F' },
  'aem-30-2853': { name: 'AEM 30-2853 High Output', type: 'COP', primaryResistance_ohm: 0.4, secondaryResistance_kohm: 6.5, sparkEnergy_mJ: 103, maxRPM: 10000, dwellTime_ms: 4.0, maxVoltage_kV: 45, application: 'Aftermarket — high boost applications' },
  'ls-d585': { name: 'GM D585 (LS Truck)', type: 'COP', primaryResistance_ohm: 0.5, secondaryResistance_kohm: 7.0, sparkEnergy_mJ: 90, maxRPM: 7500, dwellTime_ms: 3.8, maxVoltage_kV: 42, application: 'GM LS1/LS2/LS3, aftermarket swap favorite' },
  'ls-d514a': { name: 'GM D514A (LS Car)', type: 'COP', primaryResistance_ohm: 0.5, secondaryResistance_kohm: 7.0, sparkEnergy_mJ: 85, maxRPM: 7500, dwellTime_ms: 3.5, maxVoltage_kV: 40, application: 'GM LS-series car coils' },
  'ignitron-smart': { name: 'IGN-1A Smart Coil', type: 'smart-COP', primaryResistance_ohm: 0.3, secondaryResistance_kohm: 5.5, sparkEnergy_mJ: 120, maxRPM: 12000, dwellTime_ms: 2.5, maxVoltage_kV: 48, application: 'High-performance aftermarket, built-in igniter' },
  'msd-blaster-ss': { name: 'MSD Blaster SS', type: 'COP', primaryResistance_ohm: 0.45, secondaryResistance_kohm: 6.8, sparkEnergy_mJ: 95, maxRPM: 8500, dwellTime_ms: 3.2, maxVoltage_kV: 44, application: 'MSD aftermarket — Ford/GM/Mopar' },
  'hitachi-igc0078': { name: 'Hitachi IGC0078', type: 'COP', primaryResistance_ohm: 0.6, secondaryResistance_kohm: 8.5, sparkEnergy_mJ: 60, maxRPM: 7000, dwellTime_ms: 3.5, maxVoltage_kV: 36, application: 'Nissan SR20/VQ35, Subaru EJ' },
  'oem-wasted-spark': { name: 'OEM Wasted Spark Pack', type: 'wasted-spark', primaryResistance_ohm: 0.7, secondaryResistance_kohm: 10.0, sparkEnergy_mJ: 50, maxRPM: 6500, dwellTime_ms: 4.0, maxVoltage_kV: 35, application: 'OEM 4-cyl wasted spark — Mitsubishi 4G63, Ford Zetec' },
  'oem-distributor': { name: 'OEM Distributor Coil', type: 'distributor', primaryResistance_ohm: 1.2, secondaryResistance_kohm: 12.0, sparkEnergy_mJ: 40, maxRPM: 6000, dwellTime_ms: 5.0, maxVoltage_kV: 30, application: 'Classic distributor — Honda B16, Toyota 4A-GE' },
};


// ─── Spark Plug Gap Database ────────────────────────────────────────────

const SPARK_PLUG_DATABASE = {
  'ngk-bkr6e': { name: 'NGK BKR6E', heatRange: 6, gap_mm: 0.8, electrode: 'nickel', type: 'standard', lifespan_km: 30000, application: 'General NA petrol engines' },
  'ngk-bkr7e': { name: 'NGK BKR7E', heatRange: 7, gap_mm: 0.7, electrode: 'nickel', type: 'standard', lifespan_km: 30000, application: 'Performance NA, mild turbo' },
  'ngk-bkr8e': { name: 'NGK BKR8E', heatRange: 8, gap_mm: 0.7, electrode: 'nickel', type: 'standard', lifespan_km: 25000, application: 'High boost turbo applications' },
  'ngk-bkr9e': { name: 'NGK BKR9E', heatRange: 9, gap_mm: 0.6, electrode: 'nickel', type: 'standard', lifespan_km: 20000, application: 'Race / extreme boost' },
  'ngk-iridium-ifr6t': { name: 'NGK IFR6T-11 Iridium', heatRange: 6, gap_mm: 1.1, electrode: 'iridium', type: 'fine-wire', lifespan_km: 100000, application: 'OEM long-life, NA engines' },
  'ngk-iridium-ifr7': { name: 'NGK IRITOP7 Iridium Racing', heatRange: 7, gap_mm: 0.6, electrode: 'iridium', type: 'racing', lifespan_km: 10000, application: 'Racing — no ground electrode, surface discharge' },
  'denso-ik20': { name: 'Denso IK20 Iridium', heatRange: 20, gap_mm: 1.1, electrode: 'iridium', type: 'fine-wire', lifespan_km: 100000, application: 'OEM Toyota/Honda iridium long-life' },
  'denso-ik24': { name: 'Denso IK24 Iridium', heatRange: 24, gap_mm: 1.1, electrode: 'iridium', type: 'fine-wire', lifespan_km: 80000, application: 'OEM colder range for turbo' },
  'brisk-er15s': { name: 'Brisk ER15S Silver Racing', heatRange: 15, gap_mm: 0.5, electrode: 'silver', type: 'racing', lifespan_km: 5000, application: 'High-boost racing, forced induction' },
  'bosch-fr7dpp33': { name: 'Bosch FR7DPP33+ Platinum', heatRange: 7, gap_mm: 1.0, electrode: 'platinum', type: 'double-platinum', lifespan_km: 60000, application: 'OEM VW/Audi, BMW' },
};


// ─── MBT Timing Estimation ──────────────────────────────────────────────

export function estimateMBT(compressionRatio, rpm, load_pct, fuelType = 'gasoline') {
  // MBT = Maximum Brake Torque timing
  // Higher CR = less advance needed (faster burn)
  // Higher RPM = more advance needed (less time per degree)
  // Higher load = less advance (higher cylinder pressure, faster burn)

  // Base MBT for a typical 10:1 CR NA gasoline engine at 3000 RPM, 50% load
  let baseMBT = 32; // degrees BTDC

  // CR correction: -2° per CR point above 10
  baseMBT -= (compressionRatio - 10) * 2;

  // RPM correction: +3° per 1000 RPM above 3000
  baseMBT += (rpm - 3000) / 1000 * 3;

  // Load correction: -0.15° per % load above 50
  baseMBT -= (load_pct - 50) * 0.15;

  // Fuel correction
  if (fuelType === 'e85') baseMBT += 5; // ethanol burns faster but more advance benefits
  if (fuelType === 'methanol') baseMBT += 8;
  if (fuelType === 'cng') baseMBT += 6;
  if (fuelType === 'hydrogen') baseMBT -= 10; // hydrogen burns very fast

  // Clamp
  baseMBT = Math.max(5, Math.min(50, baseMBT));

  return {
    mbt_deg: Math.round(baseMBT * 10) / 10,
    compressionRatio,
    rpm,
    load_pct,
    fuelType,
    note: 'MBT is estimated — always verify on dyno with knock monitoring. Real MBT is the advance that produces peak torque without knock.',
    safety: baseMBT > 35 ? 'HIGH ADVANCE — verify no knock before running' : 'Within typical range',
  };
}


// ─── Knock-Limited Timing ───────────────────────────────────────────────

export function calcKnockLimitedTiming(compressionRatio, boostPSI = 0, octane_RON = 95, intakeTemp_C = 25) {
  const effectiveCR = compressionRatio * (1 + boostPSI / 14.7);

  // Base knock limit from octane
  let knockLimit;
  if (octane_RON >= 110) knockLimit = 38;
  else if (octane_RON >= 100) knockLimit = 32;
  else if (octane_RON >= 98) knockLimit = 28;
  else if (octane_RON >= 95) knockLimit = 24;
  else if (octane_RON >= 91) knockLimit = 20;
  else knockLimit = 16;

  // Effective CR penalty: -1.5° per unit above 10
  knockLimit -= Math.max(0, (effectiveCR - 10) * 1.5);

  // Temperature penalty: -0.3° per 10°C above 25°C
  knockLimit -= Math.max(0, (intakeTemp_C - 25) / 10 * 0.3);

  // Boost penalty on top: -1° per 5 PSI
  knockLimit -= boostPSI / 5;

  knockLimit = Math.max(5, Math.min(45, knockLimit));

  return {
    knockLimitedTiming_deg: Math.round(knockLimit * 10) / 10,
    effectiveCR: Math.round(effectiveCR * 100) / 100,
    compressionRatio,
    boostPSI,
    octane_RON,
    intakeTemp_C,
    margin: knockLimit > 20 ? 'Comfortable margin' : knockLimit > 15 ? 'Moderate — monitor closely' : 'Tight — knock likely, reduce timing or increase octane',
    recommendation: knockLimit < 15 ? 'Consider higher octane fuel or water/methanol injection' : 'Safe for tuning with knock monitoring',
  };
}


// ─── Timing Advance Curve Generator ─────────────────────────────────────

export function generateTimingCurve(compressionRatio, maxRPM, boostPSI = 0, octane_RON = 95, engineType = 'na') {
  const isTurbo = engineType !== 'na' || boostPSI > 0;
  const rpmSteps = [];
  for (let rpm = 500; rpm <= maxRPM; rpm += 500) rpmSteps.push(rpm);
  if (!rpmSteps.includes(maxRPM)) rpmSteps.push(maxRPM);

  const curve = rpmSteps.map(rpm => {
    // Base advance increases with RPM then plateaus
    let advance;
    if (rpm <= 1000) advance = 10 + (rpm - 500) / 500 * 8;
    else if (rpm <= 3000) advance = 18 + (rpm - 1000) / 2000 * 12;
    else if (rpm <= 5000) advance = 30 + (rpm - 3000) / 2000 * 4;
    else advance = 34 + (rpm - 5000) / 2000 * 2; // plateau

    // CR correction
    advance -= (compressionRatio - 10) * 1.5;

    // Boost correction
    if (isTurbo) {
      advance -= boostPSI * 0.5;
      advance = Math.min(advance, 30); // cap for turbo
    }

    // Octane bonus
    advance += (octane_RON - 95) * 0.3;

    advance = Math.max(5, Math.min(45, advance));

    return { rpm, advance_deg: Math.round(advance * 10) / 10 };
  });

  return {
    compressionRatio,
    maxRPM,
    boostPSI,
    octane_RON,
    engineType,
    curve,
    totalAdvanceRange_deg: Math.round((curve[curve.length - 1].advance_deg - curve[0].advance_deg) * 10) / 10,
    peakAdvance_deg: Math.max(...curve.map(c => c.advance_deg)),
    note: 'Starting point — always verify on dyno. These values are for WOT; part-throttle will have more advance.',
  };
}


// ─── Dwell Time Calculator ──────────────────────────────────────────────

export function calcDwellTime(coilModel, rpm, batteryVoltage_V = 14.0) {
  const coil = COIL_DATABASE[coilModel];
  if (!coil) return { error: `Unknown coil: ${coilModel}` };

  // Nominal dwell from database
  let nominalDwell = coil.dwellTime_ms;

  // Voltage compensation: lower voltage needs longer dwell
  // Reference is 14V
  const voltageCompensation = 14.0 / batteryVoltage_V;
  const compensatedDwell = nominalDwell * voltageCompensation;

  // Available time per revolution
  const timePerRev_ms = 60000 / rpm;

  // For distributor: dwell is shared across all cylinders
  // For COP: each coil has full time between its fires
  let availableTime;
  if (coil.type === 'distributor') {
    availableTime = timePerRev_ms / 2; // 4-stroke = fires every 2 revs, but distributor shares coil
  } else {
    availableTime = timePerRev_ms * 2; // COP fires once per 2 revs (4-stroke)
  }

  const dwellDuty_pct = (compensatedDwell / availableTime) * 100;
  const isOverDwell = dwellDuty_pct > 80;

  // Spark energy estimate
  const sparkEnergy = coil.sparkEnergy_mJ * Math.min(1.0, compensatedDwell / nominalDwell);

  return {
    coilModel,
    coilName: coil.name,
    coilType: coil.type,
    rpm,
    batteryVoltage_V,
    nominalDwell_ms: nominalDwell,
    compensatedDwell_ms: Math.round(compensatedDwell * 100) / 100,
    availableTime_ms: Math.round(availableTime * 100) / 100,
    dwellDuty_pct: Math.round(dwellDuty_pct * 10) / 10,
    estimatedSparkEnergy_mJ: Math.round(sparkEnergy),
    maxRPM: coil.maxRPM,
    status: isOverDwell ? 'OVERDWELL — reduce dwell or limit RPM' : dwellDuty_pct > 60 ? 'HIGH — monitor coil temperature' : 'OK',
    voltageCompensationTable: [
      { voltage: 10.0, dwell_ms: Math.round(nominalDwell * (14.0 / 10.0) * 100) / 100 },
      { voltage: 11.0, dwell_ms: Math.round(nominalDwell * (14.0 / 11.0) * 100) / 100 },
      { voltage: 12.0, dwell_ms: Math.round(nominalDwell * (14.0 / 12.0) * 100) / 100 },
      { voltage: 13.0, dwell_ms: Math.round(nominalDwell * (14.0 / 13.0) * 100) / 100 },
      { voltage: 14.0, dwell_ms: nominalDwell },
      { voltage: 15.0, dwell_ms: Math.round(nominalDwell * (14.0 / 15.0) * 100) / 100 },
      { voltage: 16.0, dwell_ms: Math.round(nominalDwell * (14.0 / 16.0) * 100) / 100 },
    ],
  };
}


// ─── Spark Plug Gap Recommendation ──────────────────────────────────────

export function recommendSparkPlugGap(boostPSI = 0, coilEnergy_mJ = 80, fuelType = 'gasoline') {
  // Higher boost = smaller gap (harder to ionize denser charge)
  // Higher coil energy = can fire larger gap
  // E85/methanol = slightly larger gap OK (more conductive)

  let baseGap_mm = 0.9; // standard NA gap

  // Boost correction: -0.05mm per 5 PSI
  baseGap_mm -= (boostPSI / 5) * 0.05;

  // Coil energy correction: +0.05mm per 20mJ above 60mJ
  baseGap_mm += Math.max(0, (coilEnergy_mJ - 60) / 20 * 0.05);

  // Fuel correction
  if (fuelType === 'e85') baseGap_mm += 0.05;
  if (fuelType === 'methanol') baseGap_mm += 0.1;

  baseGap_mm = Math.max(0.4, Math.min(1.3, baseGap_mm));

  // Recommend heat range
  let heatRange;
  if (boostPSI > 25) heatRange = '9-10 (very cold)';
  else if (boostPSI > 15) heatRange = '8-9 (cold)';
  else if (boostPSI > 5) heatRange = '7-8 (medium-cold)';
  else heatRange = '6-7 (standard-medium)';

  return {
    recommendedGap_mm: Math.round(baseGap_mm * 100) / 100,
    recommendedGap_thou: Math.round(baseGap_mm * 39.37),
    boostPSI,
    coilEnergy_mJ,
    fuelType,
    heatRange,
    notes: [
      boostPSI > 20 ? 'High boost — consider copper-core plugs for better heat transfer' : null,
      coilEnergy_mJ < 50 ? 'Low coil energy — keep gap tight to prevent misfire' : null,
      fuelType === 'e85' ? 'E85 is more conductive — can run slightly larger gap' : null,
      'Always check plug condition after tuning: brown/tan = good, white = lean, black = rich',
    ].filter(Boolean),
  };
}


// ─── Spark Energy vs Cylinder Pressure ──────────────────────────────────

export function calcSparkEnergy(cylinderPressure_bar, gap_mm, coilEnergy_mJ = 80) {
  // Paschen's law approximation: breakdown voltage increases with pressure × gap
  const breakdownVoltage_kV = 3 * cylinderPressure_bar * gap_mm; // simplified

  // Required energy
  const requiredEnergy_mJ = breakdownVoltage_kV * 0.8; // rough estimate

  const margin_pct = ((coilEnergy_mJ - requiredEnergy_mJ) / coilEnergy_mJ) * 100;

  return {
    cylinderPressure_bar,
    gap_mm,
    coilEnergy_mJ,
    estimatedBreakdownVoltage_kV: Math.round(breakdownVoltage_kV * 10) / 10,
    requiredEnergy_mJ: Math.round(requiredEnergy_mJ),
    energyMargin_pct: Math.round(margin_pct),
    verdict: margin_pct > 30 ? 'Sufficient energy margin' : margin_pct > 10 ? 'Adequate — monitor for misfires at high load' : 'INSUFFICIENT — reduce gap or upgrade coil',
  };
}


// ─── Full Ignition Timing Table ─────────────────────────────────────────

export function generateIgnitionTable(compressionRatio, maxRPM, boostMax_bar = 0, octane_RON = 95, engineType = 'na') {
  const isTurbo = engineType !== 'na' || boostMax_bar > 0;
  const boostPSI = boostMax_bar * 14.504;
  const rpmBreakpoints = [];
  for (let r = 500; r <= maxRPM; r += 500) rpmBreakpoints.push(r);
  if (!rpmBreakpoints.includes(maxRPM)) rpmBreakpoints.push(maxRPM);

  const loadBreakpoints = isTurbo
    ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 150]
    : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  const table = loadBreakpoints.map(load => ({
    load_pct: load,
    timing_by_rpm: rpmBreakpoints.map(rpm => {
      // Part-throttle: more advance
      let timing;
      if (load <= 20) {
        timing = 25 + (rpm - 500) / (maxRPM - 500) * 15; // light load, high advance
      } else if (load <= 50) {
        timing = 20 + (rpm - 500) / (maxRPM - 500) * 12;
        timing -= (load - 20) * 0.1;
      } else if (load <= 80) {
        timing = 15 + (rpm - 500) / (maxRPM - 500) * 10;
        timing -= (load - 50) * 0.1;
      } else if (load <= 100) {
        // WOT
        timing = 10 + (rpm - 500) / (maxRPM - 500) * 15;
        timing -= (compressionRatio - 10) * 1.5;
      } else {
        // Boost range
        timing = 8 + (rpm - 500) / (maxRPM - 500) * 12;
        timing -= (compressionRatio - 10) * 1.5;
        timing -= (load - 100) * 0.15;
      }

      // Octane correction
      timing += (octane_RON - 95) * 0.3;

      timing = Math.max(2, Math.min(45, timing));
      return { rpm, timing_deg: Math.round(timing * 10) / 10 };
    }),
  }));

  return {
    compressionRatio,
    maxRPM,
    boostMax_bar,
    octane_RON,
    engineType,
    rpmBreakpoints,
    loadBreakpoints,
    table,
    safety: [
      'These are STARTING VALUES — always dyno-verify with knock monitoring',
      'Part-throttle timing can be aggressive; WOT timing must respect knock limit',
      isTurbo ? `Max boost ${boostMax_bar} bar — reduce timing 1° per additional 0.1 bar above this` : 'NA engine — timing limited by compression ratio and fuel',
      `Octane: RON ${octane_RON} — running lower octane requires LESS advance`,
    ],
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listCoils() {
  return Object.entries(COIL_DATABASE).map(([name, c]) => ({ name, ...c }));
}

export function getCoil(name) {
  return COIL_DATABASE[name] || null;
}

export function searchCoils(query) {
  const q = query.toLowerCase();
  return Object.entries(COIL_DATABASE)
    .filter(([name, c]) =>
      name.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.application.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
    )
    .map(([name, c]) => ({ name, ...c }));
}

export function listSparkPlugs() {
  return Object.entries(SPARK_PLUG_DATABASE).map(([name, s]) => ({ name, ...s }));
}

export function getSparkPlug(name) {
  return SPARK_PLUG_DATABASE[name] || null;
}

export function searchSparkPlugs(query) {
  const q = query.toLowerCase();
  return Object.entries(SPARK_PLUG_DATABASE)
    .filter(([name, s]) =>
      name.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.application.toLowerCase().includes(q) ||
      s.electrode.toLowerCase().includes(q)
    )
    .map(([name, s]) => ({ name, ...s }));
}

export function ignitionCalcStats() {
  return {
    coils: Object.keys(COIL_DATABASE).length,
    sparkPlugs: Object.keys(SPARK_PLUG_DATABASE).length,
    calculations: ['mbtTiming', 'knockLimitedTiming', 'timingCurve', 'dwellTime', 'sparkPlugGap', 'sparkEnergy', 'ignitionTable'],
  };
}

export { COIL_DATABASE, SPARK_PLUG_DATABASE };
