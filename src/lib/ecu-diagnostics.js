// ECU Diagnostics & Health Monitor
// Comprehensive engine diagnostics, sensor validation, component health scoring

// ─── Sensor Value Ranges (normal operating parameters) ─────────────────

const SENSOR_RANGES = {
  'engine_coolant_temp': { name: 'Engine Coolant Temperature', unit: '°C', min: -40, max: 215, normalMin: 80, normalMax: 105, warningMin: 60, warningMax: 110, criticalMax: 120, pid: '0105' },
  'intake_air_temp': { name: 'Intake Air Temperature', unit: '°C', min: -40, max: 215, normalMin: -10, normalMax: 50, warningMax: 60, criticalMax: 80, pid: '010F' },
  'engine_rpm': { name: 'Engine RPM', unit: 'RPM', min: 0, max: 16383.75, normalMin: 600, normalMax: 7000, warningMax: 7500, criticalMax: 8500, pid: '010C' },
  'vehicle_speed': { name: 'Vehicle Speed', unit: 'km/h', min: 0, max: 255, normalMin: 0, normalMax: 200, warningMax: 240, criticalMax: 300, pid: '010D' },
  'throttle_position': { name: 'Throttle Position', unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 100, pid: '0111' },
  'engine_load': { name: 'Engine Load', unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 95, warningMax: 100, pid: '0104' },
  'fuel_pressure': { name: 'Fuel Pressure', unit: 'kPa', min: 0, max: 765, normalMin: 250, normalMax: 450, warningMin: 200, warningMax: 500, criticalMin: 150, pid: '010A' },
  'map_sensor': { name: 'Manifold Absolute Pressure', unit: 'kPa', min: 0, max: 255, normalMin: 20, normalMax: 105, warningMax: 250, pid: '010B' },
  'maf_sensor': { name: 'Mass Air Flow', unit: 'g/s', min: 0, max: 655.35, normalMin: 1, normalMax: 300, pid: '0110' },
  'timing_advance': { name: 'Timing Advance', unit: '°BTDC', min: -64, max: 63.5, normalMin: -10, normalMax: 45, warningMin: -20, warningMax: 50, pid: '010E' },
  'o2_voltage_b1s1': { name: 'O2 Sensor B1S1 Voltage', unit: 'V', min: 0, max: 1.275, normalMin: 0.1, normalMax: 0.9, pid: '0114' },
  'o2_voltage_b1s2': { name: 'O2 Sensor B1S2 Voltage', unit: 'V', min: 0, max: 1.275, normalMin: 0.1, normalMax: 0.9, pid: '0118' },
  'short_fuel_trim_b1': { name: 'Short Term Fuel Trim B1', unit: '%', min: -100, max: 99.2, normalMin: -10, normalMax: 10, warningMin: -15, warningMax: 15, criticalMin: -25, criticalMax: 25, pid: '0106' },
  'long_fuel_trim_b1': { name: 'Long Term Fuel Trim B1', unit: '%', min: -100, max: 99.2, normalMin: -10, normalMax: 10, warningMin: -15, warningMax: 15, criticalMin: -20, criticalMax: 20, pid: '0107' },
  'short_fuel_trim_b2': { name: 'Short Term Fuel Trim B2', unit: '%', min: -100, max: 99.2, normalMin: -10, normalMax: 10, warningMin: -15, warningMax: 15, criticalMin: -25, criticalMax: 25, pid: '0108' },
  'long_fuel_trim_b2': { name: 'Long Term Fuel Trim B2', unit: '%', min: -100, max: 99.2, normalMin: -10, normalMax: 10, warningMin: -15, warningMax: 15, criticalMin: -20, criticalMax: 20, pid: '0109' },
  'catalyst_temp_b1s1': { name: 'Catalyst Temperature B1S1', unit: '°C', min: -40, max: 6513.5, normalMin: 200, normalMax: 800, warningMax: 900, criticalMax: 1000, pid: '013C' },
  'battery_voltage': { name: 'Battery Voltage', unit: 'V', min: 0, max: 65.535, normalMin: 13.5, normalMax: 14.7, warningMin: 12.0, warningMax: 15.5, criticalMin: 11.0, criticalMax: 16.0, pid: '0142' },
  'oil_temp': { name: 'Engine Oil Temperature', unit: '°C', min: -40, max: 210, normalMin: 70, normalMax: 120, warningMax: 135, criticalMax: 150, pid: '015C' },
  'fuel_rail_pressure': { name: 'Fuel Rail Pressure (Direct)', unit: 'kPa', min: 0, max: 655350, normalMin: 3000, normalMax: 20000, warningMin: 2000, warningMax: 25000, pid: '0123' },
  'egr_commanded': { name: 'Commanded EGR', unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 50, pid: '012C' },
  'egr_error': { name: 'EGR Error', unit: '%', min: -100, max: 99.2, normalMin: -5, normalMax: 5, warningMin: -10, warningMax: 10, criticalMin: -15, criticalMax: 15, pid: '012D' },
  'boost_pressure': { name: 'Turbo Boost Pressure', unit: 'kPa', min: 0, max: 6553.5, normalMin: 0, normalMax: 250, warningMax: 280, criticalMax: 320, pid: '0170' },
  'exhaust_gas_temp_b1': { name: 'Exhaust Gas Temperature B1', unit: '°C', min: -40, max: 6513.5, normalMin: 100, normalMax: 850, warningMax: 950, criticalMax: 1050, pid: '0178' },
};


// ─── Diagnostic Trouble Code Categories ─────────────────────────────────

const DTC_SEVERITY = {
  'P0': { system: 'Powertrain (Generic)', severity: 'varies' },
  'P1': { system: 'Powertrain (Manufacturer)', severity: 'varies' },
  'P2': { system: 'Powertrain (Generic)', severity: 'varies' },
  'P3': { system: 'Powertrain (Generic/Mfr)', severity: 'varies' },
  'C0': { system: 'Chassis (Generic)', severity: 'medium' },
  'C1': { system: 'Chassis (Manufacturer)', severity: 'medium' },
  'B0': { system: 'Body (Generic)', severity: 'low' },
  'B1': { system: 'Body (Manufacturer)', severity: 'low' },
  'U0': { system: 'Network (Generic)', severity: 'high' },
  'U1': { system: 'Network (Manufacturer)', severity: 'high' },
};


// ─── Common Diagnostic Patterns ─────────────────────────────────────────

const DIAGNOSTIC_PATTERNS = {
  'lean_condition': {
    name: 'Lean Fuel Mixture',
    indicators: ['long_fuel_trim_b1 > 15', 'short_fuel_trim_b1 > 10'],
    causes: ['Vacuum leak', 'Weak fuel pump', 'Clogged injectors', 'MAF sensor contamination', 'Exhaust leak before O2'],
    severity: 'medium',
    related_dtcs: ['P0171', 'P0174', 'P0130', 'P2187'],
  },
  'rich_condition': {
    name: 'Rich Fuel Mixture',
    indicators: ['long_fuel_trim_b1 < -15', 'short_fuel_trim_b1 < -10'],
    causes: ['Leaking injector', 'High fuel pressure', 'Faulty O2 sensor', 'EVAP purge stuck open', 'Coolant temp sensor'],
    severity: 'medium',
    related_dtcs: ['P0172', 'P0175', 'P0131', 'P2188'],
  },
  'misfire': {
    name: 'Engine Misfire',
    indicators: ['rpm_instability > 50', 'engine_load fluctuation'],
    causes: ['Worn spark plugs', 'Faulty ignition coil', 'Low compression', 'Fuel injector failure', 'Vacuum leak'],
    severity: 'high',
    related_dtcs: ['P0300', 'P0301', 'P0302', 'P0303', 'P0304'],
  },
  'overheating': {
    name: 'Engine Overheating',
    indicators: ['engine_coolant_temp > 110'],
    causes: ['Low coolant', 'Thermostat stuck closed', 'Water pump failure', 'Radiator blockage', 'Head gasket leak'],
    severity: 'critical',
    related_dtcs: ['P0217', 'P0116', 'P0118'],
  },
  'catalytic_efficiency': {
    name: 'Catalytic Converter Degradation',
    indicators: ['o2_voltage_b1s2 switching rapidly', 'catalyst_temp_b1s1 low'],
    causes: ['Aged catalyst', 'Contaminated catalyst (oil/coolant)', 'Upstream misfire damage', 'Exhaust leak'],
    severity: 'medium',
    related_dtcs: ['P0420', 'P0421', 'P0430', 'P0431'],
  },
  'turbo_underboost': {
    name: 'Turbo Underboost',
    indicators: ['boost_pressure < expected at WOT'],
    causes: ['Boost leak', 'Wastegate stuck open', 'Turbo bearing wear', 'Intercooler leak', 'VGT actuator fault'],
    severity: 'medium',
    related_dtcs: ['P0299', 'P0234', 'P0235', 'P0236'],
  },
  'egr_malfunction': {
    name: 'EGR System Malfunction',
    indicators: ['egr_error > 10'],
    causes: ['Carbon buildup in EGR valve', 'EGR stuck open/closed', 'Vacuum hose cracked', 'EGR cooler leak'],
    severity: 'medium',
    related_dtcs: ['P0401', 'P0402', 'P0403', 'P0404'],
  },
  'charging_system': {
    name: 'Charging System Issue',
    indicators: ['battery_voltage < 13.0 while running'],
    causes: ['Alternator failure', 'Drive belt slipping', 'Bad voltage regulator', 'Corroded battery terminals', 'Parasitic drain'],
    severity: 'high',
    related_dtcs: ['P0562', 'P0563', 'P0620', 'P0621'],
  },
};


// ─── Functions ──────────────────────────────────────────────────────────

export function validateSensorReading(sensorKey, value) {
  const spec = SENSOR_RANGES[sensorKey];
  if (!spec) return { valid: false, error: 'Unknown sensor key' };

  let status = 'normal';
  const warnings = [];

  if (value < spec.min || value > spec.max) {
    status = 'out_of_range';
    warnings.push(`Value ${value} outside sensor range [${spec.min}, ${spec.max}]`);
  } else if (spec.criticalMin != null && value < spec.criticalMin) {
    status = 'critical_low';
    warnings.push(`Below critical minimum (${spec.criticalMin} ${spec.unit})`);
  } else if (spec.criticalMax != null && value > spec.criticalMax) {
    status = 'critical_high';
    warnings.push(`Above critical maximum (${spec.criticalMax} ${spec.unit})`);
  } else if (spec.warningMin != null && value < spec.warningMin) {
    status = 'warning_low';
    warnings.push(`Below warning threshold (${spec.warningMin} ${spec.unit})`);
  } else if (spec.warningMax != null && value > spec.warningMax) {
    status = 'warning_high';
    warnings.push(`Above warning threshold (${spec.warningMax} ${spec.unit})`);
  } else if (value < spec.normalMin || value > spec.normalMax) {
    status = 'marginal';
    warnings.push(`Outside normal range [${spec.normalMin}, ${spec.normalMax}] ${spec.unit}`);
  }

  return {
    valid: true,
    sensor: spec.name,
    value,
    unit: spec.unit,
    status,
    warnings,
    ranges: {
      normal: [spec.normalMin, spec.normalMax],
      warning: [spec.warningMin || spec.normalMin, spec.warningMax || spec.normalMax],
      critical: [spec.criticalMin || spec.min, spec.criticalMax || spec.max],
    },
  };
}


export function validateMultipleSensors(readings) {
  // readings: { sensorKey: value, ... }
  const results = {};
  let overallStatus = 'normal';
  const criticals = [];
  const warns = [];

  for (const [key, val] of Object.entries(readings)) {
    const r = validateSensorReading(key, val);
    results[key] = r;
    if (r.status.startsWith('critical')) {
      overallStatus = 'critical';
      criticals.push({ sensor: r.sensor, value: val, unit: r.unit, status: r.status });
    } else if (r.status.startsWith('warning') && overallStatus !== 'critical') {
      overallStatus = 'warning';
      warns.push({ sensor: r.sensor, value: val, unit: r.unit, status: r.status });
    } else if (r.status === 'marginal' && overallStatus === 'normal') {
      overallStatus = 'marginal';
    }
  }

  return { overallStatus, criticals, warnings: warns, sensors: results, sensorCount: Object.keys(readings).length };
}


export function diagnoseFromReadings(readings) {
  const matches = [];

  for (const [patKey, pat] of Object.entries(DIAGNOSTIC_PATTERNS)) {
    let score = 0;
    const matched = [];

    // Check LTFT lean
    if (patKey === 'lean_condition') {
      if (readings.long_fuel_trim_b1 > 15 || readings.long_fuel_trim_b2 > 15) { score += 2; matched.push('High LTFT'); }
      if (readings.short_fuel_trim_b1 > 10 || readings.short_fuel_trim_b2 > 10) { score += 1; matched.push('High STFT'); }
    }
    // Check LTFT rich
    if (patKey === 'rich_condition') {
      if (readings.long_fuel_trim_b1 < -15 || readings.long_fuel_trim_b2 < -15) { score += 2; matched.push('Negative LTFT'); }
      if (readings.short_fuel_trim_b1 < -10 || readings.short_fuel_trim_b2 < -10) { score += 1; matched.push('Negative STFT'); }
    }
    // Overheating
    if (patKey === 'overheating') {
      if (readings.engine_coolant_temp > 110) { score += 3; matched.push('Coolant temp elevated'); }
      if (readings.oil_temp > 135) { score += 1; matched.push('Oil temp high'); }
    }
    // Turbo underboost
    if (patKey === 'turbo_underboost') {
      if (readings.boost_pressure != null && readings.throttle_position > 80 && readings.boost_pressure < 100) {
        score += 2; matched.push('Low boost at WOT');
      }
    }
    // EGR
    if (patKey === 'egr_malfunction') {
      if (readings.egr_error != null && Math.abs(readings.egr_error) > 10) { score += 2; matched.push('EGR error high'); }
    }
    // Charging
    if (patKey === 'charging_system') {
      if (readings.battery_voltage != null && readings.battery_voltage < 13.0 && readings.engine_rpm > 800) {
        score += 2; matched.push('Low voltage while running');
      }
    }
    // Cat efficiency
    if (patKey === 'catalytic_efficiency') {
      if (readings.catalyst_temp_b1s1 != null && readings.catalyst_temp_b1s1 < 300 && readings.engine_coolant_temp > 80) {
        score += 1; matched.push('Low catalyst temp while warm');
      }
    }

    if (score > 0) {
      matches.push({ pattern: patKey, ...pat, matchScore: score, matchedIndicators: matched });
    }
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);
  return { diagnoses: matches, readingsAnalyzed: Object.keys(readings).length };
}


export function calcEngineHealthScore(readings) {
  let score = 100;
  const deductions = [];

  // Fuel trims
  const ltftB1 = readings.long_fuel_trim_b1 || 0;
  const ltftB2 = readings.long_fuel_trim_b2 || 0;
  const avgLTFT = Math.abs(ltftB1 + ltftB2) / 2;
  if (avgLTFT > 20) { score -= 25; deductions.push({ reason: 'Severe fuel trim deviation', points: 25 }); }
  else if (avgLTFT > 10) { score -= 15; deductions.push({ reason: 'Moderate fuel trim deviation', points: 15 }); }
  else if (avgLTFT > 5) { score -= 5; deductions.push({ reason: 'Slight fuel trim deviation', points: 5 }); }

  // Coolant temp
  if (readings.engine_coolant_temp != null) {
    if (readings.engine_coolant_temp > 115) { score -= 30; deductions.push({ reason: 'Critical engine temperature', points: 30 }); }
    else if (readings.engine_coolant_temp > 105) { score -= 10; deductions.push({ reason: 'Elevated engine temperature', points: 10 }); }
    else if (readings.engine_coolant_temp < 70) { score -= 5; deductions.push({ reason: 'Engine not reaching operating temp', points: 5 }); }
  }

  // Oil temperature
  if (readings.oil_temp != null) {
    if (readings.oil_temp > 140) { score -= 20; deductions.push({ reason: 'Critical oil temperature', points: 20 }); }
    else if (readings.oil_temp > 125) { score -= 10; deductions.push({ reason: 'Elevated oil temperature', points: 10 }); }
  }

  // Battery
  if (readings.battery_voltage != null) {
    if (readings.battery_voltage < 12.0) { score -= 15; deductions.push({ reason: 'Low battery voltage', points: 15 }); }
    else if (readings.battery_voltage < 13.0 && readings.engine_rpm > 800) { score -= 10; deductions.push({ reason: 'Low charging voltage', points: 10 }); }
    else if (readings.battery_voltage > 15.5) { score -= 10; deductions.push({ reason: 'Overcharging', points: 10 }); }
  }

  // EGR
  if (readings.egr_error != null && Math.abs(readings.egr_error) > 10) {
    score -= 10; deductions.push({ reason: 'EGR position error', points: 10 });
  }

  // Catalyst
  if (readings.catalyst_temp_b1s1 != null && readings.engine_coolant_temp > 80) {
    if (readings.catalyst_temp_b1s1 > 950) { score -= 10; deductions.push({ reason: 'Catalyst overheating', points: 10 }); }
    else if (readings.catalyst_temp_b1s1 < 250) { score -= 5; deductions.push({ reason: 'Catalyst not reaching temp', points: 5 }); }
  }

  // Boost (if turbo)
  if (readings.boost_pressure != null && readings.throttle_position > 80) {
    if (readings.boost_pressure < 80) { score -= 10; deductions.push({ reason: 'Low boost at high throttle', points: 10 }); }
  }

  score = Math.max(0, score);

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade, deductions, recommendation: grade === 'A' ? 'Engine in excellent condition' : grade === 'B' ? 'Engine in good condition — minor attention needed' : grade === 'C' ? 'Engine needs attention — schedule maintenance' : grade === 'D' ? 'Engine needs urgent attention' : 'Critical — immediate inspection required' };
}


export function analyzeFuelTrims(stftB1, ltftB1, stftB2, ltftB2) {
  const totalB1 = stftB1 + ltftB1;
  const totalB2 = (stftB2 != null && ltftB2 != null) ? stftB2 + ltftB2 : null;

  const analysis = {
    bank1: { stft: stftB1, ltft: ltftB1, total: totalB1 },
    bank2: totalB2 != null ? { stft: stftB2, ltft: ltftB2, total: totalB2 } : null,
    condition: 'normal',
    possibleCauses: [],
    severity: 'ok',
  };

  // Bank 1 analysis
  if (totalB1 > 25) {
    analysis.condition = 'severely_lean_b1';
    analysis.severity = 'critical';
    analysis.possibleCauses = ['Large vacuum leak', 'Fuel pump failing', 'Multiple clogged injectors', 'MAF sensor failure'];
  } else if (totalB1 > 15) {
    analysis.condition = 'lean_b1';
    analysis.severity = 'warning';
    analysis.possibleCauses = ['Vacuum leak', 'Dirty MAF sensor', 'Weak fuel pump', 'Partially clogged injector', 'Exhaust leak before O2'];
  } else if (totalB1 < -25) {
    analysis.condition = 'severely_rich_b1';
    analysis.severity = 'critical';
    analysis.possibleCauses = ['Leaking injector(s)', 'Fuel pressure regulator failure', 'O2 sensor lazy/failed'];
  } else if (totalB1 < -15) {
    analysis.condition = 'rich_b1';
    analysis.severity = 'warning';
    analysis.possibleCauses = ['Leaking injector', 'High fuel pressure', 'EVAP purge stuck open', 'Coolant temp sensor reading cold'];
  }

  // Bank imbalance (V-engine)
  if (totalB2 != null) {
    const imbalance = Math.abs(totalB1 - totalB2);
    analysis.bankImbalance = Math.round(imbalance * 10) / 10;
    if (imbalance > 10) {
      analysis.imbalanceNote = 'Significant bank imbalance — likely bank-specific issue (one bank has a leak or faulty sensor)';
    } else if (imbalance > 5) {
      analysis.imbalanceNote = 'Moderate bank imbalance — worth investigating';
    }
  }

  // LTFT adaptation state
  if (Math.abs(ltftB1) < 3) {
    analysis.adaptationState = 'well_adapted';
  } else if (Math.abs(ltftB1) < 10) {
    analysis.adaptationState = 'adapting';
  } else {
    analysis.adaptationState = 'compensation_limit';
  }

  return analysis;
}


export function interpretO2Sensor(voltage, sensorPosition = 'upstream') {
  const result = { voltage, position: sensorPosition, status: 'normal', notes: [] };

  if (sensorPosition === 'upstream') {
    if (voltage < 0.1) {
      result.status = 'stuck_lean';
      result.notes.push('Sensor stuck lean — possible O2 sensor heater failure or wiring issue');
    } else if (voltage > 0.9) {
      result.status = 'stuck_rich';
      result.notes.push('Sensor stuck rich — possible sensor contamination or wiring short');
    } else if (voltage >= 0.1 && voltage <= 0.45) {
      result.mixture = 'lean';
      result.notes.push('Mixture lean at this moment');
    } else if (voltage > 0.45 && voltage <= 0.9) {
      result.mixture = 'rich';
      result.notes.push('Mixture rich at this moment');
    }
    result.notes.push('Normal upstream O2 should oscillate between 0.1-0.9V at ~1-3 Hz when warm');
  } else {
    // Downstream (post-cat)
    if (voltage < 0.2 || voltage > 0.8) {
      result.notes.push('Post-cat O2 showing wide swings — possible catalyst efficiency issue');
    } else if (voltage >= 0.4 && voltage <= 0.6) {
      result.status = 'normal';
      result.notes.push('Post-cat O2 steady in mid-range — catalyst functioning well');
    }
  }

  return result;
}


export function generateMaintenanceSchedule(mileage_km, lastService_km, engineType = 'gasoline', turbo = false) {
  const since = mileage_km - lastService_km;
  const schedule = [];

  // Oil change
  const oilInterval = turbo ? 7500 : 10000;
  const oilDue = since >= oilInterval;
  schedule.push({ item: 'Oil & Filter Change', interval_km: oilInterval, due: oilDue, urgency: oilDue ? (since > oilInterval * 1.5 ? 'overdue' : 'due') : 'ok', nextDue_km: lastService_km + oilInterval });

  // Air filter
  schedule.push({ item: 'Air Filter', interval_km: 20000, due: since >= 20000, urgency: since >= 20000 ? 'due' : 'ok', nextDue_km: lastService_km + 20000 });

  // Spark plugs
  const sparkInterval = engineType === 'gasoline' ? 40000 : null;
  if (sparkInterval) {
    schedule.push({ item: 'Spark Plugs', interval_km: sparkInterval, due: since >= sparkInterval, urgency: since >= sparkInterval ? 'due' : 'ok', nextDue_km: lastService_km + sparkInterval });
  }

  // Coolant
  schedule.push({ item: 'Coolant Flush', interval_km: 60000, due: since >= 60000, urgency: since >= 60000 ? 'due' : 'ok', nextDue_km: lastService_km + 60000 });

  // Transmission fluid
  schedule.push({ item: 'Transmission Fluid', interval_km: 60000, due: since >= 60000, urgency: since >= 60000 ? 'due' : 'ok', nextDue_km: lastService_km + 60000 });

  // Brake fluid
  schedule.push({ item: 'Brake Fluid', interval_km: 40000, due: since >= 40000, urgency: since >= 40000 ? 'due' : 'ok', nextDue_km: lastService_km + 40000 });

  // Timing belt (if applicable)
  if (engineType !== 'electric') {
    schedule.push({ item: 'Timing Belt / Chain Inspection', interval_km: 100000, due: since >= 100000, urgency: since >= 100000 ? 'due' : 'ok', nextDue_km: lastService_km + 100000 });
  }

  // Fuel filter (diesel)
  if (engineType === 'diesel') {
    schedule.push({ item: 'Fuel Filter', interval_km: 30000, due: since >= 30000, urgency: since >= 30000 ? 'due' : 'ok', nextDue_km: lastService_km + 30000 });
  }

  // Turbo-specific
  if (turbo) {
    schedule.push({ item: 'Turbo Oil Feed Line Inspection', interval_km: 50000, due: since >= 50000, urgency: since >= 50000 ? 'due' : 'ok', nextDue_km: lastService_km + 50000 });
    schedule.push({ item: 'Intercooler Inspection', interval_km: 80000, due: since >= 80000, urgency: since >= 80000 ? 'due' : 'ok', nextDue_km: lastService_km + 80000 });
  }

  const dueItems = schedule.filter(s => s.due);
  const overdueItems = schedule.filter(s => s.urgency === 'overdue');

  return {
    mileage_km,
    lastService_km,
    kmSinceService: since,
    engineType,
    turbo,
    schedule,
    dueCount: dueItems.length,
    overdueCount: overdueItems.length,
    nextServiceItem: schedule.filter(s => !s.due).sort((a, b) => a.nextDue_km - b.nextDue_km)[0] || null,
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listSensorRanges() {
  return Object.entries(SENSOR_RANGES).map(([key, s]) => ({ key, name: s.name, unit: s.unit, pid: s.pid, normalRange: [s.normalMin, s.normalMax] }));
}

export function getSensorRange(key) {
  return SENSOR_RANGES[key] || null;
}

export function listDiagnosticPatterns() {
  return Object.entries(DIAGNOSTIC_PATTERNS).map(([key, p]) => ({ key, name: p.name, severity: p.severity, relatedDTCs: p.related_dtcs }));
}

export function getDiagnosticPattern(key) {
  return DIAGNOSTIC_PATTERNS[key] || null;
}

export function classifyDTC(dtcCode) {
  if (!dtcCode || dtcCode.length < 2) return null;
  const prefix = dtcCode.substring(0, 2).toUpperCase();
  const info = DTC_SEVERITY[prefix];
  if (!info) return { code: dtcCode, system: 'Unknown', severity: 'unknown' };

  let specificSeverity = info.severity;
  // Some well-known critical codes
  const criticalCodes = ['P0300','P0301','P0302','P0303','P0304','P0217','P0219','P0562','P0563'];
  const warningCodes = ['P0420','P0430','P0171','P0172','P0174','P0175','P0299','P0401','P0402'];
  if (criticalCodes.includes(dtcCode.toUpperCase())) specificSeverity = 'high';
  else if (warningCodes.includes(dtcCode.toUpperCase())) specificSeverity = 'medium';

  return { code: dtcCode, ...info, specificSeverity };
}

export function ecuDiagnosticsStats() {
  return {
    sensorRanges: Object.keys(SENSOR_RANGES).length,
    diagnosticPatterns: Object.keys(DIAGNOSTIC_PATTERNS).length,
    dtcCategories: Object.keys(DTC_SEVERITY).length,
    calculations: ['validateSensorReading', 'validateMultipleSensors', 'diagnoseFromReadings', 'calcEngineHealthScore', 'analyzeFuelTrims', 'interpretO2Sensor', 'generateMaintenanceSchedule', 'classifyDTC'],
  };
}

export { SENSOR_RANGES, DIAGNOSTIC_PATTERNS, DTC_SEVERITY };
