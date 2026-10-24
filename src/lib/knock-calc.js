// Knock Detection Analyzer
// Knock frequency by bore, timing retard, octane, detonation risk, knock sensor analysis

// ─── Knock Frequency by Bore Size ──────────────────────────────────────

/**
 * Primary knock frequency ≈ 900000 / bore_mm (Hz)
 * Harmonics at 2x, 3x, 4x
 */
export function calcKnockFrequency(bore_mm) {
  const primary = 900000 / bore_mm;
  return {
    bore_mm,
    primary_Hz: Math.round(primary),
    primary_kHz: Math.round(primary / 100) / 10,
    harmonics: [
      { order: 1, freq_Hz: Math.round(primary), freq_kHz: Math.round(primary / 100) / 10 },
      { order: 2, freq_Hz: Math.round(primary * 2), freq_kHz: Math.round(primary * 2 / 100) / 10 },
      { order: 3, freq_Hz: Math.round(primary * 3), freq_kHz: Math.round(primary * 3 / 100) / 10 },
      { order: 4, freq_Hz: Math.round(primary * 4), freq_kHz: Math.round(primary * 4 / 100) / 10 },
    ],
    bandpassFilter: {
      center_Hz: Math.round(primary),
      low_Hz: Math.round(primary * 0.85),
      high_Hz: Math.round(primary * 1.15),
      bandwidth_Hz: Math.round(primary * 0.30),
      note: 'Typical knock sensor bandpass is ±15% of primary frequency',
    },
    sensorRecommendation: primary < 5000 ? 'Broadband resonant sensor (1-18kHz)' : primary < 8000 ? 'Standard resonant sensor (5-10kHz center)' : 'High-frequency resonant sensor (8-16kHz center)',
  };
}


// ─── Octane Requirement ─────────────────────────────────────────────────

const OCTANE_DATABASE = {
  'ron91': { name: 'Regular 91 RON / 87 AKI', ron: 91, aki: 87, mot: 83, sensitivity: 8, application: 'NA economy engines, low compression' },
  'ron95': { name: 'Premium 95 RON / 91 AKI', ron: 95, aki: 91, mot: 87, sensitivity: 8, application: 'Modern NA engines, mild turbo' },
  'ron98': { name: 'Super 98 RON / 93 AKI', ron: 98, aki: 93, mot: 89, sensitivity: 9, application: 'High-performance NA, turbo engines' },
  'ron100': { name: 'Race 100 RON / 96 AKI', ron: 100, aki: 96, mot: 91, sensitivity: 9, application: 'High boost turbo, race' },
  'ron102': { name: 'Race 102 RON / 98 AKI', ron: 102, aki: 98, mot: 92, sensitivity: 10, application: 'Extreme boost, drag racing' },
  'ron104': { name: 'Race 104 RON / 100 AKI', ron: 104, aki: 100, mot: 93, sensitivity: 11, application: 'Professional motorsport' },
  'ron110': { name: 'Racing 110 RON / 106 AKI', ron: 110, aki: 106, mot: 97, sensitivity: 13, application: 'Top-level racing, extreme applications' },
  'e85': { name: 'E85 Ethanol', ron: 108, aki: 105, mot: 95, sensitivity: 13, application: 'Flex-fuel, high boost — excellent knock resistance' },
  'methanol': { name: 'Methanol (M100)', ron: 115, aki: 112, mot: 99, sensitivity: 16, application: 'Sprint racing, drag — extreme cooling and knock resistance' },
};


// ─── Detonation Risk Assessment ─────────────────────────────────────────

export function assessDetonationRisk(compressionRatio, boostPSI = 0, octane_RON = 95, intakeTemp_C = 25, timing_deg = 0) {
  // Effective compression with boost
  const boostRatio = (14.7 + boostPSI) / 14.7;
  const effectiveCR = compressionRatio * boostRatio;

  // Temperature effect
  const tempFactor = 1 + (intakeTemp_C - 25) * 0.003; // each degree C above 25 adds ~0.3% risk

  // Octane resistance
  const octaneMargin = octane_RON - (60 + effectiveCR * 3); // rough threshold

  // Timing effect
  const timingRisk = timing_deg > 0 ? timing_deg * 0.05 : 0; // advanced timing increases risk

  // Risk score 0-100
  let riskScore = 0;
  riskScore += Math.max(0, (effectiveCR - 10) * 8); // high eCR
  riskScore += Math.max(0, -octaneMargin * 3); // low octane margin
  riskScore += Math.max(0, (intakeTemp_C - 25) * 0.5); // hot intake
  riskScore += timingRisk * 10;
  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

  let riskLevel, recommendation;
  if (riskScore < 20) { riskLevel = 'LOW'; recommendation = 'Safe operating conditions. Standard tuning parameters are fine.'; }
  else if (riskScore < 40) { riskLevel = 'MODERATE'; recommendation = 'Monitor knock counts. Consider knock retard strategy.'; }
  else if (riskScore < 60) { riskLevel = 'HIGH'; recommendation = 'Active knock control required. Reduce timing, add fuel enrichment, or upgrade fuel.'; }
  else if (riskScore < 80) { riskLevel = 'VERY HIGH'; recommendation = 'Significant detonation risk. Reduce boost/timing, upgrade fuel, or add methanol injection.'; }
  else { riskLevel = 'CRITICAL'; recommendation = 'Engine damage imminent without intervention. Immediately reduce boost and timing.'; }

  return {
    compressionRatio,
    boostPSI,
    boostRatio: Math.round(boostRatio * 100) / 100,
    effectiveCR: Math.round(effectiveCR * 10) / 10,
    octane_RON,
    intakeTemp_C,
    timing_advance_deg: timing_deg,
    octaneMargin: Math.round(octaneMargin * 10) / 10,
    riskScore,
    riskLevel,
    recommendation,
    mitigations: riskScore >= 40 ? [
      'Retard ignition timing 2-4° from current',
      'Increase fuel enrichment under load (target λ 0.80-0.85)',
      boostPSI > 0 ? 'Reduce boost by 2-3 PSI' : null,
      intakeTemp_C > 40 ? 'Improve intercooling — charge air too hot' : null,
      octane_RON < 98 ? `Upgrade fuel to RON 98+ (currently using RON ${octane_RON})` : null,
      boostPSI > 15 ? 'Consider water/methanol injection' : null,
    ].filter(Boolean) : [],
  };
}


// ─── Timing Retard Recommendation ───────────────────────────────────────

export function calcTimingRetard(baseAdvance_deg, knockCount, knockIntensity = 1.0) {
  // Standard knock-retard strategy
  const retardPerKnock = 1.5; // degrees per knock event
  const maxRetard = 12; // maximum retard from base
  const recoveryRate_deg_per_s = 0.5; // degrees recovered per second without knock

  const immediateRetard = Math.min(maxRetard, knockCount * retardPerKnock * knockIntensity);
  const newTiming = baseAdvance_deg - immediateRetard;

  return {
    baseAdvance_deg,
    knockCount,
    knockIntensity,
    immediateRetard_deg: Math.round(immediateRetard * 10) / 10,
    newTiming_deg: Math.round(newTiming * 10) / 10,
    recoveryRate_deg_per_s: recoveryRate_deg_per_s,
    recoveryTime_s: Math.round(immediateRetard / recoveryRate_deg_per_s * 10) / 10,
    maxRetardLimit_deg: maxRetard,
    assessment: immediateRetard > 8 ? 'SEVERE — sustained heavy knock, investigate root cause' : immediateRetard > 4 ? 'MODERATE — tune needs adjustment' : immediateRetard > 0 ? 'MINOR — normal knock adaptation' : 'NONE — no knock detected',
    strategy: {
      step1: 'On knock event, immediately retard timing by retard amount',
      step2: `Recover at ${recoveryRate_deg_per_s}°/sec when no knock present`,
      step3: 'If knock persists at maximum retard, add fuel enrichment',
      step4: 'Log knock events for post-session analysis',
    },
  };
}


// ─── Knock Sensor Spec Database ─────────────────────────────────────────

const KNOCK_SENSOR_DATABASE = {
  'bosch-0261231006': { name: 'Bosch 0261231006', type: 'resonant', centerFreq_kHz: 6.8, bandwidth_kHz: '5-9', impedance_ohm: 560, sensitivity_mV_g: 28, tempRange_C: '-40 to 150', thread: 'M8x1.25', application: 'BMW, VW, Porsche — common OEM sensor' },
  'bosch-0261231120': { name: 'Bosch 0261231120', type: 'resonant', centerFreq_kHz: 7.5, bandwidth_kHz: '5-10', impedance_ohm: 100, sensitivity_mV_g: 30, tempRange_C: '-40 to 150', thread: 'M8x1.25', application: 'Modern Bosch ECU applications' },
  'bosch-0261231146': { name: 'Bosch 0261231146', type: 'broadband', centerFreq_kHz: 'wideband', bandwidth_kHz: '1-18', impedance_ohm: 1000, sensitivity_mV_g: 25, tempRange_C: '-40 to 150', thread: 'M8x1.25', application: 'Aftermarket, MoTeC, Haltech' },
  'denso-89615-12090': { name: 'Denso 89615-12090', type: 'resonant', centerFreq_kHz: 6.2, bandwidth_kHz: '4-8', impedance_ohm: 560, sensitivity_mV_g: 26, tempRange_C: '-40 to 130', thread: 'M8x1.25', application: 'Toyota, Lexus' },
  'delphi-12589867': { name: 'Delphi 12589867', type: 'resonant', centerFreq_kHz: 5.8, bandwidth_kHz: '4-8', impedance_ohm: 3300, sensitivity_mV_g: 32, tempRange_C: '-40 to 150', thread: '7/16-20', application: 'GM LS-series, Gen III/IV' },
  'continental-a2c53338100': { name: 'Continental A2C53338100', type: 'broadband', centerFreq_kHz: 'wideband', bandwidth_kHz: '2-15', impedance_ohm: 220, sensitivity_mV_g: 22, tempRange_C: '-40 to 140', thread: 'M8x1.25', application: 'Ford EcoBoost, PSA' },
  'ngk-s0116': { name: 'NGK/NTK S0116', type: 'resonant', centerFreq_kHz: 7.0, bandwidth_kHz: '5-10', impedance_ohm: 470, sensitivity_mV_g: 27, tempRange_C: '-40 to 130', thread: 'M8x1.25', application: 'Subaru, Mitsubishi' },
  'aftermarket-wideband': { name: 'Aftermarket Wideband Knock Sensor', type: 'broadband', centerFreq_kHz: 'wideband', bandwidth_kHz: '1-20', impedance_ohm: 1000, sensitivity_mV_g: 20, tempRange_C: '-40 to 150', thread: 'M8x1.25', application: 'Universal aftermarket, standalone ECUs' },
};


// ─── Ignition Timing Map Recommendations ────────────────────────────────

export function recommendTimingMap(compressionRatio, fuelOctane_RON, boostPSI = 0, engineType = 'na') {
  const effectiveCR = compressionRatio * ((14.7 + boostPSI) / 14.7);

  // Base timing estimate at peak torque RPM
  let baseTiming;
  if (engineType === 'na') {
    baseTiming = 38 - (effectiveCR - 9) * 2; // higher CR = less timing
  } else {
    baseTiming = 28 - (effectiveCR - 8) * 1.5; // boosted = even less timing
  }

  // Octane correction
  baseTiming += (fuelOctane_RON - 95) * 0.3; // higher octane allows more timing

  baseTiming = Math.max(8, Math.min(42, baseTiming));

  const rpmBreakpoints = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000];
  const loadBreakpoints = [20, 40, 60, 80, 100]; // % load

  const timingTable = loadBreakpoints.map(load => ({
    load_pct: load,
    timing_by_rpm: rpmBreakpoints.map(rpm => {
      let t = baseTiming;
      // RPM correction: more timing at low RPM (more burn time), less at high RPM
      if (rpm < 2000) t += 5;
      else if (rpm < 3000) t += 3;
      else if (rpm > 5500) t -= 2;
      else if (rpm > 6500) t -= 4;
      // Load correction: less timing at high load (more pressure)
      t -= (load - 50) * 0.08;
      return { rpm, timing_deg: Math.round(Math.max(5, Math.min(45, t)) * 10) / 10 };
    }),
  }));

  return {
    compressionRatio,
    fuelOctane_RON,
    boostPSI,
    effectiveCR: Math.round(effectiveCR * 10) / 10,
    engineType,
    peakTorqueTiming_deg: Math.round(baseTiming * 10) / 10,
    idleTiming_deg: Math.round((baseTiming + 8) * 10) / 10,
    timingTable,
    note: 'Estimated starting point only. Always verify on dyno with knock detection active. Retard 2-3° from first knock onset (MBT).',
    safety: [
      'Never exceed MBT (Minimum spark advance for Best Torque)',
      'Always run wideband O2 and knock sensor during tuning',
      'Richer mixture (λ 0.85) under boost for knock margin',
      'Add 2° safety margin from knock threshold',
    ],
  };
}


// ─── Knock Window Analysis ──────────────────────────────────────────────

export function analyzeKnockWindow(rpm, strokeLength_mm = 86) {
  const crankDegPerSecond = rpm * 6; // 360° per rev, rpm/60 revs per sec
  const windowStart_ATDC = -5; // 5° before TDC
  const windowEnd_ATDC = 70; // 70° after TDC
  const windowDuration_deg = windowEnd_ATDC - windowStart_ATDC;
  const windowDuration_ms = (windowDuration_deg / crankDegPerSecond) * 1000;

  // Piston position at knock window boundaries
  const pistonTravel_mm = strokeLength_mm / 2; // half stroke = crank radius

  return {
    rpm,
    strokeLength_mm,
    knockWindow: {
      start_deg_ATDC: windowStart_ATDC,
      end_deg_ATDC: windowEnd_ATDC,
      duration_deg: windowDuration_deg,
      duration_ms: Math.round(windowDuration_ms * 100) / 100,
    },
    crankSpeed_deg_per_ms: Math.round(crankDegPerSecond / 1000 * 100) / 100,
    samplingRequirement: {
      minSampleRate_kHz: Math.round(1 / (windowDuration_ms / 1000) / 1000 * 20), // Nyquist * 10 for adequate resolution
      recommendedSampleRate_kHz: Math.round(1 / (windowDuration_ms / 1000) / 1000 * 40),
      note: 'Sample rate must resolve knock frequency within the knock window',
    },
    assessment: windowDuration_ms < 1 ? 'VERY SHORT window — high-speed ADC required, >200kHz recommended' : windowDuration_ms < 3 ? 'SHORT window — fast ADC recommended, >100kHz' : windowDuration_ms < 8 ? 'NORMAL window — standard knock detection adequate' : 'LONG window — low RPM, standard sensor and ADC sufficient',
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listOctanes() {
  return Object.entries(OCTANE_DATABASE).map(([name, o]) => ({ name, ...o }));
}

export function getOctane(name) {
  return OCTANE_DATABASE[name] || null;
}

export function listKnockSensors() {
  return Object.entries(KNOCK_SENSOR_DATABASE).map(([name, s]) => ({ name, ...s }));
}

export function getKnockSensor(name) {
  return KNOCK_SENSOR_DATABASE[name] || null;
}

export function searchKnockSensors(query) {
  const q = query.toLowerCase();
  return Object.entries(KNOCK_SENSOR_DATABASE)
    .filter(([name, s]) =>
      name.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.application.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q)
    )
    .map(([name, s]) => ({ name, ...s }));
}

export function knockCalcStats() {
  return {
    octaneRatings: Object.keys(OCTANE_DATABASE).length,
    knockSensors: Object.keys(KNOCK_SENSOR_DATABASE).length,
    calculations: ['knockFrequency', 'detonationRisk', 'timingRetard', 'timingMap', 'knockWindow'],
  };
}

export { OCTANE_DATABASE, KNOCK_SENSOR_DATABASE };
