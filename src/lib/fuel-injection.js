// Fuel Injection & Boost Calculator
// Injector sizing, duty cycle, fuel pressure, AFR, boost targets

// ─── Constants ────────────────────────────────────────────────────────────

const FUEL_DENSITY = {
  gasoline:  { kg_l: 0.745, stoich_afr: 14.7, energy_mj: 34.2 },
  e85:      { kg_l: 0.785, stoich_afr: 9.765, energy_mj: 26.9 },
  e50:      { kg_l: 0.765, stoich_afr: 12.23, energy_mj: 30.5 },
  methanol: { kg_l: 0.792, stoich_afr: 6.47,  energy_mj: 19.9 },
  diesel:   { kg_l: 0.832, stoich_afr: 14.6,  energy_mj: 45.5 },
  lpg:      { kg_l: 0.535, stoich_afr: 15.7,  energy_mj: 46.4 },
  cng:      { kg_l: 0.180, stoich_afr: 17.2,  energy_mj: 53.6 },
};

const INJECTOR_DATABASE = {
  // Common OEM injectors — flow in cc/min at 3 bar (43.5 psi)
  'bosch-ev1-160':     { flow_cc: 160, resistance: 'high', type: 'EV1', connector: 'EV1' },
  'bosch-ev1-210':     { flow_cc: 210, resistance: 'high', type: 'EV1', connector: 'EV1' },
  'bosch-ev6-380':     { flow_cc: 380, resistance: 'high', type: 'EV6', connector: 'USCAR' },
  'bosch-ev14-440':    { flow_cc: 440, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-550':    { flow_cc: 550, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-630':    { flow_cc: 630, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-980':    { flow_cc: 980, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-1000':   { flow_cc: 1000, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-1300':   { flow_cc: 1300, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'bosch-ev14-2200':   { flow_cc: 2200, resistance: 'low', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-600':  { flow_cc: 600, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-750':  { flow_cc: 750, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-1000': { flow_cc: 1000, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-1200': { flow_cc: 1200, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-1700': { flow_cc: 1700, resistance: 'low', type: 'EV14', connector: 'USCAR' },
  'deatschwerks-2200': { flow_cc: 2200, resistance: 'low', type: 'EV14', connector: 'USCAR' },
  'id-1050x':          { flow_cc: 1050, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'id-1300x':          { flow_cc: 1300, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'id-1700x':          { flow_cc: 1700, resistance: 'high', type: 'EV14', connector: 'USCAR' },
  'id-2600x':          { flow_cc: 2600, resistance: 'low', type: 'EV14', connector: 'USCAR' },
  'siemens-deka-60lb': { flow_cc: 630, resistance: 'high', type: 'EV1', connector: 'EV1' },
  'denso-565':         { flow_cc: 565, resistance: 'high', type: 'Denso', connector: 'Denso' },
  'denso-1000':        { flow_cc: 1000, resistance: 'high', type: 'Denso', connector: 'Denso' },
};

// ─── Injector Flow Correction ─────────────────────────────────────────────

/**
 * Correct injector flow rate for different fuel pressure
 * Flow scales with sqrt(pressure_ratio)
 */
export function correctFlowForPressure(baseCc, basePressureBar, newPressureBar) {
  if (basePressureBar <= 0 || newPressureBar <= 0) return { error: 'Pressure must be positive' };
  const ratio = Math.sqrt(newPressureBar / basePressureBar);
  return {
    baseFlow_cc: baseCc,
    basePressure_bar: basePressureBar,
    newPressure_bar: newPressureBar,
    correctedFlow_cc: Math.round(baseCc * ratio * 10) / 10,
    flowChange_pct: Math.round((ratio - 1) * 1000) / 10,
  };
}


// ─── Injector Duty Cycle ──────────────────────────────────────────────────

/**
 * Calculate injector duty cycle
 * @param {number} flowCc - Injector flow rate in cc/min at reference pressure
 * @param {number} numInjectors - Number of injectors
 * @param {number} targetHp - Target horsepower
 * @param {number} bsfc - Brake Specific Fuel Consumption (lb/hp/hr) — gasoline typically 0.45-0.55
 * @param {number} rpm - Engine RPM
 * @param {string} fuelType - Fuel type
 * @returns {object} Duty cycle analysis
 */
export function calcDutyCycle(flowCc, numInjectors, targetHp, bsfc = 0.50, rpm = 6500, fuelType = 'gasoline') {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;

  // Fuel flow required: BSFC * HP = lb/hr total
  const fuelFlowLbHr = bsfc * targetHp;
  const fuelFlowCcMin = fuelFlowLbHr * 453.592 / 60 / (fuel.kg_l * 1000); // convert lb/hr to cc/min

  // Per-injector requirement
  const flowPerInjector = fuelFlowCcMin / numInjectors;

  // Pulse width at this RPM (sequential injection = one pulse per 2 revolutions)
  const cycleTime_ms = (120 / rpm) * 1000; // ms per injection event (720° / RPM)
  const reqPulseWidth_ms = (flowPerInjector / flowCc) * cycleTime_ms;

  // Duty cycle
  const dutyCycle = (reqPulseWidth_ms / cycleTime_ms) * 100;

  let status = 'OK';
  let recommendation = '';
  if (dutyCycle > 85) {
    status = 'DANGER';
    recommendation = 'Duty cycle too high — injectors are maxed out. Upgrade to larger injectors or increase fuel pressure.';
  } else if (dutyCycle > 80) {
    status = 'WARNING';
    recommendation = 'Duty cycle is near the limit. Consider upgrading injectors for safety margin.';
  } else if (dutyCycle < 20) {
    status = 'OVERSIZED';
    recommendation = 'Injectors are heavily oversized. Consider smaller injectors for better idle quality and fine control.';
  }

  return {
    injectorFlow_cc: flowCc,
    numInjectors,
    targetHp,
    bsfc,
    rpm,
    fuelType,
    fuelFlow: {
      total_lb_hr: Math.round(fuelFlowLbHr * 100) / 100,
      total_cc_min: Math.round(fuelFlowCcMin * 10) / 10,
      per_injector_cc_min: Math.round(flowPerInjector * 10) / 10,
    },
    cycleTime_ms: Math.round(cycleTime_ms * 100) / 100,
    requiredPulseWidth_ms: Math.round(reqPulseWidth_ms * 100) / 100,
    dutyCycle_pct: Math.round(dutyCycle * 10) / 10,
    status,
    recommendation,
    maxHpAtThisRPM: Math.round((flowCc * numInjectors * 0.80 * (60 / (cycleTime_ms / 1000))) / (bsfc * 453.592 / (fuel.kg_l * 1000))),
  };
}


// ─── Injector Sizing ──────────────────────────────────────────────────────

/**
 * Recommend injector size for target power
 */
export function sizeInjectors(targetHp, numInjectors, fuelType = 'gasoline', bsfc = 0.50, maxDuty = 80, fuelPressureBar = 3) {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;

  const fuelFlowLbHr = bsfc * targetHp;
  const fuelFlowCcMin = fuelFlowLbHr * 453.592 / 60 / (fuel.kg_l * 1000);
  const perInjector = fuelFlowCcMin / numInjectors;
  const requiredFlow = perInjector / (maxDuty / 100);

  // Correct to standard 3 bar rating
  const atStdPressure = requiredFlow * Math.sqrt(3 / fuelPressureBar);

  // Find matching injectors
  const recommendations = Object.entries(INJECTOR_DATABASE)
    .filter(([, inj]) => inj.flow_cc >= atStdPressure * 0.9)
    .sort((a, b) => a[1].flow_cc - b[1].flow_cc)
    .slice(0, 5)
    .map(([name, inj]) => {
      const dc = calcDutyCycle(inj.flow_cc, numInjectors, targetHp, bsfc, 6500, fuelType);
      return {
        injector: name,
        ...inj,
        dutyCycleAt6500: dc.dutyCycle_pct,
        maxHpAt6500: dc.maxHpAtThisRPM,
        fit: dc.dutyCycle_pct <= maxDuty ? 'GOOD' : 'TOO_SMALL',
      };
    });

  return {
    targetHp,
    numInjectors,
    fuelType,
    bsfc,
    maxDuty_pct: maxDuty,
    fuelPressure_bar: fuelPressureBar,
    requiredFlow_cc_at_3bar: Math.round(atStdPressure),
    recommendations,
  };
}


// ─── AFR Calculator ──────────────────────────────────────────────────────

/**
 * Calculate target AFR and lambda for various conditions
 */
export function calcAFR(fuelType = 'gasoline', mode = 'stoich') {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;
  const stoich = fuel.stoich_afr;

  const targets = {
    stoich:    { afr: stoich,          lambda: 1.0,   desc: 'Stoichiometric — balanced combustion' },
    cruise:    { afr: stoich * 1.05,   lambda: 1.05,  desc: 'Lean cruise — fuel economy, lower emissions' },
    wot:      { afr: stoich * 0.82,   lambda: 0.82,  desc: 'Wide Open Throttle — max power, safe rich' },
    max_power: { afr: stoich * 0.86,  lambda: 0.86,  desc: 'Peak power — slightly rich of peak' },
    economy:   { afr: stoich * 1.10,  lambda: 1.10,  desc: 'Maximum economy — lean burn' },
    cold_start: { afr: stoich * 0.70, lambda: 0.70,  desc: 'Cold start enrichment — extra fuel for cold engine' },
    decel:     { afr: 999,            lambda: 999,    desc: 'Deceleration fuel cut — injectors off' },
    idle:      { afr: stoich * 0.98,  lambda: 0.98,   desc: 'Idle — slightly rich for stability' },
    boost:     { afr: stoich * 0.78,  lambda: 0.78,   desc: 'High boost — rich for safety, intercooler backup' },
  };

  if (mode === 'all') {
    return { fuelType, stoichAFR: stoich, targets };
  }

  const target = targets[mode];
  if (!target) return { error: `Unknown mode: ${mode}. Available: ${Object.keys(targets).join(', ')}` };

  return {
    fuelType,
    stoichAFR: stoich,
    mode,
    targetAFR: Math.round(target.afr * 100) / 100,
    lambda: target.lambda,
    description: target.desc,
  };
}


// ─── Lambda ↔ AFR Conversion ──────────────────────────────────────────────

export function lambdaToAFR(lambda, fuelType = 'gasoline') {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;
  return { lambda, afr: Math.round(lambda * fuel.stoich_afr * 100) / 100, fuelType, stoich: fuel.stoich_afr };
}

export function afrToLambda(afr, fuelType = 'gasoline') {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;
  return { afr, lambda: Math.round((afr / fuel.stoich_afr) * 1000) / 1000, fuelType, stoich: fuel.stoich_afr };
}


// ─── Boost Pressure Calculator ───────────────────────────────────────────

/**
 * Estimate power gain from boost pressure
 */
export function calcBoost(naHp, boostPsi, intercoolerEfficiency = 0.70, altitudeFt = 0) {
  const boostBar = boostPsi * 0.0689476;
  const atmBar = 1.01325 * Math.pow(1 - (altitudeFt * 0.3048 * 0.0000226), 5.256);

  // Pressure ratio
  const pressureRatio = (atmBar + boostBar) / atmBar;

  // Temperature rise (adiabatic compression)
  const ambientK = 298; // 25°C
  const gamma = 1.4;    // air
  const tempAfterTurbo = ambientK * Math.pow(pressureRatio, (gamma - 1) / gamma);
  const tempRise = tempAfterTurbo - ambientK;
  const tempAfterIC = ambientK + tempRise * (1 - intercoolerEfficiency);

  // Density ratio (corrected for temperature)
  const densityRatio = pressureRatio * (ambientK / tempAfterIC);

  // Power estimate
  const estimatedHp = naHp * densityRatio;
  const powerGain = estimatedHp - naHp;

  return {
    naturallyAspiratedHp: naHp,
    boost_psi: boostPsi,
    boost_bar: Math.round(boostBar * 100) / 100,
    atmosphericPressure_bar: Math.round(atmBar * 1000) / 1000,
    altitude_ft: altitudeFt,
    pressureRatio: Math.round(pressureRatio * 100) / 100,
    intercoolerEfficiency_pct: intercoolerEfficiency * 100,
    temperatures: {
      ambient_C: Math.round(ambientK - 273.15),
      afterTurbo_C: Math.round(tempAfterTurbo - 273.15),
      afterIntercooler_C: Math.round(tempAfterIC - 273.15),
      tempRise_C: Math.round(tempRise),
    },
    densityRatio: Math.round(densityRatio * 100) / 100,
    estimatedHp: Math.round(estimatedHp),
    powerGain_hp: Math.round(powerGain),
    powerGain_pct: Math.round((powerGain / naHp) * 100),
  };
}


// ─── Wastegate Duty Cycle ─────────────────────────────────────────────────

/**
 * Calculate wastegate duty cycle for target boost
 */
export function calcWastegateDuty(targetBoostPsi, springPressurePsi = 7, maxDuty = 95) {
  if (targetBoostPsi <= 0) return { error: 'Target boost must be positive' };

  // Below spring pressure — wastegate stays open
  if (targetBoostPsi <= springPressurePsi) {
    return {
      targetBoost_psi: targetBoostPsi,
      springPressure_psi: springPressurePsi,
      duty_pct: 0,
      status: 'SPRING_ONLY',
      note: 'Target boost is at or below spring pressure — no solenoid duty needed',
    };
  }

  // Linear approximation: duty rises proportionally above spring pressure
  const range = springPressurePsi * 3; // typical controllable range
  const dutyCycle = Math.min(((targetBoostPsi - springPressurePsi) / range) * 100, maxDuty);

  let status = 'OK';
  if (dutyCycle >= maxDuty) status = 'MAX_DUTY';
  else if (dutyCycle > 80) status = 'HIGH';

  return {
    targetBoost_psi: targetBoostPsi,
    targetBoost_bar: Math.round(targetBoostPsi * 0.0689476 * 100) / 100,
    springPressure_psi: springPressurePsi,
    duty_pct: Math.round(dutyCycle * 10) / 10,
    status,
    boostMap: [
      { rpm: 2000, duty: Math.round(dutyCycle * 0.3), boost_psi: Math.round(targetBoostPsi * 0.3 * 10) / 10 },
      { rpm: 3000, duty: Math.round(dutyCycle * 0.6), boost_psi: Math.round(targetBoostPsi * 0.6 * 10) / 10 },
      { rpm: 4000, duty: Math.round(dutyCycle * 0.85), boost_psi: Math.round(targetBoostPsi * 0.85 * 10) / 10 },
      { rpm: 5000, duty: Math.round(dutyCycle * 1.0), boost_psi: targetBoostPsi },
      { rpm: 6000, duty: Math.round(dutyCycle * 0.95), boost_psi: Math.round(targetBoostPsi * 0.95 * 10) / 10 },
      { rpm: 7000, duty: Math.round(dutyCycle * 0.90), boost_psi: Math.round(targetBoostPsi * 0.90 * 10) / 10 },
    ],
  };
}


// ─── MAF Scaling ──────────────────────────────────────────────────────────

/**
 * Calculate MAF sensor scaling factor for larger injectors
 */
export function calcMAFScale(stockFlowCc, newFlowCc, stockFuelPressureBar = 3, newFuelPressureBar = 3) {
  const stockCorrected = stockFlowCc * Math.sqrt(stockFuelPressureBar / 3);
  const newCorrected = newFlowCc * Math.sqrt(newFuelPressureBar / 3);
  const scaleFactor = stockCorrected / newCorrected;

  return {
    stockInjector_cc: stockFlowCc,
    newInjector_cc: newFlowCc,
    stockPressure_bar: stockFuelPressureBar,
    newPressure_bar: newFuelPressureBar,
    mafScaleFactor: Math.round(scaleFactor * 10000) / 10000,
    mafScale_pct: Math.round(scaleFactor * 100 * 10) / 10,
    note: scaleFactor < 1
      ? 'MAF values need to be reduced (larger injectors deliver more fuel per ms)'
      : 'MAF values need to be increased (smaller injectors deliver less fuel per ms)',
  };
}


// ─── Fuel Pump Sizing ─────────────────────────────────────────────────────

/**
 * Calculate required fuel pump flow
 */
export function sizeFuelPump(targetHp, fuelType = 'gasoline', bsfc = 0.50, fuelPressureBar = 3, safetyMargin = 1.2) {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;
  const fuelFlowLbHr = bsfc * targetHp;
  const fuelFlowLitersHr = fuelFlowLbHr * 0.453592 / fuel.kg_l;
  const requiredLph = fuelFlowLitersHr * safetyMargin;

  const commonPumps = [
    { name: 'Walbro 190', flow_lph: 190, pressure_bar: 3 },
    { name: 'Walbro 255', flow_lph: 255, pressure_bar: 3 },
    { name: 'AEM 320', flow_lph: 320, pressure_bar: 3 },
    { name: 'AEM 340', flow_lph: 340, pressure_bar: 3 },
    { name: 'DW200', flow_lph: 200, pressure_bar: 3 },
    { name: 'DW300', flow_lph: 300, pressure_bar: 3 },
    { name: 'DW400', flow_lph: 400, pressure_bar: 3 },
    { name: 'Bosch 044', flow_lph: 300, pressure_bar: 5 },
    { name: 'Twin Walbro 255', flow_lph: 510, pressure_bar: 3 },
    { name: 'Twin Bosch 044', flow_lph: 600, pressure_bar: 5 },
  ];

  // Correct pump flow for actual pressure (pumps lose flow at higher pressure)
  const suitablePumps = commonPumps
    .map(p => {
      const correctedFlow = p.flow_lph * Math.sqrt(p.pressure_bar / fuelPressureBar);
      return {
        ...p,
        correctedFlow_lph: Math.round(correctedFlow),
        adequate: correctedFlow >= requiredLph,
        headroom_pct: Math.round(((correctedFlow - requiredLph) / requiredLph) * 100),
      };
    })
    .filter(p => p.adequate)
    .sort((a, b) => a.correctedFlow_lph - b.correctedFlow_lph);

  return {
    targetHp,
    fuelType,
    fuelFlow_lph: Math.round(fuelFlowLitersHr * 10) / 10,
    requiredWithMargin_lph: Math.round(requiredLph * 10) / 10,
    safetyMargin,
    fuelPressure_bar: fuelPressureBar,
    suitablePumps: suitablePumps.slice(0, 5),
  };
}


// ─── Volumetric Efficiency Estimator ─────────────────────────────────────

/**
 * Estimate VE from measured AFR and known injector data
 */
export function estimateVE(measuredAFR, injectorFlowCc, pulseWidthMs, rpm, displacement_cc, numCylinders, fuelType = 'gasoline') {
  const fuel = FUEL_DENSITY[fuelType] || FUEL_DENSITY.gasoline;

  // Fuel delivered per cycle per cylinder
  const fuelPerPulse_cc = (injectorFlowCc / 60000) * pulseWidthMs; // cc of fuel
  const fuelMass_g = fuelPerPulse_cc * fuel.kg_l * 1000; // grams

  // Air mass from measured AFR
  const airMass_g = fuelMass_g * measuredAFR;

  // Theoretical air per cylinder per intake event
  const cylinderVolume_cc = displacement_cc / numCylinders;
  const airDensity_g_cc = 1.225 / 1000; // g/cc at sea level, 15°C
  const theoreticalAir_g = cylinderVolume_cc * airDensity_g_cc;

  const ve = (airMass_g / theoreticalAir_g) * 100;

  return {
    measuredAFR,
    injectorFlow_cc: injectorFlowCc,
    pulseWidth_ms: pulseWidthMs,
    rpm,
    displacement_cc,
    numCylinders,
    fuelDelivered_cc: Math.round(fuelPerPulse_cc * 10000) / 10000,
    fuelMass_mg: Math.round(fuelMass_g * 1000 * 10) / 10,
    airMass_mg: Math.round(airMass_g * 1000 * 10) / 10,
    theoreticalAir_mg: Math.round(theoreticalAir_g * 1000 * 10) / 10,
    volumetricEfficiency_pct: Math.round(ve * 10) / 10,
    note: ve > 100 ? 'VE > 100% indicates forced induction or ram-air effect' :
          ve > 85 ? 'Good VE — well-tuned naturally aspirated or mild boost' :
          ve > 70 ? 'Average VE — typical stock engine' :
          'Low VE — potential intake restriction, exhaust restriction, or timing issues',
  };
}


// ─── Listing / Lookup ────────────────────────────────────────────────────

export function listInjectors() {
  return Object.entries(INJECTOR_DATABASE).map(([name, data]) => ({ name, ...data }));
}

export function getInjector(name) {
  return INJECTOR_DATABASE[name] || null;
}

export function listFuelTypes() {
  return Object.entries(FUEL_DENSITY).map(([name, data]) => ({ name, ...data }));
}

export function getFuelType(name) {
  return FUEL_DENSITY[name] || null;
}

export function fuelCalcStats() {
  return {
    injectors: Object.keys(INJECTOR_DATABASE).length,
    fuelTypes: Object.keys(FUEL_DENSITY).length,
    calculations: ['dutyCycle', 'injectorSizing', 'afr', 'lambdaConversion',
      'boostPower', 'wastegateDuty', 'mafScaling', 'fuelPumpSizing', 'volumetricEfficiency'],
  };
}

export { FUEL_DENSITY, INJECTOR_DATABASE };
