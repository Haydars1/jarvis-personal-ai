// Oil System Calculator
// Viscosity by temperature, oil pressure, cooler sizing, pump flow, oil analysis

// ─── Oil Viscosity Database ─────────────────────────────────────────────

const OIL_DATABASE = {
  '0w-20': { name: '0W-20', baseSAE: '0W', topSAE: '20', viscosity40C_cSt: 46, viscosity100C_cSt: 8.6, vi: 165, pourPoint_C: -45, flashPoint_C: 224, hths_cP: 2.6, application: 'Modern fuel-efficient engines, Toyota, Honda, Subaru' },
  '5w-20': { name: '5W-20', baseSAE: '5W', topSAE: '20', viscosity40C_cSt: 49, viscosity100C_cSt: 8.9, vi: 160, pourPoint_C: -42, flashPoint_C: 226, hths_cP: 2.7, application: 'Ford EcoBoost, GM direct-injection' },
  '5w-30': { name: '5W-30', baseSAE: '5W', topSAE: '30', viscosity40C_cSt: 62, viscosity100C_cSt: 10.5, vi: 155, pourPoint_C: -40, flashPoint_C: 230, hths_cP: 3.1, application: 'Universal — most NA and mild turbo engines' },
  '5w-40': { name: '5W-40', baseSAE: '5W', topSAE: '40', viscosity40C_cSt: 87, viscosity100C_cSt: 14.0, vi: 168, pourPoint_C: -39, flashPoint_C: 235, hths_cP: 3.7, application: 'European turbo — VW/Audi, BMW, Mercedes' },
  '10w-30': { name: '10W-30', baseSAE: '10W', topSAE: '30', viscosity40C_cSt: 70, viscosity100C_cSt: 11.0, vi: 142, pourPoint_C: -33, flashPoint_C: 232, hths_cP: 3.0, application: 'Classic engines, warmer climates' },
  '10w-40': { name: '10W-40', baseSAE: '10W', topSAE: '40', viscosity40C_cSt: 96, viscosity100C_cSt: 14.5, vi: 148, pourPoint_C: -30, flashPoint_C: 238, hths_cP: 3.6, application: 'Older European engines, mild performance' },
  '10w-60': { name: '10W-60', baseSAE: '10W', topSAE: '60', viscosity40C_cSt: 170, viscosity100C_cSt: 24.0, vi: 175, pourPoint_C: -33, flashPoint_C: 250, hths_cP: 5.2, application: 'BMW M engines (S54, S65), high-RPM track use' },
  '15w-40': { name: '15W-40', baseSAE: '15W', topSAE: '40', viscosity40C_cSt: 110, viscosity100C_cSt: 15.0, vi: 135, pourPoint_C: -27, flashPoint_C: 240, hths_cP: 3.7, application: 'Diesel engines, fleet vehicles, heavy duty' },
  '15w-50': { name: '15W-50', baseSAE: '15W', topSAE: '50', viscosity40C_cSt: 140, viscosity100C_cSt: 19.0, vi: 155, pourPoint_C: -27, flashPoint_C: 248, hths_cP: 4.5, application: 'Air-cooled Porsche, high-heat engines' },
  '20w-50': { name: '20W-50', baseSAE: '20W', topSAE: '50', viscosity40C_cSt: 160, viscosity100C_cSt: 20.5, vi: 130, pourPoint_C: -21, flashPoint_C: 250, hths_cP: 4.8, application: 'Classic muscle cars, high-mileage engines, hot climates' },
  '0w-40': { name: '0W-40', baseSAE: '0W', topSAE: '40', viscosity40C_cSt: 78, viscosity100C_cSt: 13.5, vi: 180, pourPoint_C: -48, flashPoint_C: 228, hths_cP: 3.6, application: 'Porsche, Mercedes AMG, cold-start + high-heat' },
  '5w-50': { name: '5W-50', baseSAE: '5W', topSAE: '50', viscosity40C_cSt: 120, viscosity100C_cSt: 18.0, vi: 170, pourPoint_C: -42, flashPoint_C: 245, hths_cP: 4.4, application: 'Track day, high-RPM turbo, Subaru EJ' },
};


// ─── Oil Pump Database ──────────────────────────────────────────────────

const PUMP_DATABASE = {
  'gerotor-stock': { name: 'OEM Gerotor (stock)', type: 'gerotor', maxPressure_bar: 4.5, maxFlow_Lmin: 25, efficiency_pct: 75, driveRatio: 0.5, application: 'Stock OEM pump, most passenger cars' },
  'gerotor-high-vol': { name: 'High-Volume Gerotor', type: 'gerotor', maxPressure_bar: 5.5, maxFlow_Lmin: 35, efficiency_pct: 78, driveRatio: 0.5, application: 'Aftermarket — GM LS, Ford Mod, turbo builds' },
  'gear-pump-performance': { name: 'External Gear Pump', type: 'external-gear', maxPressure_bar: 7.0, maxFlow_Lmin: 45, efficiency_pct: 82, driveRatio: 1.0, application: 'Racing — dry sump scavenge/pressure stage' },
  'dry-sump-3stage': { name: 'Dry Sump 3-Stage', type: 'dry-sump', maxPressure_bar: 8.0, maxFlow_Lmin: 60, efficiency_pct: 85, driveRatio: 1.0, application: 'Road racing, drifting — consistent pressure in G-loads' },
  'dry-sump-4stage': { name: 'Dry Sump 4-Stage', type: 'dry-sump', maxPressure_bar: 8.5, maxFlow_Lmin: 80, efficiency_pct: 85, driveRatio: 1.0, application: 'Endurance racing, extreme aero — 3 scavenge + 1 pressure' },
  'vane-pump-vvt': { name: 'Variable Vane Pump (VVT)', type: 'variable-vane', maxPressure_bar: 5.0, maxFlow_Lmin: 30, efficiency_pct: 80, driveRatio: 0.5, application: 'Modern variable-displacement — BMW N20, Toyota D-4S' },
  'electric-auxiliary': { name: 'Electric Auxiliary Pump', type: 'electric', maxPressure_bar: 3.0, maxFlow_Lmin: 15, efficiency_pct: 70, driveRatio: 0, application: 'Turbo CHRA pre/post-lube, turbo timer replacement' },
};


// ─── Oil Cooler Database ────────────────────────────────────────────────

const COOLER_DATABASE = {
  'mocal-13row': { name: 'Mocal 13-Row', type: 'air-oil', rows: 13, heatDissipation_W: 2500, flowCapacity_Lmin: 30, pressureDrop_bar: 0.3, dimensions_mm: '330×140×50', application: 'Street performance — Miata, S2000, BRZ' },
  'mocal-16row': { name: 'Mocal 16-Row', type: 'air-oil', rows: 16, heatDissipation_W: 3500, flowCapacity_Lmin: 35, pressureDrop_bar: 0.4, dimensions_mm: '330×175×50', application: 'Street/track — turbo 4-cyl, NA 6-cyl' },
  'mocal-19row': { name: 'Mocal 19-Row', type: 'air-oil', rows: 19, heatDissipation_W: 4500, flowCapacity_Lmin: 40, pressureDrop_bar: 0.5, dimensions_mm: '330×210×50', application: 'Track day — turbo builds, V8 engines' },
  'mocal-25row': { name: 'Mocal 25-Row', type: 'air-oil', rows: 25, heatDissipation_W: 6000, flowCapacity_Lmin: 45, pressureDrop_bar: 0.6, dimensions_mm: '330×265×50', application: 'Racing — high-power turbo, V8 race engines' },
  'setrab-series6-10': { name: 'Setrab Series 6 (10-row)', type: 'air-oil', rows: 10, heatDissipation_W: 2000, flowCapacity_Lmin: 25, pressureDrop_bar: 0.25, dimensions_mm: '190×100×50', application: 'Compact — Miata, Mini, motorcycle' },
  'oem-water-oil': { name: 'OEM Water-Oil Heat Exchanger', type: 'water-oil', rows: 0, heatDissipation_W: 3000, flowCapacity_Lmin: 30, pressureDrop_bar: 0.15, dimensions_mm: 'integrated', application: 'OEM — fast warmup, thermostat regulated' },
  'laminova-c43': { name: 'Laminova C43-185', type: 'water-oil', rows: 0, heatDissipation_W: 4000, flowCapacity_Lmin: 35, pressureDrop_bar: 0.2, dimensions_mm: '185×43mm tube', application: 'Aftermarket water-oil — turbo, compact install' },
};


// ─── Oil Viscosity at Temperature ───────────────────────────────────────

export function calcViscosityAtTemp(oilGrade, temperature_C) {
  const oil = OIL_DATABASE[oilGrade];
  if (!oil) return { error: `Unknown oil grade: ${oilGrade}` };

  // Walther equation approximation for viscosity-temperature relationship
  // Using two-point fit from 40°C and 100°C data
  const T1 = 40, T2 = 100;
  const v1 = oil.viscosity40C_cSt, v2 = oil.viscosity100C_cSt;

  // Log-log linear interpolation (Walther equation simplified)
  const logLogV1 = Math.log(Math.log(v1 + 0.7));
  const logLogV2 = Math.log(Math.log(v2 + 0.7));
  const logT1 = Math.log(T1 + 273.15);
  const logT2 = Math.log(T2 + 273.15);

  const slope = (logLogV1 - logLogV2) / (logT1 - logT2);
  const intercept = logLogV1 - slope * logT1;

  const logT = Math.log(temperature_C + 273.15);
  const logLogV = slope * logT + intercept;
  const viscosity = Math.exp(Math.exp(logLogV)) - 0.7;

  // Film thickness estimate (relative)
  const filmThicknessRelative = viscosity / oil.viscosity100C_cSt;

  return {
    oilGrade,
    oilName: oil.name,
    temperature_C,
    viscosity_cSt: Math.round(viscosity * 100) / 100,
    viscosityIndex: oil.vi,
    referencePoints: {
      at40C_cSt: v1,
      at100C_cSt: v2,
    },
    filmThicknessRelative: Math.round(filmThicknessRelative * 100) / 100,
    status: viscosity < 4 ? 'DANGER — film too thin, bearing damage risk' :
      viscosity < 6 ? 'Warning — minimum film, monitor closely' :
      viscosity > 200 ? 'Very thick — cold start concern, pump cavitation risk' :
      viscosity > 100 ? 'Thick — increased parasitic drag, slow flow to top-end' : 'Normal operating range',
  };
}


// ─── Oil Pressure Requirements ──────────────────────────────────────────

export function calcOilPressure(rpm, oilGrade, bearingClearance_mm = 0.05, numberOfBearings = 10) {
  const oil = OIL_DATABASE[oilGrade];
  if (!oil) return { error: `Unknown oil grade: ${oilGrade}` };

  // Minimum oil pressure rule of thumb: 10 PSI per 1000 RPM
  const minimumPressure_psi = rpm / 1000 * 10;
  const minimumPressure_bar = minimumPressure_psi * 0.0689;

  // Required flow through bearings (simplified Petroff equation)
  // Flow per bearing ≈ π × diameter × clearance³ × pressure / (6 × viscosity × width)
  // Simplified: higher clearance = more flow needed
  const clearanceFactor = (bearingClearance_mm / 0.05); // normalized to standard
  const flowPerBearing_Lmin = 0.5 * clearanceFactor * (rpm / 3000);
  const totalFlow_Lmin = flowPerBearing_Lmin * numberOfBearings;

  // Recommended pressure range
  const idlePressure_bar = Math.max(0.7, minimumPressure_bar * 0.3);

  return {
    rpm,
    oilGrade,
    oilName: oil.name,
    bearingClearance_mm,
    numberOfBearings,
    minimumPressure_bar: Math.round(minimumPressure_bar * 100) / 100,
    minimumPressure_psi: Math.round(minimumPressure_psi),
    recommendedPressure_bar: Math.round(minimumPressure_bar * 1.2 * 100) / 100,
    idleMinimum_bar: Math.round(idlePressure_bar * 100) / 100,
    estimatedFlow_Lmin: Math.round(totalFlow_Lmin * 10) / 10,
    reliefValveSetting_bar: Math.round(Math.min(7.0, minimumPressure_bar * 1.5) * 100) / 100,
    notes: [
      clearanceFactor > 1.5 ? 'Loose bearing clearance — higher flow needed, consider high-volume pump' : null,
      rpm > 7000 ? 'High RPM — ensure oil pickup is adequate, consider windage tray' : null,
      'Oil pressure gauge is essential for tuned engines',
    ].filter(Boolean),
  };
}


// ─── Oil Cooler Sizing ──────────────────────────────────────────────────

export function sizeOilCooler(engineHP, oilTemp_target_C = 110, ambientTemp_C = 35, isTurbo = false) {
  // Heat to oil ≈ 30-40% of total engine heat rejection
  // Engine heat ≈ 0.7 × engine power (kW)
  const enginePower_kW = engineHP * 0.7457;
  const totalHeatRejection_W = enginePower_kW * 1000 * 0.7; // 70% of fuel energy is heat
  const oilHeatFraction = isTurbo ? 0.35 : 0.30;
  const oilHeat_W = totalHeatRejection_W * oilHeatFraction;

  // Required cooler capacity with safety margin
  const tempDelta = oilTemp_target_C - ambientTemp_C;
  const requiredCapacity_W = oilHeat_W * 0.6; // cooler handles 60% of peak, rest is oil pan + block

  // Match cooler from database
  const recommendations = Object.entries(COOLER_DATABASE)
    .map(([key, cooler]) => ({
      key,
      ...cooler,
      adequacy_pct: Math.round((cooler.heatDissipation_W / requiredCapacity_W) * 100),
    }))
    .filter(c => c.adequacy_pct >= 80)
    .sort((a, b) => Math.abs(a.adequacy_pct - 100) - Math.abs(b.adequacy_pct - 100));

  return {
    engineHP,
    oilTemp_target_C,
    ambientTemp_C,
    isTurbo,
    estimatedOilHeat_W: Math.round(oilHeat_W),
    requiredCoolerCapacity_W: Math.round(requiredCapacity_W),
    tempDelta_C: tempDelta,
    recommendations: recommendations.slice(0, 3),
    notes: [
      isTurbo ? 'Turbo increases oil heat significantly — budget for larger cooler' : null,
      ambientTemp_C > 40 ? 'Hot climate — size up one cooler row' : null,
      engineHP > 400 ? 'High power — consider dual coolers or water-oil exchanger' : null,
      'Always use a thermostat sandwich plate to prevent overcooling at startup',
    ].filter(Boolean),
  };
}


// ─── Oil Pump Flow Calculator ───────────────────────────────────────────

export function calcPumpFlow(pumpModel, rpm, oilGrade) {
  const pump = PUMP_DATABASE[pumpModel];
  if (!pump) return { error: `Unknown pump: ${pumpModel}` };

  const oil = oilGrade ? OIL_DATABASE[oilGrade] : null;

  // Flow is proportional to RPM (for positive displacement pumps)
  const pumpRPM = rpm * pump.driveRatio || rpm * 0.5;
  const theoreticalFlow = pump.maxFlow_Lmin * (pumpRPM / 6000); // normalized to 6000 pump RPM
  const actualFlow = theoreticalFlow * (pump.efficiency_pct / 100);

  // Viscosity affects volumetric efficiency at high RPM
  let viscosityPenalty = 1.0;
  if (oil && oil.viscosity100C_cSt > 18) viscosityPenalty = 0.95; // thick oil, slight flow loss
  if (oil && oil.viscosity100C_cSt < 8) viscosityPenalty = 0.98; // thin oil, slight leak-back

  const adjustedFlow = actualFlow * viscosityPenalty;

  return {
    pumpModel,
    pumpName: pump.name,
    pumpType: pump.type,
    engineRPM: rpm,
    pumpRPM: Math.round(pumpRPM),
    theoreticalFlow_Lmin: Math.round(theoreticalFlow * 10) / 10,
    actualFlow_Lmin: Math.round(adjustedFlow * 10) / 10,
    efficiency_pct: pump.efficiency_pct,
    maxPressure_bar: pump.maxPressure_bar,
    oilGrade: oil ? oil.name : 'not specified',
    viscosityPenalty: viscosityPenalty < 1 ? `${Math.round((1 - viscosityPenalty) * 100)}% flow reduction due to viscosity` : 'None',
    status: adjustedFlow < 10 ? 'LOW — may starve top-end at high RPM' :
      adjustedFlow > pump.maxFlow_Lmin * 0.9 ? 'NEAR MAX — pump capacity limit' : 'Adequate flow',
  };
}


// ─── Oil Analysis Interpreter ───────────────────────────────────────────

export function interpretOilAnalysis(results) {
  // Standard wear metal limits (ppm) for gasoline engines
  const LIMITS = {
    iron_ppm: { normal: 30, caution: 60, critical: 100, source: 'Cylinder walls, crank, cam' },
    copper_ppm: { normal: 20, caution: 40, critical: 80, source: 'Bearings, bushings, oil cooler' },
    lead_ppm: { normal: 15, caution: 30, critical: 60, source: 'Bearings overlay' },
    tin_ppm: { normal: 10, caution: 20, critical: 40, source: 'Bearings, piston coatings' },
    aluminum_ppm: { normal: 15, caution: 30, critical: 60, source: 'Pistons, bearings, pump housing' },
    chromium_ppm: { normal: 5, caution: 10, critical: 20, source: 'Rings, exhaust valves' },
    silicon_ppm: { normal: 20, caution: 30, critical: 50, source: 'Dirt ingestion, sealant' },
    sodium_ppm: { normal: 10, caution: 20, critical: 50, source: 'Coolant leak (antifreeze)' },
    potassium_ppm: { normal: 10, caution: 20, critical: 50, source: 'Coolant leak (OAT coolant)' },
    molybdenum_ppm: { normal: 100, caution: 200, critical: 500, source: 'Additive (moly), rings' },
    phosphorus_ppm: { normal: 800, caution: 1200, critical: 1500, source: 'ZDDP anti-wear additive' },
    zinc_ppm: { normal: 800, caution: 1200, critical: 1500, source: 'ZDDP anti-wear additive' },
    calcium_ppm: { normal: 2000, caution: 3000, critical: 4000, source: 'Detergent additive' },
  };

  const findings = [];
  const alerts = [];

  for (const [key, value] of Object.entries(results)) {
    const limit = LIMITS[key];
    if (!limit) continue;

    let status;
    if (value <= limit.normal) status = 'normal';
    else if (value <= limit.caution) { status = 'caution'; findings.push(`${key}: ${value} ppm — elevated (${limit.source})`); }
    else { status = 'critical'; alerts.push(`${key}: ${value} ppm — CRITICAL (${limit.source})`); }
  }

  // Coolant leak check
  if ((results.sodium_ppm || 0) > 20 && (results.potassium_ppm || 0) > 15) {
    alerts.push('COOLANT LEAK SUSPECTED — both sodium and potassium elevated');
  }

  // Fuel dilution check
  if (results.fuelDilution_pct && results.fuelDilution_pct > 2) {
    alerts.push(`FUEL DILUTION ${results.fuelDilution_pct}% — injector leak or excessive cold starts`);
  }

  // TBN check
  if (results.tbn && results.tbn < 3) {
    findings.push(`TBN ${results.tbn} — oil is losing protective capability, change soon`);
  }

  // Oxidation
  if (results.oxidation && results.oxidation > 20) {
    findings.push(`Oxidation ${results.oxidation} — oil degradation, extended drain may be too long`);
  }

  return {
    inputValues: results,
    alerts,
    findings,
    overallStatus: alerts.length > 0 ? 'ACTION REQUIRED' : findings.length > 0 ? 'MONITOR' : 'HEALTHY',
    recommendation: alerts.length > 0 ? 'Investigate source of contamination before next oil change' :
      findings.length > 0 ? 'Shorten oil change interval, resample at next change' :
      'Continue normal maintenance schedule',
    referenceLimits: LIMITS,
  };
}


// ─── Oil Capacity & Change Interval ─────────────────────────────────────

export function recommendOilSpec(engineType, powerLevel_HP, usage) {
  // usage: 'daily', 'spirited', 'track', 'race'
  let grade, changeInterval_km, filterInterval;

  if (usage === 'race') {
    grade = powerLevel_HP > 500 ? '15w-50' : powerLevel_HP > 300 ? '10w-60' : '5w-50';
    changeInterval_km = 1000;
    filterInterval = 'Every race weekend';
  } else if (usage === 'track') {
    grade = powerLevel_HP > 400 ? '10w-60' : powerLevel_HP > 250 ? '5w-50' : '5w-40';
    changeInterval_km = 3000;
    filterInterval = 'Every oil change';
  } else if (usage === 'spirited') {
    grade = engineType === 'turbo' ? '5w-40' : '5w-30';
    changeInterval_km = 5000;
    filterInterval = 'Every oil change';
  } else {
    grade = engineType === 'diesel' ? '5w-40' : '5w-30';
    changeInterval_km = engineType === 'diesel' ? 10000 : 7500;
    filterInterval = 'Every oil change';
  }

  const oilSpec = OIL_DATABASE[grade];

  return {
    engineType,
    powerLevel_HP,
    usage,
    recommendedGrade: grade,
    oilDetails: oilSpec,
    changeInterval_km,
    filterInterval,
    additionalNotes: [
      usage === 'track' || usage === 'race' ? 'Use oil analysis to optimize change intervals' : null,
      engineType === 'turbo' ? 'Allow 30s idle before shutdown for turbo bearing cooling' : null,
      powerLevel_HP > 400 ? 'Consider oil temperature gauge — target 90-120°C' : null,
      'Always use OEM or better quality filter — cheap filters restrict flow',
    ].filter(Boolean),
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listOils() {
  return Object.entries(OIL_DATABASE).map(([name, o]) => ({ name, ...o }));
}

export function getOil(name) {
  return OIL_DATABASE[name] || null;
}

export function listPumps() {
  return Object.entries(PUMP_DATABASE).map(([name, p]) => ({ name, ...p }));
}

export function getPump(name) {
  return PUMP_DATABASE[name] || null;
}

export function listCoolers() {
  return Object.entries(COOLER_DATABASE).map(([name, c]) => ({ name, ...c }));
}

export function getCooler(name) {
  return COOLER_DATABASE[name] || null;
}

export function searchOils(query) {
  const q = query.toLowerCase();
  return Object.entries(OIL_DATABASE)
    .filter(([name, o]) =>
      name.includes(q) || o.name.toLowerCase().includes(q) || o.application.toLowerCase().includes(q)
    )
    .map(([name, o]) => ({ name, ...o }));
}

export function oilCalcStats() {
  return {
    oilGrades: Object.keys(OIL_DATABASE).length,
    pumps: Object.keys(PUMP_DATABASE).length,
    coolers: Object.keys(COOLER_DATABASE).length,
    calculations: ['viscosityAtTemp', 'oilPressure', 'oilCoolerSizing', 'pumpFlow', 'oilAnalysis', 'oilSpec'],
  };
}

export { OIL_DATABASE, PUMP_DATABASE, COOLER_DATABASE };
