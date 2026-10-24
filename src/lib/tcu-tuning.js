// Transmission & TCU Tuning Calculator
// Shift point optimization, torque converter lockup, line pressure, launch control

// ─── Transmission Types ─────────────────────────────────────────────────

const TRANSMISSION_TYPES = {
  'zf_8hp': { name: 'ZF 8HP', type: 'torque_converter', gears: 8, maxTorque_nm: 1000, ratios: [4.714,3.143,2.106,1.667,1.285,1.000,0.839,0.667], reverseRatio: 3.317, finalDrive: 3.15, fluidCapacity_l: 9.0, tcStallRatio: 2.4, maxLinePress_bar: 40, shiftTime_ms: 200, application: 'BMW, Audi, Dodge, Jeep' },
  'zf_9hp': { name: 'ZF 9HP', type: 'torque_converter', gears: 9, maxTorque_nm: 480, ratios: [4.700,2.842,1.861,1.378,1.000,0.806,0.637,0.508,0.391], reverseRatio: 3.815, finalDrive: 3.30, fluidCapacity_l: 7.0, tcStallRatio: 2.2, maxLinePress_bar: 35, shiftTime_ms: 250, application: 'Honda, Jeep, Land Rover' },
  'aisin_aw_f21': { name: 'Aisin AW F21', type: 'torque_converter', gears: 6, maxTorque_nm: 750, ratios: [3.538,2.060,1.404,1.000,0.713,0.582], reverseRatio: 3.168, finalDrive: 3.73, fluidCapacity_l: 7.4, tcStallRatio: 2.3, maxLinePress_bar: 38, shiftTime_ms: 300, application: 'Toyota Supra, Lexus' },
  'getrag_dct_dq250': { name: 'Getrag DQ250 DSG', type: 'dct', gears: 6, maxTorque_nm: 350, ratios: [3.462,2.050,1.300,0.902,0.711,0.581], reverseRatio: 3.682, finalDrive: 4.12, fluidCapacity_l: 5.5, tcStallRatio: null, maxLinePress_bar: 50, shiftTime_ms: 8, application: 'VW Golf GTI, Audi S3 (wet clutch)' },
  'getrag_dct_dq381': { name: 'Getrag DQ381 DSG', type: 'dct', gears: 7, maxTorque_nm: 420, ratios: [3.765,2.273,1.531,1.121,1.176,0.951,0.795], reverseRatio: 4.396, finalDrive: 3.44, fluidCapacity_l: 5.7, tcStallRatio: null, maxLinePress_bar: 55, shiftTime_ms: 7, application: 'VW Golf R, Audi S3 (wet clutch)' },
  'mercedes_9g_tronic': { name: 'Mercedes 9G-Tronic', type: 'torque_converter', gears: 9, maxTorque_nm: 700, ratios: [5.500,3.330,2.315,1.661,1.211,1.000,0.865,0.717,0.601], reverseRatio: 4.932, finalDrive: 2.82, fluidCapacity_l: 8.5, tcStallRatio: 2.3, maxLinePress_bar: 42, shiftTime_ms: 150, application: 'Mercedes-Benz C/E/S class' },
  'gm_10l80': { name: 'GM 10L80', type: 'torque_converter', gears: 10, maxTorque_nm: 830, ratios: [4.702,2.990,2.149,1.769,1.520,1.275,1.000,0.854,0.689,0.636], reverseRatio: 4.866, finalDrive: 3.23, fluidCapacity_l: 10.3, tcStallRatio: 2.5, maxLinePress_bar: 45, shiftTime_ms: 200, application: 'Camaro ZL1, Corvette, Silverado' },
  'ford_10r80': { name: 'Ford 10R80', type: 'torque_converter', gears: 10, maxTorque_nm: 750, ratios: [4.696,2.985,2.179,1.801,1.539,1.288,1.000,0.822,0.640,0.588], reverseRatio: 4.786, finalDrive: 3.31, fluidCapacity_l: 10.6, tcStallRatio: 2.4, maxLinePress_bar: 42, shiftTime_ms: 250, application: 'Mustang, F-150' },
  'tremec_tr6060': { name: 'Tremec TR-6060', type: 'manual', gears: 6, maxTorque_nm: 880, ratios: [2.970,2.100,1.460,1.000,0.740,0.500], reverseRatio: 2.970, finalDrive: 3.73, fluidCapacity_l: 3.8, tcStallRatio: null, maxLinePress_bar: null, shiftTime_ms: null, application: 'Camaro SS, Mustang GT' },
  'nissan_jatco_re5r05a': { name: 'Nissan/Jatco RE5R05A', type: 'torque_converter', gears: 5, maxTorque_nm: 600, ratios: [3.842,2.353,1.531,1.000,0.834], reverseRatio: 3.195, finalDrive: 3.54, fluidCapacity_l: 10.0, tcStallRatio: 2.1, maxLinePress_bar: 35, shiftTime_ms: 350, application: 'Nissan 350Z, Infiniti G35' },
  'porsche_pdk': { name: 'Porsche PDK', type: 'dct', gears: 7, maxTorque_nm: 700, ratios: [3.545,2.095,1.407,1.077,0.868,0.693,0.554], reverseRatio: 3.445, finalDrive: 3.44, fluidCapacity_l: 9.0, tcStallRatio: null, maxLinePress_bar: 60, shiftTime_ms: 20, application: 'Porsche 911, Cayman, Boxster' },
  'bmw_gs6': { name: 'BMW GS6-53DZ', type: 'manual', gears: 6, maxTorque_nm: 550, ratios: [4.055,2.369,1.582,1.185,1.000,0.846], reverseRatio: 3.677, finalDrive: 3.46, fluidCapacity_l: 1.6, tcStallRatio: null, maxLinePress_bar: null, shiftTime_ms: null, application: 'BMW M3 E46, M3 E9x' },
};


// ─── Torque Converter Types ─────────────────────────────────────────────

const TORQUE_CONVERTERS = {
  'stock_zf8hp': { name: 'ZF 8HP Stock', stallSpeed_rpm: 2200, stallRatio: 2.4, lockupClutch: true, multiPlate: true, diameterInch: 11.0, application: 'OEM ZF 8HP' },
  'circle_d_hp': { name: 'Circle D HP Series', stallSpeed_rpm: 2800, stallRatio: 2.6, lockupClutch: true, multiPlate: true, diameterInch: 10.0, application: 'LS/LT, GM 10L80' },
  'circle_d_pro1': { name: 'Circle D Pro Series', stallSpeed_rpm: 3200, stallRatio: 2.8, lockupClutch: true, multiPlate: true, diameterInch: 10.0, application: 'GM 4L60E/4L80E' },
  'precision_ind_hd': { name: 'Precision Industries HD', stallSpeed_rpm: 2400, stallRatio: 2.5, lockupClutch: true, multiPlate: true, diameterInch: 12.0, application: 'Cummins/Allison' },
  'goerend_triple': { name: 'Goerend Triple Disc', stallSpeed_rpm: 2600, stallRatio: 2.7, lockupClutch: true, multiPlate: true, diameterInch: 11.0, application: '47RE/48RE Dodge' },
  'bte_nitrous': { name: 'BTE Nitrous Series', stallSpeed_rpm: 4500, stallRatio: 3.2, lockupClutch: false, multiPlate: false, diameterInch: 9.0, application: 'Drag racing' },
  'yank_ss': { name: 'Yank SS Series', stallSpeed_rpm: 3000, stallRatio: 2.7, lockupClutch: true, multiPlate: true, diameterInch: 10.0, application: 'GM 4L60E/4L80E' },
};


// ─── Shift Strategy Profiles ────────────────────────────────────────────

const SHIFT_PROFILES = {
  'economy': { name: 'Economy', upshiftRPM_pct: 0.55, downshiftRPM_pct: 0.35, aggressiveness: 0.2, lockupEarly: true, coastDownshift: false, skipShift: true, description: 'Maximize fuel economy' },
  'normal': { name: 'Normal', upshiftRPM_pct: 0.65, downshiftRPM_pct: 0.40, aggressiveness: 0.5, lockupEarly: true, coastDownshift: false, skipShift: false, description: 'Balanced daily driving' },
  'sport': { name: 'Sport', upshiftRPM_pct: 0.80, downshiftRPM_pct: 0.55, aggressiveness: 0.75, lockupEarly: false, coastDownshift: true, skipShift: false, description: 'Spirited driving' },
  'track': { name: 'Track', upshiftRPM_pct: 0.95, downshiftRPM_pct: 0.70, aggressiveness: 0.95, lockupEarly: false, coastDownshift: true, skipShift: false, description: 'Maximum performance' },
  'drag': { name: 'Drag', upshiftRPM_pct: 1.0, downshiftRPM_pct: 0.80, aggressiveness: 1.0, lockupEarly: false, coastDownshift: false, skipShift: false, description: 'Drag strip launch' },
  'tow': { name: 'Tow/Haul', upshiftRPM_pct: 0.70, downshiftRPM_pct: 0.50, aggressiveness: 0.6, lockupEarly: false, coastDownshift: true, skipShift: false, description: 'Towing / heavy load' },
};


// ─── Functions ──────────────────────────────────────────────────────────

export function calcShiftPoints(transKey, redline_rpm, peakTorqueRPM, profileKey = 'normal') {
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);
  const profile = SHIFT_PROFILES[profileKey] || SHIFT_PROFILES.normal;

  const upshiftRPM = Math.round(redline_rpm * profile.upshiftRPM_pct);
  const downshiftRPM = Math.round(redline_rpm * profile.downshiftRPM_pct);
  const shifts = [];

  for (let i = 0; i < trans.gears - 1; i++) {
    const ratioDrop = trans.ratios[i] / trans.ratios[i + 1];
    const landingRPM = Math.round(upshiftRPM / ratioDrop);
    const inPowerBand = landingRPM >= peakTorqueRPM * 0.85;
    shifts.push({
      from: i + 1,
      to: i + 2,
      upshiftRPM,
      landingRPM,
      ratioDrop: Math.round(ratioDrop * 1000) / 1000,
      inPowerBand,
      downshiftRPM,
      note: inPowerBand ? 'Good — stays in power band' : `Warning — drops below ${Math.round(peakTorqueRPM * 0.85)} RPM`,
    });
  }

  return {
    transmission: trans.name,
    profile: profile.name,
    redline_rpm,
    peakTorqueRPM,
    upshiftTarget_rpm: upshiftRPM,
    downshiftTarget_rpm: downshiftRPM,
    shifts,
    recommendation: shifts.filter(s => !s.inPowerBand).length > 0
      ? 'Some shifts drop below power band — consider a shorter final drive or different profile'
      : 'All shifts keep engine in power band',
  };
}


export function calcLinePressure(transKey, torque_nm, gear, safetyMargin = 1.15) {
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);
  if (trans.maxLinePress_bar == null) return { error: 'Manual transmission — no line pressure control' };
  if (gear < 1 || gear > trans.gears) throw new Error(`Gear must be 1-${trans.gears}`);

  const ratio = trans.ratios[gear - 1];
  const clutchTorque = torque_nm * ratio;
  // Simplified: line pressure proportional to clutch torque demand
  const basePressure = (clutchTorque / trans.maxTorque_nm) * trans.maxLinePress_bar;
  const requiredPressure = Math.round(basePressure * safetyMargin * 10) / 10;
  const cappedPressure = Math.min(requiredPressure, trans.maxLinePress_bar);
  const atLimit = requiredPressure >= trans.maxLinePress_bar;

  return {
    transmission: trans.name,
    gear,
    gearRatio: ratio,
    inputTorque_nm: torque_nm,
    clutchTorque_nm: Math.round(clutchTorque),
    basePressure_bar: Math.round(basePressure * 10) / 10,
    requiredPressure_bar: requiredPressure,
    cappedPressure_bar: cappedPressure,
    maxPressure_bar: trans.maxLinePress_bar,
    safetyMargin,
    atLimit,
    note: atLimit
      ? 'At maximum line pressure — risk of clutch slip above this torque'
      : 'Within safe operating range',
  };
}


export function calcTorqueConverterSlip(converterKey, engineTorque_nm, engineRPM, turbineRPM) {
  const tc = TORQUE_CONVERTERS[converterKey];
  if (!tc) throw new Error('Unknown torque converter: ' + converterKey);

  const speedRatio = turbineRPM / engineRPM;
  const slip_pct = (1 - speedRatio) * 100;
  const inStall = engineRPM <= tc.stallSpeed_rpm * 1.1 && turbineRPM < engineRPM * 0.3;
  const torqueMultiplication = inStall ? tc.stallRatio : 1 + (tc.stallRatio - 1) * (1 - speedRatio);
  const outputTorque = Math.round(engineTorque_nm * torqueMultiplication);
  const heatGen_kW = (engineTorque_nm * (engineRPM - turbineRPM) * Math.PI / 30) / 1000;

  return {
    converter: tc.name,
    engineRPM,
    turbineRPM,
    speedRatio: Math.round(speedRatio * 1000) / 1000,
    slip_pct: Math.round(slip_pct * 10) / 10,
    inStall,
    torqueMultiplication: Math.round(torqueMultiplication * 100) / 100,
    inputTorque_nm: engineTorque_nm,
    outputTorque_nm: outputTorque,
    heatGeneration_kW: Math.round(heatGen_kW * 10) / 10,
    lockupRecommended: slip_pct < 5 && !inStall,
    note: inStall ? `Stall condition — ${tc.stallRatio}:1 multiplication` : slip_pct < 3 ? 'Near coupling — lockup recommended' : `${Math.round(slip_pct)}% slip — ${Math.round(heatGen_kW)}kW heat generation`,
  };
}


export function calcLaunchControl(transKey, converterKey, redline_rpm, vehicleWeight_kg, tireGrip_g = 1.0) {
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);

  const isAuto = trans.type === 'torque_converter';
  const isDCT = trans.type === 'dct';

  let launchRPM, method;

  if (isAuto && converterKey) {
    const tc = TORQUE_CONVERTERS[converterKey];
    if (!tc) throw new Error('Unknown torque converter: ' + converterKey);
    // Launch at or just above stall speed for max torque multiplication
    launchRPM = Math.round(tc.stallSpeed_rpm * 1.05);
    method = 'torque_converter_stall';
  } else if (isDCT) {
    // DCT: launch at peak torque with clutch slip
    launchRPM = Math.round(redline_rpm * 0.55);
    method = 'dct_clutch_slip';
  } else {
    // Manual: clutch dump or slip from mid-range
    launchRPM = Math.round(redline_rpm * 0.50);
    method = 'clutch_release';
  }

  // Max tractive force in first gear
  const firstGearRatio = trans.ratios[0] * trans.finalDrive;
  // Assume 0.30m tire rolling radius
  const tireRadius_m = 0.30;
  // Max tire force = weight * grip * g
  const maxTireForce_N = vehicleWeight_kg * tireGrip_g * 9.81;
  const maxAccel_g = tireGrip_g;

  return {
    transmission: trans.name,
    launchRPM,
    method,
    firstGearRatio: Math.round(firstGearRatio * 100) / 100,
    maxTireForce_N: Math.round(maxTireForce_N),
    maxAcceleration_g: maxAccel_g,
    estimated060_s: estimateLaunchTime(vehicleWeight_kg, maxTireForce_N, trans),
    settings: {
      launchRPM_limit: launchRPM,
      antiLagEnabled: method === 'dct_clutch_slip',
      tractionControl: tireGrip_g < 1.2 ? 'recommended' : 'optional',
      flatFootShift: isDCT || isAuto,
      burnoutMode: false,
    },
  };
}

function estimateLaunchTime(mass_kg, maxForce_N, trans) {
  // Simplified 0-100 km/h estimate using first 2 gears
  const target_mps = 100 / 3.6; // 27.78 m/s
  let speed = 0;
  let time = 0;
  const dt = 0.01;
  let gear = 0;

  while (speed < target_mps && time < 20) {
    const ratio = trans.ratios[gear] * trans.finalDrive;
    const force = Math.min(maxForce_N, maxForce_N * 0.9); // rough drag loss
    const accel = force / mass_kg;
    speed += accel * dt;
    time += dt;
    // Simple shift logic
    if (gear < trans.gears - 1 && speed > target_mps * ((gear + 1) / trans.gears) * 1.2) {
      gear++;
      time += (trans.shiftTime_ms || 300) / 1000;
    }
  }
  return Math.round(time * 100) / 100;
}


export function optimizeShiftSchedule(transKey, torqueCurve_nm, redline_rpm) {
  // torqueCurve_nm: array of {rpm, torque_nm}
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);
  if (!torqueCurve_nm || torqueCurve_nm.length < 3) throw new Error('Need at least 3 torque curve points');

  const sorted = [...torqueCurve_nm].sort((a, b) => a.rpm - b.rpm);
  const peakTorque = sorted.reduce((max, p) => p.torque_nm > max.torque_nm ? p : max, sorted[0]);

  // For each gear transition, find the optimal shift point
  const optimalShifts = [];
  for (let i = 0; i < trans.gears - 1; i++) {
    const ratioThis = trans.ratios[i];
    const ratioNext = trans.ratios[i + 1];
    const ratioDrop = ratioThis / ratioNext;

    // Find the RPM where wheel torque in current gear equals wheel torque in next gear
    let bestShiftRPM = redline_rpm;
    let bestWheelTorqueDiff = -Infinity;

    for (let rpm = Math.round(peakTorque.rpm); rpm <= redline_rpm; rpm += 50) {
      const torqueAtRPM = interpolateTorque(sorted, rpm);
      const wheelTorqueCurrent = torqueAtRPM * ratioThis;

      const landingRPM = rpm / ratioDrop;
      const torqueAtLanding = interpolateTorque(sorted, landingRPM);
      const wheelTorqueNext = torqueAtLanding * ratioNext;

      // Shift when current gear's wheel torque falls below next gear's
      if (wheelTorqueCurrent >= wheelTorqueNext && wheelTorqueCurrent - wheelTorqueNext < bestWheelTorqueDiff || bestWheelTorqueDiff === -Infinity) {
        bestWheelTorqueDiff = wheelTorqueCurrent - wheelTorqueNext;
        bestShiftRPM = rpm;
      }
    }

    optimalShifts.push({
      from: i + 1,
      to: i + 2,
      optimalShiftRPM: bestShiftRPM,
      landingRPM: Math.round(bestShiftRPM / ratioDrop),
      ratioDrop: Math.round(ratioDrop * 1000) / 1000,
    });
  }

  return {
    transmission: trans.name,
    peakTorqueRPM: peakTorque.rpm,
    peakTorque_nm: peakTorque.torque_nm,
    redline_rpm,
    optimalShifts,
    method: 'wheel_torque_crossover',
    note: 'Shift points optimized for maximum acceleration — where wheel torque in next gear exceeds current gear',
  };
}

function interpolateTorque(curve, rpm) {
  if (rpm <= curve[0].rpm) return curve[0].torque_nm;
  if (rpm >= curve[curve.length - 1].rpm) return curve[curve.length - 1].torque_nm;
  for (let i = 0; i < curve.length - 1; i++) {
    if (rpm >= curve[i].rpm && rpm <= curve[i + 1].rpm) {
      const frac = (rpm - curve[i].rpm) / (curve[i + 1].rpm - curve[i].rpm);
      return curve[i].torque_nm + frac * (curve[i + 1].torque_nm - curve[i].torque_nm);
    }
  }
  return curve[curve.length - 1].torque_nm;
}


export function calcClutchWear(transKey, torque_nm, slipTime_s, slipRPM_delta) {
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);
  if (trans.type === 'manual') return { error: 'Use for automatic/DCT only — manual clutch wear is driver-dependent' };

  // Energy dissipated = torque × angular_velocity_slip × time
  const slipRad = slipRPM_delta * Math.PI / 30;
  const energy_kJ = (torque_nm * slipRad * slipTime_s) / 1000;
  const power_kW = energy_kJ / slipTime_s;

  let severity;
  if (energy_kJ > 50) severity = 'critical';
  else if (energy_kJ > 25) severity = 'high';
  else if (energy_kJ > 10) severity = 'moderate';
  else severity = 'low';

  return {
    transmission: trans.name,
    torque_nm,
    slipTime_s,
    slipRPM_delta,
    energyDissipated_kJ: Math.round(energy_kJ * 10) / 10,
    avgPower_kW: Math.round(power_kW * 10) / 10,
    severity,
    clutchLifeImpact: severity === 'critical' ? 'Severe — repeated events will cause premature failure' : severity === 'high' ? 'Significant — minimize frequency' : severity === 'moderate' ? 'Acceptable for occasional spirited driving' : 'Minimal — within normal operating range',
    recommendation: power_kW > 50 ? 'Consider upgraded clutch material or more aggressive lockup strategy' : 'Within clutch thermal capacity',
  };
}


export function recommendFluid(transKey) {
  const trans = TRANSMISSION_TYPES[transKey];
  if (!trans) throw new Error('Unknown transmission: ' + transKey);

  const recommendations = {
    'zf_8hp': { oem: 'ZF Lifeguard 8', alternatives: ['Pentosin ATF 8HP', 'Ravenol ATF 8HP'], interval_km: 60000, severe_km: 40000 },
    'zf_9hp': { oem: 'ZF Lifeguard 9', alternatives: ['Pentosin ATF 9HP'], interval_km: 60000, severe_km: 40000 },
    'aisin_aw_f21': { oem: 'Toyota WS ATF', alternatives: ['Aisin ATF WS'], interval_km: 60000, severe_km: 40000 },
    'getrag_dct_dq250': { oem: 'VW G 052 182 A2', alternatives: ['Pentosin FFL-2'], interval_km: 60000, severe_km: 40000 },
    'getrag_dct_dq381': { oem: 'VW G 052 529', alternatives: ['Pentosin FFL-4'], interval_km: 60000, severe_km: 40000 },
    'mercedes_9g_tronic': { oem: 'MB 236.17', alternatives: ['Fuchs Titan ATF 9134'], interval_km: 60000, severe_km: 40000 },
    'gm_10l80': { oem: 'Dexron ULV', alternatives: ['Mobil 1 Synthetic ATF'], interval_km: 75000, severe_km: 50000 },
    'ford_10r80': { oem: 'Mercon ULV', alternatives: ['Motorcraft Mercon ULV'], interval_km: 75000, severe_km: 50000 },
    'tremec_tr6060': { oem: 'Tremec HP MTF', alternatives: ['Royal Purple Synchromax', 'Amsoil MTF'], interval_km: 50000, severe_km: 30000 },
    'nissan_jatco_re5r05a': { oem: 'Nissan Matic S', alternatives: ['Valvoline MaxLife ATF'], interval_km: 50000, severe_km: 30000 },
    'porsche_pdk': { oem: 'Pentosin FFL-4', alternatives: ['Fuchs Titan DCTF'], interval_km: 60000, severe_km: 40000 },
    'bmw_gs6': { oem: 'BMW MTF LT-4', alternatives: ['Redline MTL', 'Royal Purple Synchromax'], interval_km: 50000, severe_km: 30000 },
  };

  const rec = recommendations[transKey] || { oem: 'Consult manufacturer', alternatives: [], interval_km: 50000, severe_km: 30000 };
  return {
    transmission: trans.name,
    type: trans.type,
    capacity_l: trans.fluidCapacity_l,
    ...rec,
    note: trans.type === 'dct' ? 'DCT fluid is critical — use ONLY approved specifications' : 'ATF quality directly affects shift quality and transmission life',
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listTransmissionTypes() {
  return Object.entries(TRANSMISSION_TYPES).map(([key, t]) => ({ key, name: t.name, type: t.type, gears: t.gears, maxTorque_nm: t.maxTorque_nm, application: t.application }));
}
export function getTransmissionType(key) { return TRANSMISSION_TYPES[key] || null; }
export function searchTransmissionTypes(query) {
  const q = query.toLowerCase();
  return Object.entries(TRANSMISSION_TYPES).filter(([k, t]) => k.includes(q) || t.name.toLowerCase().includes(q) || t.application.toLowerCase().includes(q)).map(([key, t]) => ({ key, name: t.name, type: t.type, gears: t.gears, application: t.application }));
}

export function listTorqueConverters() {
  return Object.entries(TORQUE_CONVERTERS).map(([key, tc]) => ({ key, name: tc.name, stallSpeed_rpm: tc.stallSpeed_rpm, stallRatio: tc.stallRatio, application: tc.application }));
}
export function getTorqueConverter(key) { return TORQUE_CONVERTERS[key] || null; }

export function listShiftProfiles() {
  return Object.entries(SHIFT_PROFILES).map(([key, p]) => ({ key, name: p.name, aggressiveness: p.aggressiveness, description: p.description }));
}
export function getShiftProfile(key) { return SHIFT_PROFILES[key] || null; }

export function tcuTuningStats() {
  return {
    transmissions: Object.keys(TRANSMISSION_TYPES).length,
    torqueConverters: Object.keys(TORQUE_CONVERTERS).length,
    shiftProfiles: Object.keys(SHIFT_PROFILES).length,
    calculations: ['calcShiftPoints', 'calcLinePressure', 'calcTorqueConverterSlip', 'calcLaunchControl', 'optimizeShiftSchedule', 'calcClutchWear', 'recommendFluid'],
  };
}

export { TRANSMISSION_TYPES, TORQUE_CONVERTERS, SHIFT_PROFILES };
