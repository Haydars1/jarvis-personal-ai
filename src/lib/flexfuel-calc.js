// Flex Fuel & Ethanol Content Sensor Calculator
// Fuel blend analysis, E85 conversion calculations, sensor calibration

// ─── Ethanol Fuel Blends ────────────────────────────────────────────────

const FUEL_BLENDS = {
  'E0':   { name: 'E0 (Pure Gasoline)',   ethanol_pct: 0,   stoich: 14.7, octane_ron: 95,  density_kg_l: 0.745, energy_MJ_l: 34.2, lambdaCorrection: 1.00 },
  'E5':   { name: 'E5',                   ethanol_pct: 5,   stoich: 14.35, octane_ron: 96,  density_kg_l: 0.748, energy_MJ_l: 33.6, lambdaCorrection: 1.02 },
  'E10':  { name: 'E10',                  ethanol_pct: 10,  stoich: 14.0, octane_ron: 97,  density_kg_l: 0.751, energy_MJ_l: 33.0, lambdaCorrection: 1.05 },
  'E15':  { name: 'E15',                  ethanol_pct: 15,  stoich: 13.65, octane_ron: 98,  density_kg_l: 0.754, energy_MJ_l: 32.4, lambdaCorrection: 1.07 },
  'E20':  { name: 'E20',                  ethanol_pct: 20,  stoich: 13.3, octane_ron: 99,  density_kg_l: 0.757, energy_MJ_l: 31.8, lambdaCorrection: 1.10 },
  'E25':  { name: 'E25',                  ethanol_pct: 25,  stoich: 12.95, octane_ron: 100, density_kg_l: 0.760, energy_MJ_l: 31.2, lambdaCorrection: 1.13 },
  'E30':  { name: 'E30',                  ethanol_pct: 30,  stoich: 12.6, octane_ron: 101, density_kg_l: 0.763, energy_MJ_l: 30.6, lambdaCorrection: 1.16 },
  'E40':  { name: 'E40',                  ethanol_pct: 40,  stoich: 11.9, octane_ron: 102, density_kg_l: 0.769, energy_MJ_l: 29.4, lambdaCorrection: 1.22 },
  'E50':  { name: 'E50',                  ethanol_pct: 50,  stoich: 11.2, octane_ron: 104, density_kg_l: 0.775, energy_MJ_l: 28.2, lambdaCorrection: 1.28 },
  'E60':  { name: 'E60',                  ethanol_pct: 60,  stoich: 10.5, octane_ron: 105, density_kg_l: 0.781, energy_MJ_l: 27.0, lambdaCorrection: 1.35 },
  'E70':  { name: 'E70',                  ethanol_pct: 70,  stoich: 9.8,  octane_ron: 106, density_kg_l: 0.787, energy_MJ_l: 25.8, lambdaCorrection: 1.42 },
  'E85':  { name: 'E85',                  ethanol_pct: 85,  stoich: 9.765, octane_ron: 108, density_kg_l: 0.795, energy_MJ_l: 24.0, lambdaCorrection: 1.51 },
  'E98':  { name: 'E98 (Race Ethanol)',    ethanol_pct: 98,  stoich: 9.0,  octane_ron: 110, density_kg_l: 0.789, energy_MJ_l: 22.4, lambdaCorrection: 1.63 },
  'E100': { name: 'E100 (Pure Ethanol)',   ethanol_pct: 100, stoich: 9.0,  octane_ron: 111, density_kg_l: 0.789, energy_MJ_l: 21.4, lambdaCorrection: 1.63 },
};


// ─── Ethanol Content Sensors ────────────────────────────────────────────

const ETHANOL_SENSOR_DATABASE = {
  'gm-flex-fuel': {
    name: 'GM Flex Fuel Sensor (Continental)',
    partNumber: '13577429',
    type: 'frequency',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 125],
    voltage: '12V',
    connector: '3-pin',
    accuracy_pct: 1.0,
    application: 'GM flex fuel vehicles, most common aftermarket'
  },
  'continental-se01': {
    name: 'Continental SE01',
    partNumber: 'SE01',
    type: 'frequency',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 125],
    voltage: '12V',
    connector: '3-pin',
    accuracy_pct: 0.5,
    application: 'OEM flex fuel, high accuracy'
  },
  'zeitronix-eca': {
    name: 'Zeitronix ECA-2 Ethanol Content Analyzer',
    partNumber: 'ECA-2',
    type: 'frequency',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 150],
    voltage: '12V',
    connector: '3-pin + analog out',
    accuracy_pct: 0.5,
    application: 'Aftermarket, standalone display + analog output'
  },
  'innovate-efr': {
    name: 'Innovate EFR (Ethanol Fuel Ratio)',
    partNumber: 'EFR',
    type: 'frequency_analog',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 125],
    voltage: '12V',
    connector: '3-pin + 0-5V analog',
    accuracy_pct: 1.0,
    application: 'Aftermarket, 0-5V analog output for standalone ECUs'
  },
  'aem-ethanol': {
    name: 'AEM Ethanol Content Sensor',
    partNumber: '30-2200',
    type: 'frequency',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 125],
    voltage: '12V',
    connector: '3-pin',
    accuracy_pct: 1.0,
    application: 'AEM EMS / Infinity ECU integration'
  },
  'haltech-flex': {
    name: 'Haltech Flex Fuel Sensor',
    partNumber: 'HT-011001',
    type: 'frequency',
    range_pct: [0, 100],
    output_hz: [50, 150],
    fuelTemp: true,
    tempRange_C: [-40, 125],
    voltage: '12V',
    connector: '3-pin DTM',
    accuracy_pct: 1.0,
    application: 'Haltech Elite/Nexus ECU direct input'
  },
  'diy-capacitive': {
    name: 'DIY Capacitive Sensor',
    partNumber: 'N/A',
    type: 'capacitive_analog',
    range_pct: [0, 100],
    output_hz: null,
    fuelTemp: false,
    tempRange_C: [-20, 80],
    voltage: '5V',
    connector: 'Custom',
    accuracy_pct: 3.0,
    application: 'Budget DIY builds, lower accuracy'
  },
};


// ─── Calculations ───────────────────────────────────────────────────────

export function calcBlendProperties(ethanol_pct) {
  ethanol_pct = Math.max(0, Math.min(100, ethanol_pct));

  const gasoline = FUEL_BLENDS['E0'];
  const ethanol = FUEL_BLENDS['E100'];

  const frac = ethanol_pct / 100;
  const stoich = gasoline.stoich * (1 - frac) + ethanol.stoich * frac;
  const density = gasoline.density_kg_l * (1 - frac) + ethanol.density_kg_l * frac;
  const energy = gasoline.energy_MJ_l * (1 - frac) + ethanol.energy_MJ_l * frac;
  const octane = gasoline.octane_ron + (ethanol.octane_ron - gasoline.octane_ron) * frac;
  const lambdaCorr = gasoline.lambdaCorrection * (1 - frac) + ethanol.lambdaCorrection * frac;

  // Find nearest blend in database
  let nearest = 'E0';
  let minDiff = 999;
  for (const [k, v] of Object.entries(FUEL_BLENDS)) {
    const diff = Math.abs(v.ethanol_pct - ethanol_pct);
    if (diff < minDiff) { minDiff = diff; nearest = k; }
  }

  return {
    ethanol_pct,
    stoichiometric_afr: Math.round(stoich * 100) / 100,
    density_kg_l: Math.round(density * 1000) / 1000,
    energy_MJ_l: Math.round(energy * 10) / 10,
    octane_ron_estimate: Math.round(octane),
    lambdaCorrection: Math.round(lambdaCorr * 100) / 100,
    fuelVolumeIncrease_pct: Math.round((lambdaCorr - 1) * 100 * 10) / 10,
    nearestBlend: nearest,
    notes: [
      ethanol_pct > 50 ? 'Requires flex-fuel compatible fuel system (lines, seals, pump)' : null,
      ethanol_pct > 30 ? 'Cold start enrichment recommended below 10°C' : null,
      ethanol_pct > 15 ? 'Injector sizing should account for increased fuel volume' : null,
      octane > 100 ? 'Higher knock resistance — timing advance possible' : null,
    ].filter(Boolean),
  };
}


export function calcInjectorRequirement(baseFuelFlow_cc_min, baseEthanol_pct, targetEthanol_pct) {
  const baseBlend = calcBlendProperties(baseEthanol_pct);
  const targetBlend = calcBlendProperties(targetEthanol_pct);

  const correctionFactor = targetBlend.lambdaCorrection / baseBlend.lambdaCorrection;
  const requiredFlow = baseFuelFlow_cc_min * correctionFactor;
  const dutyCycleIncrease_pct = (correctionFactor - 1) * 100;

  return {
    baseFuelFlow_cc_min,
    baseEthanol_pct,
    targetEthanol_pct,
    correctionFactor: Math.round(correctionFactor * 1000) / 1000,
    requiredFlow_cc_min: Math.round(requiredFlow),
    dutyCycleIncrease_pct: Math.round(dutyCycleIncrease_pct * 10) / 10,
    needLargerInjectors: dutyCycleIncrease_pct > 15,
    recommendation: dutyCycleIncrease_pct > 40
      ? 'Significantly larger injectors required — consider 50%+ larger'
      : dutyCycleIncrease_pct > 20
      ? 'Larger injectors recommended — consider 30%+ larger'
      : dutyCycleIncrease_pct > 10
      ? 'Current injectors may work but duty cycle will be high — monitor carefully'
      : 'Current injectors sufficient with tune adjustment',
  };
}


export function calcFuelPumpRequirement(basePumpFlow_lph, baseEthanol_pct, targetEthanol_pct) {
  const baseBlend = calcBlendProperties(baseEthanol_pct);
  const targetBlend = calcBlendProperties(targetEthanol_pct);

  const correctionFactor = targetBlend.lambdaCorrection / baseBlend.lambdaCorrection;
  const requiredFlow = basePumpFlow_lph * correctionFactor;

  return {
    basePumpFlow_lph,
    baseEthanol_pct,
    targetEthanol_pct,
    correctionFactor: Math.round(correctionFactor * 1000) / 1000,
    requiredFlow_lph: Math.round(requiredFlow),
    flowIncrease_lph: Math.round(requiredFlow - basePumpFlow_lph),
    needUpgrade: correctionFactor > 1.15,
    recommendation: correctionFactor > 1.4
      ? 'Fuel pump upgrade strongly recommended — dual pump or surge tank setup'
      : correctionFactor > 1.2
      ? 'Higher capacity fuel pump recommended'
      : 'Current fuel pump likely sufficient',
  };
}


export function calcTimingAdvance(baseTimingDeg, baseEthanol_pct, targetEthanol_pct) {
  const octaneGain = (targetEthanol_pct - baseEthanol_pct) * 0.16; // ~0.16 RON per % ethanol
  // Roughly 1 degree per 2-3 RON increase, conservative
  const possibleAdvance = octaneGain / 2.5;
  const recommendedAdvance = Math.min(possibleAdvance, 8); // cap at 8 deg max advance

  return {
    baseTimingDeg,
    baseEthanol_pct,
    targetEthanol_pct,
    octaneGainRON: Math.round(octaneGain * 10) / 10,
    possibleAdvanceDeg: Math.round(possibleAdvance * 10) / 10,
    recommendedAdvanceDeg: Math.round(recommendedAdvance * 10) / 10,
    newTimingDeg: Math.round((baseTimingDeg + recommendedAdvance) * 10) / 10,
    notes: [
      'Always verify with knock monitoring — these are starting points',
      recommendedAdvance > 5 ? 'Significant advance — increase in 1-2 deg steps with data logging' : null,
      targetEthanol_pct > 70 ? 'At high ethanol content, cooling effect allows more aggressive timing' : null,
    ].filter(Boolean),
  };
}


export function calcColdStartEnrichment(ethanol_pct, ambientTemp_C) {
  // Ethanol has much higher heat of vaporization (840 kJ/kg vs 350 kJ/kg for gasoline)
  const ethanolFrac = ethanol_pct / 100;
  const vaporizationFactor = 1 + ethanolFrac * 1.4; // ethanol needs ~2.4x more heat to vaporize

  // Below 15°C, cold start enrichment starts increasing
  let tempFactor = 1.0;
  if (ambientTemp_C < 15) {
    tempFactor = 1 + (15 - ambientTemp_C) * 0.02; // 2% per degree below 15°C
  }
  if (ambientTemp_C < 0) {
    tempFactor *= 1 + Math.abs(ambientTemp_C) * 0.015; // additional 1.5% per degree below 0°C
  }

  const totalEnrichment = vaporizationFactor * tempFactor;
  const crankingPulseMultiplier = totalEnrichment * (ambientTemp_C < 0 ? 1.5 : 1.2);

  return {
    ethanol_pct,
    ambientTemp_C,
    vaporizationFactor: Math.round(vaporizationFactor * 100) / 100,
    temperatureFactor: Math.round(tempFactor * 100) / 100,
    totalEnrichmentMultiplier: Math.round(totalEnrichment * 100) / 100,
    crankingPulseMultiplier: Math.round(crankingPulseMultiplier * 100) / 100,
    additionalFuel_pct: Math.round((totalEnrichment - 1) * 100),
    difficulty: ambientTemp_C < -10 && ethanol_pct > 60 ? 'very_hard'
      : ambientTemp_C < 0 && ethanol_pct > 40 ? 'hard'
      : ambientTemp_C < 10 && ethanol_pct > 20 ? 'moderate'
      : 'easy',
    notes: [
      ethanol_pct > 50 && ambientTemp_C < 0 ? 'Block heater or intake heater strongly recommended' : null,
      ethanol_pct > 70 && ambientTemp_C < -10 ? 'May not start — consider winter blend (E50 or lower)' : null,
      ethanol_pct > 30 ? 'Ensure cranking fuel table accounts for ethanol enrichment' : null,
      'Post-start idle enrichment should taper over 30-60 seconds',
    ].filter(Boolean),
  };
}


export function calibrateSensorFrequency(frequency_hz) {
  // Standard GM flex fuel sensor: 50 Hz = 0%, 150 Hz = 100%
  if (frequency_hz < 50) return { ethanol_pct: 0, fuelTemp_C: null, warning: 'Below minimum frequency — check wiring' };
  if (frequency_hz > 150) {
    // Frequency above 150 Hz is fuel temperature signal
    const temp_C = (frequency_hz - 150) * 0.3125 - 40; // per GM spec
    return { ethanol_pct: null, fuelTemp_C: Math.round(temp_C * 10) / 10, note: 'Temperature mode' };
  }

  const ethanol_pct = (frequency_hz - 50) / 100 * 100;
  return {
    ethanol_pct: Math.round(ethanol_pct * 10) / 10,
    frequency_hz,
    fuelTemp_C: null,
    ...calcBlendProperties(ethanol_pct),
  };
}


export function calcSensorVoltage(voltage, sensorType = 'linear_0_5v') {
  // For sensors with 0-5V analog output (e.g., Innovate EFR analog out)
  let ethanol_pct;
  switch (sensorType) {
    case 'linear_0_5v':
      ethanol_pct = (voltage / 5.0) * 100;
      break;
    case 'linear_0_5v_inverted':
      ethanol_pct = ((5.0 - voltage) / 5.0) * 100;
      break;
    case 'linear_0.5_4.5v':
      ethanol_pct = ((voltage - 0.5) / 4.0) * 100;
      break;
    default:
      ethanol_pct = (voltage / 5.0) * 100;
  }

  ethanol_pct = Math.max(0, Math.min(100, ethanol_pct));

  return {
    voltage,
    sensorType,
    ethanol_pct: Math.round(ethanol_pct * 10) / 10,
    ...calcBlendProperties(ethanol_pct),
  };
}


export function calcE85Conversion(vehicleHP, currentInjectorSize_cc, currentPumpFlow_lph, currentTiming_deg, currentEthanol_pct = 0) {
  const targetEthanol = 85;

  const injectorReq = calcInjectorRequirement(currentInjectorSize_cc, currentEthanol_pct, targetEthanol);
  const pumpReq = calcFuelPumpRequirement(currentPumpFlow_lph, currentEthanol_pct, targetEthanol);
  const timingAdv = calcTimingAdvance(currentTiming_deg, currentEthanol_pct, targetEthanol);
  const coldStartMinus10 = calcColdStartEnrichment(targetEthanol, -10);
  const coldStart0 = calcColdStartEnrichment(targetEthanol, 0);
  const blendProps = calcBlendProperties(targetEthanol);

  const powerGain_pct = Math.round((timingAdv.octaneGainRON / 10) * 3 + (targetEthanol - currentEthanol_pct) * 0.05);

  return {
    vehicleHP,
    currentSetup: { injectorSize_cc: currentInjectorSize_cc, pumpFlow_lph: currentPumpFlow_lph, timing_deg: currentTiming_deg, ethanol_pct: currentEthanol_pct },
    targetBlend: blendProps,
    injectorAnalysis: injectorReq,
    fuelPumpAnalysis: pumpReq,
    timingAnalysis: timingAdv,
    coldStartAnalysis: { at_minus10C: coldStartMinus10, at_0C: coldStart0 },
    estimatedPowerGain_pct: powerGain_pct,
    checklist: [
      { item: 'Ethanol-compatible fuel lines and seals', required: true },
      { item: 'Flex fuel sensor installed', required: true },
      { item: 'ECU tune for E85', required: true },
      { item: injectorReq.needLargerInjectors ? 'Upgrade injectors' : 'Injectors OK', required: injectorReq.needLargerInjectors },
      { item: pumpReq.needUpgrade ? 'Upgrade fuel pump' : 'Fuel pump OK', required: pumpReq.needUpgrade },
      { item: 'Wideband O2 sensor for tuning', required: true },
      { item: 'Knock sensor monitoring', required: true },
      { item: 'Cold start calibration', required: true },
    ],
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listFuelBlends() {
  return Object.entries(FUEL_BLENDS).map(([key, b]) => ({ key, ...b }));
}

export function getFuelBlend(key) {
  return FUEL_BLENDS[key.toUpperCase()] || FUEL_BLENDS[key] || null;
}

export function listEthanolSensors() {
  return Object.entries(ETHANOL_SENSOR_DATABASE).map(([key, s]) => ({ key, ...s }));
}

export function getEthanolSensor(key) {
  return ETHANOL_SENSOR_DATABASE[key] || null;
}

export function searchEthanolSensors(query) {
  const q = query.toLowerCase();
  return Object.entries(ETHANOL_SENSOR_DATABASE)
    .filter(([k, s]) => k.includes(q) || s.name.toLowerCase().includes(q) || s.application.toLowerCase().includes(q))
    .map(([key, s]) => ({ key, ...s }));
}

export function flexfuelCalcStats() {
  return {
    fuelBlends: Object.keys(FUEL_BLENDS).length,
    ethanolSensors: Object.keys(ETHANOL_SENSOR_DATABASE).length,
    calculations: ['calcBlendProperties', 'calcInjectorRequirement', 'calcFuelPumpRequirement', 'calcTimingAdvance', 'calcColdStartEnrichment', 'calibrateSensorFrequency', 'calcSensorVoltage', 'calcE85Conversion'],
  };
}

export { FUEL_BLENDS, ETHANOL_SENSOR_DATABASE };
