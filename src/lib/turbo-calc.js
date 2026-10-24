// Turbo & Compressor Calculator
// Compressor map sizing, A/R selection, turbine matching, surge/choke analysis

// ─── Compressor Map Zones ─────────────────────────────────────────────────

const TURBO_DATABASE = {
  // Garrett
  'garrett-gtx2860r': { compressor: { trim: 60, inducer_mm: 42.1, exducer_mm: 60, maxFlow_lb_min: 40, surgeFlow: 8, peakEfficiency: 0.78 }, turbine: { trim: 76, exducer_mm: 54, AR_options: [0.64, 0.82, 0.86], maxRPM: 160000 }, maxHp: 475 },
  'garrett-gtx2867r': { compressor: { trim: 67, inducer_mm: 42.1, exducer_mm: 54, maxFlow_lb_min: 42, surgeFlow: 7, peakEfficiency: 0.78 }, turbine: { trim: 76, exducer_mm: 54, AR_options: [0.64, 0.82, 0.86], maxRPM: 155000 }, maxHp: 500 },
  'garrett-gtx3071r': { compressor: { trim: 58, inducer_mm: 49.7, exducer_mm: 71.4, maxFlow_lb_min: 53, surgeFlow: 10, peakEfficiency: 0.76 }, turbine: { trim: 84, exducer_mm: 56, AR_options: [0.63, 0.82, 1.01, 1.06], maxRPM: 140000 }, maxHp: 620 },
  'garrett-gtx3076r': { compressor: { trim: 58, inducer_mm: 53.1, exducer_mm: 76.2, maxFlow_lb_min: 60, surgeFlow: 12, peakEfficiency: 0.76 }, turbine: { trim: 84, exducer_mm: 62, AR_options: [0.63, 0.82, 1.01, 1.06], maxRPM: 130000 }, maxHp: 700 },
  'garrett-gtx3582r': { compressor: { trim: 56, inducer_mm: 58.3, exducer_mm: 82.2, maxFlow_lb_min: 73, surgeFlow: 16, peakEfficiency: 0.75 }, turbine: { trim: 84, exducer_mm: 68, AR_options: [0.63, 0.82, 1.01, 1.06], maxRPM: 115000 }, maxHp: 900 },
  'garrett-g25-550': { compressor: { trim: 55, inducer_mm: 45.0, exducer_mm: 60.7, maxFlow_lb_min: 41, surgeFlow: 7, peakEfficiency: 0.79 }, turbine: { trim: 80, exducer_mm: 54.5, AR_options: [0.49, 0.72, 0.92], maxRPM: 165000 }, maxHp: 550 },
  'garrett-g25-660': { compressor: { trim: 55, inducer_mm: 48.6, exducer_mm: 65.6, maxFlow_lb_min: 47, surgeFlow: 8, peakEfficiency: 0.79 }, turbine: { trim: 80, exducer_mm: 54.5, AR_options: [0.49, 0.72, 0.92], maxRPM: 155000 }, maxHp: 660 },
  'garrett-g30-660': { compressor: { trim: 55, inducer_mm: 51, exducer_mm: 68.7, maxFlow_lb_min: 53, surgeFlow: 10, peakEfficiency: 0.78 }, turbine: { trim: 80, exducer_mm: 62, AR_options: [0.61, 0.83, 1.01], maxRPM: 140000 }, maxHp: 660 },
  'garrett-g30-770': { compressor: { trim: 55, inducer_mm: 54.0, exducer_mm: 72.7, maxFlow_lb_min: 58, surgeFlow: 11, peakEfficiency: 0.78 }, turbine: { trim: 80, exducer_mm: 65, AR_options: [0.61, 0.83, 1.01], maxRPM: 130000 }, maxHp: 770 },
  'garrett-g30-900': { compressor: { trim: 55, inducer_mm: 58, exducer_mm: 78, maxFlow_lb_min: 68, surgeFlow: 14, peakEfficiency: 0.77 }, turbine: { trim: 80, exducer_mm: 68, AR_options: [0.83, 1.01, 1.21], maxRPM: 120000 }, maxHp: 900 },
  'garrett-g35-900': { compressor: { trim: 58, inducer_mm: 62, exducer_mm: 84, maxFlow_lb_min: 73, surgeFlow: 15, peakEfficiency: 0.77 }, turbine: { trim: 80, exducer_mm: 74, AR_options: [0.61, 0.83, 1.01, 1.21], maxRPM: 110000 }, maxHp: 900 },
  'garrett-g35-1050': { compressor: { trim: 58, inducer_mm: 68, exducer_mm: 88, maxFlow_lb_min: 82, surgeFlow: 18, peakEfficiency: 0.76 }, turbine: { trim: 80, exducer_mm: 78, AR_options: [0.83, 1.01, 1.21], maxRPM: 105000 }, maxHp: 1050 },
  'garrett-g40-1150': { compressor: { trim: 60, inducer_mm: 72, exducer_mm: 96, maxFlow_lb_min: 95, surgeFlow: 20, peakEfficiency: 0.76 }, turbine: { trim: 84, exducer_mm: 84, AR_options: [1.01, 1.16, 1.28], maxRPM: 95000 }, maxHp: 1150 },
  // BorgWarner
  'borgwarner-efr-6258': { compressor: { trim: 58, inducer_mm: 42, exducer_mm: 55.1, maxFlow_lb_min: 30, surgeFlow: 5, peakEfficiency: 0.76 }, turbine: { trim: 76, exducer_mm: 48, AR_options: [0.64, 0.80], maxRPM: 180000 }, maxHp: 375 },
  'borgwarner-efr-6758': { compressor: { trim: 58, inducer_mm: 50, exducer_mm: 65.7, maxFlow_lb_min: 42, surgeFlow: 8, peakEfficiency: 0.76 }, turbine: { trim: 76, exducer_mm: 55, AR_options: [0.64, 0.80], maxRPM: 155000 }, maxHp: 500 },
  'borgwarner-efr-7163': { compressor: { trim: 63, inducer_mm: 53, exducer_mm: 71, maxFlow_lb_min: 55, surgeFlow: 10, peakEfficiency: 0.77 }, turbine: { trim: 80, exducer_mm: 62, AR_options: [0.80, 0.92, 1.05], maxRPM: 135000 }, maxHp: 650 },
  'borgwarner-efr-7670': { compressor: { trim: 70, inducer_mm: 57, exducer_mm: 76, maxFlow_lb_min: 66, surgeFlow: 13, peakEfficiency: 0.76 }, turbine: { trim: 80, exducer_mm: 68, AR_options: [0.85, 0.92, 1.05], maxRPM: 120000 }, maxHp: 800 },
  'borgwarner-efr-8374': { compressor: { trim: 74, inducer_mm: 62, exducer_mm: 83.3, maxFlow_lb_min: 80, surgeFlow: 16, peakEfficiency: 0.75 }, turbine: { trim: 84, exducer_mm: 74, AR_options: [0.83, 0.92, 1.05], maxRPM: 110000 }, maxHp: 1000 },
  'borgwarner-efr-9180': { compressor: { trim: 80, inducer_mm: 67, exducer_mm: 91, maxFlow_lb_min: 95, surgeFlow: 18, peakEfficiency: 0.75 }, turbine: { trim: 84, exducer_mm: 80, AR_options: [0.92, 1.05, 1.18], maxRPM: 100000 }, maxHp: 1200 },
  // Precision Turbo
  'precision-5862': { compressor: { trim: 62, inducer_mm: 46, exducer_mm: 58, maxFlow_lb_min: 38, surgeFlow: 7, peakEfficiency: 0.76 }, turbine: { trim: 76, exducer_mm: 52, AR_options: [0.63, 0.82], maxRPM: 155000 }, maxHp: 460 },
  'precision-6266': { compressor: { trim: 66, inducer_mm: 51, exducer_mm: 62, maxFlow_lb_min: 52, surgeFlow: 10, peakEfficiency: 0.76 }, turbine: { trim: 82, exducer_mm: 62, AR_options: [0.64, 0.82, 1.00], maxRPM: 140000 }, maxHp: 620 },
  'precision-6766': { compressor: { trim: 66, inducer_mm: 56, exducer_mm: 67.3, maxFlow_lb_min: 62, surgeFlow: 12, peakEfficiency: 0.76 }, turbine: { trim: 82, exducer_mm: 66, AR_options: [0.82, 1.00, 1.15], maxRPM: 125000 }, maxHp: 750 },
  'precision-7675': { compressor: { trim: 75, inducer_mm: 58, exducer_mm: 76, maxFlow_lb_min: 76, surgeFlow: 15, peakEfficiency: 0.75 }, turbine: { trim: 84, exducer_mm: 72, AR_options: [0.82, 0.96, 1.15], maxRPM: 115000 }, maxHp: 950 },
  'precision-8685': { compressor: { trim: 85, inducer_mm: 66, exducer_mm: 86, maxFlow_lb_min: 96, surgeFlow: 19, peakEfficiency: 0.74 }, turbine: { trim: 88, exducer_mm: 82, AR_options: [0.96, 1.15, 1.32], maxRPM: 100000 }, maxHp: 1200 },
};


// ─── Compressor Airflow Requirement ──────────────────────────────────────

/**
 * Calculate required compressor airflow for a target power
 * @param {number} targetHp - Target horsepower
 * @param {number} bsfc - Brake specific fuel consumption (lb/hp/hr), typically 0.45-0.60
 * @param {number} afr - Air-fuel ratio (stoich 14.7 for gasoline)
 * @returns {object} Required airflow in lb/min and CFM
 */
export function calcAirflow(targetHp, bsfc = 0.50, afr = 14.7) {
  const fuelFlow_lb_min = (bsfc * targetHp) / 60;
  const airFlow_lb_min = fuelFlow_lb_min * afr;
  const airFlow_cfm = airFlow_lb_min / 0.0765; // density at sea level

  return {
    targetHp,
    bsfc,
    afr,
    fuelFlow_lb_min: Math.round(fuelFlow_lb_min * 100) / 100,
    airFlow_lb_min: Math.round(airFlow_lb_min * 100) / 100,
    airFlow_cfm: Math.round(airFlow_cfm * 10) / 10,
  };
}


// ─── Compressor Pressure Ratio ───────────────────────────────────────────

/**
 * Calculate compressor pressure ratio for target boost
 */
export function calcPressureRatio(boostPsi, intakeLoss_psi = 1, altitudeFt = 0) {
  const atmPsi = 14.696 * Math.pow(1 - (altitudeFt * 0.3048 * 0.0000226), 5.256);
  const inletPsi = atmPsi - intakeLoss_psi;
  const outletPsi = atmPsi + boostPsi;
  const pr = outletPsi / inletPsi;

  return {
    boostPsi,
    altitude_ft: altitudeFt,
    atmosphericPressure_psi: Math.round(atmPsi * 100) / 100,
    inletPressure_psi: Math.round(inletPsi * 100) / 100,
    outletPressure_psi: Math.round(outletPsi * 100) / 100,
    pressureRatio: Math.round(pr * 100) / 100,
    intakeLoss_psi: intakeLoss_psi,
  };
}


// ─── Compressor Outlet Temperature ──────────────────────────────────────

/**
 * Calculate compressor outlet temperature (adiabatic)
 */
export function calcCompressorTemp(pr, inletTempC = 25, compressorEfficiency = 0.75) {
  const inletK = inletTempC + 273.15;
  const gamma = 1.4;
  const idealRise = inletK * (Math.pow(pr, (gamma - 1) / gamma) - 1);
  const actualRise = idealRise / compressorEfficiency;
  const outletK = inletK + actualRise;

  return {
    pressureRatio: pr,
    inletTemp_C: inletTempC,
    compressorEfficiency_pct: compressorEfficiency * 100,
    idealTempRise_C: Math.round(idealRise),
    actualTempRise_C: Math.round(actualRise),
    outletTemp_C: Math.round(outletK - 273.15),
    outletTemp_F: Math.round((outletK - 273.15) * 9 / 5 + 32),
  };
}


// ─── Intercooler Sizing ──────────────────────────────────────────────────

/**
 * Calculate intercooler requirements
 */
export function calcIntercooler(airflowLbMin, compOutletTempC, ambientTempC = 25, targetEfficiency = 0.70) {
  const tempDrop = (compOutletTempC - ambientTempC) * targetEfficiency;
  const postICTemp = compOutletTempC - tempDrop;

  // Heat rejection estimate (BTU/min)
  const cp_air = 0.24; // BTU/(lb·°F)
  const tempDropF = tempDrop * 9 / 5;
  const heatRejection_btu_min = airflowLbMin * cp_air * tempDropF;
  const heatRejection_kw = heatRejection_btu_min * 0.01757;

  // Core size recommendation (rough)
  const coreVolume_ci = heatRejection_btu_min * 2.5; // ~2.5 ci per BTU/min
  const coreLength = Math.round(Math.pow(coreVolume_ci / 3, 1/3)); // cube root for balanced dims

  return {
    airflow_lb_min: airflowLbMin,
    compressorOutlet_C: compOutletTempC,
    ambient_C: ambientTempC,
    targetEfficiency_pct: targetEfficiency * 100,
    tempDrop_C: Math.round(tempDrop),
    postIntercoolerTemp_C: Math.round(postICTemp),
    heatRejection_btu_min: Math.round(heatRejection_btu_min),
    heatRejection_kw: Math.round(heatRejection_kw * 10) / 10,
    recommendedCore: {
      minVolume_ci: Math.round(coreVolume_ci),
      suggestedDims_inches: `${coreLength}" x ${coreLength}" x ${Math.round(coreLength * 0.5)}"`,
    },
  };
}


// ─── Turbine A/R Selection ──────────────────────────────────────────────

/**
 * Guide turbine A/R selection based on displacement and target boost
 */
export function selectAR(displacement_cc, targetBoostPsi, numCylinders, maxRPM = 7000) {
  const disp_liters = displacement_cc / 1000;

  // Exhaust gas flow estimate (CFM at peak)
  const ve = 0.90; // assume good VE
  const exhaustFlow_cfm = (disp_liters * maxRPM * ve) / (2 * 28.317); // rough exhaust CFM

  // A/R sizing — smaller A/R = faster spool, higher backpressure
  let recommendedAR;
  const exhaustMetric = disp_liters * (maxRPM / 1000);

  if (exhaustMetric < 8) recommendedAR = { min: 0.48, ideal: 0.64, max: 0.82, note: 'Small displacement — prioritize spool speed' };
  else if (exhaustMetric < 15) recommendedAR = { min: 0.63, ideal: 0.82, max: 1.01, note: 'Medium displacement — balanced spool and flow' };
  else if (exhaustMetric < 25) recommendedAR = { min: 0.82, ideal: 1.01, max: 1.15, note: 'Large displacement — good exhaust energy, larger A/R OK' };
  else recommendedAR = { min: 1.01, ideal: 1.15, max: 1.32, note: 'Very large displacement — large A/R for low backpressure' };

  // Spool estimate
  const spoolFactor = recommendedAR.ideal * 1000 / disp_liters;
  let spoolRPM;
  if (spoolFactor < 500) spoolRPM = '2000-2500 RPM';
  else if (spoolFactor < 800) spoolRPM = '2500-3500 RPM';
  else if (spoolFactor < 1200) spoolRPM = '3500-4500 RPM';
  else spoolRPM = '4500+ RPM';

  return {
    displacement_cc,
    displacement_liters: disp_liters,
    numCylinders,
    maxRPM,
    targetBoost_psi: targetBoostPsi,
    exhaustFlow_cfm: Math.round(exhaustFlow_cfm),
    recommendedAR,
    estimatedFullBoostRPM: spoolRPM,
    tips: [
      'Lower A/R = faster spool but more backpressure at high RPM',
      'Higher A/R = slower spool but better top-end flow',
      'Divided (twin-scroll) housings improve spool with less backpressure penalty',
      'External wastegate allows more precise boost control vs. internal',
    ],
  };
}


// ─── Turbo Sizing Recommendation ─────────────────────────────────────────

/**
 * Recommend turbo size for target power and displacement
 */
export function sizeTurbo(targetHp, displacement_cc, fuelType = 'gasoline', bsfc = 0.50) {
  const afr = fuelType === 'e85' ? 9.765 : fuelType === 'diesel' ? 14.6 : 14.7;
  const airflow = calcAirflow(targetHp, bsfc, afr);
  const requiredFlow = airflow.airFlow_lb_min;

  // Find matching turbos
  const matches = Object.entries(TURBO_DATABASE)
    .filter(([, t]) => t.compressor.maxFlow_lb_min >= requiredFlow * 0.85 && t.maxHp >= targetHp * 0.8)
    .sort((a, b) => Math.abs(a[1].maxHp - targetHp) - Math.abs(b[1].maxHp - targetHp))
    .slice(0, 5)
    .map(([name, t]) => {
      const headroom = ((t.compressor.maxFlow_lb_min - requiredFlow) / requiredFlow * 100);
      const flowPct = (requiredFlow / t.compressor.maxFlow_lb_min) * 100;
      let fit = 'GOOD';
      if (flowPct > 90) fit = 'TIGHT';
      else if (flowPct > 95) fit = 'MAXED';
      else if (flowPct < 50) fit = 'OVERSIZED';

      return {
        turbo: name,
        maxHp: t.maxHp,
        compressorMaxFlow: t.compressor.maxFlow_lb_min,
        compressorEfficiency: t.compressor.peakEfficiency,
        turbineAR_options: t.turbine.AR_options,
        maxTurboRPM: t.turbine.maxRPM,
        flowHeadroom_pct: Math.round(headroom),
        operatingPoint_pct: Math.round(flowPct),
        fit,
      };
    });

  return {
    targetHp,
    displacement_cc,
    fuelType,
    requiredAirflow: airflow,
    recommendations: matches,
  };
}


// ─── Surge / Choke Analysis ─────────────────────────────────────────────

/**
 * Check if an operating point is in surge or choke for a given turbo
 */
export function checkSurgeChoke(turboName, operatingFlow_lb_min, pressureRatio) {
  const turbo = TURBO_DATABASE[turboName];
  if (!turbo) return { error: `Turbo not found: ${turboName}` };

  const comp = turbo.compressor;
  let zone = 'NORMAL';
  let detail = '';

  if (operatingFlow_lb_min < comp.surgeFlow * (pressureRatio / 2)) {
    zone = 'SURGE';
    detail = 'Operating point is below the surge line — compressor is stalling. Increase airflow (larger engine displacement, higher RPM) or reduce boost.';
  } else if (operatingFlow_lb_min > comp.maxFlow_lb_min * 0.95) {
    zone = 'CHOKE';
    detail = 'Operating point is near the choke line — compressor efficiency drops sharply. Consider a larger compressor.';
  } else if (operatingFlow_lb_min > comp.maxFlow_lb_min * 0.85) {
    zone = 'HIGH_FLOW';
    detail = 'Near choke boundary — efficiency dropping. Monitor compressor outlet temperature.';
  } else if (operatingFlow_lb_min < comp.surgeFlow * (pressureRatio / 1.5)) {
    zone = 'NEAR_SURGE';
    detail = 'Near surge boundary — may experience flutter under transient conditions. Consider a blow-off valve adjustment.';
  } else {
    detail = 'Operating in the efficiency island — good placement on the compressor map.';
  }

  return {
    turbo: turboName,
    operatingFlow_lb_min,
    pressureRatio,
    surgeFlow: comp.surgeFlow,
    maxFlow: comp.maxFlow_lb_min,
    peakEfficiency: comp.peakEfficiency,
    zone,
    detail,
  };
}


// ─── Twin Turbo Configuration ──────────────────────────────────────────

/**
 * Calculate twin-turbo configuration
 */
export function calcTwinTurbo(targetHp, displacement_cc, config = 'parallel') {
  const perTurboHp = config === 'parallel' ? targetHp / 2 : targetHp;
  const perTurboDisp = config === 'parallel' ? displacement_cc / 2 : displacement_cc;

  const sizing = sizeTurbo(perTurboHp, perTurboDisp);

  return {
    totalTargetHp: targetHp,
    totalDisplacement_cc: displacement_cc,
    configuration: config,
    description: config === 'parallel'
      ? 'Parallel twins — each turbo fed by half the cylinders, both feeding the same intake manifold'
      : config === 'sequential'
        ? 'Sequential twins — small turbo for low RPM spool, large turbo for high RPM power'
        : 'Compound — low-pressure turbo feeds into high-pressure turbo (staged compression)',
    perTurboTarget: {
      hp: perTurboHp,
      displacement_cc: perTurboDisp,
    },
    advantages: config === 'parallel'
      ? ['Faster spool than single large turbo', 'Balanced exhaust pulses on V-engines', 'Smaller packaging per side']
      : config === 'sequential'
        ? ['Broad powerband — small turbo fills low-end gap', 'High-RPM power from large turbo', 'Common on factory turbo cars']
        : ['Very high boost possible (40+ psi)', 'Each stage runs at lower PR for better efficiency', 'Common in diesel/marine'],
    singleTurboRecommendations: sizing.recommendations,
  };
}


// ─── Listing / Lookup ────────────────────────────────────────────────────

export function listTurbos() {
  return Object.entries(TURBO_DATABASE).map(([name, data]) => ({
    name,
    maxHp: data.maxHp,
    compressorMaxFlow: data.compressor.maxFlow_lb_min,
    compressorTrim: data.compressor.trim,
    turbineAR_options: data.turbine.AR_options,
    maxRPM: data.turbine.maxRPM,
  }));
}

export function getTurbo(name) {
  return TURBO_DATABASE[name] || null;
}

export function searchTurbos(query) {
  const q = query.toLowerCase();
  return Object.entries(TURBO_DATABASE)
    .filter(([name]) => name.includes(q))
    .map(([name, data]) => ({ name, maxHp: data.maxHp, maxFlow: data.compressor.maxFlow_lb_min }));
}

export function turboCalcStats() {
  return {
    turbos: Object.keys(TURBO_DATABASE).length,
    manufacturers: [...new Set(Object.keys(TURBO_DATABASE).map(n => n.split('-')[0]))],
    calculations: ['airflow', 'pressureRatio', 'compressorTemp', 'intercooler', 'arSelection', 'turboSizing', 'surgeChoke', 'twinTurbo'],
  };
}

export { TURBO_DATABASE };
