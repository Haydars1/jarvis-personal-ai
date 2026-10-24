// Engine Math & Compression Ratio Calculator
// Displacement, CR, valve timing, torque/HP conversion, engine efficiency

// ─── Constants ───────────────────────────────────────────────────────────

const ATMOSPHERIC_PRESSURE_KPA = 101.325;
const GAMMA_AIR = 1.4;
const R_AIR = 287; // J/(kg·K)

// ─── Bore/Stroke Configurations Database ─────────────────────────────────

const ENGINE_CONFIGS = {
  // Common inline-4
  '1.6L-I4': { bore_mm: 77, stroke_mm: 85.8, cylinders: 4, layout: 'inline' },
  '1.8T-I4': { bore_mm: 81, stroke_mm: 86.4, cylinders: 4, layout: 'inline' },
  '2.0T-I4': { bore_mm: 82.5, stroke_mm: 92.8, cylinders: 4, layout: 'inline' },
  '2.0T-EA888': { bore_mm: 82.5, stroke_mm: 92.8, cylinders: 4, layout: 'inline' },
  '2.3T-EcoBoost': { bore_mm: 87.5, stroke_mm: 94, cylinders: 4, layout: 'inline' },
  '2.0-Skyactiv': { bore_mm: 83.5, stroke_mm: 91.2, cylinders: 4, layout: 'inline' },
  'K20A': { bore_mm: 86, stroke_mm: 86, cylinders: 4, layout: 'inline' },
  'SR20DET': { bore_mm: 86, stroke_mm: 86, cylinders: 4, layout: 'inline' },
  '4G63': { bore_mm: 85, stroke_mm: 88, cylinders: 4, layout: 'inline' },
  'EJ257': { bore_mm: 99.5, stroke_mm: 79, cylinders: 4, layout: 'boxer' },
  'B58': { bore_mm: 82, stroke_mm: 94.6, cylinders: 6, layout: 'inline' },
  'N54': { bore_mm: 84, stroke_mm: 89.6, cylinders: 6, layout: 'inline' },
  'RB26DETT': { bore_mm: 86, stroke_mm: 73.7, cylinders: 6, layout: 'inline' },
  '2JZ-GTE': { bore_mm: 86, stroke_mm: 86, cylinders: 6, layout: 'inline' },
  'VR38DETT': { bore_mm: 95.5, stroke_mm: 88.4, cylinders: 6, layout: 'V60' },
  'LS3': { bore_mm: 103.25, stroke_mm: 92, cylinders: 8, layout: 'V90' },
  'LT4': { bore_mm: 103.25, stroke_mm: 92, cylinders: 8, layout: 'V90' },
  'Coyote-5.0': { bore_mm: 92.2, stroke_mm: 92.7, cylinders: 8, layout: 'V90' },
  'HEMI-6.4': { bore_mm: 103, stroke_mm: 94.6, cylinders: 8, layout: 'V90' },
  '13B-REW': { bore_mm: 0, stroke_mm: 0, cylinders: 2, layout: 'rotary', displacement_cc: 1308 },
};


// ─── Displacement Calculation ────────────────────────────────────────────

/**
 * Calculate engine displacement from bore and stroke
 */
export function calcDisplacement(bore_mm, stroke_mm, cylinders) {
  const bore_cm = bore_mm / 10;
  const stroke_cm = stroke_mm / 10;
  const singleCyl_cc = (Math.PI / 4) * Math.pow(bore_cm, 2) * stroke_cm;
  const total_cc = singleCyl_cc * cylinders;

  return {
    bore_mm,
    stroke_mm,
    cylinders,
    singleCylinder_cc: Math.round(singleCyl_cc * 10) / 10,
    totalDisplacement_cc: Math.round(total_cc),
    totalDisplacement_L: Math.round(total_cc / 100) / 10,
    totalDisplacement_ci: Math.round(total_cc / 16.387 * 10) / 10,
    boreStrokeRatio: Math.round(bore_mm / stroke_mm * 1000) / 1000,
    engineType: bore_mm > stroke_mm ? 'oversquare' : bore_mm < stroke_mm ? 'undersquare' : 'square',
    note: bore_mm > stroke_mm
      ? 'Oversquare: favors high RPM, better breathing'
      : bore_mm < stroke_mm
        ? 'Undersquare: favors torque, better thermal efficiency'
        : 'Square: balanced torque and RPM characteristics',
  };
}


// ─── Compression Ratio ──────────────────────────────────────────────────

/**
 * Calculate static compression ratio
 */
export function calcCompressionRatio(bore_mm, stroke_mm, chamberVolume_cc, gasketThickness_mm, gasketBore_mm, pistonDomeVolume_cc = 0, deckClearance_mm = 0) {
  const bore_cm = bore_mm / 10;
  const stroke_cm = stroke_mm / 10;
  const cylinderVolume_cc = (Math.PI / 4) * Math.pow(bore_cm, 2) * stroke_cm;

  const gasketBore_cm = (gasketBore_mm || bore_mm) / 10;
  const gasketVolume_cc = (Math.PI / 4) * Math.pow(gasketBore_cm, 2) * (gasketThickness_mm / 10);

  const deckVolume_cc = (Math.PI / 4) * Math.pow(bore_cm, 2) * (deckClearance_mm / 10);

  // pistonDomeVolume_cc positive = dome (reduces clearance), negative = dish (adds clearance)
  const clearanceVolume = chamberVolume_cc + gasketVolume_cc + deckVolume_cc - pistonDomeVolume_cc;

  const cr = (cylinderVolume_cc + clearanceVolume) / clearanceVolume;

  return {
    bore_mm,
    stroke_mm,
    chamberVolume_cc,
    gasketThickness_mm,
    gasketBore_mm: gasketBore_mm || bore_mm,
    pistonDomeVolume_cc,
    deckClearance_mm,
    cylinderVolume_cc: Math.round(cylinderVolume_cc * 10) / 10,
    gasketVolume_cc: Math.round(gasketVolume_cc * 100) / 100,
    deckVolume_cc: Math.round(deckVolume_cc * 100) / 100,
    totalClearanceVolume_cc: Math.round(clearanceVolume * 100) / 100,
    compressionRatio: Math.round(cr * 100) / 100,
    assessment: assessCR(cr),
  };
}

function assessCR(cr) {
  if (cr < 8) return { status: 'LOW', detail: 'Very low CR — suited for high-boost forced induction', fuelReq: '91 octane' };
  if (cr < 9.5) return { status: 'LOW_MODERATE', detail: 'Low-moderate CR — good for turbo/supercharged applications', fuelReq: '91-93 octane' };
  if (cr < 10.5) return { status: 'MODERATE', detail: 'Moderate CR — typical for modern turbo engines', fuelReq: '93-95 octane' };
  if (cr < 11.5) return { status: 'MODERATE_HIGH', detail: 'Moderate-high CR — typical NA engine or mild boost', fuelReq: '95-98 octane' };
  if (cr < 13) return { status: 'HIGH', detail: 'High CR — NA performance engine, risk of detonation with boost', fuelReq: '98+ octane' };
  if (cr < 14.5) return { status: 'VERY_HIGH', detail: 'Very high CR — high-efficiency NA or Skyactiv/Atkinson type', fuelReq: '98+ octane or E85' };
  return { status: 'EXTREME', detail: 'Extreme CR — diesel-like. Requires very precise tuning and fuel', fuelReq: 'Race fuel or diesel' };
}


// ─── Dynamic / Effective Compression Ratio ──────────────────────────────

/**
 * Calculate dynamic compression ratio based on intake valve closing point
 */
export function calcDynamicCR(staticCR, stroke_mm, rodLength_mm, intakeValveClose_ABDC) {
  // IVC after BDC in degrees — earlier closing = higher effective CR
  const ivcRad = intakeValveClose_ABDC * Math.PI / 180;
  const R = rodLength_mm / stroke_mm * 2; // rod ratio

  // Effective stroke fraction at IVC
  const effectiveStroke = 1 - ((1 - Math.cos(ivcRad)) / 2 + (1 - Math.sqrt(1 - Math.pow(Math.sin(ivcRad) / (2 * R), 2))) / (2 * R));

  const effectiveCR = Math.pow(staticCR, effectiveStroke);

  // More accurate: volume-based
  const clearanceVolume = 1 / (staticCR - 1);
  const effectiveDisplacement = effectiveStroke; // normalized
  const dynamicCR = (effectiveDisplacement + clearanceVolume) / clearanceVolume;

  return {
    staticCR,
    stroke_mm,
    rodLength_mm,
    intakeValveClose_ABDC,
    rodRatio: Math.round(R * 100) / 100,
    effectiveStrokeFraction: Math.round(effectiveStroke * 1000) / 1000,
    dynamicCR: Math.round(dynamicCR * 100) / 100,
    crReduction: Math.round((staticCR - dynamicCR) * 100) / 100,
    note: 'Dynamic CR accounts for late intake valve closing — actual trapped charge is less than geometric displacement',
  };
}


// ─── Mean Piston Speed ──────────────────────────────────────────────────

/**
 * Calculate mean piston speed
 */
export function calcMeanPistonSpeed(stroke_mm, rpm) {
  const stroke_m = stroke_mm / 1000;
  const mps = 2 * stroke_m * rpm / 60;

  let assessment;
  if (mps < 15) assessment = 'CONSERVATIVE';
  else if (mps < 20) assessment = 'NORMAL';
  else if (mps < 25) assessment = 'HIGH';
  else if (mps < 28) assessment = 'VERY_HIGH';
  else assessment = 'EXTREME';

  return {
    stroke_mm,
    rpm,
    meanPistonSpeed_m_s: Math.round(mps * 100) / 100,
    meanPistonSpeed_ft_min: Math.round(mps * 196.85),
    assessment,
    limits: {
      streetEngine: '15-20 m/s typical',
      racingEngine: '20-25 m/s typical',
      f1Engine: '25-27 m/s',
      materialLimit: '~28 m/s for forged steel rods, ~30 m/s for titanium rods',
    },
    maxSafeRPM: Math.round(25 / (2 * stroke_m / 60)), // at 25 m/s limit
  };
}


// ─── Torque / HP Conversion ─────────────────────────────────────────────

/**
 * Convert between torque and horsepower
 */
export function convertTorqueHP(value, from, rpm) {
  let hp, torque_nm, torque_ftlb;

  switch (from) {
    case 'hp':
      hp = value;
      torque_ftlb = hp * 5252 / rpm;
      torque_nm = torque_ftlb * 1.3558;
      break;
    case 'nm':
      torque_nm = value;
      torque_ftlb = torque_nm / 1.3558;
      hp = torque_ftlb * rpm / 5252;
      break;
    case 'ftlb':
      torque_ftlb = value;
      torque_nm = torque_ftlb * 1.3558;
      hp = torque_ftlb * rpm / 5252;
      break;
    case 'kw':
      hp = value * 1.341;
      torque_ftlb = hp * 5252 / rpm;
      torque_nm = torque_ftlb * 1.3558;
      break;
    case 'ps':
      hp = value * 0.9863;
      torque_ftlb = hp * 5252 / rpm;
      torque_nm = torque_ftlb * 1.3558;
      break;
    default:
      return { error: `Unknown unit: ${from}. Use hp, nm, ftlb, kw, or ps` };
  }

  return {
    input: { value, unit: from, rpm },
    hp: Math.round(hp * 10) / 10,
    kw: Math.round(hp / 1.341 * 10) / 10,
    ps: Math.round(hp / 0.9863 * 10) / 10,
    torque_nm: Math.round(torque_nm * 10) / 10,
    torque_ftlb: Math.round(torque_ftlb * 10) / 10,
    torque_kgm: Math.round(torque_nm / 9.8067 * 100) / 100,
  };
}


// ─── BMEP (Brake Mean Effective Pressure) ───────────────────────────────

/**
 * Calculate BMEP from torque and displacement
 */
export function calcBMEP(torque_nm, displacement_cc, strokes = 4) {
  const displacement_L = displacement_cc / 1000;
  const n = strokes === 2 ? 1 : 2; // revolutions per power stroke

  // BMEP = (Torque × 2π × n) / displacement
  const bmep_kPa = (torque_nm * 2 * Math.PI * n) / (displacement_L / 1000);
  const bmep_bar = bmep_kPa / 100;
  const bmep_psi = bmep_bar * 14.5038;

  let assessment;
  if (bmep_bar < 10) assessment = 'LOW — typical NA economy engine';
  else if (bmep_bar < 13) assessment = 'MODERATE — good NA engine';
  else if (bmep_bar < 17) assessment = 'HIGH — well-tuned NA or mild boost';
  else if (bmep_bar < 25) assessment = 'VERY HIGH — typical turbo engine';
  else if (bmep_bar < 30) assessment = 'EXTREME — high-boost turbo';
  else assessment = 'RACE — competition-level output';

  return {
    torque_nm,
    displacement_cc,
    strokes,
    bmep_kPa: Math.round(bmep_kPa),
    bmep_bar: Math.round(bmep_bar * 100) / 100,
    bmep_psi: Math.round(bmep_psi * 10) / 10,
    assessment,
    references: {
      typicalNA: '10-13 bar',
      goodNA: '13-15 bar',
      turboStreet: '18-25 bar',
      turboRace: '25-35 bar',
      topFuel: '~80 bar',
    },
  };
}


// ─── Engine Efficiency ──────────────────────────────────────────────────

/**
 * Calculate thermal and volumetric efficiency
 */
export function calcEfficiency(hp, fuelFlow_kg_hr, fuelType = 'gasoline', displacement_cc = null, rpm = null, actualAirflow_kg_hr = null) {
  const fuelEnergy = { gasoline: 44000, diesel: 42500, e85: 29700, methanol: 19900 }; // kJ/kg
  const lhv = fuelEnergy[fuelType] || fuelEnergy.gasoline;

  const power_kW = hp * 0.7457;
  const fuelEnergy_kW = (fuelFlow_kg_hr / 3600) * lhv;
  const thermalEfficiency = power_kW / fuelEnergy_kW;

  const result = {
    hp,
    power_kW: Math.round(power_kW * 10) / 10,
    fuelFlow_kg_hr,
    fuelType,
    lhv_kJ_kg: lhv,
    fuelPower_kW: Math.round(fuelEnergy_kW * 10) / 10,
    thermalEfficiency_pct: Math.round(thermalEfficiency * 1000) / 10,
    bsfc_g_kWh: Math.round(fuelFlow_kg_hr * 1000 / power_kW * 10) / 10,
    bsfc_lb_hp_hr: Math.round(fuelFlow_kg_hr * 2.2046 / hp * 1000) / 1000,
  };

  if (displacement_cc && rpm) {
    const displacement_m3 = displacement_cc / 1e6;
    const theoreticalAir_kg_hr = displacement_m3 * (rpm / 2) * 60 * 1.225; // at sea level, 4-stroke
    result.theoreticalAirflow_kg_hr = Math.round(theoreticalAir_kg_hr * 10) / 10;

    if (actualAirflow_kg_hr) {
      result.volumetricEfficiency_pct = Math.round(actualAirflow_kg_hr / theoreticalAir_kg_hr * 1000) / 10;
    }
  }

  return result;
}


// ─── Rod Ratio Analysis ─────────────────────────────────────────────────

/**
 * Analyze connecting rod ratio
 */
export function calcRodRatio(rodLength_mm, stroke_mm) {
  const ratio = rodLength_mm / stroke_mm;

  let assessment;
  if (ratio < 1.5) assessment = 'SHORT — aggressive piston side-loading, rapid initial acceleration, broader torque curve';
  else if (ratio < 1.65) assessment = 'MODERATE_SHORT — common in performance engines, good mid-range';
  else if (ratio < 1.8) assessment = 'MODERATE — balanced, common in production engines';
  else if (ratio < 2.0) assessment = 'MODERATE_LONG — smoother piston motion, less side-loading, better ring seal';
  else assessment = 'LONG — minimal side-loading, very smooth, tall engine package';

  return {
    rodLength_mm,
    stroke_mm,
    rodRatio: Math.round(ratio * 1000) / 1000,
    assessment,
    effects: {
      shortRod: 'More piston dwell at TDC, higher piston speeds mid-stroke, broader torque',
      longRod: 'Less piston dwell at TDC, lower piston speeds, reduced friction, better top-end',
    },
    commonRatios: {
      honda_K20: '1.72',
      ej257_subaru: '1.57',
      ls_chevy: '1.63',
      '2jz_toyota': '1.75',
      sr20det: '1.65',
    },
  };
}


// ─── Cylinder Pressure Estimation ───────────────────────────────────────

/**
 * Estimate peak cylinder pressure
 */
export function estimateCylinderPressure(compressionRatio, boostPressure_bar = 0, fuelType = 'gasoline') {
  const mapPressure = ATMOSPHERIC_PRESSURE_KPA / 100 + boostPressure_bar; // bar absolute
  const motoring_bar = mapPressure * Math.pow(compressionRatio, GAMMA_AIR);

  const combustionMultiplier = {
    gasoline: 3.5,
    diesel: 2.5,
    e85: 3.8,
    methanol: 4.0,
  };

  const mult = combustionMultiplier[fuelType] || 3.5;
  const peakFiring_bar = motoring_bar * mult;

  let assessment;
  if (peakFiring_bar < 80) assessment = 'NORMAL — standard production engine range';
  else if (peakFiring_bar < 100) assessment = 'MODERATE — mildly tuned, stock internals usually sufficient';
  else if (peakFiring_bar < 120) assessment = 'HIGH — forged pistons recommended';
  else if (peakFiring_bar < 150) assessment = 'VERY HIGH — forged internals required, reinforced block recommended';
  else assessment = 'EXTREME — race-spec components, billet block may be needed';

  return {
    compressionRatio,
    boostPressure_bar,
    mapPressure_bar: Math.round(mapPressure * 100) / 100,
    fuelType,
    motoringPressure_bar: Math.round(motoring_bar * 10) / 10,
    estimatedPeakPressure_bar: Math.round(peakFiring_bar),
    estimatedPeakPressure_psi: Math.round(peakFiring_bar * 14.5038),
    assessment,
    note: 'Estimates based on polytropic compression and typical combustion pressure ratios. Actual values depend on timing, mixture, and combustion chamber design.',
  };
}


// ─── Listings ────────────────────────────────────────────────────────────

export function listEngineConfigs() {
  return Object.entries(ENGINE_CONFIGS).map(([name, cfg]) => ({
    name,
    ...cfg,
    displacement_cc: cfg.displacement_cc || Math.round(
      (Math.PI / 4) * Math.pow(cfg.bore_mm / 10, 2) * (cfg.stroke_mm / 10) * cfg.cylinders
    ),
  }));
}

export function getEngineConfig(name) {
  return ENGINE_CONFIGS[name] || null;
}

export function searchEngineConfigs(query) {
  const q = query.toLowerCase();
  return Object.entries(ENGINE_CONFIGS)
    .filter(([name, cfg]) =>
      name.toLowerCase().includes(q) || cfg.layout.toLowerCase().includes(q)
    )
    .map(([name, cfg]) => ({
      name,
      ...cfg,
      displacement_cc: cfg.displacement_cc || Math.round(
        (Math.PI / 4) * Math.pow(cfg.bore_mm / 10, 2) * (cfg.stroke_mm / 10) * cfg.cylinders
      ),
    }));
}

export function engineMathStats() {
  return {
    engineConfigs: Object.keys(ENGINE_CONFIGS).length,
    calculations: [
      'displacement', 'compressionRatio', 'dynamicCR', 'meanPistonSpeed',
      'torqueHPConvert', 'bmep', 'efficiency', 'rodRatio', 'cylinderPressure',
    ],
  };
}

export { ENGINE_CONFIGS };
