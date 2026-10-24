// Nitrous Oxide (N2O) Calculator
// Jet sizing, bottle pressure, timing retard, HP gain, fuel enrichment, purge

// ─── Nozzle / Jet Database ──────────────────────────────────────────────

const JET_DATABASE = {
  'nos-14010': { name: 'NOS #14010 (25hp)', flow_cc_min: 135, hp_gain: 25, fuelType: 'wet', nozzleType: 'fogger', application: 'Small 4-cyl — starter kit' },
  'nos-14020': { name: 'NOS #14020 (50hp)', flow_cc_min: 270, hp_gain: 50, fuelType: 'wet', nozzleType: 'fogger', application: 'NA 4-cyl, mild 6-cyl' },
  'nos-14030': { name: 'NOS #14030 (75hp)', flow_cc_min: 405, hp_gain: 75, fuelType: 'wet', nozzleType: 'fogger', application: 'Built 4-cyl, NA V6' },
  'nos-14050': { name: 'NOS #14050 (100hp)', flow_cc_min: 540, hp_gain: 100, fuelType: 'wet', nozzleType: 'fogger', application: 'Built engines, mild V8' },
  'nos-14075': { name: 'NOS #14075 (125hp)', flow_cc_min: 675, hp_gain: 125, fuelType: 'wet', nozzleType: 'fogger', application: 'V8, strong internals required' },
  'nos-14100': { name: 'NOS #14100 (150hp)', flow_cc_min: 810, hp_gain: 150, fuelType: 'wet', nozzleType: 'fogger', application: 'V8 with forged internals' },
  'nos-14150': { name: 'NOS #14150 (200hp)', flow_cc_min: 1080, hp_gain: 200, fuelType: 'wet', nozzleType: 'fogger', application: 'Built V8, race only' },
  'nos-14200': { name: 'NOS #14200 (250hp)', flow_cc_min: 1350, hp_gain: 250, fuelType: 'wet', nozzleType: 'fogger', application: 'Dedicated race engine' },
  'zex-82010': { name: 'ZEX Dry 55hp', flow_cc_min: 297, hp_gain: 55, fuelType: 'dry', nozzleType: 'dry-plate', application: 'Dry kit — EFI only, computer-controlled fuel' },
  'zex-82020': { name: 'ZEX Dry 75hp', flow_cc_min: 405, hp_gain: 75, fuelType: 'dry', nozzleType: 'dry-plate', application: 'Dry kit — larger EFI engines' },
  'nx-direct-port-4': { name: 'Nitrous Express Direct Port (4-cyl)', flow_cc_min: 540, hp_gain: 100, fuelType: 'wet', nozzleType: 'direct-port', application: 'Direct port per-cylinder — even distribution' },
  'nx-direct-port-8': { name: 'Nitrous Express Direct Port (V8)', flow_cc_min: 1080, hp_gain: 200, fuelType: 'wet', nozzleType: 'direct-port', application: 'Direct port V8 — max power, even distribution' },
};


// ─── Bottle Database ────────────────────────────────────────────────────

const BOTTLE_DATABASE = {
  '2.5lb': { name: '2.5 lb Bottle', capacity_lb: 2.5, capacity_kg: 1.13, usableN2O_lb: 2.0, duration_sec_at_100hp: 15, material: 'aluminum', application: 'Motorcycle, small purge system' },
  '5lb': { name: '5 lb Bottle', capacity_lb: 5, capacity_kg: 2.27, usableN2O_lb: 4.0, duration_sec_at_100hp: 30, material: 'aluminum', application: 'Compact cars, short runs' },
  '10lb': { name: '10 lb Bottle', capacity_lb: 10, capacity_kg: 4.54, usableN2O_lb: 8.0, duration_sec_at_100hp: 60, material: 'steel', application: 'Standard street/strip — most popular' },
  '15lb': { name: '15 lb Bottle', capacity_lb: 15, capacity_kg: 6.80, usableN2O_lb: 12.0, duration_sec_at_100hp: 90, material: 'steel', application: 'Drag racing — multiple passes' },
  '20lb': { name: '20 lb Bottle', capacity_lb: 20, capacity_kg: 9.07, usableN2O_lb: 16.0, duration_sec_at_100hp: 120, material: 'steel', application: 'Racing — extended use, team events' },
};


// ─── HP Gain Estimate ───────────────────────────────────────────────────

export function estimateN2OGain(baseHP, shotSize_HP, numStages = 1) {
  const totalShot = shotSize_HP * numStages;
  const effectiveGain = totalShot * 0.92; // ~8% delivery loss
  const newHP = baseHP + effectiveGain;
  const gainPct = (effectiveGain / baseHP) * 100;

  // Safety assessment
  let safetyRating;
  if (gainPct <= 20) safetyRating = 'SAFE — stock internals can usually handle this';
  else if (gainPct <= 40) safetyRating = 'MODERATE — forged pistons recommended';
  else if (gainPct <= 60) safetyRating = 'AGGRESSIVE — full forged bottom end required';
  else safetyRating = 'EXTREME — dedicated race engine, custom tune mandatory';

  return {
    baseHP,
    shotSize_HP,
    numStages,
    totalShot_HP: totalShot,
    effectiveGain_HP: Math.round(effectiveGain),
    newHP: Math.round(newHP),
    gainPct: Math.round(gainPct),
    safetyRating,
    requirements: [
      totalShot > 75 ? 'Upgraded fuel system (pump + injectors)' : null,
      totalShot > 100 ? 'Forged pistons and rods' : null,
      totalShot > 150 ? 'Forged crankshaft' : null,
      totalShot > 100 ? 'Standalone ECU or piggyback with nitrous input' : null,
      numStages > 1 ? `Progressive controller for ${numStages}-stage activation` : null,
      'Dedicated nitrous fuel pressure regulator',
      'Window switch (RPM activation range)',
      'Wide-band O2 sensor for tuning verification',
    ].filter(Boolean),
  };
}


// ─── Timing Retard Calculator ───────────────────────────────────────────

export function calcTimingRetard(shotSize_HP, compressionRatio = 10, fuelType = 'gasoline') {
  // Rule of thumb: ~1.5° retard per 50hp of nitrous, modified by CR and fuel
  const baseRetard = (shotSize_HP / 50) * 1.5;

  let crFactor = 1.0;
  if (compressionRatio > 10.5) crFactor = 1.3;
  else if (compressionRatio > 9.5) crFactor = 1.1;
  else if (compressionRatio < 9.0) crFactor = 0.8;

  let fuelFactor = 1.0;
  if (fuelType === 'e85') fuelFactor = 0.7; // E85 is knock-resistant
  else if (fuelType === 'race_gas') fuelFactor = 0.8;
  else if (fuelType === 'methanol') fuelFactor = 0.5;

  const totalRetard = baseRetard * crFactor * fuelFactor;

  return {
    shotSize_HP,
    compressionRatio,
    fuelType,
    baseRetard_deg: Math.round(baseRetard * 10) / 10,
    crFactor,
    fuelFactor,
    totalRetard_deg: Math.round(totalRetard * 10) / 10,
    activationMethod: shotSize_HP > 100 ? 'Progressive retard via ECU nitrous input' : 'Window switch with MSD timing retard module',
    notes: [
      'Retard timing BEFORE adding nitrous — never run nitrous without timing pulled',
      totalRetard > 4 ? 'High retard — must verify timing at each jet change on dyno' : null,
      fuelType === 'e85' ? 'E85 allows less retard but still requires nitrous-specific tune' : null,
    ].filter(Boolean),
  };
}


// ─── Fuel Enrichment Calculator ─────────────────────────────────────────

export function calcFuelEnrichment(shotSize_HP, injectorSize_cc = 440, numInjectors = 4, fuelPressure_bar = 3.0) {
  // N2O flow rate: ~5.4 cc/min per HP of nitrous
  const n2oFlow_cc_min = shotSize_HP * 5.4;

  // Fuel needed: maintain ~12.5:1 AFR under nitrous (rich for safety)
  // N2O is ~36% oxygen by mass, density ~1.98 kg/L as liquid
  const additionalFuelNeeded_cc_min = n2oFlow_cc_min * 0.36 / 12.5 * 1000;

  // Check if existing injectors can supply enough fuel
  const maxInjectorFlow = injectorSize_cc * numInjectors;
  const baseFuelNeed = maxInjectorFlow * 0.85; // 85% duty cycle is max safe
  const totalFuelNeed = baseFuelNeed + additionalFuelNeeded_cc_min * 0.6; // wet system handles part
  const dutyCycle = (totalFuelNeed / maxInjectorFlow) * 100;

  return {
    shotSize_HP,
    n2oFlow_cc_min: Math.round(n2oFlow_cc_min),
    additionalFuelNeeded_cc_min: Math.round(additionalFuelNeeded_cc_min),
    currentInjectorSize_cc: injectorSize_cc,
    numberOfInjectors: numInjectors,
    estimatedDutyCycle_pct: Math.round(dutyCycle),
    fuelPressure_bar: fuelPressure_bar,
    status: dutyCycle > 85 ? 'DANGER — injectors maxed, upgrade required' :
      dutyCycle > 75 ? 'WARNING — marginal, consider larger injectors' : 'OK — sufficient fuel capacity',
    recommendations: [
      dutyCycle > 80 ? `Upgrade to ${Math.ceil(injectorSize_cc * 1.3)}cc injectors` : null,
      fuelPressure_bar < 3.5 ? 'Increase fuel pressure to 3.5-4.0 bar with adjustable FPR' : null,
      shotSize_HP > 75 ? 'Install dedicated nitrous fuel solenoid and line' : null,
      'Wideband O2 mandatory — target 11.5-12.0:1 AFR under nitrous',
    ].filter(Boolean),
  };
}


// ─── Bottle Pressure & Temperature ──────────────────────────────────────

export function calcBottlePressure(temperature_C) {
  // N2O vapor pressure follows Clausius-Clapeyron approximation
  // Reference: 750 PSI at 21°C (70°F)
  const T_ref = 21;
  const P_ref = 750; // PSI
  const slope = 15; // ~15 PSI per °C near operating range

  const pressure_psi = P_ref + (temperature_C - T_ref) * slope;
  const pressure_bar = pressure_psi * 0.0689;

  let status;
  if (pressure_psi < 600) status = 'TOO LOW — bottle too cold, use bottle heater';
  else if (pressure_psi < 700) status = 'LOW — slightly cold, may have reduced power';
  else if (pressure_psi > 1050) status = 'DANGER — over-pressurized, vent immediately';
  else if (pressure_psi > 950) status = 'HIGH — hot bottle, monitor closely';
  else status = 'OPTIMAL — good operating pressure';

  return {
    temperature_C,
    temperature_F: Math.round(temperature_C * 9 / 5 + 32),
    pressure_psi: Math.round(pressure_psi),
    pressure_bar: Math.round(pressure_bar * 10) / 10,
    status,
    optimalRange_psi: '700-950 PSI',
    optimalRange_C: '18-32°C',
    notes: [
      pressure_psi < 650 ? 'Use a bottle blanket/heater to bring pressure up' : null,
      pressure_psi > 950 ? 'Store bottle in shade, DO NOT exceed 1100 PSI' : null,
      'Always warm bottle to operating temperature before use',
      'Bottle pressure drops as N2O is consumed',
    ].filter(Boolean),
  };
}


// ─── Bottle Duration Estimate ───────────────────────────────────────────

export function calcBottleDuration(bottleSize, shotSize_HP) {
  const bottle = BOTTLE_DATABASE[bottleSize];
  if (!bottle) return { error: `Unknown bottle: ${bottleSize}` };

  // N2O consumption: ~0.8 lb per 100hp per 10 seconds
  const consumption_lb_per_sec = (shotSize_HP / 100) * 0.08;
  const duration_sec = bottle.usableN2O_lb / consumption_lb_per_sec;

  // Quarter mile estimate (assume 10-12 seconds of WOT)
  const quarterMileRuns = Math.floor(duration_sec / 11);

  return {
    bottle: bottle.name,
    capacity_lb: bottle.capacity_lb,
    usableN2O_lb: bottle.usableN2O_lb,
    shotSize_HP,
    consumptionRate_lb_sec: Math.round(consumption_lb_per_sec * 1000) / 1000,
    totalDuration_sec: Math.round(duration_sec),
    quarterMileRuns,
    notes: [
      `~${Math.round(duration_sec)} seconds of continuous use at ${shotSize_HP}hp shot`,
      quarterMileRuns > 0 ? `Approximately ${quarterMileRuns} quarter-mile passes` : 'Not enough for a full quarter-mile pass',
      'Duration decreases as bottle empties (pressure drop)',
      'Weigh bottle before runs to know remaining N2O',
    ],
  };
}


// ─── Purge System Calculator ────────────────────────────────────────────

export function calcPurge(lineLength_m = 2, lineDiameter_mm = 6.35) {
  // Calculate line volume
  const radius_m = (lineDiameter_mm / 2) / 1000;
  const volume_cc = Math.PI * radius_m * radius_m * lineLength_m * 1e6;

  // Purge duration: enough to clear the line of gas and fill with liquid N2O
  // Flow rate through purge solenoid: ~200 cc/s
  const purgeFlow_cc_s = 200;
  const purgeDuration_ms = (volume_cc / purgeFlow_cc_s) * 1000 * 1.5; // 1.5x safety factor

  return {
    lineLength_m,
    lineDiameter_mm,
    lineVolume_cc: Math.round(volume_cc * 10) / 10,
    recommendedPurgeDuration_ms: Math.round(purgeDuration_ms),
    purgeBeforeEachRun: true,
    notes: [
      'Purge clears gas from the line, ensures liquid N2O reaches solenoid',
      'Always purge before first hit of the day',
      'Re-purge if system has been sitting more than 5 minutes',
      `Line volume: ${Math.round(volume_cc * 10) / 10} cc`,
    ],
  };
}


// ─── Safety Checklist Generator ─────────────────────────────────────────

export function safetyChecklist(shotSize_HP, engineType = 'na', fuelType = 'gasoline') {
  const checks = [
    { item: 'Bottle pressure', value: '700-950 PSI', critical: true },
    { item: 'Timing retard', value: `${Math.round((shotSize_HP / 50) * 1.5)}° minimum`, critical: true },
    { item: 'Fuel pressure under load', value: '≥ 3.5 bar (50 PSI)', critical: true },
    { item: 'AFR under nitrous', value: '11.5-12.0:1', critical: true },
    { item: 'Window switch RPM range', value: engineType === 'turbo' ? '3500-7000 RPM' : '2500-6500 RPM', critical: true },
    { item: 'Wide-band O2 reading', value: 'Verified on dyno', critical: true },
    { item: 'Spark plugs', value: 'One step colder than stock, gap reduced 0.1mm', critical: false },
    { item: 'Purge system', value: 'Purged before run', critical: false },
    { item: 'Bottle heater', value: 'If ambient < 15°C', critical: false },
    { item: 'Fuel level', value: '≥ half tank', critical: false },
    { item: 'Engine oil temperature', value: '≥ 80°C before activation', critical: false },
  ];

  if (shotSize_HP > 100) {
    checks.push({ item: 'Forged internals verified', value: 'Required above 100hp shot', critical: true });
  }
  if (engineType === 'turbo') {
    checks.push({ item: 'Boost controller deactivation', value: 'Reduce boost by 3-5 PSI under nitrous', critical: true });
  }
  if (fuelType === 'e85') {
    checks.push({ item: 'E85 nitrous fuel solenoid', value: 'Larger fuel jet required for E85', critical: true });
  }

  return {
    shotSize_HP,
    engineType,
    fuelType,
    totalChecks: checks.length,
    criticalChecks: checks.filter(c => c.critical).length,
    checklist: checks,
    preRunSequence: [
      '1. Verify bottle pressure (700-950 PSI)',
      '2. Check all fittings and connections',
      '3. Arm system, purge line',
      '4. Verify fuel pressure',
      '5. Warm engine to operating temp',
      '6. Activate window switch',
      '7. Full throttle hit in appropriate gear',
    ],
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listJets() {
  return Object.entries(JET_DATABASE).map(([key, j]) => ({ key, ...j }));
}

export function getJet(key) {
  return JET_DATABASE[key] || null;
}

export function searchJets(query) {
  const q = query.toLowerCase();
  return Object.entries(JET_DATABASE)
    .filter(([key, j]) =>
      key.includes(q) || j.name.toLowerCase().includes(q) || j.application.toLowerCase().includes(q) ||
      j.nozzleType.includes(q) || j.fuelType.includes(q)
    )
    .map(([key, j]) => ({ key, ...j }));
}

export function listBottles() {
  return Object.entries(BOTTLE_DATABASE).map(([key, b]) => ({ key, ...b }));
}

export function getBottle(key) {
  return BOTTLE_DATABASE[key] || null;
}

export function nitrousCalcStats() {
  return {
    jets: Object.keys(JET_DATABASE).length,
    bottles: Object.keys(BOTTLE_DATABASE).length,
    calculations: ['hpGain', 'timingRetard', 'fuelEnrichment', 'bottlePressure', 'bottleDuration', 'purge', 'safetyChecklist'],
  };
}

export { JET_DATABASE, BOTTLE_DATABASE };
