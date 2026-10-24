// ═══════════════════════════════════════════════════════════════════════════
// Aerodynamics Calculator — JARVIS ECU Platform
// Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const DRAG_PROFILES={
  supercar_slippery:{name:'Supercar (Optimized)',cd:0.26,frontalArea_m2:1.85,example:'McLaren Speedtail, Mercedes EQS'},
  sports_coupe:{name:'Sports Coupé',cd:0.30,frontalArea_m2:1.95,example:'Porsche 911, BMW M4, Toyota Supra'},
  sedan_aero:{name:'Sedan (Aero-Optimized)',cd:0.24,frontalArea_m2:2.10,example:'Tesla Model 3, Mercedes CLA, Lucid Air'},
  sedan_standard:{name:'Standard Sedan',cd:0.30,frontalArea_m2:2.15,example:'BMW 3 Series, Honda Accord, VW Passat'},
  hatchback:{name:'Hatchback',cd:0.32,frontalArea_m2:2.10,example:'VW Golf, Honda Civic, Mazda 3'},
  suv_modern:{name:'SUV (Modern)',cd:0.35,frontalArea_m2:2.80,example:'BMW X5, Mercedes GLE, Porsche Cayenne'},
  suv_boxy:{name:'SUV (Boxy)',cd:0.40,frontalArea_m2:3.00,example:'Mercedes G-Class, Jeep Wrangler, Land Rover Defender'},
  pickup:{name:'Pickup Truck',cd:0.42,frontalArea_m2:3.20,example:'Ford F-150, Toyota Tundra, RAM 1500'},
  race_gt:{name:'GT Race Car',cd:0.34,frontalArea_m2:1.95,example:'GT3 cars, GT4 cars — high downforce, moderate drag'},
  race_formula:{name:'Open Wheel / Formula',cd:0.70,frontalArea_m2:1.40,example:'Formula 1, Formula 2 — very high downforce, high drag'},
  race_prototype:{name:'LMP / Hypercar Prototype',cd:0.44,frontalArea_m2:1.75,example:'Le Mans prototypes, WEC Hypercar'},
  motorcycle:{name:'Motorcycle (Sport)',cd:0.55,frontalArea_m2:0.55,example:'Sportbike tuck position'},
  convertible_up:{name:'Convertible (Top Up)',cd:0.33,frontalArea_m2:2.00,example:'Porsche Boxster, Mazda MX-5, BMW Z4'},
  convertible_down:{name:'Convertible (Top Down)',cd:0.40,frontalArea_m2:2.00,example:'Any convertible — turbulent cabin airflow'}
};

export const WING_PROFILES={
  gurney_flap:{name:'Gurney Flap',downforce_coeff:0.08,drag_penalty:0.01,angle_deg:90,note:'Small L-shaped tab on trailing edge — simple, effective, minimal drag'},
  lip_spoiler:{name:'Lip Spoiler',downforce_coeff:0.04,drag_penalty:0.005,angle_deg:10,note:'Subtle trunk lip — disrupts airflow separation, slight downforce'},
  duck_tail:{name:'Duck Tail Spoiler',downforce_coeff:0.06,drag_penalty:0.008,angle_deg:15,note:'Raised deck lid — reduces lift without a wing'},
  oem_spoiler:{name:'OEM Rear Spoiler',downforce_coeff:0.08,drag_penalty:0.015,angle_deg:20,note:'Factory spoiler — modest downforce, low drag'},
  gt_wing_low:{name:'GT Wing (Low AoA)',downforce_coeff:0.18,drag_penalty:0.03,angle_deg:5,note:'Aftermarket GT wing at low angle — balanced'},
  gt_wing_med:{name:'GT Wing (Medium AoA)',downforce_coeff:0.30,drag_penalty:0.06,angle_deg:10,note:'GT wing at track angle — significant downforce'},
  gt_wing_high:{name:'GT Wing (High AoA)',downforce_coeff:0.45,drag_penalty:0.10,angle_deg:15,note:'GT wing at max angle — maximum downforce, high drag'},
  swan_neck:{name:'Swan Neck GT Wing',downforce_coeff:0.35,drag_penalty:0.07,angle_deg:12,note:'Top-mount swan neck — cleaner underside airflow than standard stands'},
  diffuser_small:{name:'Rear Diffuser (Mild)',downforce_coeff:0.10,drag_penalty:-0.01,angle_deg:7,note:'Underbody diffuser — reduces drag AND adds downforce'},
  diffuser_race:{name:'Rear Diffuser (Race)',downforce_coeff:0.25,drag_penalty:-0.03,angle_deg:12,note:'Aggressive diffuser with strakes — significant ground effect'},
  splitter_small:{name:'Front Splitter (Mild)',downforce_coeff:0.08,drag_penalty:0.01,angle_deg:0,note:'Extended front lip — front downforce, reduces front lift'},
  splitter_race:{name:'Front Splitter (Race)',downforce_coeff:0.20,drag_penalty:0.03,angle_deg:0,note:'Large front splitter with endplates — track-focused front downforce'},
  canards:{name:'Front Canards',downforce_coeff:0.06,drag_penalty:0.015,angle_deg:25,note:'Dive planes on front bumper — front downforce + yaw stability'},
  flat_bottom:{name:'Flat Underbody Panel',downforce_coeff:0.05,drag_penalty:-0.02,angle_deg:0,note:'Smooth undertray — reduces drag and turbulence, mild downforce'}
};

const RHO_AIR = 1.225; // kg/m³ at sea level 15°C

// ── Calculations ──

export function calcDragForce(cd, frontalArea_m2, speed_kmh, airDensity=RHO_AIR) {
  const v = speed_kmh / 3.6;
  const force_n = 0.5 * airDensity * cd * frontalArea_m2 * v * v;
  const power_w = force_n * v;
  return {
    cd, frontalArea_m2, speed_kmh, airDensity_kg_m3: airDensity,
    speed_ms: Math.round(v * 100) / 100,
    dragForce_n: Math.round(force_n * 10) / 10,
    dragForce_kg: Math.round(force_n / 9.81 * 10) / 10,
    powerToDrag_w: Math.round(power_w),
    powerToDrag_hp: Math.round(power_w / 745.7 * 10) / 10,
    powerToDrag_kw: Math.round(power_w / 1000 * 10) / 10,
    note: `At ${speed_kmh} km/h, ${Math.round(power_w / 745.7)} HP is consumed overcoming air resistance alone`
  };
}

export function calcTopSpeed(power_hp, cd, frontalArea_m2, rollingResistance=0.012, vehicleWeight_kg=1500, airDensity=RHO_AIR) {
  // Iterative — find speed where drag+rolling = available power
  const power_w = power_hp * 745.7;
  let speed = 10; // start at 10 m/s
  for (let i = 0; i < 500; i++) {
    const dragForce = 0.5 * airDensity * cd * frontalArea_m2 * speed * speed;
    const rollingForce = rollingResistance * vehicleWeight_kg * 9.81;
    const totalResistance = dragForce + rollingForce;
    const powerNeeded = totalResistance * speed;
    if (powerNeeded >= power_w * 0.85) break; // 85% drivetrain efficiency
    speed += 0.5;
  }
  const topSpeed_kmh = speed * 3.6;
  const dragAtTop = 0.5 * airDensity * cd * frontalArea_m2 * speed * speed;
  const rollAtTop = rollingResistance * vehicleWeight_kg * 9.81;
  return {
    power_hp, cd, frontalArea_m2, vehicleWeight_kg,
    estimatedTopSpeed_kmh: Math.round(topSpeed_kmh),
    estimatedTopSpeed_mph: Math.round(topSpeed_kmh * 0.621),
    dragForceAtTop_n: Math.round(dragAtTop),
    rollingResistanceAtTop_n: Math.round(rollAtTop),
    dragPct: Math.round(dragAtTop / (dragAtTop + rollAtTop) * 100),
    rollingPct: Math.round(rollAtTop / (dragAtTop + rollAtTop) * 100),
    note: 'Assumes 85% drivetrain efficiency, sea level, 15°C'
  };
}

export function calcDownforce(wingProfile_key, speed_kmh, frontalArea_m2=1.95, airDensity=RHO_AIR) {
  const profile = WING_PROFILES[wingProfile_key];
  if (!profile) return { error: 'Wing profile not found', available: Object.keys(WING_PROFILES) };
  const v = speed_kmh / 3.6;
  const downforce_n = 0.5 * airDensity * profile.downforce_coeff * frontalArea_m2 * v * v;
  const dragPenalty_n = 0.5 * airDensity * profile.drag_penalty * frontalArea_m2 * v * v;
  return {
    wing: profile.name, speed_kmh,
    downforce_n: Math.round(downforce_n * 10) / 10,
    downforce_kg: Math.round(downforce_n / 9.81 * 10) / 10,
    dragPenalty_n: Math.round(dragPenalty_n * 10) / 10,
    dragPenalty_hp: Math.round(dragPenalty_n * (speed_kmh / 3.6) / 745.7 * 10) / 10,
    efficiency: profile.drag_penalty > 0 ? Math.round(downforce_n / dragPenalty_n * 100) / 100 : 'Infinite (drag reduction)',
    note: profile.note
  };
}

export function calcAeroBalance(frontDownforce_n, rearDownforce_n, vehicleWeight_kg, frontWeightPct=55) {
  const totalDownforce = frontDownforce_n + rearDownforce_n;
  const frontAeroPct = totalDownforce > 0 ? (frontDownforce_n / totalDownforce * 100) : 0;
  const rearAeroPct = totalDownforce > 0 ? (rearDownforce_n / totalDownforce * 100) : 0;
  const staticFrontN = vehicleWeight_kg * 9.81 * (frontWeightPct / 100);
  const staticRearN = vehicleWeight_kg * 9.81 * ((100 - frontWeightPct) / 100);
  const dynamicFrontPct = (staticFrontN + frontDownforce_n) / (vehicleWeight_kg * 9.81 + totalDownforce) * 100;
  return {
    frontDownforce_n, rearDownforce_n, totalDownforce_n: totalDownforce,
    totalDownforce_kg: Math.round(totalDownforce / 9.81),
    aeroBalance_front_pct: Math.round(frontAeroPct),
    aeroBalance_rear_pct: Math.round(rearAeroPct),
    staticWeightBalance_front_pct: frontWeightPct,
    dynamicWeightBalance_front_pct: Math.round(dynamicFrontPct * 10) / 10,
    handling: dynamicFrontPct > 55 ? 'Understeer bias — too much front downforce' :
      dynamicFrontPct < 45 ? 'Oversteer bias — too much rear downforce' :
      dynamicFrontPct < 48 ? 'Slight oversteer — aggressive track setup' :
      dynamicFrontPct > 52 ? 'Slight understeer — safe, stable setup' : 'Neutral — ideal balance'
  };
}

export function calcSpeedEffect(cd, frontalArea_m2, vehicleWeight_kg=1500, airDensity=RHO_AIR) {
  const speeds = [60, 80, 100, 120, 140, 160, 180, 200, 250, 300];
  const results = speeds.map(spd => {
    const v = spd / 3.6;
    const drag_n = 0.5 * airDensity * cd * frontalArea_m2 * v * v;
    const power_hp = drag_n * v / 745.7;
    return { speed_kmh: spd, drag_n: Math.round(drag_n), drag_hp: Math.round(power_hp * 10) / 10 };
  });
  return { cd, frontalArea_m2, speeds: results, note: 'Drag grows with speed² — power to overcome it grows with speed³' };
}

export function calcAltitudeEffect(altitude_m, cd, frontalArea_m2, speed_kmh) {
  // Air density decreases ~12% per 1000m
  const densityAtAlt = RHO_AIR * Math.exp(-altitude_m / 8500);
  const seaLevel = calcDragForce(cd, frontalArea_m2, speed_kmh, RHO_AIR);
  const atAlt = calcDragForce(cd, frontalArea_m2, speed_kmh, densityAtAlt);
  const dragReduction_pct = (1 - atAlt.dragForce_n / seaLevel.dragForce_n) * 100;
  return {
    altitude_m, airDensity_sea: RHO_AIR, airDensity_alt: Math.round(densityAtAlt * 1000) / 1000,
    dragAtSeaLevel_n: seaLevel.dragForce_n,
    dragAtAltitude_n: atAlt.dragForce_n,
    dragReduction_pct: Math.round(dragReduction_pct * 10) / 10,
    powerSaved_hp: Math.round((seaLevel.powerToDrag_hp - atAlt.powerToDrag_hp) * 10) / 10,
    note: `At ${altitude_m}m, air is ${Math.round(dragReduction_pct)}% thinner — less drag but also less engine power (NA engines lose ~3% per 300m)`
  };
}

export function calcCdFromCoasting(speed1_kmh, speed2_kmh, time_s, vehicleWeight_kg, frontalArea_m2, gradient_pct=0) {
  // Estimate Cd from coast-down test data
  const v1 = speed1_kmh / 3.6;
  const v2 = speed2_kmh / 3.6;
  const vAvg = (v1 + v2) / 2;
  const decel = (v1 - v2) / time_s;
  const totalForce = vehicleWeight_kg * decel;
  const gravForce = vehicleWeight_kg * 9.81 * Math.sin(Math.atan(gradient_pct / 100));
  const rollingForce = vehicleWeight_kg * 9.81 * 0.012; // estimated Crr
  const dragForce = totalForce - rollingForce + gravForce;
  const cd = (2 * dragForce) / (RHO_AIR * frontalArea_m2 * vAvg * vAvg);
  return {
    speed1_kmh, speed2_kmh, time_s, vehicleWeight_kg, frontalArea_m2,
    averageSpeed_kmh: Math.round((speed1_kmh + speed2_kmh) / 2),
    deceleration_ms2: Math.round(decel * 1000) / 1000,
    estimatedCd: Math.round(Math.abs(cd) * 1000) / 1000,
    estimatedDragForce_n: Math.round(Math.abs(dragForce)),
    accuracy: 'Approximate — proper coast-down requires multiple runs, GPS, wind correction',
    note: 'For best results, test on flat road, no wind, multiple directions, average results'
  };
}

// ── Query Functions ──

export function listDragProfiles() { return Object.entries(DRAG_PROFILES).map(([k, v]) => ({ key: k, ...v })); }
export function getDragProfile(key) { const d = DRAG_PROFILES[key]; return d ? { key, ...d } : null; }
export function searchDragProfiles(q) { const l = q.toLowerCase(); return listDragProfiles().filter(d => d.name.toLowerCase().includes(l) || (d.example || '').toLowerCase().includes(l)); }
export function listWingProfiles() { return Object.entries(WING_PROFILES).map(([k, v]) => ({ key: k, ...v })); }
export function getWingProfile(key) { const w = WING_PROFILES[key]; return w ? { key, ...w } : null; }

export function aeroCalcStats() {
  return {
    module: 'Aerodynamics Calculator',
    dragProfiles: Object.keys(DRAG_PROFILES).length,
    wingProfiles: Object.keys(WING_PROFILES).length,
    calculations: ['calcDragForce', 'calcTopSpeed', 'calcDownforce', 'calcAeroBalance', 'calcSpeedEffect', 'calcAltitudeEffect', 'calcCdFromCoasting']
  };
}
