// ═══════════════════════════════════════════════════════════════════════════
// Weight Distribution & Load Transfer Calculator — JARVIS ECU Platform
// Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const WEIGHT_CLASSES={
  kei_car:{name:'Kei Car',min_kg:600,max_kg:900,example:'Suzuki Alto, Honda N-Box, Daihatsu Copen'},
  city_car:{name:'City Car',min_kg:850,max_kg:1100,example:'Toyota Yaris, VW Polo, Fiat 500'},
  compact:{name:'Compact',min_kg:1100,max_kg:1400,example:'VW Golf, Honda Civic, Mazda 3'},
  midsize:{name:'Midsize Sedan',min_kg:1300,max_kg:1600,example:'BMW 3 Series, Toyota Camry, Audi A4'},
  fullsize:{name:'Full-Size Sedan',min_kg:1500,max_kg:1900,example:'Mercedes E-Class, BMW 5 Series, Lexus ES'},
  sports_car:{name:'Sports Car',min_kg:1100,max_kg:1600,example:'Porsche Cayman, Toyota Supra, Corvette'},
  muscle_car:{name:'Muscle Car',min_kg:1600,max_kg:2000,example:'Dodge Challenger, Ford Mustang, Chevy Camaro'},
  supercar:{name:'Supercar',min_kg:1200,max_kg:1700,example:'Ferrari 488, Lamborghini Huracán, McLaren 720S'},
  hypercar:{name:'Hypercar',min_kg:1100,max_kg:1500,example:'Bugatti Chiron, Koenigsegg Jesko, Pagani Huayra'},
  suv_compact:{name:'Compact SUV',min_kg:1400,max_kg:1800,example:'BMW X3, Toyota RAV4, Mazda CX-5'},
  suv_midsize:{name:'Midsize SUV',min_kg:1800,max_kg:2400,example:'BMW X5, Mercedes GLE, Audi Q7'},
  suv_fullsize:{name:'Full-Size SUV',min_kg:2300,max_kg:3000,example:'Range Rover, Cadillac Escalade, Toyota Land Cruiser'},
  pickup_midsize:{name:'Midsize Pickup',min_kg:1700,max_kg:2200,example:'Toyota Tacoma, Ford Ranger, Chevy Colorado'},
  pickup_fullsize:{name:'Full-Size Pickup',min_kg:2100,max_kg:2900,example:'Ford F-150, RAM 1500, Chevy Silverado'},
  ev_sedan:{name:'EV Sedan',min_kg:1600,max_kg:2300,example:'Tesla Model 3/S, Mercedes EQS, BMW i4'},
  ev_suv:{name:'EV SUV',min_kg:2000,max_kg:2800,example:'Tesla Model X, BMW iX, Mercedes EQE SUV'},
  race_formula:{name:'Formula / Open Wheel',min_kg:650,max_kg:800,example:'F1, F2, IndyCar — minimum weight with driver'},
  race_gt:{name:'GT Race Car',min_kg:1200,max_kg:1400,example:'GT3, GT4 — with BOP weight'},
  race_touring:{name:'Touring Car',min_kg:1100,max_kg:1350,example:'TCR, BTCC, DTM'},
  van:{name:'Van / MPV',min_kg:1600,max_kg:2500,example:'VW Transporter, Ford Transit Custom, Mercedes Vito'}
};

export const LAYOUT_TYPES={
  ff:{name:'FF (Front Engine, FWD)',typicalFrontPct:60,pros:'Compact, efficient, low cost',cons:'Understeer bias, limited traction under power',note:'Most common layout — economical, predictable'},
  fr:{name:'FR (Front Engine, RWD)',typicalFrontPct:52,pros:'Good balance, natural handling, driftable',cons:'Less traction in wet/snow, prop shaft adds weight',note:'Classic sports car layout — BMW, Mazda MX-5, Mustang'},
  mr:{name:'MR (Mid Engine, RWD)',typicalFrontPct:42,pros:'Best rotational inertia, excellent balance',cons:'Snappy limit behavior, packaging constraints',note:'Supercar layout — Ferrari, Lamborghini, Cayman'},
  rr:{name:'RR (Rear Engine, RWD)',typicalFrontPct:38,pros:'Maximum rear traction, unique character',cons:'Pendulum oversteer at limit, front lifts under power',note:'Porsche 911 layout — requires skilled driving'},
  awd_front:{name:'AWD (Front-Biased)',typicalFrontPct:58,pros:'All-weather traction, stable',cons:'Heavy, understeer tendency',note:'Most AWD crossovers and SUVs'},
  awd_rear:{name:'AWD (Rear-Biased)',typicalFrontPct:50,pros:'Balanced, sporty AWD feel',cons:'Complex, expensive',note:'BMW xDrive, Mercedes 4MATIC+, Audi Sport Quattro'},
  awd_mid:{name:'AWD (Mid Engine)',typicalFrontPct:43,pros:'Extreme traction + balance',cons:'Most complex, expensive',note:'Audi R8, Lamborghini Huracán AWD, Bugatti Chiron'}
};

const G = 9.81;

// ── Load Transfer ──

export function calcLongitudinalTransfer(vehicleWeight_kg, wheelbase_mm, cgHeight_mm, accel_g) {
  const transferForce_n = vehicleWeight_kg * G * (cgHeight_mm / wheelbase_mm) * accel_g;
  const totalWeight_n = vehicleWeight_kg * G;
  const transferPct = (transferForce_n / totalWeight_n) * 100;
  return {
    vehicleWeight_kg, wheelbase_mm, cgHeight_mm, acceleration_g: accel_g,
    loadTransfer_n: Math.round(transferForce_n),
    loadTransfer_kg: Math.round(transferForce_n / G * 10) / 10,
    loadTransfer_pct: Math.round(transferPct * 10) / 10,
    direction: accel_g > 0 ? 'Rearward (acceleration — weight shifts to rear)' : 'Forward (braking — weight shifts to front)',
    effect: Math.abs(transferPct) > 15 ? 'HIGH — significant grip change front/rear' :
      Math.abs(transferPct) > 8 ? 'MODERATE — noticeable balance shift' : 'LOW — mild effect',
    tip: accel_g > 0 ? 'Rear tires gain grip, front tires lose grip — anti-squat geometry helps' :
      'Front tires gain grip, rear tires lose grip — anti-dive geometry helps'
  };
}

export function calcLateralTransfer(vehicleWeight_kg, trackWidth_mm, cgHeight_mm, lateral_g) {
  const transferForce_n = vehicleWeight_kg * G * (cgHeight_mm / trackWidth_mm) * lateral_g;
  const totalWeight_n = vehicleWeight_kg * G;
  const transferPct = (transferForce_n / totalWeight_n) * 100;
  const insideWheelLoad_pct = 50 - transferPct;
  return {
    vehicleWeight_kg, trackWidth_mm, cgHeight_mm, lateral_g,
    loadTransfer_n: Math.round(transferForce_n),
    loadTransfer_kg: Math.round(transferForce_n / G * 10) / 10,
    loadTransfer_pct: Math.round(transferPct * 10) / 10,
    insideWheelLoad_pct: Math.round(insideWheelLoad_pct * 10) / 10,
    outsideWheelLoad_pct: Math.round((50 + transferPct) * 10) / 10,
    liftRisk: insideWheelLoad_pct < 5 ? 'CRITICAL — inside wheel near lift-off' :
      insideWheelLoad_pct < 15 ? 'HIGH — inside wheel very lightly loaded' :
      insideWheelLoad_pct < 25 ? 'MODERATE — noticeable inside unloading' : 'LOW — balanced loading',
    tip: 'Lower CG height and wider track reduce lateral transfer — stiffer sway bars shift transfer front/rear'
  };
}

// ── CG Height Estimation ──

export function estimateCGHeight(vehicleWeight_kg, wheelbase_mm, frontAxleWeight_rear_lifted_kg, liftHeight_mm) {
  // Tilt test method: lift rear axle to known height, measure front axle weight change
  const staticFrontWeight_kg = vehicleWeight_kg * 0.5; // placeholder, caller should provide
  const weightShift_kg = frontAxleWeight_rear_lifted_kg - staticFrontWeight_kg;
  const angle_rad = Math.asin(liftHeight_mm / wheelbase_mm);
  const cgHeight_mm = (weightShift_kg * wheelbase_mm) / (vehicleWeight_kg * Math.tan(angle_rad));
  return {
    vehicleWeight_kg, wheelbase_mm, liftHeight_mm, frontAxleWeight_rear_lifted_kg,
    estimatedCGHeight_mm: Math.round(Math.abs(cgHeight_mm)),
    estimatedCGHeight_in: Math.round(Math.abs(cgHeight_mm) / 25.4 * 10) / 10,
    tiltAngle_deg: Math.round(angle_rad * 57.3 * 10) / 10,
    accuracy: 'Approximate — proper testing requires level surface, accurate scales, and multiple measurements',
    note: 'CG height affects ALL dynamic behavior: lower is always better for grip and stability'
  };
}

// ── Weight Distribution Analysis ──

export function analyzeDistribution(frontWeight_kg, rearWeight_kg, layout, wheelbase_mm=2700) {
  const total = frontWeight_kg + rearWeight_kg;
  const frontPct = (frontWeight_kg / total) * 100;
  const rearPct = (rearWeight_kg / total) * 100;
  const layoutInfo = LAYOUT_TYPES[layout];
  const idealPct = layoutInfo ? layoutInfo.typicalFrontPct : 50;
  const deviation = frontPct - idealPct;
  const polarMoment_relative = (frontWeight_kg * Math.pow(rearPct / 100 * wheelbase_mm, 2) +
    rearWeight_kg * Math.pow(frontPct / 100 * wheelbase_mm, 2)) / (total * wheelbase_mm * wheelbase_mm);
  return {
    frontWeight_kg, rearWeight_kg, totalWeight_kg: total,
    frontDistribution_pct: Math.round(frontPct * 10) / 10,
    rearDistribution_pct: Math.round(rearPct * 10) / 10,
    ratio: `${Math.round(frontPct)}/${Math.round(rearPct)}`,
    layout: layoutInfo || { name: 'Custom' },
    idealForLayout_pct: idealPct,
    deviationFromIdeal_pct: Math.round(Math.abs(deviation) * 10) / 10,
    polarMomentIndex: Math.round(polarMoment_relative * 1000) / 1000,
    handling: frontPct > 55 ? 'Understeer tendency — front-heavy' :
      frontPct > 52 ? 'Mild understeer — stable, forgiving' :
      frontPct > 48 ? 'Neutral — ideal handling balance' :
      frontPct > 45 ? 'Mild oversteer — sporty, responsive' :
      'Oversteer tendency — rear-heavy, requires skill',
    recommendations: [
      Math.abs(deviation) > 5 ? `${deviation > 0 ? 'Move weight rearward' : 'Move weight forward'} — battery relocation, lighter components ${deviation > 0 ? 'front' : 'rear'}` : 'Distribution within ideal range for layout',
      polarMoment_relative > 0.3 ? 'High polar moment — heavy items far from center, sluggish rotation' : 'Good polar moment — mass concentrated near center',
      total > 1800 ? 'Consider weight reduction — lighter wheels, carbon panels, interior strip' : ''
    ].filter(Boolean)
  };
}

// ── Ballast Calculator ──

export function calcBallast(currentFront_kg, currentRear_kg, targetFrontPct, maxBallast_kg=50) {
  const total = currentFront_kg + currentRear_kg;
  const currentFrontPct = (currentFront_kg / total) * 100;
  let ballastFront_kg = 0, ballastRear_kg = 0;

  if (targetFrontPct > currentFrontPct) {
    // Need more front weight
    ballastFront_kg = (targetFrontPct / 100 * (total + maxBallast_kg) - currentFront_kg);
    ballastFront_kg = Math.min(Math.max(ballastFront_kg, 0), maxBallast_kg);
  } else {
    // Need more rear weight
    ballastRear_kg = (currentFront_kg - targetFrontPct / 100 * (total + maxBallast_kg));
    ballastRear_kg = Math.min(Math.max(ballastRear_kg, 0), maxBallast_kg);
  }

  const newFront = currentFront_kg + ballastFront_kg;
  const newRear = currentRear_kg + ballastRear_kg;
  const newTotal = newFront + newRear;
  const achievedFrontPct = (newFront / newTotal) * 100;

  return {
    current: { front_kg: currentFront_kg, rear_kg: currentRear_kg, frontPct: Math.round(currentFrontPct * 10) / 10 },
    target: { frontPct: targetFrontPct },
    ballast: {
      front_kg: Math.round(ballastFront_kg * 10) / 10,
      rear_kg: Math.round(ballastRear_kg * 10) / 10,
      total_kg: Math.round((ballastFront_kg + ballastRear_kg) * 10) / 10,
      location: ballastFront_kg > 0 ? 'Add ballast to front — under bumper, behind front axle' : 'Add ballast to rear — trunk, behind rear axle'
    },
    result: { front_kg: Math.round(newFront), rear_kg: Math.round(newRear), frontPct: Math.round(achievedFrontPct * 10) / 10 },
    note: ballastFront_kg + ballastRear_kg > 30 ? 'Significant ballast — consider relocating heavy components instead' : 'Reasonable ballast amount'
  };
}

// ── Payload / Towing Impact ──

export function calcPayloadEffect(vehicleWeight_kg, frontPct, payloadWeight_kg, payloadPosition_pct_from_front) {
  const origFront = vehicleWeight_kg * (frontPct / 100);
  const origRear = vehicleWeight_kg * (1 - frontPct / 100);
  const payloadFront = payloadWeight_kg * (payloadPosition_pct_from_front / 100);
  const payloadRear = payloadWeight_kg * (1 - payloadPosition_pct_from_front / 100);
  const newFront = origFront + payloadFront;
  const newRear = origRear + payloadRear;
  const newTotal = newFront + newRear;
  const newFrontPct = (newFront / newTotal) * 100;
  const weightIncrease_pct = (payloadWeight_kg / vehicleWeight_kg) * 100;
  return {
    empty: { weight_kg: vehicleWeight_kg, frontPct },
    payload: { weight_kg: payloadWeight_kg, position_pct_from_front: payloadPosition_pct_from_front },
    loaded: {
      totalWeight_kg: newTotal,
      frontWeight_kg: Math.round(newFront),
      rearWeight_kg: Math.round(newRear),
      frontPct: Math.round(newFrontPct * 10) / 10,
      weightIncrease_pct: Math.round(weightIncrease_pct)
    },
    balanceShift: Math.round((newFrontPct - frontPct) * 10) / 10,
    brakingEffect: `Stopping distance increases ~${Math.round(weightIncrease_pct)}% — brake earlier`,
    accelerationEffect: `0-100 time increases ~${Math.round(weightIncrease_pct * 0.8)}% — less responsive`,
    handlingNote: Math.abs(newFrontPct - frontPct) > 5 ? 'Significant balance change — adjust tire pressures and driving style' : 'Minor balance change — normal driving unaffected'
  };
}

// ── Power-to-Weight ──

export function calcPowerToWeight(power_hp, vehicleWeight_kg, driverWeight_kg=75) {
  const totalWeight = vehicleWeight_kg + driverWeight_kg;
  const hpPerTon = power_hp / (totalWeight / 1000);
  const kgPerHp = totalWeight / power_hp;
  const wPerKg = power_hp * 745.7 / totalWeight;
  // Rough 0-100 estimate: t ≈ 2.8 * weight/power (empirical for RWD)
  const est0_100 = 2.8 * totalWeight / (power_hp * 0.85); // 85% drivetrain efficiency
  return {
    power_hp, vehicleWeight_kg, driverWeight_kg, totalWeight_kg: totalWeight,
    hp_per_ton: Math.round(hpPerTon * 10) / 10,
    kg_per_hp: Math.round(kgPerHp * 10) / 10,
    w_per_kg: Math.round(wPerKg * 10) / 10,
    estimated_0_100_s: Math.round(est0_100 * 10) / 10,
    estimated_quarter_mile_s: Math.round((est0_100 * 1.35 + 4.5) * 10) / 10,
    category: hpPerTon > 500 ? 'Hypercar territory' :
      hpPerTon > 350 ? 'Supercar performance' :
      hpPerTon > 250 ? 'Sports car' :
      hpPerTon > 150 ? 'Hot hatch / warm sport sedan' :
      hpPerTon > 100 ? 'Average car' :
      hpPerTon > 60 ? 'Economy / city car' : 'Underpowered — consider power upgrades',
    tuningTip: kgPerHp > 8 ? 'Weight reduction gives better gains than more power at this ratio' :
      kgPerHp > 5 ? 'Both power gains and weight reduction equally effective' :
      'Power-rich — focus on traction, cooling, and aero rather than more power'
  };
}

// ── Weight Reduction Analyzer ──

export function analyzeWeightReduction(vehicleWeight_kg, power_hp, reductions) {
  // reductions: [{item, weight_kg, cost_eur?}]
  const totalReduction = reductions.reduce((sum, r) => sum + r.weight_kg, 0);
  const totalCost = reductions.reduce((sum, r) => sum + (r.cost_eur || 0), 0);
  const newWeight = vehicleWeight_kg - totalReduction;
  const origPW = calcPowerToWeight(power_hp, vehicleWeight_kg);
  const newPW = calcPowerToWeight(power_hp, newWeight);
  const hpEquivalent = power_hp * (vehicleWeight_kg / newWeight) - power_hp;
  return {
    originalWeight_kg: vehicleWeight_kg,
    totalReduction_kg: totalReduction,
    newWeight_kg: newWeight,
    reduction_pct: Math.round(totalReduction / vehicleWeight_kg * 1000) / 10,
    hpEquivalent: Math.round(hpEquivalent * 10) / 10,
    original_hp_per_ton: origPW.hp_per_ton,
    new_hp_per_ton: newPW.hp_per_ton,
    original_0_100_est: origPW.estimated_0_100_s,
    new_0_100_est: newPW.estimated_0_100_s,
    timeSaved_0_100: Math.round((origPW.estimated_0_100_s - newPW.estimated_0_100_s) * 100) / 100,
    costPerKg: totalCost > 0 ? Math.round(totalCost / totalReduction) : null,
    costPerHpEquivalent: totalCost > 0 && hpEquivalent > 0 ? Math.round(totalCost / hpEquivalent) : null,
    items: reductions.map(r => ({
      item: r.item, weight_kg: r.weight_kg, cost_eur: r.cost_eur || null,
      pctOfTotal: Math.round(r.weight_kg / totalReduction * 1000) / 10
    })),
    note: totalReduction > vehicleWeight_kg * 0.1 ? 'Aggressive reduction — verify structural integrity and safety' :
      totalReduction > vehicleWeight_kg * 0.05 ? 'Significant reduction — inspect affected areas for rigidity' :
      'Moderate reduction — should not affect structural integrity'
  };
}

// ── Query Functions ──

export function listWeightClasses() { return Object.entries(WEIGHT_CLASSES).map(([k, v]) => ({ key: k, ...v })); }
export function getWeightClass(key) { const w = WEIGHT_CLASSES[key]; return w ? { key, ...w } : null; }
export function searchWeightClasses(q) { const l = q.toLowerCase(); return listWeightClasses().filter(w => w.name.toLowerCase().includes(l) || (w.example || '').toLowerCase().includes(l)); }
export function listLayoutTypes() { return Object.entries(LAYOUT_TYPES).map(([k, v]) => ({ key: k, ...v })); }
export function getLayoutType(key) { const l = LAYOUT_TYPES[key]; return l ? { key, ...l } : null; }

export function weightDistCalcStats() {
  return {
    module: 'Weight Distribution & Load Transfer Calculator',
    weightClasses: Object.keys(WEIGHT_CLASSES).length,
    layoutTypes: Object.keys(LAYOUT_TYPES).length,
    calculations: ['calcLongitudinalTransfer', 'calcLateralTransfer', 'estimateCGHeight', 'analyzeDistribution', 'calcBallast', 'calcPayloadEffect', 'calcPowerToWeight', 'analyzeWeightReduction']
  };
}
