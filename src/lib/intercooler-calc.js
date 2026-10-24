// ─── intercooler-calc.js ── Intercooler & Charge Air System Calculator ───
// Module #35 — Forced Induction Cooling: core sizing, efficiency, pressure drop,
// heat exchanger calculations for air-to-air and air-to-water intercoolers
// Pure JS, zero deps, Cloudflare Workers ESM

export const INTERCOOLER_TYPES = {
  bar_and_plate: { name:'Bar & Plate', efficiency_range:[0.70,0.90], pressureDrop_range:[0.5,3.0], weight_factor:1.0, durability:'high', cost:'medium', desc:'Solid construction, good for high-boost street/track' },
  tube_and_fin:  { name:'Tube & Fin', efficiency_range:[0.60,0.85], pressureDrop_range:[0.3,2.0], weight_factor:0.7, durability:'medium', cost:'low', desc:'Lighter, lower pressure drop, good for moderate boost' },
  air_to_water:  { name:'Air-to-Water', efficiency_range:[0.80,0.95], pressureDrop_range:[0.5,2.5], weight_factor:1.3, durability:'high', cost:'high', desc:'Compact, best efficiency, needs pump & reservoir' },
  top_mount:     { name:'Top Mount (TMIC)', efficiency_range:[0.60,0.80], pressureDrop_range:[0.5,2.0], weight_factor:0.8, durability:'medium', cost:'low', desc:'Short piping, heat soak risk, Subaru/Mitsu style' },
  side_mount:    { name:'Side Mount (SMIC)', efficiency_range:[0.65,0.85], pressureDrop_range:[0.5,2.5], weight_factor:0.9, durability:'medium', cost:'medium', desc:'One-side mount, moderate piping length' },
  front_mount:   { name:'Front Mount (FMIC)', efficiency_range:[0.75,0.92], pressureDrop_range:[1.0,4.0], weight_factor:1.1, durability:'high', cost:'medium', desc:'Best airflow, longest piping, blocks radiator' }
};

export const PIPING_MATERIALS = {
  aluminum:   { name:'Aluminum', thermalCond:205, weight_factor:1.0, maxTemp:250, cost:'medium' },
  steel:      { name:'Steel', thermalCond:50, weight_factor:2.9, maxTemp:500, cost:'low' },
  silicone:   { name:'Silicone Hose', thermalCond:0.2, weight_factor:0.4, maxTemp:200, cost:'medium' },
  carbon:     { name:'Carbon Fiber', thermalCond:5, weight_factor:0.6, maxTemp:300, cost:'high' },
  titanium:   { name:'Titanium', thermalCond:22, weight_factor:1.7, maxTemp:600, cost:'very_high' }
};

export const CORE_SIZES = {
  small:   { width_mm:450, height_mm:200, depth_mm:65, volume_L:5.85, power_range:'150-300hp', desc:'Compact, fits tight bays' },
  medium:  { width_mm:600, height_mm:250, depth_mm:76, volume_L:11.4, power_range:'300-500hp', desc:'Standard street/track' },
  large:   { width_mm:720, height_mm:300, depth_mm:90, volume_L:19.44, power_range:'500-800hp', desc:'High power street/race' },
  xlarge:  { width_mm:810, height_mm:350, depth_mm:100, volume_L:28.35, power_range:'800-1200hp', desc:'Race / big turbo builds' },
  race:    { width_mm:900, height_mm:400, depth_mm:120, volume_L:43.2, power_range:'1200hp+', desc:'Full race / drag' }
};

const AIR_CP = 1005;      // J/(kg·K) specific heat of air
const AIR_DENSITY_SL = 1.225; // kg/m³ at sea level 15°C
const WATER_CP = 4186;    // J/(kg·K) specific heat of water
const WATER_DENSITY = 997; // kg/m³

// Calculate compressor outlet temperature
export function calcCompressorOutletTemp(ambientTemp_C, pressureRatio, compressorEfficiency=0.70) {
  const T1 = ambientTemp_C + 273.15; // Kelvin
  const gamma = 1.4; // ratio of specific heats for air
  const T2_ideal = T1 * Math.pow(pressureRatio, (gamma-1)/gamma);
  const T2_actual = T1 + (T2_ideal - T1) / compressorEfficiency;
  const tempRise = T2_actual - T1;
  return {
    ambientTemp_C,
    pressureRatio,
    compressorEfficiency,
    outletTemp_C: Math.round((T2_actual - 273.15)*10)/10,
    tempRise_C: Math.round(tempRise*10)/10,
    idealOutletTemp_C: Math.round((T2_ideal - 273.15)*10)/10,
    idealTempRise_C: Math.round((T2_ideal - T1)*10)/10,
    boost_psi: Math.round((pressureRatio - 1) * 14.696 * 10)/10
  };
}

// Calculate intercooler efficiency
export function calcIntercoolerEfficiency(inletTemp_C, outletTemp_C, ambientTemp_C) {
  const efficiency = (inletTemp_C - outletTemp_C) / (inletTemp_C - ambientTemp_C);
  const clamped = Math.max(0, Math.min(1, efficiency));
  return {
    inletTemp_C,
    outletTemp_C,
    ambientTemp_C,
    efficiency: Math.round(clamped*1000)/10,
    tempDrop_C: Math.round((inletTemp_C - outletTemp_C)*10)/10,
    rating: clamped > 0.85 ? 'excellent' : clamped > 0.70 ? 'good' : clamped > 0.55 ? 'fair' : 'poor',
    notes: clamped > 0.85 ? 'Race-grade cooling' : clamped > 0.70 ? 'Good for street/track' : clamped > 0.55 ? 'Consider upgrade for higher boost' : 'Significant heat soak — upgrade recommended'
  };
}

// Size intercooler core for given power & boost
export function sizeIntercoolerCore(power_hp, boost_psi, ambientTemp_C=25, type='bar_and_plate') {
  const t = INTERCOOLER_TYPES[type];
  if(!t) return { error: 'Unknown type. Use: '+Object.keys(INTERCOOLER_TYPES).join(', ') };

  const power_kw = power_hp * 0.7457;
  const pressureRatio = 1 + boost_psi / 14.696;
  const compOut = calcCompressorOutletTemp(ambientTemp_C, pressureRatio, 0.70);
  const heatLoad_kw = power_kw * 0.30; // ~30% of engine power as heat to reject

  // Mass flow estimate: ~0.9 kg/min per 100hp turbocharged
  const massFlow_kgPerMin = power_hp * 0.009;
  const massFlow_kgPerSec = massFlow_kgPerMin / 60;

  // Required core volume (empirical: ~5L per 150hp for bar_and_plate)
  const baseVolume_L = power_hp * (5.0 / 150);
  const adjustedVolume_L = baseVolume_L / ((t.efficiency_range[0]+t.efficiency_range[1])/2 / 0.80);

  // Find recommended core size
  let recommended = 'custom';
  for(const [k,v] of Object.entries(CORE_SIZES)) {
    if(v.volume_L >= adjustedVolume_L * 0.85) { recommended = k; break; }
  }

  const targetEfficiency = (t.efficiency_range[0]+t.efficiency_range[1])/2;
  const estimatedOutlet_C = compOut.outletTemp_C - (compOut.outletTemp_C - ambientTemp_C) * targetEfficiency;

  return {
    power_hp,
    boost_psi,
    pressureRatio: Math.round(pressureRatio*100)/100,
    type,
    typeName: t.name,
    compressorOutletTemp_C: compOut.outletTemp_C,
    heatLoad_kw: Math.round(heatLoad_kw*10)/10,
    massFlow_kgPerMin: Math.round(massFlow_kgPerMin*10)/10,
    requiredCoreVolume_L: Math.round(adjustedVolume_L*10)/10,
    recommendedCoreSize: recommended,
    coreDetails: CORE_SIZES[recommended] || { note: 'Custom core needed — exceeds standard sizes' },
    estimatedEfficiency: Math.round(targetEfficiency*100),
    estimatedOutletTemp_C: Math.round(estimatedOutlet_C*10)/10,
    estimatedTempDrop_C: Math.round((compOut.outletTemp_C - estimatedOutlet_C)*10)/10,
    notes: t.desc
  };
}

// Calculate pressure drop across intercooler
export function calcPressureDrop(boost_psi, flowRate_cfm, coreDepth_mm=76, pipeDiameter_mm=63.5) {
  // Simplified Darcy-Weisbach-based estimate
  const velocity = flowRate_cfm * 0.000472 / (Math.PI * Math.pow(pipeDiameter_mm/2000, 2)); // m/s
  const frictionFactor = 0.02; // typical for smooth aluminum
  const pipeLength_m = 1.5; // avg piping length
  const pipeDrop_psi = frictionFactor * (pipeLength_m / (pipeDiameter_mm/1000)) * (AIR_DENSITY_SL * velocity*velocity / 2) / 6895;

  // Core drop: thicker = more drop
  const coreDropFactor = coreDepth_mm / 76; // normalized to 76mm standard
  const coreDrop_psi = 0.8 * coreDropFactor * (flowRate_cfm / 300); // empirical

  const totalDrop_psi = pipeDrop_psi + coreDrop_psi;
  const dropPct = (totalDrop_psi / boost_psi) * 100;

  return {
    boost_psi,
    flowRate_cfm,
    pipeDiameter_mm,
    coreDepth_mm,
    pipePressureDrop_psi: Math.round(pipeDrop_psi*100)/100,
    corePressureDrop_psi: Math.round(coreDrop_psi*100)/100,
    totalPressureDrop_psi: Math.round(totalDrop_psi*100)/100,
    dropPercentage: Math.round(dropPct*10)/10,
    effectiveBoost_psi: Math.round((boost_psi - totalDrop_psi)*100)/100,
    rating: dropPct < 5 ? 'excellent' : dropPct < 10 ? 'good' : dropPct < 15 ? 'acceptable' : 'excessive',
    notes: dropPct > 15 ? 'Consider larger piping diameter or lower-restriction core' : dropPct > 10 ? 'Moderate drop — acceptable for street use' : 'Low restriction — good for performance'
  };
}

// Water-to-Air intercooler sizing
export function sizeWaterToAir(power_hp, boost_psi, ambientTemp_C=25, waterTemp_C=15) {
  const pressureRatio = 1 + boost_psi / 14.696;
  const compOut = calcCompressorOutletTemp(ambientTemp_C, pressureRatio, 0.70);
  const heatLoad_kw = power_hp * 0.7457 * 0.30;

  // Water flow needed: Q = m_dot * cp * deltaT
  const waterDeltaT = 15; // target water temp rise
  const waterFlow_LPerMin = (heatLoad_kw * 1000) / (WATER_CP * WATER_DENSITY/1000 * waterDeltaT / 60);

  // Reservoir sizing: ~2-3x per-minute flow
  const reservoir_L = waterFlow_LPerMin * 2.5;

  // Pump sizing
  const pumpFlow_LPerHr = waterFlow_LPerMin * 60;
  const pumpPressure_psi = 15 + (power_hp / 200) * 5; // base + power-scaled

  // Heat exchanger (radiator) sizing
  const hxArea_m2 = heatLoad_kw / (50 * (waterDeltaT)); // simplified

  const w2aEfficiency = 0.88; // typical w2a
  const estimatedOutlet_C = compOut.outletTemp_C - (compOut.outletTemp_C - waterTemp_C) * w2aEfficiency;

  return {
    power_hp,
    boost_psi,
    compressorOutletTemp_C: compOut.outletTemp_C,
    heatLoad_kw: Math.round(heatLoad_kw*10)/10,
    waterFlow_LPerMin: Math.round(waterFlow_LPerMin*10)/10,
    pumpFlow_LPerHr: Math.round(pumpFlow_LPerHr),
    pumpPressure_psi: Math.round(pumpPressure_psi),
    reservoir_L: Math.round(reservoir_L*10)/10,
    heatExchangerArea_m2: Math.round(hxArea_m2*100)/100,
    estimatedEfficiency: Math.round(w2aEfficiency*100),
    estimatedOutletTemp_C: Math.round(estimatedOutlet_C*10)/10,
    estimatedTempDrop_C: Math.round((compOut.outletTemp_C - estimatedOutlet_C)*10)/10,
    components: [
      { part:'Water/Air Heat Exchanger Core', spec:`${Math.round(hxArea_m2*10000)}cm² face area` },
      { part:'Electric Water Pump', spec:`${Math.round(pumpFlow_LPerHr)}L/hr @ ${Math.round(pumpPressure_psi)}psi` },
      { part:'Reservoir', spec:`${Math.round(reservoir_L*10)/10}L capacity` },
      { part:'Coolant Lines', spec:'AN-8 or AN-10 recommended' },
      { part:'Fan for HX', spec: power_hp>500?'Dual 12" recommended':'Single 10-12" sufficient' }
    ]
  };
}

// Piping diameter recommendation
export function recommendPipingDiameter(power_hp, boost_psi) {
  // Based on flow volume at given boost
  const flowRate_cfm = power_hp * 1.5; // rough CFM estimate
  const boost_bar = boost_psi * 0.0689476;

  let recommendations = [];
  const diameters = [50.8, 57.15, 63.5, 70, 76.2, 88.9, 101.6]; // 2", 2.25", 2.5", 2.75", 3", 3.5", 4"

  for(const d of diameters) {
    const area = Math.PI * Math.pow(d/2, 2); // mm²
    const velocity = (flowRate_cfm * 0.000472) / (area / 1e6); // m/s
    const suitable = velocity < 80; // max ~80 m/s for reasonable pressure drop
    recommendations.push({
      diameter_mm: d,
      diameter_inch: Math.round(d/25.4*4)/4,
      velocity_mPerSec: Math.round(velocity*10)/10,
      suitable,
      rating: velocity < 40 ? 'oversized' : velocity < 60 ? 'optimal' : velocity < 80 ? 'acceptable' : 'too_small'
    });
  }

  const optimal = recommendations.find(r=>r.rating==='optimal') || recommendations.find(r=>r.suitable);

  return {
    power_hp,
    boost_psi,
    estimatedFlow_cfm: Math.round(flowRate_cfm),
    recommended: optimal ? { diameter_mm:optimal.diameter_mm, diameter_inch:optimal.diameter_inch } : null,
    allSizes: recommendations.filter(r=>r.suitable)
  };
}

// Spray bar / water injection sizing
export function calcWaterInjection(power_hp, boost_psi, ambientTemp_C=35) {
  const pressureRatio = 1 + boost_psi / 14.696;
  const compOut = calcCompressorOutletTemp(ambientTemp_C, pressureRatio, 0.70);

  // Water injection rate: ~10% of fuel flow for cooling
  const fuelFlow_ccPerMin = power_hp * 0.8; // rough BSFC estimate
  const waterFlow_ccPerMin = fuelFlow_ccPerMin * 0.10;

  // IAT drop from water injection (~20-40°C typical)
  const iatDrop = Math.min(40, (compOut.outletTemp_C - ambientTemp_C) * 0.35);

  // Nozzle sizing
  const nozzleFlow_ccPerMin = waterFlow_ccPerMin * 1.2; // 20% headroom
  const nozzleCount = power_hp > 600 ? 2 : 1;
  const perNozzle_ccPerMin = nozzleFlow_ccPerMin / nozzleCount;

  // Tank sizing for 30min track session
  const tankSize_L = (waterFlow_ccPerMin * 30) / 1000;

  return {
    power_hp,
    boost_psi,
    compressorOutletTemp_C: compOut.outletTemp_C,
    waterFlow_ccPerMin: Math.round(waterFlow_ccPerMin*10)/10,
    estimatedIATDrop_C: Math.round(iatDrop*10)/10,
    resultingIAT_C: Math.round((compOut.outletTemp_C - iatDrop)*10)/10,
    nozzleCount,
    nozzleSize_ccPerMin: Math.round(perNozzle_ccPerMin),
    recommendedPump_psi: power_hp > 400 ? 175 : 150,
    tankSize_L: Math.round(tankSize_L*10)/10,
    mixture: 'Pure distilled water recommended. 50/50 water-methanol for extra cooling.',
    safetyNotes: [
      'Install failsafe: cut boost if water tank empty',
      'Use fine-mist nozzles (10-20 micron)',
      'Mount nozzle pre-intercooler or post-intercooler pre-throttle',
      'Tune with water injection active — timing/boost may be more aggressive'
    ]
  };
}

// Heat soak analysis
export function analyzeHeatSoak(intercoolerType, ambientTemp_C, boostPressure_psi, idleTime_min=5) {
  const t = INTERCOOLER_TYPES[intercoolerType];
  if(!t) return { error: 'Unknown type' };

  // Heat soak rate depends on type
  const soakRates = {
    bar_and_plate: 2.5, tube_and_fin: 3.0, air_to_water: 1.2,
    top_mount: 4.5, side_mount: 3.5, front_mount: 2.0
  };
  const soakRate = soakRates[intercoolerType] || 3.0; // °C per minute idle

  const engineBayTemp = ambientTemp_C + 60; // typical engine bay temp
  const pressureRatio = 1 + boostPressure_psi / 14.696;
  const compOut = calcCompressorOutletTemp(ambientTemp_C, pressureRatio, 0.70);

  // Temperature over time
  const timeline = [];
  for(let t=0; t<=idleTime_min; t++) {
    const soakedTemp = ambientTemp_C + (engineBayTemp - ambientTemp_C) * (1 - Math.exp(-soakRate * t / 10));
    const effectiveEfficiency = Math.max(0.20, ((INTERCOOLER_TYPES[intercoolerType].efficiency_range[0]+INTERCOOLER_TYPES[intercoolerType].efficiency_range[1])/2) * Math.exp(-soakRate * t / 15));
    timeline.push({
      minute: t,
      coreTemp_C: Math.round(soakedTemp*10)/10,
      estimatedEfficiency: Math.round(effectiveEfficiency*100),
      estimatedIAT_C: Math.round((compOut.outletTemp_C - (compOut.outletTemp_C - soakedTemp) * effectiveEfficiency)*10)/10
    });
  }

  return {
    intercoolerType,
    typeName: t.name,
    ambientTemp_C,
    engineBayTemp_C: engineBayTemp,
    boostPressure_psi,
    compressorOutletTemp_C: compOut.outletTemp_C,
    soakRate_CPerMin: soakRate,
    timeline,
    verdict: soakRate > 3.5 ? 'High heat soak risk — consider FMIC or water-to-air upgrade' :
             soakRate > 2.5 ? 'Moderate heat soak — avoid extended idle before pulls' :
             'Low heat soak — good thermal management'
  };
}

// Query helpers
export function listIntercoolerTypes() { return Object.entries(INTERCOOLER_TYPES).map(([k,v])=>({id:k,...v})); }
export function getIntercoolerType(id) { const t=INTERCOOLER_TYPES[id]; return t?{id,...t}:null; }
export function listCoreSizes() { return Object.entries(CORE_SIZES).map(([k,v])=>({id:k,...v})); }
export function getCoreSize(id) { const c=CORE_SIZES[id]; return c?{id,...c}:null; }
export function listPipingMaterials() { return Object.entries(PIPING_MATERIALS).map(([k,v])=>({id:k,...v})); }
export function getPipingMaterial(id) { const p=PIPING_MATERIALS[id]; return p?{id,...p}:null; }

export function intercoolerCalcStats() {
  return {
    module: 'intercooler-calc',
    version: '1.0.0',
    intercoolerTypes: Object.keys(INTERCOOLER_TYPES).length,
    coreSizes: Object.keys(CORE_SIZES).length,
    pipingMaterials: Object.keys(PIPING_MATERIALS).length,
    calculations: [
      'calcCompressorOutletTemp','calcIntercoolerEfficiency','sizeIntercoolerCore',
      'calcPressureDrop','sizeWaterToAir','recommendPipingDiameter',
      'calcWaterInjection','analyzeHeatSoak'
    ]
  };
}
