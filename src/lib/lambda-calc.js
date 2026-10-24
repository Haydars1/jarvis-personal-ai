// Wideband Lambda Controller
// Lambda target tables, closed-loop PID, sensor calibration, stoich by fuel, AFR mapping

// ─── Stoichiometric AFR by Fuel Type ────────────────────────────────────

const STOICH_DATABASE = {
  'gasoline': { name: 'Gasoline (Petrol)', stoichAFR: 14.7, stoichLambda: 1.0, energyDensity_MJ_L: 34.2, density_kg_L: 0.745, ron: '91-100', application: 'Standard petrol engines' },
  'e10': { name: 'E10 (10% Ethanol)', stoichAFR: 14.1, stoichLambda: 1.0, energyDensity_MJ_L: 33.4, density_kg_L: 0.755, ron: '94-98', application: 'Common pump fuel in EU/US' },
  'e85': { name: 'E85 (85% Ethanol)', stoichAFR: 9.76, stoichLambda: 1.0, energyDensity_MJ_L: 25.6, density_kg_L: 0.795, ron: '105-108', application: 'Flex-fuel, high-performance' },
  'ethanol': { name: 'Pure Ethanol (E100)', stoichAFR: 9.0, stoichLambda: 1.0, energyDensity_MJ_L: 23.5, density_kg_L: 0.789, ron: '108-110', application: 'Racing, dedicated ethanol engines' },
  'methanol': { name: 'Methanol (M100)', stoichAFR: 6.47, stoichLambda: 1.0, energyDensity_MJ_L: 17.9, density_kg_L: 0.792, ron: '112-115', application: 'Sprint racing, drag racing' },
  'diesel': { name: 'Diesel', stoichAFR: 14.5, stoichLambda: 1.0, energyDensity_MJ_L: 38.6, density_kg_L: 0.835, ron: 'N/A (cetane 40-55)', application: 'Compression ignition engines' },
  'lpg': { name: 'LPG (Autogas)', stoichAFR: 15.7, stoichLambda: 1.0, energyDensity_MJ_L: 26.0, density_kg_L: 0.540, ron: '105-115', application: 'LPG converted vehicles' },
  'cng': { name: 'CNG (Natural Gas)', stoichAFR: 17.2, stoichLambda: 1.0, energyDensity_MJ_L: 9.0, density_kg_L: 0.162, ron: '120-130', application: 'CNG vehicles, fleet' },
  'hydrogen': { name: 'Hydrogen', stoichAFR: 34.3, stoichLambda: 1.0, energyDensity_MJ_L: 10.1, density_kg_L: 0.071, ron: '130+', application: 'Hydrogen ICE experimental' },
  'avgas': { name: 'AvGas 100LL', stoichAFR: 14.7, stoichLambda: 1.0, energyDensity_MJ_L: 33.5, density_kg_L: 0.721, ron: '100-130', application: 'Aviation, leaded' },
  'race-gas-c16': { name: 'VP C16 Race Fuel', stoichAFR: 14.7, stoichLambda: 1.0, energyDensity_MJ_L: 34.5, density_kg_L: 0.750, ron: '117', application: 'Professional racing' },
  'nitromethane': { name: 'Nitromethane', stoichAFR: 1.7, stoichLambda: 1.0, energyDensity_MJ_L: 11.3, density_kg_L: 1.139, ron: 'N/A', application: 'Top Fuel drag racing' },
};


// ─── Wideband O2 Sensor Database ────────────────────────────────────────

const WIDEBAND_SENSOR_DATABASE = {
  'bosch-lsu49': { name: 'Bosch LSU 4.9', partNumber: '17025', type: 'wideband', range_lambda: '0.65-infinity', range_afr: '9.5-infinity', accuracy_pct: 1.5, responseTime_ms: 100, heaterVoltage_V: 12, heaterPower_W: 8.5, thread: 'M18x1.5', lifespan_hours: 2000, calibrationCurve: 'IP/Ip vs lambda — linear pump current', application: 'Standard aftermarket wideband — AEM, Innovate, PLX, 14point7' },
  'bosch-lsu42': { name: 'Bosch LSU 4.2', partNumber: '0258007057', type: 'wideband', range_lambda: '0.65-infinity', range_afr: '9.5-infinity', accuracy_pct: 2.0, responseTime_ms: 150, heaterVoltage_V: 12, heaterPower_W: 12, thread: 'M18x1.5', lifespan_hours: 1500, calibrationCurve: 'IP/Ip vs lambda — wider range but less accurate than 4.9', application: 'Older aftermarket wideband — AEM first gen' },
  'bosch-lsu-adi': { name: 'Bosch LSU ADV', partNumber: '17200', type: 'wideband', range_lambda: '0.65-infinity', range_afr: '9.5-infinity', accuracy_pct: 0.8, responseTime_ms: 50, heaterVoltage_V: 12, heaterPower_W: 9, thread: 'M18x1.5', lifespan_hours: 3000, calibrationCurve: 'Digital SENT protocol output', application: 'Latest Bosch OEM — fast and accurate' },
  'ntk-l1h1': { name: 'NTK/NGK ZFAS-U2', type: 'wideband', range_lambda: '0.65-10', range_afr: '9.5-infinity', accuracy_pct: 1.5, responseTime_ms: 100, heaterVoltage_V: 12, heaterPower_W: 10, thread: 'M18x1.5', lifespan_hours: 2000, calibrationCurve: 'Pump current proportional to lambda', application: 'OEM Toyota, Honda — AEM X-Series compatible' },
  'denso-universal': { name: 'Denso Universal O2', type: 'wideband', range_lambda: '0.68-infinity', range_afr: '10-infinity', accuracy_pct: 2.0, responseTime_ms: 120, heaterVoltage_V: 12, heaterPower_W: 11, thread: 'M18x1.5', lifespan_hours: 1800, calibrationCurve: 'Current output proportional to O2 concentration', application: 'OEM Subaru, Mazda' },
  'aem-30-0300': { name: 'AEM 30-0300 X-Series', type: 'controller+sensor', range_lambda: '0.5-1.52', range_afr: '7.35-22.4', accuracy_pct: 0.1, responseTime_ms: 40, heaterVoltage_V: 12, heaterPower_W: 8.5, thread: 'M18x1.5', lifespan_hours: 2000, calibrationCurve: '0-5V linear output: 0V=7.35AFR, 5V=22.4AFR', application: 'Aftermarket standalone — fastest response, digital display' },
  'innovate-mtx-l': { name: 'Innovate MTX-L PLUS', type: 'controller+sensor', range_lambda: '0.5-1.52', range_afr: '7.35-22.4', accuracy_pct: 0.1, responseTime_ms: 60, heaterVoltage_V: 12, heaterPower_W: 8.5, thread: 'M18x1.5', lifespan_hours: 2000, calibrationCurve: '0-5V linear programmable output', application: 'Aftermarket standalone — MTS protocol for multi-gauge daisy chain' },
  'plx-dm6': { name: 'PLX DM-6 SM-AFR', type: 'controller+sensor', range_lambda: '0.68-infinity', range_afr: '10-infinity', accuracy_pct: 0.2, responseTime_ms: 80, heaterVoltage_V: 12, heaterPower_W: 8.5, thread: 'M18x1.5', lifespan_hours: 2000, calibrationCurve: '0-5V linear output', application: 'Aftermarket — multi-gauge system compatible' },
  'narrowband-stock': { name: 'Stock Narrowband O2', type: 'narrowband', range_lambda: '0.8-1.2', range_afr: '11.7-17.6 (gasoline)', accuracy_pct: 5.0, responseTime_ms: 300, heaterVoltage_V: 12, heaterPower_W: 6, thread: 'M18x1.5', lifespan_hours: 50000, calibrationCurve: 'Voltage: 0.1V=lean, 0.45V=stoich, 0.9V=rich (switch-type)', application: 'OEM closed-loop at idle/cruise only — NOT for tuning' },
};


// ─── Lambda Target Tables ───────────────────────────────────────────────

const LAMBDA_TARGETS = {
  'cruise-na': { name: 'NA Cruise', lambda: 1.0, afr_gasoline: 14.7, purpose: 'Fuel economy and emissions at light load', condition: 'Part throttle, steady state' },
  'cruise-turbo': { name: 'Turbo Cruise', lambda: 1.0, afr_gasoline: 14.7, purpose: 'Fuel economy at light load', condition: 'Part throttle, off-boost' },
  'lean-cruise': { name: 'Lean Cruise (fuel saving)', lambda: 1.05, afr_gasoline: 15.4, purpose: 'Maximum fuel economy', condition: 'Part throttle, low load, NA only' },
  'power-na': { name: 'NA Full Power', lambda: 0.88, afr_gasoline: 12.9, purpose: 'Maximum power NA engine', condition: 'WOT, peak torque to redline' },
  'power-turbo-mild': { name: 'Mild Turbo Power', lambda: 0.85, afr_gasoline: 12.5, purpose: 'Power with safety margin on pump fuel', condition: 'WOT, moderate boost' },
  'power-turbo-high': { name: 'High Boost Power', lambda: 0.80, afr_gasoline: 11.8, purpose: 'Maximum power with knock protection', condition: 'WOT, high boost (>1.5 bar)' },
  'power-turbo-race': { name: 'Race Turbo Power', lambda: 0.78, afr_gasoline: 11.5, purpose: 'Aggressive race tune, risk of lean misfire if leaner', condition: 'WOT, maximum boost, race fuel' },
  'cold-start': { name: 'Cold Start Enrichment', lambda: 0.75, afr_gasoline: 11.0, purpose: 'Reliable cold start', condition: 'Cranking and first 30s, coolant <40°C' },
  'warmup': { name: 'Warmup Enrichment', lambda: 0.90, afr_gasoline: 13.2, purpose: 'Smooth warmup, prevent stall', condition: 'Coolant 40-70°C, light load' },
  'decel-overrun': { name: 'Decel Fuel Cut', lambda: Infinity, afr_gasoline: Infinity, purpose: 'Zero fuel consumption on deceleration', condition: 'Throttle closed, RPM > resume threshold' },
  'cat-heat': { name: 'Cat Heating', lambda: 0.95, afr_gasoline: 14.0, purpose: 'Rapid catalyst light-off', condition: 'Post-cold-start, catalyst below operating temp' },
  'e85-power': { name: 'E85 Full Power', lambda: 0.82, afr_gasoline: 8.0, purpose: 'Maximum power on E85', condition: 'WOT, E85 detected by flex-fuel sensor' },
};


// ─── PID Parameters for Closed-Loop Control ─────────────────────────────

export function calcPIDTuning(targetLambda, sensorType = 'wideband', engineSize_cc = 2000) {
  // PID gains depend on sensor response time and engine displacement
  const isWideband = sensorType !== 'narrowband';
  const sizeFactor = engineSize_cc / 2000; // normalize to 2.0L

  let Kp, Ki, Kd, updateRate_Hz, deadband;
  if (isWideband) {
    Kp = 3.0 * sizeFactor;
    Ki = 1.2 * sizeFactor;
    Kd = 0.3;
    updateRate_Hz = 50;
    deadband = 0.005; // lambda units
  } else {
    // Narrowband: switch-type, can only do bang-bang near stoich
    Kp = 1.5;
    Ki = 0.8;
    Kd = 0.0; // no derivative on switch sensor
    updateRate_Hz = 10;
    deadband = 0.02;
  }

  // Integral windup limits
  const integralLimit = isWideband ? 15 : 25; // % fuel correction max

  return {
    targetLambda,
    sensorType,
    engineSize_cc,
    pid: {
      Kp: Math.round(Kp * 100) / 100,
      Ki: Math.round(Ki * 100) / 100,
      Kd: Math.round(Kd * 100) / 100,
      updateRate_Hz,
      deadband_lambda: deadband,
    },
    integralLimits: {
      max_pct: integralLimit,
      min_pct: -integralLimit,
    },
    fuelCorrection: {
      shortTermFuelTrim_max_pct: isWideband ? 25 : 15,
      longTermFuelTrim_max_pct: isWideband ? 20 : 12,
      note: isWideband ? 'Wideband allows precise proportional control across full range' : 'Narrowband limited to oscillating around stoich (14.7 AFR)',
    },
    closedLoopConditions: [
      'Engine coolant temp > 60°C',
      'Post-start timer elapsed (10-30s)',
      'RPM > idle + 200',
      'No decel fuel cut active',
      'O2 sensor heater ready',
      isWideband ? 'Wideband controller reporting valid lambda' : 'Narrowband voltage cycling between 0.1V and 0.9V',
    ],
    openLoopConditions: [
      'WOT (>80% throttle)',
      'High boost (>0.5 bar)',
      'Cold start enrichment active',
      'Decel fuel cut active',
      'Component protection mode (overtemp)',
    ],
  };
}


// ─── Lambda Target Map Generation ───────────────────────────────────────

export function generateLambdaMap(fuelType = 'gasoline', engineType = 'na', boostMax_bar = 0) {
  const stoich = STOICH_DATABASE[fuelType]?.stoichAFR || 14.7;
  const isTurbo = engineType !== 'na' || boostMax_bar > 0;

  const rpmBreakpoints = [800, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000];
  const loadBreakpoints = isTurbo ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 150] : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  const lambdaTable = loadBreakpoints.map(load => ({
    load_pct: load,
    lambda_by_rpm: rpmBreakpoints.map(rpm => {
      let lam;
      if (load <= 30) {
        lam = 1.0; // cruise
        if (rpm < 1200 && load < 10) lam = 0.95; // idle enrichment
      } else if (load <= 60) {
        lam = 1.0 - (load - 30) * 0.003; // gradual enrichment
      } else if (load <= 80) {
        lam = isTurbo ? 0.88 : 0.90; // medium-high load
      } else if (load <= 100) {
        lam = isTurbo ? 0.83 : 0.88; // WOT
      } else {
        // Over 100% = boost
        lam = 0.80 - (load - 100) * 0.001; // richer with more boost
      }

      // Fuel-type correction
      if (fuelType === 'e85') lam *= 0.98; // E85 runs a bit richer for power
      if (fuelType === 'methanol') lam *= 0.95;

      return { rpm, lambda: Math.round(Math.max(0.70, Math.min(1.05, lam)) * 1000) / 1000, afr: Math.round(lam * stoich * 10) / 10 };
    }),
  }));

  return {
    fuelType,
    engineType,
    stoichAFR: stoich,
    boostMax_bar,
    rpmBreakpoints,
    loadBreakpoints,
    lambdaTable,
    safety: [
      `Never run leaner than λ ${isTurbo ? '0.78' : '0.85'} at WOT`,
      'Always monitor knock with wideband AND knock sensor simultaneously',
      'EGT should not exceed 900°C at any point',
      'These are starting values — dyno-verify every cell',
    ],
  };
}


// ─── Sensor Calibration ─────────────────────────────────────────────────

export function calibrateSensor(sensorModel, outputVoltage_V) {
  const sensor = WIDEBAND_SENSOR_DATABASE[sensorModel];
  if (!sensor) return { error: `Unknown sensor: ${sensorModel}` };

  let lambda, afr_gasoline;
  if (sensor.type === 'narrowband') {
    // Narrowband: voltage to lambda (switch-type)
    if (outputVoltage_V < 0.1) { lambda = 1.2; }
    else if (outputVoltage_V < 0.45) { lambda = 1.0 + (0.45 - outputVoltage_V) * 0.5; }
    else if (outputVoltage_V < 0.55) { lambda = 1.0; }
    else { lambda = 1.0 - (outputVoltage_V - 0.55) * 0.5; }
  } else {
    // Wideband: linear 0-5V to AFR range (AEM X-Series standard)
    const minAFR = 7.35;
    const maxAFR = 22.4;
    afr_gasoline = minAFR + (outputVoltage_V / 5.0) * (maxAFR - minAFR);
    lambda = afr_gasoline / 14.7;
  }

  if (!afr_gasoline) afr_gasoline = lambda * 14.7;

  return {
    sensorModel,
    sensorName: sensor.name,
    outputVoltage_V,
    lambda: Math.round(lambda * 1000) / 1000,
    afr_gasoline: Math.round(afr_gasoline * 10) / 10,
    fuelSpecificAFR: Object.fromEntries(
      Object.entries(STOICH_DATABASE).slice(0, 6).map(([key, f]) => [key, Math.round(lambda * f.stoichAFR * 10) / 10])
    ),
    richLean: lambda < 0.97 ? 'RICH' : lambda > 1.03 ? 'LEAN' : 'STOICHIOMETRIC',
    sensorHealth: sensor.type === 'narrowband' ? (outputVoltage_V > 0.05 && outputVoltage_V < 0.95 ? 'OK — sensor cycling' : 'CHECK — sensor stuck or heater fault') : 'Wideband — check controller status LED',
  };
}


// ─── Free Air Calibration ───────────────────────────────────────────────

export function freeAirCalibration(sensorModel) {
  const sensor = WIDEBAND_SENSOR_DATABASE[sensorModel];
  if (!sensor) return { error: `Unknown sensor: ${sensorModel}` };

  return {
    sensorModel,
    sensorName: sensor.name,
    procedure: [
      '1. Remove sensor from exhaust (or use a spare)',
      '2. Connect sensor to controller, power on',
      '3. Wait for sensor to reach operating temperature (heater cycle ~30s)',
      '4. Sensor should read λ=infinite / AFR=infinite in free air (20.9% O2)',
      '5. If controller has "Free Air Cal" button/menu, activate it now',
      '6. Controller stores the free-air reference point',
      '7. Verify reading shows λ>3.0 or AFR>44.0',
    ],
    expectedReading: { lambda: 'Infinite (display shows --.- or >3.0)', afr: 'Infinite (display shows --.- or >44.0)', voltage_V: sensor.type === 'narrowband' ? '0.05-0.10V (lean)' : '5.0V (max lean)' },
    frequency: 'Every 6 months or after sensor contamination (silicone, leaded fuel, anti-seize on threads)',
    warnings: [
      'Never apply anti-seize to sensor threads — silicone contaminates the element',
      'Do not calibrate in a running engine — exhaust gases invalidate the reference',
      'Replace sensor if free-air cal drifts by >2% from factory spec',
    ],
  };
}


// ─── Flex-Fuel Ethanol Content Estimation ───────────────────────────────

export function estimateEthanolContent(measuredStoichAFR) {
  // Linear interpolation between gasoline (14.7) and pure ethanol (9.0)
  const gasAFR = 14.7;
  const ethAFR = 9.0;
  const range = gasAFR - ethAFR;
  const ethPct = Math.max(0, Math.min(100, ((gasAFR - measuredStoichAFR) / range) * 100));

  // Determine blend name
  let blendName;
  if (ethPct < 5) blendName = 'E0 (Pure Gasoline)';
  else if (ethPct < 15) blendName = `E${Math.round(ethPct)} (Pump Regular)`;
  else if (ethPct < 30) blendName = `E${Math.round(ethPct)} (High Ethanol Pump)`;
  else if (ethPct < 60) blendName = `E${Math.round(ethPct)} (Mid Blend)`;
  else if (ethPct < 80) blendName = `E${Math.round(ethPct)} (Near E85)`;
  else if (ethPct < 90) blendName = `E${Math.round(ethPct)} (E85 Range)`;
  else blendName = `E${Math.round(ethPct)} (High Ethanol)`;

  return {
    measuredStoichAFR,
    estimatedEthanol_pct: Math.round(ethPct * 10) / 10,
    blendName,
    expectedRON: Math.round(91 + (ethPct / 100) * 17),
    injectorScaling_pct: Math.round((gasAFR / measuredStoichAFR - 1) * 100 * 10) / 10,
    timingAdvance_deg: Math.round(ethPct * 0.1 * 10) / 10,
    note: 'Ethanol content varies seasonally (E85 can be E51 to E83 in winter). Always verify with a sensor or AFR-based measurement.',
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listFuelStoich() {
  return Object.entries(STOICH_DATABASE).map(([name, f]) => ({ name, ...f }));
}

export function getFuelStoich(name) {
  return STOICH_DATABASE[name] || null;
}

export function listWidebandSensors() {
  return Object.entries(WIDEBAND_SENSOR_DATABASE).map(([name, s]) => ({ name, ...s }));
}

export function getWidebandSensor(name) {
  return WIDEBAND_SENSOR_DATABASE[name] || null;
}

export function searchWidebandSensors(query) {
  const q = query.toLowerCase();
  return Object.entries(WIDEBAND_SENSOR_DATABASE)
    .filter(([name, s]) =>
      name.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.application.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q)
    )
    .map(([name, s]) => ({ name, ...s }));
}

export function listLambdaTargets() {
  return Object.entries(LAMBDA_TARGETS).map(([name, t]) => ({ name, ...t }));
}

export function getLambdaTarget(name) {
  return LAMBDA_TARGETS[name] || null;
}

export function lambdaCalcStats() {
  return {
    fuelTypes: Object.keys(STOICH_DATABASE).length,
    widebandSensors: Object.keys(WIDEBAND_SENSOR_DATABASE).length,
    lambdaTargets: Object.keys(LAMBDA_TARGETS).length,
    calculations: ['pidTuning', 'lambdaMap', 'sensorCalibration', 'freeAirCal', 'ethanolEstimate'],
  };
}

export { STOICH_DATABASE, WIDEBAND_SENSOR_DATABASE, LAMBDA_TARGETS };
