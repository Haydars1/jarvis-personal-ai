// Cooling System Calculator
// Radiator sizing, coolant flow, heat rejection, thermostat, water pump

// ─── Coolant Properties ─────────────────────────────────────────────────

const COOLANT_TYPES = {
  'water': { name: 'Pure Water', specificHeat: 4186, boilingPoint_C: 100, freezingPoint_C: 0, density_kg_L: 1.0 },
  'water-glycol-50': { name: '50/50 Water/Glycol', specificHeat: 3350, boilingPoint_C: 108, freezingPoint_C: -37, density_kg_L: 1.065 },
  'water-glycol-60': { name: '60/40 Water/Glycol', specificHeat: 3140, boilingPoint_C: 112, freezingPoint_C: -52, density_kg_L: 1.075 },
  'water-glycol-70': { name: '70/30 Water/Glycol', specificHeat: 2930, boilingPoint_C: 118, freezingPoint_C: -64, density_kg_L: 1.085 },
  'water-wetter': { name: 'Water + Wetter', specificHeat: 4100, boilingPoint_C: 100, freezingPoint_C: 0, density_kg_L: 1.0, note: 'Reduces surface tension, better heat transfer' },
  'evans-waterless': { name: 'Evans Waterless', specificHeat: 2400, boilingPoint_C: 180, freezingPoint_C: -40, density_kg_L: 1.04, note: 'No pressure, higher boiling point' },
};


// ─── Radiator Database ──────────────────────────────────────────────────

const RADIATOR_DATABASE = {
  'stock-4cyl': { name: 'Stock 4-Cylinder', rows: 1, coreThickness_mm: 26, coreArea_cm2: 2500, material: 'aluminum-plastic', flowCapacity_Lpm: 60, heatRejection_kW: 40, application: 'Economy 4-cyl, <150hp' },
  'stock-6cyl': { name: 'Stock 6-Cylinder', rows: 1, coreThickness_mm: 32, coreArea_cm2: 3200, material: 'aluminum-plastic', flowCapacity_Lpm: 75, heatRejection_kW: 55, application: '6-cyl sedan, 200-280hp' },
  'stock-v8': { name: 'Stock V8', rows: 2, coreThickness_mm: 38, coreArea_cm2: 3800, material: 'aluminum-plastic', flowCapacity_Lpm: 90, heatRejection_kW: 70, application: 'V8 sedan/truck, 300-400hp' },
  'performance-2row': { name: 'Performance 2-Row Aluminum', rows: 2, coreThickness_mm: 42, coreArea_cm2: 3500, material: 'full-aluminum', flowCapacity_Lpm: 100, heatRejection_kW: 85, application: 'Street performance, 300-500hp' },
  'performance-3row': { name: 'Performance 3-Row Aluminum', rows: 3, coreThickness_mm: 56, coreArea_cm2: 3800, material: 'full-aluminum', flowCapacity_Lpm: 120, heatRejection_kW: 110, application: 'High performance, 400-700hp' },
  'race-2row': { name: 'Race 2-Row Aluminum', rows: 2, coreThickness_mm: 45, coreArea_cm2: 4200, material: 'full-aluminum-brazed', flowCapacity_Lpm: 140, heatRejection_kW: 130, application: 'Race, 500-800hp' },
  'race-3row': { name: 'Race 3-Row Aluminum', rows: 3, coreThickness_mm: 63, coreArea_cm2: 4500, material: 'full-aluminum-brazed', flowCapacity_Lpm: 160, heatRejection_kW: 160, application: 'Race, 700-1200hp' },
  'drag-4row': { name: 'Drag 4-Row Aluminum', rows: 4, coreThickness_mm: 80, coreArea_cm2: 5000, material: 'full-aluminum-brazed', flowCapacity_Lpm: 180, heatRejection_kW: 200, application: 'Drag racing, 1000hp+' },
  'oilcooler-small': { name: 'Oil Cooler Small', rows: 1, coreThickness_mm: 20, coreArea_cm2: 600, material: 'aluminum', flowCapacity_Lpm: 15, heatRejection_kW: 8, application: 'Mild street oil cooling' },
  'oilcooler-large': { name: 'Oil Cooler Large', rows: 1, coreThickness_mm: 25, coreArea_cm2: 1200, material: 'aluminum', flowCapacity_Lpm: 25, heatRejection_kW: 18, application: 'Track day / race oil cooling' },
  'intercooler-fmic': { name: 'Front-Mount Intercooler', rows: 1, coreThickness_mm: 76, coreArea_cm2: 3000, material: 'bar-plate-aluminum', flowCapacity_Lpm: 0, heatRejection_kW: 50, application: 'Turbo charge air cooling' },
};


// ─── Thermostat Ratings ─────────────────────────────────────────────────

const THERMOSTAT_RATINGS = {
  'low-temp-71': { openTemp_C: 71, fullOpenTemp_C: 85, application: 'Racing — fast warm-up, aggressive cooling' },
  'low-temp-77': { openTemp_C: 77, fullOpenTemp_C: 90, application: 'Performance street — slightly cooler running' },
  'stock-82': { openTemp_C: 82, fullOpenTemp_C: 95, application: 'Standard OEM — balanced emissions and performance' },
  'stock-88': { openTemp_C: 88, fullOpenTemp_C: 100, application: 'Modern OEM — optimized for emissions and fuel economy' },
  'stock-92': { openTemp_C: 92, fullOpenTemp_C: 105, application: 'Modern diesel / turbocharged — higher operating temperature' },
  'high-temp-100': { openTemp_C: 100, fullOpenTemp_C: 115, application: 'Special applications — very high operating temp' },
};


// ─── Fan Types ──────────────────────────────────────────────────────────

const FAN_DATABASE = {
  'mechanical-clutch': { name: 'Mechanical Clutch Fan', cfm_max: 3000, power_draw_W: 0, parasitic_hp: 8, rpm_dependent: true, application: 'Stock trucks, V8s' },
  'electric-12in': { name: 'Electric 12" Single', cfm_max: 1500, power_draw_W: 120, parasitic_hp: 0, rpm_dependent: false, application: 'Budget electric conversion' },
  'electric-14in': { name: 'Electric 14" Single', cfm_max: 2100, power_draw_W: 180, parasitic_hp: 0, rpm_dependent: false, application: 'Street performance' },
  'electric-16in': { name: 'Electric 16" Single', cfm_max: 2800, power_draw_W: 240, parasitic_hp: 0, rpm_dependent: false, application: 'High performance street' },
  'electric-dual-12': { name: 'Electric Dual 12"', cfm_max: 2800, power_draw_W: 240, parasitic_hp: 0, rpm_dependent: false, application: 'Wide radiator, performance' },
  'electric-dual-14': { name: 'Electric Dual 14"', cfm_max: 4000, power_draw_W: 360, parasitic_hp: 0, rpm_dependent: false, application: 'Race / high power' },
  'spal-high-perf': { name: 'SPAL High Performance 16"', cfm_max: 3200, power_draw_W: 280, parasitic_hp: 0, rpm_dependent: false, application: 'Premium electric, track' },
};


// ─── Calculations ───────────────────────────────────────────────────────

/**
 * Calculate heat rejection requirement
 * Rule of thumb: ~33% of fuel energy becomes heat rejected to coolant
 */
export function calcHeatRejection(crankHP, efficiency_pct = 30) {
  const crankHP_kW = crankHP * 0.7457;
  const totalFuelEnergy_kW = crankHP_kW / (efficiency_pct / 100);
  const heatToCoolant_kW = totalFuelEnergy_kW * 0.33; // ~33% to coolant
  const heatToExhaust_kW = totalFuelEnergy_kW * 0.33; // ~33% to exhaust
  const heatToFriction_kW = totalFuelEnergy_kW * (1 - efficiency_pct / 100 - 0.33 - 0.04); // remainder
  const heatToRadiation_kW = totalFuelEnergy_kW * 0.04;

  return {
    crankHP,
    efficiency_pct,
    totalFuelEnergy_kW: Math.round(totalFuelEnergy_kW * 10) / 10,
    heatToCoolant_kW: Math.round(heatToCoolant_kW * 10) / 10,
    heatToCoolant_BTU_hr: Math.round(heatToCoolant_kW * 3412.14),
    heatToExhaust_kW: Math.round(heatToExhaust_kW * 10) / 10,
    heatToFriction_kW: Math.round(heatToFriction_kW * 10) / 10,
    heatToRadiation_kW: Math.round(heatToRadiation_kW * 10) / 10,
    recommendedRadiator: heatToCoolant_kW < 45 ? 'stock-4cyl' : heatToCoolant_kW < 60 ? 'stock-6cyl' : heatToCoolant_kW < 75 ? 'stock-v8' : heatToCoolant_kW < 90 ? 'performance-2row' : heatToCoolant_kW < 120 ? 'performance-3row' : heatToCoolant_kW < 140 ? 'race-2row' : heatToCoolant_kW < 170 ? 'race-3row' : 'drag-4row',
  };
}

/**
 * Calculate coolant flow requirement
 */
export function calcCoolantFlow(heatRejection_kW, deltaT_C = 10, coolantType = 'water-glycol-50') {
  const coolant = COOLANT_TYPES[coolantType] || COOLANT_TYPES['water-glycol-50'];
  // Q = m * Cp * dT → m = Q / (Cp * dT)
  const massFlow_kg_s = (heatRejection_kW * 1000) / (coolant.specificHeat * deltaT_C);
  const volumeFlow_L_s = massFlow_kg_s / coolant.density_kg_L;
  const volumeFlow_Lpm = volumeFlow_L_s * 60;
  const volumeFlow_gpm = volumeFlow_Lpm * 0.264172;

  return {
    heatRejection_kW,
    deltaT_C,
    coolantType,
    coolant: coolant.name,
    specificHeat: coolant.specificHeat,
    massFlow_kg_s: Math.round(massFlow_kg_s * 1000) / 1000,
    volumeFlow_Lpm: Math.round(volumeFlow_Lpm * 10) / 10,
    volumeFlow_gpm: Math.round(volumeFlow_gpm * 10) / 10,
    pumpRecommendation: volumeFlow_Lpm < 60 ? 'Stock water pump adequate' : volumeFlow_Lpm < 100 ? 'High-flow stock pump or mild upgrade' : volumeFlow_Lpm < 150 ? 'Performance electric water pump recommended' : 'Race-spec electric water pump required',
  };
}

/**
 * Radiator sizing calculator
 */
export function sizeRadiator(crankHP, ambientTemp_C = 35, targetCoolantTemp_C = 90, airSpeed_kmh = 30) {
  const heat = calcHeatRejection(crankHP);
  const heatReject_kW = heat.heatToCoolant_kW;
  const deltaTRadiator = targetCoolantTemp_C - ambientTemp_C;
  const airSpeed_ms = airSpeed_kmh / 3.6;

  // Estimate required core area
  // Simplified: Q = U * A * LMTD, U depends on airspeed
  const U_W_m2_K = 30 + airSpeed_ms * 15; // rough heat transfer coefficient
  const requiredArea_m2 = (heatReject_kW * 1000) / (U_W_m2_K * deltaTRadiator);
  const requiredArea_cm2 = requiredArea_m2 * 10000;

  // Match to database
  const recommendations = Object.entries(RADIATOR_DATABASE)
    .filter(([, r]) => r.heatRejection_kW >= heatReject_kW * 0.8 && !r.application.includes('Oil') && !r.application.includes('Intercooler'))
    .sort((a, b) => a[1].heatRejection_kW - b[1].heatRejection_kW)
    .slice(0, 3)
    .map(([name, r]) => ({ name, ...r, margin_pct: Math.round((r.heatRejection_kW / heatReject_kW - 1) * 100) }));

  return {
    crankHP,
    heatToCoolant_kW: heatReject_kW,
    ambientTemp_C,
    targetCoolantTemp_C,
    deltaTRadiator,
    airSpeed_kmh,
    heatTransferCoeff_W_m2K: Math.round(U_W_m2_K),
    requiredCoreArea_cm2: Math.round(requiredArea_cm2),
    recommendations,
    warnings: deltaTRadiator < 20 ? ['Very low delta-T — radiator must be oversized or coolant temp target raised'] : [],
    note: 'Sizing is approximate. Actual performance depends on fin density, tube design, airflow uniformity, and fan CFM.',
  };
}

/**
 * Calculate system pressure effect on boiling point
 */
export function calcBoilingPoint(pressureCap_psi = 15, coolantType = 'water-glycol-50') {
  const coolant = COOLANT_TYPES[coolantType] || COOLANT_TYPES['water-glycol-50'];
  // Each PSI raises boiling point ~1.4°C for water, ~1.25°C for glycol mix
  const boostPerPSI = coolantType.includes('glycol') ? 1.25 : 1.4;
  const effectiveBoilingPoint = coolant.boilingPoint_C + (pressureCap_psi * boostPerPSI);

  return {
    coolantType,
    coolant: coolant.name,
    baseBoilingPoint_C: coolant.boilingPoint_C,
    pressureCap_psi,
    pressureCap_bar: Math.round(pressureCap_psi * 0.0689476 * 100) / 100,
    effectiveBoilingPoint_C: Math.round(effectiveBoilingPoint * 10) / 10,
    effectiveBoilingPoint_F: Math.round(effectiveBoilingPoint * 9 / 5 + 32),
    freezingPoint_C: coolant.freezingPoint_C,
    freezingPoint_F: Math.round(coolant.freezingPoint_C * 9 / 5 + 32),
    safetyMargin: effectiveBoilingPoint > 120 ? 'GOOD — significant margin above typical operating temp' : effectiveBoilingPoint > 110 ? 'ADEQUATE — acceptable for street use' : 'LOW — consider higher pressure cap or different coolant',
  };
}

/**
 * Fan sizing recommendation
 */
export function sizeFan(radiatorArea_cm2, crankHP, hasAC = false) {
  const heat = calcHeatRejection(crankHP);
  const requiredCFM = heat.heatToCoolant_kW * 35 + (hasAC ? 500 : 0); // rough: 35 CFM per kW

  const recommendations = Object.entries(FAN_DATABASE)
    .filter(([, f]) => f.cfm_max >= requiredCFM * 0.8)
    .sort((a, b) => a[1].cfm_max - b[1].cfm_max)
    .slice(0, 3)
    .map(([name, f]) => ({ name, ...f, adequate: f.cfm_max >= requiredCFM }));

  return {
    crankHP,
    heatToCoolant_kW: heat.heatToCoolant_kW,
    hasAC,
    requiredCFM_min: Math.round(requiredCFM),
    recommendations,
    note: 'Electric fans free engine power at speed. Dual fans provide redundancy and staging. Shroud is critical for efficiency.',
  };
}

/**
 * Water pump flow analysis
 */
export function calcWaterPump(pumpFlow_Lpm, systemVolume_L, heatRejection_kW, coolantType = 'water-glycol-50') {
  const coolant = COOLANT_TYPES[coolantType] || COOLANT_TYPES['water-glycol-50'];
  const cyclesPerMinute = pumpFlow_Lpm / systemVolume_L;
  const massFlow_kg_s = (pumpFlow_Lpm / 60) * coolant.density_kg_L;
  const deltaT = (heatRejection_kW * 1000) / (massFlow_kg_s * coolant.specificHeat);
  const residenceTime_s = (systemVolume_L / pumpFlow_Lpm) * 60;

  return {
    pumpFlow_Lpm,
    systemVolume_L,
    coolantType,
    cyclesPerMinute: Math.round(cyclesPerMinute * 10) / 10,
    massFlow_kg_s: Math.round(massFlow_kg_s * 1000) / 1000,
    tempRise_perPass_C: Math.round(deltaT * 10) / 10,
    residenceTime_s: Math.round(residenceTime_s * 10) / 10,
    assessment: deltaT < 8 ? 'EXCELLENT — low temp rise per pass' : deltaT < 15 ? 'GOOD — normal operating range' : deltaT < 25 ? 'MARGINAL — consider higher flow pump' : 'POOR — pump flow inadequate, upgrade required',
    note: 'Ideal temp rise per pass is 5-15°C. Too low = wasted pump energy. Too high = hot spots.',
  };
}

/**
 * Thermostat recommendation
 */
export function recommendThermostat(application = 'street', forced_induction = false) {
  const scored = Object.entries(THERMOSTAT_RATINGS).map(([name, t]) => {
    let score = 0;
    if (application === 'daily' || application === 'economy') {
      if (t.openTemp_C >= 85) score += 20;
      if (t.openTemp_C >= 88) score += 10;
    } else if (application === 'street') {
      if (t.openTemp_C >= 77 && t.openTemp_C <= 88) score += 30;
      if (forced_induction && t.openTemp_C <= 82) score += 15;
    } else if (application === 'track' || application === 'race') {
      if (t.openTemp_C <= 77) score += 30;
      if (t.openTemp_C <= 71) score += 10;
    }
    return { name, ...t, score };
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  return { application, forced_induction, recommendations: scored };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listCoolantTypes() {
  return Object.entries(COOLANT_TYPES).map(([name, c]) => ({ name, ...c }));
}

export function listRadiators() {
  return Object.entries(RADIATOR_DATABASE).map(([name, r]) => ({ name, ...r }));
}

export function getRadiator(name) {
  return RADIATOR_DATABASE[name] || null;
}

export function listFans() {
  return Object.entries(FAN_DATABASE).map(([name, f]) => ({ name, ...f }));
}

export function listThermostats() {
  return Object.entries(THERMOSTAT_RATINGS).map(([name, t]) => ({ name, ...t }));
}

export function coolingCalcStats() {
  return {
    coolantTypes: Object.keys(COOLANT_TYPES).length,
    radiators: Object.keys(RADIATOR_DATABASE).length,
    fans: Object.keys(FAN_DATABASE).length,
    thermostats: Object.keys(THERMOSTAT_RATINGS).length,
    calculations: ['heatRejection', 'coolantFlow', 'radiatorSizing', 'boilingPoint', 'fanSizing', 'waterPump', 'thermostatRecommend'],
  };
}

export { COOLANT_TYPES, RADIATOR_DATABASE, FAN_DATABASE, THERMOSTAT_RATINGS };
