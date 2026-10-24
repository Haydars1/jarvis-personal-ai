// Intake Manifold & Throttle Body Calculator
// Runner length/diameter, plenum volume, throttle body sizing, airflow estimates

// ─── Manifold Database ──────────────────────────────────────────────────

const MANIFOLD_DATABASE = {
  'stock-4cyl-na': { name: 'Stock 4-cyl NA', type: 'log', runners: 4, runnerLength_mm: 400, runnerDiam_mm: 36, plenumVolume_cc: 1500, throttleBody_mm: 56, peakTorqueRPM: 4000, application: 'OEM 1.6-2.0L NA engines' },
  'stock-4cyl-turbo': { name: 'Stock 4-cyl Turbo', type: 'log', runners: 4, runnerLength_mm: 250, runnerDiam_mm: 38, plenumVolume_cc: 2000, throttleBody_mm: 60, peakTorqueRPM: 3500, application: 'OEM 1.4-2.0L turbo engines' },
  'stock-v6-na': { name: 'Stock V6 NA', type: 'dual-plane', runners: 6, runnerLength_mm: 350, runnerDiam_mm: 40, plenumVolume_cc: 3000, throttleBody_mm: 65, peakTorqueRPM: 4500, application: 'OEM 2.5-3.5L V6' },
  'stock-v8-na': { name: 'Stock V8 NA', type: 'dual-plane', runners: 8, runnerLength_mm: 300, runnerDiam_mm: 42, plenumVolume_cc: 4000, throttleBody_mm: 75, peakTorqueRPM: 4000, application: 'OEM 4.0-5.7L V8' },
  'single-plane-v8': { name: 'Single Plane V8', type: 'single-plane', runners: 8, runnerLength_mm: 200, runnerDiam_mm: 50, plenumVolume_cc: 5500, throttleBody_mm: 90, peakTorqueRPM: 5500, application: 'Performance V8, high RPM focus' },
  'itb-4cyl': { name: 'ITB 4-cyl', type: 'individual-throttle-body', runners: 4, runnerLength_mm: 300, runnerDiam_mm: 45, plenumVolume_cc: 0, throttleBody_mm: 45, peakTorqueRPM: 6000, application: 'NA high-RPM 4-cyl, motorsport' },
  'itb-6cyl': { name: 'ITB 6-cyl', type: 'individual-throttle-body', runners: 6, runnerLength_mm: 280, runnerDiam_mm: 42, plenumVolume_cc: 0, throttleBody_mm: 42, peakTorqueRPM: 6500, application: 'NA high-RPM inline-6, motorsport' },
  'sheet-metal-turbo': { name: 'Sheet Metal Turbo Manifold', type: 'log', runners: 4, runnerLength_mm: 150, runnerDiam_mm: 44, plenumVolume_cc: 3500, throttleBody_mm: 70, peakTorqueRPM: 4000, application: 'High-boost turbo 4-cyl builds' },
  'tunnel-ram-v8': { name: 'Tunnel Ram V8', type: 'tunnel-ram', runners: 8, runnerLength_mm: 350, runnerDiam_mm: 55, plenumVolume_cc: 7000, throttleBody_mm: 52, peakTorqueRPM: 6000, application: 'Race V8 with dual carbs/TB' },
  'ls-cathedral': { name: 'LS Cathedral Port', type: 'single-plane', runners: 8, runnerLength_mm: 240, runnerDiam_mm: 48, plenumVolume_cc: 4800, throttleBody_mm: 90, peakTorqueRPM: 5000, application: 'GM LS1/LS6 engines' },
  'ls-rectangular': { name: 'LS Rectangular Port', type: 'single-plane', runners: 8, runnerLength_mm: 230, runnerDiam_mm: 52, plenumVolume_cc: 5200, throttleBody_mm: 102, peakTorqueRPM: 5500, application: 'GM LS3/L99/LS7 engines' },
};


// ─── Throttle Body Database ─────────────────────────────────────────────

const THROTTLE_BODY_DATABASE = {
  'oem-56mm': { name: 'OEM 56mm', bore_mm: 56, flowRate_cfm: 320, type: 'single-blade', application: '4-cyl NA up to 150hp' },
  'oem-60mm': { name: 'OEM 60mm', bore_mm: 60, flowRate_cfm: 380, type: 'single-blade', application: '4-cyl turbo, NA 6-cyl up to 200hp' },
  'bbk-65mm': { name: 'BBK 65mm', bore_mm: 65, flowRate_cfm: 450, type: 'single-blade', application: '4-cyl turbo up to 300hp' },
  'oem-70mm': { name: 'OEM 70mm', bore_mm: 70, flowRate_cfm: 520, type: 'single-blade', application: 'V6, mild V8 up to 350hp' },
  'bbk-75mm': { name: 'BBK 75mm', bore_mm: 75, flowRate_cfm: 600, type: 'single-blade', application: 'V8 up to 400hp' },
  'oem-80mm': { name: 'OEM 80mm', bore_mm: 80, flowRate_cfm: 690, type: 'single-blade', application: 'V8 350-450hp' },
  'oem-90mm': { name: 'OEM 90mm (LS1)', bore_mm: 90, flowRate_cfm: 850, type: 'single-blade', application: 'LS1/LS6, V8 400-550hp' },
  'nick-williams-102mm': { name: 'Nick Williams 102mm', bore_mm: 102, flowRate_cfm: 1100, type: 'single-blade', application: 'LS3/LS7, big V8 500-700hp' },
  'accufab-105mm': { name: 'Accufab 105mm', bore_mm: 105, flowRate_cfm: 1200, type: 'single-blade', application: 'Supercharged/turbo V8 600-900hp' },
  'twin-65mm': { name: 'Dual 65mm', bore_mm: 65, flowRate_cfm: 900, type: 'twin-blade', application: 'High-perf V8, tunnel ram' },
};


// ─── Runner Length Calculator ───────────────────────────────────────────

export function calcRunnerLength(targetPeakTorqueRPM, numCylinders = 4) {
  // Helmholtz resonance tuning
  // L = (speedOfSound * Kd) / (2 * targetRPM * pulses_per_rev) - correction
  // Simplified: L_inches = 85000 / targetRPM (empirical for 4-stroke)
  // Then adjust for number of cylinders

  const pulsesPerRev = numCylinders / 2; // 4-stroke
  const L_mm = (85000 / targetPeakTorqueRPM) * 25.4;

  // Secondary tuning harmonic
  const L_secondary_mm = L_mm / 2;

  return {
    targetPeakTorqueRPM,
    numCylinders,
    primaryRunnerLength_mm: Math.round(L_mm),
    primaryRunnerLength_in: Math.round(L_mm / 25.4 * 10) / 10,
    secondaryHarmonicLength_mm: Math.round(L_secondary_mm),
    notes: [
      `Primary runner length tuned for peak torque at ${targetPeakTorqueRPM} RPM`,
      'Shorter runners = higher RPM peak torque, less low-end',
      'Longer runners = lower RPM peak torque, better street driveability',
      L_mm > 400 ? 'Very long runners — consider variable-length intake' : null,
      L_mm < 150 ? 'Very short runners — race-only, poor low-RPM torque' : null,
    ].filter(Boolean),
  };
}


// ─── Runner Diameter Calculator ─────────────────────────────────────────

export function calcRunnerDiameter(targetHP, numCylinders = 4, peakRPM = 6500) {
  // Flow velocity target: 75-85 m/s at peak RPM
  // Volume flow per cylinder = (displacement/cyl * RPM * VE) / (2 * 60)
  // Assuming 1.0L per cylinder and 90% VE as baseline, scale by HP
  const hpPerCyl = targetHP / numCylinders;
  const estimatedDisplacement_L = (targetHP / 100) * 1.0; // rough estimate
  const displPerCyl_cc = (estimatedDisplacement_L * 1000) / numCylinders;

  // Volume flow per cylinder at peak RPM (cc/s)
  const VE = 0.90;
  const volFlow_cc_s = (displPerCyl_cc * peakRPM * VE) / (2 * 60);

  // Target velocity 80 m/s = 80000 mm/s
  const targetVel = 80000; // mm/s
  const volFlow_mm3_s = volFlow_cc_s * 1000;
  const area_mm2 = volFlow_mm3_s / targetVel;
  const diameter_mm = Math.sqrt(4 * area_mm2 / Math.PI);

  return {
    targetHP,
    numCylinders,
    peakRPM,
    hpPerCylinder: Math.round(hpPerCyl),
    recommendedDiameter_mm: Math.round(diameter_mm),
    recommendedDiameter_in: Math.round(diameter_mm / 25.4 * 100) / 100,
    airVelocity_m_s: 80,
    crossSectionArea_mm2: Math.round(area_mm2),
    notes: [
      'Runner velocity target: 75-85 m/s for best signal and torque',
      diameter_mm > 55 ? 'Large runners — may lose low-RPM velocity signal' : null,
      diameter_mm < 30 ? 'Small runners — restrictive above target RPM' : null,
      'Port-match to cylinder head for best results',
    ].filter(Boolean),
  };
}


// ─── Plenum Volume Calculator ───────────────────────────────────────────

export function calcPlenumVolume(displacement_cc, numCylinders = 4, isTurbo = false) {
  // Rule of thumb:
  // NA: plenum = 0.5-0.8x total displacement
  // Turbo: plenum = 1.0-1.5x total displacement (buffer for boost)
  // ITB: no plenum needed

  const minMultiplier = isTurbo ? 1.0 : 0.5;
  const maxMultiplier = isTurbo ? 1.5 : 0.8;
  const optimalMultiplier = isTurbo ? 1.2 : 0.65;

  return {
    displacement_cc,
    numCylinders,
    isTurbo,
    minPlenumVolume_cc: Math.round(displacement_cc * minMultiplier),
    optimalPlenumVolume_cc: Math.round(displacement_cc * optimalMultiplier),
    maxPlenumVolume_cc: Math.round(displacement_cc * maxMultiplier),
    plenumVolume_L: Math.round(displacement_cc * optimalMultiplier / 100) / 10,
    notes: [
      isTurbo ? 'Turbo engines benefit from larger plenum (boost buffer)' : 'NA engines use smaller plenum (sharper throttle response)',
      'Too large = sluggish throttle response, lean hesitation',
      'Too small = restrictive at high RPM, uneven distribution',
      'Shape matters: tapered is better than box-shaped for even distribution',
    ],
  };
}


// ─── Throttle Body Sizing ───────────────────────────────────────────────

export function sizeThrottleBody(targetHP, isTurbo = false) {
  // Airflow needed: ~1.5 CFM per HP (NA), ~1.3 CFM per HP (turbo, denser air)
  const cfmPerHP = isTurbo ? 1.3 : 1.5;
  const requiredCFM = targetHP * cfmPerHP;

  // Find matching throttle bodies
  const matches = Object.entries(THROTTLE_BODY_DATABASE)
    .map(([key, tb]) => ({ key, ...tb, headroom_pct: Math.round(((tb.flowRate_cfm - requiredCFM) / requiredCFM) * 100) }))
    .filter(tb => tb.headroom_pct >= -5) // within 5% of needed
    .sort((a, b) => Math.abs(a.headroom_pct - 15) - Math.abs(b.headroom_pct - 15)); // prefer ~15% headroom

  return {
    targetHP,
    isTurbo,
    requiredAirflow_cfm: Math.round(requiredCFM),
    recommendedBore_mm: matches.length > 0 ? matches[0].bore_mm : null,
    recommendations: matches.slice(0, 3),
    notes: [
      'Ideal throttle body has 10-20% headroom over required CFM',
      'Too large = poor throttle response, tip-in issues',
      'Too small = restrictive at WOT, power loss',
      isTurbo ? 'Turbo cars use compressed air — slightly smaller TB works' : null,
    ].filter(Boolean),
  };
}


// ─── Airflow Estimate ───────────────────────────────────────────────────

export function estimateAirflow(displacement_cc, rpm, VE_pct = 90, boostPressure_bar = 0) {
  // Volume flow = (displacement * RPM * VE) / (2 * 1000) for 4-stroke, L/min
  const VE = VE_pct / 100;
  const pressureRatio = 1 + boostPressure_bar; // absolute / atmospheric

  const volumeFlow_L_min = (displacement_cc * rpm * VE) / (2 * 1000);
  const massFlow_L_min = volumeFlow_L_min * pressureRatio;

  // Convert to CFM (1 L/min = 0.03531 CFM)
  const volumeFlow_cfm = volumeFlow_L_min * 0.03531;
  const massFlow_cfm = massFlow_L_min * 0.03531;

  // Mass airflow in g/s (air density ~1.2 kg/m³ at sea level)
  const massFlow_g_s = (massFlow_L_min / 60) * 1.2;

  return {
    displacement_cc,
    rpm,
    VE_pct,
    boostPressure_bar,
    volumeFlow_L_min: Math.round(volumeFlow_L_min),
    massFlow_L_min: Math.round(massFlow_L_min),
    volumeFlow_cfm: Math.round(volumeFlow_cfm),
    massFlow_cfm: Math.round(massFlow_cfm),
    massAirflow_g_s: Math.round(massFlow_g_s * 10) / 10,
    estimatedHP: Math.round(massFlow_cfm / 1.5), // rough: 1.5 CFM per HP
    notes: [
      `At ${rpm} RPM with ${VE_pct}% VE`,
      boostPressure_bar > 0 ? `Boost: ${boostPressure_bar} bar adds ${Math.round((pressureRatio - 1) * 100)}% airflow` : 'Naturally aspirated',
    ],
  };
}


// ─── Variable Runner Length Analysis ────────────────────────────────────

export function analyzeVariableIntake(shortLength_mm, longLength_mm, switchRPM) {
  // Short runners: tuned for high RPM
  const shortPeakRPM = Math.round(85000 * 25.4 / shortLength_mm);
  // Long runners: tuned for low RPM
  const longPeakRPM = Math.round(85000 * 25.4 / longLength_mm);

  return {
    shortRunnerLength_mm: shortLength_mm,
    longRunnerLength_mm: longLength_mm,
    switchRPM,
    shortRunnerPeakTorqueRPM: shortPeakRPM,
    longRunnerPeakTorqueRPM: longPeakRPM,
    effectiveTorqueBand: `${longPeakRPM}-${shortPeakRPM} RPM`,
    analysis: {
      lowRPM: `Long runners (${longLength_mm}mm) active below ${switchRPM} RPM — peak torque at ~${longPeakRPM} RPM`,
      highRPM: `Short runners (${shortLength_mm}mm) active above ${switchRPM} RPM — peak torque at ~${shortPeakRPM} RPM`,
      switchPoint: switchRPM >= longPeakRPM && switchRPM <= shortPeakRPM ? 'GOOD — switch point within torque band' : 'SUBOPTIMAL — consider adjusting switch RPM',
    },
    examples: [
      'BMW DISA valve: 310mm / 530mm, switch at 3500 RPM',
      'Honda VTEC intake (R18): 300mm / 480mm, switch at 3800 RPM',
      'Toyota ACIS (2JZ): 250mm / 450mm, switch at 4000 RPM',
    ],
  };
}


// ─── Port Flow Estimate ────────────────────────────────────────────────

export function estimatePortFlow(portDiameter_mm, portLength_mm, surfaceFinish = 'cast') {
  // Flow coefficient based on surface finish and geometry
  const finishCoeff = { cast: 0.55, ported: 0.68, cnc: 0.75, polished: 0.72 };
  const Cd = finishCoeff[surfaceFinish] || 0.55;

  // Cross-section area
  const area_mm2 = Math.PI * (portDiameter_mm / 2) ** 2;
  const area_cm2 = area_mm2 / 100;

  // Flow at standard test pressure (28" H2O = ~7 kPa)
  // Q = Cd * A * sqrt(2 * dP / rho)
  const dP = 7000; // Pa (28" H2O)
  const rho = 1.2; // kg/m³
  const velocity = Math.sqrt(2 * dP / rho);
  const flowRate_m3_s = Cd * (area_mm2 / 1e6) * velocity;
  const flowRate_cfm = flowRate_m3_s * 2118.88;

  return {
    portDiameter_mm,
    portLength_mm,
    surfaceFinish,
    flowCoefficient: Cd,
    crossSectionArea_mm2: Math.round(area_mm2),
    estimatedFlow_cfm_at_28inH2O: Math.round(flowRate_cfm),
    estimatedHP_support: Math.round(flowRate_cfm / 1.5),
    recommendations: [
      surfaceFinish === 'cast' ? 'Porting can improve flow 20-35%' : null,
      surfaceFinish === 'polished' ? 'Mirror finish reduces fuel atomization — dimpled texture preferred' : null,
      portDiameter_mm > 50 ? 'Large ports — may lose velocity signal at low RPM' : null,
      'Short-side radius is the critical restriction — focus porting effort there',
    ].filter(Boolean),
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listManifolds() {
  return Object.entries(MANIFOLD_DATABASE).map(([key, m]) => ({ key, ...m }));
}

export function getManifold(key) {
  return MANIFOLD_DATABASE[key] || null;
}

export function searchManifolds(query) {
  const q = query.toLowerCase();
  return Object.entries(MANIFOLD_DATABASE)
    .filter(([key, m]) =>
      key.includes(q) || m.name.toLowerCase().includes(q) ||
      m.application.toLowerCase().includes(q) || m.type.includes(q)
    )
    .map(([key, m]) => ({ key, ...m }));
}

export function listThrottleBodies() {
  return Object.entries(THROTTLE_BODY_DATABASE).map(([key, tb]) => ({ key, ...tb }));
}

export function getThrottleBody(key) {
  return THROTTLE_BODY_DATABASE[key] || null;
}

export function searchThrottleBodies(query) {
  const q = query.toLowerCase();
  return Object.entries(THROTTLE_BODY_DATABASE)
    .filter(([key, tb]) =>
      key.includes(q) || tb.name.toLowerCase().includes(q) || tb.application.toLowerCase().includes(q)
    )
    .map(([key, tb]) => ({ key, ...tb }));
}

export function intakeCalcStats() {
  return {
    manifolds: Object.keys(MANIFOLD_DATABASE).length,
    throttleBodies: Object.keys(THROTTLE_BODY_DATABASE).length,
    calculations: ['runnerLength', 'runnerDiameter', 'plenumVolume', 'throttleBodySizing', 'airflowEstimate', 'variableIntake', 'portFlow'],
  };
}

export { MANIFOLD_DATABASE, THROTTLE_BODY_DATABASE };
