// ═══════════════════════════════════════════════════════════════════════════
// Brake System Calculator — JARVIS ECU Platform
// Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const PAD_COMPOUNDS={
  organic:{name:'Organic (NAO)',mu_cold:0.35,mu_hot:0.30,tempMax_c:350,dust:'Low',noise:'Low',rotor_wear:'Low',application:'Daily driving, commuting',fade:'Moderate fade above 300°C'},
  semi_metallic:{name:'Semi-Metallic',mu_cold:0.38,mu_hot:0.40,tempMax_c:500,dust:'Moderate',noise:'Moderate',rotor_wear:'Moderate',application:'Performance street, light track',fade:'Good fade resistance to 450°C'},
  ceramic:{name:'Ceramic',mu_cold:0.34,mu_hot:0.32,tempMax_c:400,dust:'Very Low',noise:'Very Low',rotor_wear:'Low',application:'Luxury daily, quiet operation',fade:'Fade above 350°C'},
  performance_ceramic:{name:'Performance Ceramic',mu_cold:0.40,mu_hot:0.42,tempMax_c:550,dust:'Low',noise:'Low',rotor_wear:'Moderate',application:'Sport driving, spirited street + light track',fade:'Good resistance to 500°C'},
  track_metallic:{name:'Track / Racing Metallic',mu_cold:0.28,mu_hot:0.55,tempMax_c:750,dust:'High',noise:'High',rotor_wear:'High',application:'Track day, circuit racing',fade:'Excellent — improves with temperature'},
  carbon_metallic:{name:'Carbon Metallic',mu_cold:0.32,mu_hot:0.58,tempMax_c:800,dust:'High',noise:'Moderate',rotor_wear:'Moderate',application:'Endurance racing, GT cars',fade:'Outstanding at extreme temps'},
  carbon_ceramic:{name:'Carbon-Ceramic (CCM)',mu_cold:0.30,mu_hot:0.50,tempMax_c:1000,dust:'Very Low',noise:'Low',rotor_wear:'Very Low',application:'Supercars, motorsport',fade:'Near zero fade — exotic cost'}
};

export const ROTOR_TYPES={
  solid:{name:'Solid Rotor',type:'solid',vented:false,drilled:false,slotted:false,cooling:'Poor',weight:'Heavy',cost:'Low',application:'Rear brakes, economy cars'},
  vented:{name:'Vented Rotor',type:'vented',vented:true,drilled:false,slotted:false,cooling:'Good',weight:'Moderate',cost:'Moderate',application:'Standard front brakes, most vehicles'},
  drilled:{name:'Cross-Drilled Rotor',type:'drilled',vented:true,drilled:true,slotted:false,cooling:'Very Good',weight:'Light',cost:'High',application:'Street performance, wet weather',note:'Holes can crack under sustained track use'},
  slotted:{name:'Slotted Rotor',type:'slotted',vented:true,drilled:false,slotted:true,cooling:'Good',weight:'Moderate',cost:'High',application:'Track, towing, heavy braking',note:'Slots clear gas and debris, slight pad wear increase'},
  drilled_slotted:{name:'Drilled & Slotted Rotor',type:'drilled_slotted',vented:true,drilled:true,slotted:true,cooling:'Excellent',weight:'Light',cost:'Very High',application:'Aggressive street + track',note:'Maximum cooling & gas venting, stress riser risk'},
  two_piece:{name:'Two-Piece Floating Rotor',type:'two_piece',vented:true,drilled:false,slotted:true,cooling:'Excellent',weight:'Very Light',cost:'Premium',application:'Motorsport, serious track cars',note:'Aluminum hat + iron ring, allows thermal expansion'},
  carbon_ceramic_disc:{name:'Carbon-Ceramic Disc',type:'ccm',vented:true,drilled:false,slotted:false,cooling:'Outstanding',weight:'60% lighter than iron',cost:'Extreme',application:'Supercars, F1-derived, endurance',note:'1000°C+ capable, 100k+ mile life'}
};

export const BRAKE_FLUIDS={
  dot3:{name:'DOT 3',dry_bp_c:205,wet_bp_c:140,type:'glycol',application:'Standard passenger cars',note:'Absorbs moisture — flush every 2 years'},
  dot4:{name:'DOT 4',dry_bp_c:230,wet_bp_c:155,type:'glycol',application:'European cars, performance street',note:'Higher boiling point, still hygroscopic'},
  dot4_plus:{name:'DOT 4+',dry_bp_c:260,wet_bp_c:180,type:'glycol',application:'Sport cars, spirited driving',note:'Enhanced DOT 4 for higher temps'},
  dot4_racing:{name:'DOT 4 Racing',dry_bp_c:310,wet_bp_c:200,type:'glycol',application:'Track days, racing',note:'Highest glycol-based boiling point'},
  dot5:{name:'DOT 5',dry_bp_c:260,wet_bp_c:180,type:'silicone',application:'Military, show cars, long storage',note:'Non-hygroscopic but compressible — NOT for ABS'},
  dot51:{name:'DOT 5.1',dry_bp_c:270,wet_bp_c:190,type:'glycol',application:'High-performance ABS vehicles',note:'Glycol-based (ABS compatible), high boiling point'},
  racing_rf600:{name:'Racing RF-600',dry_bp_c:316,wet_bp_c:204,type:'glycol',application:'Endurance racing, repeated heavy braking',note:'Professional grade — flush after every race weekend'}
};

export const CALIPER_TYPES={
  floating_single:{name:'Single Piston Floating',pistons:1,type:'floating',application:'Economy cars, rear brakes',pros:'Simple, low cost, self-adjusting',cons:'Uneven pad wear possible'},
  floating_dual:{name:'Dual Piston Floating',pistons:2,type:'floating',application:'Mid-range cars, front brakes',pros:'Better force distribution than single',cons:'Still limited vs fixed calipers'},
  fixed_2pot:{name:'Fixed 2-Piston',pistons:2,type:'fixed',application:'Sport compact cars',pros:'Even pad wear, stiffer feel',cons:'More expensive, no self-adjustment'},
  fixed_4pot:{name:'Fixed 4-Piston',pistons:4,type:'fixed',application:'Performance cars, sport brakes',pros:'Strong clamping, excellent modulation',cons:'Higher cost, more complex'},
  fixed_6pot:{name:'Fixed 6-Piston',pistons:6,type:'fixed',application:'High-performance, big brake kits',pros:'Maximum clamping force, progressive feel',cons:'Heavy, expensive, large wheels required'},
  fixed_8pot:{name:'Fixed 8-Piston',pistons:8,type:'fixed',application:'Supercars, heavy performance vehicles',pros:'Ultimate stopping power',cons:'Extreme cost, packaging challenges'},
  monoblock:{name:'Monoblock Caliper',pistons:6,type:'monoblock',application:'Motorsport, top-tier road cars',pros:'Lightest, stiffest — machined from single billet',cons:'Premium cost'}
};

// ── Calculations ──

export function calcBrakeForce(pedalForce_n, boosterRatio, masterBore_mm, caliperBore_mm, caliperPistons, padMu, effectiveRadius_mm) {
  // F_pedal × boost → master cylinder pressure → caliper force → friction force × 2 pads
  const masterArea_mm2 = Math.PI * (masterBore_mm / 2) ** 2;
  const boostedForce = pedalForce_n * boosterRatio;
  const linePressure_mpa = boostedForce / masterArea_mm2;
  const linePressure_bar = linePressure_mpa * 10;
  const caliperArea_mm2 = Math.PI * (caliperBore_mm / 2) ** 2 * caliperPistons;
  const clampForce_n = linePressure_mpa * caliperArea_mm2;
  const frictionForce_n = clampForce_n * padMu * 2; // both sides of rotor
  const brakeTorque_nm = frictionForce_n * (effectiveRadius_mm / 1000);
  return {
    pedalForce_n, boosterRatio, masterBore_mm, caliperBore_mm, caliperPistons, padMu, effectiveRadius_mm,
    boostedForce_n: Math.round(boostedForce),
    linePressure_bar: Math.round(linePressure_bar * 10) / 10,
    caliperClampForce_n: Math.round(clampForce_n),
    frictionForce_n: Math.round(frictionForce_n),
    brakeTorque_nm: Math.round(brakeTorque_nm),
    pedalRatio: Math.round((caliperArea_mm2 / masterArea_mm2) * boosterRatio * 10) / 10
  };
}

export function calcStoppingDistance(speed_kmh, vehicleWeight_kg, totalBrakeForce_n, tireGrip_mu = 1.0, tireRadius_mm = 310) {
  const speed_ms = speed_kmh / 3.6;
  const maxDecel_brake = (totalBrakeForce_n / tireRadius_mm * 1000) / vehicleWeight_kg;
  const maxDecel_tire = tireGrip_mu * 9.81;
  const effectiveDecel = Math.min(maxDecel_brake, maxDecel_tire);
  const limitingFactor = maxDecel_brake < maxDecel_tire ? 'brake_force' : 'tire_grip';
  const stoppingDist_m = (speed_ms ** 2) / (2 * effectiveDecel);
  const stoppingTime_s = speed_ms / effectiveDecel;
  const decelG = effectiveDecel / 9.81;
  return {
    speed_kmh, vehicleWeight_kg, totalBrakeForce_n, tireGrip_mu,
    effectiveDecel_ms2: Math.round(effectiveDecel * 100) / 100,
    deceleration_g: Math.round(decelG * 100) / 100,
    stoppingDistance_m: Math.round(stoppingDist_m * 10) / 10,
    stoppingTime_s: Math.round(stoppingTime_s * 100) / 100,
    limitingFactor,
    warning: limitingFactor === 'brake_force' ? 'Brakes are the limit — upgrade calipers/pads for shorter stops' : 'Tire grip is the limit — stickier tires will help more than bigger brakes'
  };
}

export function calcBrakeBias(frontBrakeForce_n, rearBrakeForce_n, vehicleWeight_kg, frontWeightPct = 60) {
  const totalBrake = frontBrakeForce_n + rearBrakeForce_n;
  const brakeBiasFront_pct = (frontBrakeForce_n / totalBrake) * 100;
  const idealFrontBias = frontWeightPct + 5; // slight front bias is safe
  const biasError = brakeBiasFront_pct - idealFrontBias;
  let handling;
  if (brakeBiasFront_pct > 75) handling = 'Extreme front bias — rear brakes nearly unused, long stops';
  else if (brakeBiasFront_pct > idealFrontBias + 5) handling = 'Front-heavy — safe but longer stops, front pads wear fast';
  else if (brakeBiasFront_pct >= idealFrontBias - 3) handling = 'Well balanced — optimal for this weight distribution';
  else if (brakeBiasFront_pct > 45) handling = 'Rear-heavy — risk of rear lockup under hard braking (dangerous)';
  else handling = 'Extreme rear bias — DANGEROUS, rear will lock and spin';
  return {
    frontBrakeForce_n, rearBrakeForce_n, vehicleWeight_kg, frontWeightPct,
    brakeBiasFront_pct: Math.round(brakeBiasFront_pct * 10) / 10,
    brakeBiasRear_pct: Math.round((100 - brakeBiasFront_pct) * 10) / 10,
    idealFrontBias_pct: idealFrontBias,
    biasError_pct: Math.round(biasError * 10) / 10,
    handling,
    adjustments: Math.abs(biasError) > 5 ? [
      biasError > 0 ? 'Reduce front or increase rear brake force' : 'Increase front or reduce rear brake force',
      'Adjustable proportioning valve recommended',
      Math.abs(biasError) > 10 ? 'Consider big brake kit on the weak end' : 'Fine-tune with pad compound selection'
    ] : ['Bias is within optimal range']
  };
}

export function calcRotorTemp(kineticEnergy_j, rotorMass_kg, rotorMaterial = 'cast_iron') {
  // ΔT = E / (m × Cp)
  const specificHeat = rotorMaterial === 'carbon_ceramic' ? 1200 : 460; // J/(kg·K)
  const tempRise_c = kineticEnergy_j / (rotorMass_kg * specificHeat);
  const ambientTemp = 25;
  const peakTemp = ambientTemp + tempRise_c;
  let condition;
  if (peakTemp > 700) condition = 'DANGER — rotor cracking risk, brake fade imminent';
  else if (peakTemp > 550) condition = 'HIGH — track-grade pads and fluid required';
  else if (peakTemp > 400) condition = 'ELEVATED — performance pads recommended';
  else if (peakTemp > 250) condition = 'NORMAL — standard pads adequate';
  else condition = 'COOL — light braking';
  return {
    kineticEnergy_j, rotorMass_kg, rotorMaterial, specificHeat_j_kgK: specificHeat,
    tempRise_c: Math.round(tempRise_c),
    estimatedPeakTemp_c: Math.round(peakTemp),
    condition,
    fluidRecommendation: peakTemp > 500 ? 'DOT 4 Racing or RF-600 required' : peakTemp > 350 ? 'DOT 4+ minimum' : 'DOT 3 or DOT 4 adequate'
  };
}

export function calcKineticEnergy(vehicleWeight_kg, speed_kmh) {
  const speed_ms = speed_kmh / 3.6;
  const ke_j = 0.5 * vehicleWeight_kg * speed_ms ** 2;
  return {
    vehicleWeight_kg, speed_kmh,
    kineticEnergy_j: Math.round(ke_j),
    kineticEnergy_kj: Math.round(ke_j / 1000 * 10) / 10,
    note: `Energy the brakes must absorb to stop from ${speed_kmh} km/h`
  };
}

export function calcPedalRatio(pedalLength_mm, pivotToMaster_mm) {
  const ratio = pedalLength_mm / pivotToMaster_mm;
  return {
    pedalLength_mm, pivotToMaster_mm,
    pedalRatio: Math.round(ratio * 100) / 100,
    feel: ratio > 6 ? 'Very easy — long travel, soft feel' : ratio > 5 ? 'Comfortable — street car' : ratio > 4 ? 'Firm — sport car' : ratio > 3 ? 'Stiff — race car' : 'Very stiff — formula car',
    recommendation: ratio < 3.5 ? 'May need power assist for street use' : ratio > 7 ? 'Excessive travel — consider shorter pedal arm' : 'Good range'
  };
}

export function calcBrakeLineLength(caliper_bore_mm, caliper_pistons, masterBore_mm) {
  // Fluid volume displaced per mm of pad wear
  const caliperVolume_mm3 = Math.PI * (caliper_bore_mm / 2) ** 2 * caliper_pistons * 2; // both sides
  const masterVolume_per_mm = Math.PI * (masterBore_mm / 2) ** 2;
  const pedalTravel_per_mm_wear = caliperVolume_mm3 / masterVolume_per_mm;
  return {
    caliper_bore_mm, caliper_pistons, masterBore_mm,
    caliperVolume_cm3: Math.round(caliperVolume_mm3 / 1000 * 100) / 100,
    masterVolume_per_mm_cm3: Math.round(masterVolume_per_mm / 1000 * 100) / 100,
    pedalTravel_per_mm_padWear_mm: Math.round(pedalTravel_per_mm_wear * 100) / 100,
    note: 'Higher ratio means pedal sinks more as pads wear — watch pad thickness'
  };
}

export function recommendBrakeFluid(maxRotorTemp_c) {
  const suitable = Object.entries(BRAKE_FLUIDS)
    .filter(([, f]) => f.dry_bp_c > maxRotorTemp_c * 0.6) // fluid temp ≈ 60% of rotor temp
    .map(([key, f]) => ({
      key, ...f,
      safetyMargin_c: Math.round(f.dry_bp_c - maxRotorTemp_c * 0.6)
    }))
    .sort((a, b) => a.safetyMargin_c - b.safetyMargin_c);
  const estimatedFluidTemp = Math.round(maxRotorTemp_c * 0.6);
  return {
    maxRotorTemp_c,
    estimatedFluidTemp_c: estimatedFluidTemp,
    suitable,
    warning: estimatedFluidTemp > 250 ? 'Extreme fluid temps — racing-grade fluid mandatory, bleed frequently' :
      estimatedFluidTemp > 180 ? 'High fluid temps — DOT 4+ minimum' : 'Standard fluid temps'
  };
}

// ── Query Functions ──

export function listPadCompounds() { return Object.entries(PAD_COMPOUNDS).map(([k, v]) => ({ key: k, ...v })); }
export function getPadCompound(key) { const p = PAD_COMPOUNDS[key]; return p ? { key, ...p } : null; }
export function listRotorTypes() { return Object.entries(ROTOR_TYPES).map(([k, v]) => ({ key: k, ...v })); }
export function getRotorType(key) { const r = ROTOR_TYPES[key]; return r ? { key, ...r } : null; }
export function listBrakeFluids() { return Object.entries(BRAKE_FLUIDS).map(([k, v]) => ({ key: k, ...v })); }
export function getBrakeFluid(key) { const f = BRAKE_FLUIDS[key]; return f ? { key, ...f } : null; }
export function listCaliperTypes() { return Object.entries(CALIPER_TYPES).map(([k, v]) => ({ key: k, ...v })); }
export function getCaliperType(key) { const c = CALIPER_TYPES[key]; return c ? { key, ...c } : null; }
export function searchPadCompounds(q) { const l = q.toLowerCase(); return listPadCompounds().filter(p => p.name.toLowerCase().includes(l) || (p.application || '').toLowerCase().includes(l)); }

export function brakeCalcStats() {
  return {
    module: 'Brake System Calculator',
    padCompounds: Object.keys(PAD_COMPOUNDS).length,
    rotorTypes: Object.keys(ROTOR_TYPES).length,
    brakeFluids: Object.keys(BRAKE_FLUIDS).length,
    caliperTypes: Object.keys(CALIPER_TYPES).length,
    calculations: ['calcBrakeForce', 'calcStoppingDistance', 'calcBrakeBias', 'calcRotorTemp', 'calcKineticEnergy', 'calcPedalRatio', 'calcBrakeLineLength', 'recommendBrakeFluid']
  };
}
