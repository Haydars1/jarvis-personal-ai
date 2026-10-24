// Drivetrain Loss Calculator
// Gear ratios, final drive, tire size, speed vs RPM, wheel HP vs crank HP, 0-100 estimate

// ─── Common Transmission Database ────────────────────────────────────────

const TRANSMISSION_DATABASE = {
  // Manual
  'getrag-6mt-bmw': { name: 'Getrag 6MT (BMW)', type: 'manual', gears: [4.110, 2.315, 1.542, 1.179, 1.000, 0.846], finalDrive: 3.46, loss_pct: 12, application: 'BMW 3/5 Series, Z4' },
  'tremec-t56': { name: 'Tremec T56', type: 'manual', gears: [2.97, 2.07, 1.43, 1.00, 0.80, 0.62], finalDrive: 3.73, loss_pct: 12, application: 'Corvette, Camaro, Mustang, Viper' },
  'tremec-tr6060': { name: 'Tremec TR-6060', type: 'manual', gears: [2.66, 1.78, 1.30, 1.00, 0.80, 0.63], finalDrive: 3.73, loss_pct: 12, application: 'Camaro SS, CTS-V, GT500' },
  'aisin-aw6': { name: 'Aisin AW6 (Toyota)', type: 'manual', gears: [3.538, 2.060, 1.404, 1.000, 0.854, 0.725], finalDrive: 4.10, loss_pct: 11, application: 'Toyota 86, Supra, various' },
  'honda-k-series-6mt': { name: 'Honda K-Series 6MT', type: 'manual', gears: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738], finalDrive: 4.39, loss_pct: 11, application: 'Civic Type R, Integra, S2000' },
  'vw-dq250-6mt': { name: 'VW 02Q 6MT', type: 'manual', gears: [3.778, 2.118, 1.360, 0.971, 0.756, 0.610], finalDrive: 3.65, loss_pct: 12, application: 'Golf GTI, A3, Leon' },
  'nissan-cd009': { name: 'Nissan CD009 6MT', type: 'manual', gears: [3.794, 2.324, 1.624, 1.271, 1.000, 0.794], finalDrive: 3.54, loss_pct: 12, application: '350Z, 370Z' },

  // Automatic / DCT
  'zf-8hp': { name: 'ZF 8HP', type: 'torque-converter', gears: [4.714, 3.143, 2.106, 1.667, 1.285, 1.000, 0.839, 0.667], finalDrive: 3.15, loss_pct: 15, application: 'BMW, Audi, Chrysler, Rolls-Royce' },
  'zf-8hp-sport': { name: 'ZF 8HP Sport Tune', type: 'torque-converter', gears: [4.714, 3.143, 2.106, 1.667, 1.285, 1.000, 0.839, 0.667], finalDrive: 3.46, loss_pct: 14, application: 'BMW M, Audi RS, Maserati' },
  'vw-dsg-dq381': { name: 'VW DSG DQ381 7-spd', type: 'dct', gears: [3.765, 2.273, 1.531, 1.133, 1.176, 0.905, 0.695], finalDrive: 3.44, loss_pct: 10, application: 'Golf R, S3, TT-S' },
  'vw-dsg-dq500': { name: 'VW DSG DQ500 7-spd', type: 'dct', gears: [3.500, 2.087, 1.343, 0.933, 1.029, 0.837, 0.657], finalDrive: 4.77, loss_pct: 10, application: 'RS3, TTRS, Golf R (high torque)' },
  'porsche-pdk': { name: 'Porsche PDK 7-spd', type: 'dct', gears: [3.91, 2.29, 1.58, 1.18, 0.94, 0.79, 0.62], finalDrive: 3.44, loss_pct: 9, application: '911, Cayman, Boxster, Panamera' },
  'nissan-jatco-cvt': { name: 'Nissan Jatco CVT', type: 'cvt', gears: [2.631, 0.378], finalDrive: 5.56, loss_pct: 18, application: 'Nissan Sentra, Altima, Rogue' },
  'gm-10l90': { name: 'GM 10L90 10-spd', type: 'torque-converter', gears: [4.70, 2.99, 2.15, 1.77, 1.52, 1.28, 1.00, 0.85, 0.69, 0.64], finalDrive: 3.73, loss_pct: 14, application: 'Camaro ZL1, Corvette C7, Escalade' },
  'ford-10r80': { name: 'Ford 10R80 10-spd', type: 'torque-converter', gears: [4.696, 2.985, 2.146, 1.769, 1.520, 1.275, 1.000, 0.854, 0.689, 0.636], finalDrive: 3.73, loss_pct: 14, application: 'Mustang GT, F-150, Raptor' },
};


// ─── Common Tire Sizes ──────────────────────────────────────────────────

const TIRE_DATABASE = {
  '205/55R16': { width: 205, aspect: 55, rim: 16 },
  '215/45R17': { width: 215, aspect: 45, rim: 17 },
  '225/40R18': { width: 225, aspect: 40, rim: 18 },
  '225/45R17': { width: 225, aspect: 45, rim: 17 },
  '235/35R19': { width: 235, aspect: 35, rim: 19 },
  '235/40R18': { width: 235, aspect: 40, rim: 18 },
  '245/35R19': { width: 245, aspect: 35, rim: 19 },
  '245/40R18': { width: 245, aspect: 40, rim: 18 },
  '255/35R18': { width: 255, aspect: 35, rim: 18 },
  '265/35R18': { width: 265, aspect: 35, rim: 18 },
  '275/30R20': { width: 275, aspect: 30, rim: 20 },
  '275/35R19': { width: 275, aspect: 35, rim: 19 },
  '285/30R20': { width: 285, aspect: 30, rim: 20 },
  '295/30R19': { width: 295, aspect: 30, rim: 19 },
  '305/30R20': { width: 305, aspect: 30, rim: 20 },
  '315/30R20': { width: 315, aspect: 30, rim: 20 },
  '335/25R20': { width: 335, aspect: 25, rim: 20 },
};


// ─── Tire Diameter ──────────────────────────────────────────────────────

function tireDiameter_mm(width, aspect, rim) {
  const sidewall = width * (aspect / 100);
  return (rim * 25.4) + (2 * sidewall);
}

function tireCircumference_m(width, aspect, rim) {
  return Math.PI * tireDiameter_mm(width, aspect, rim) / 1000;
}


// ─── Drivetrain Loss ────────────────────────────────────────────────────

const DRIVETRAIN_LOSS = {
  'fwd-manual': { loss_pct: 10, description: 'FWD Manual — minimal parasitic loss' },
  'fwd-auto': { loss_pct: 14, description: 'FWD Automatic — torque converter losses' },
  'fwd-dct': { loss_pct: 8, description: 'FWD DCT — low parasitic, no converter' },
  'rwd-manual': { loss_pct: 12, description: 'RWD Manual — longer driveshaft + diff' },
  'rwd-auto': { loss_pct: 15, description: 'RWD Automatic — converter + long drivetrain' },
  'rwd-dct': { loss_pct: 10, description: 'RWD DCT — efficient but long drivetrain' },
  'awd-manual': { loss_pct: 18, description: 'AWD Manual — transfer case + two diffs' },
  'awd-auto': { loss_pct: 22, description: 'AWD Automatic — highest parasitic losses' },
  'awd-dct': { loss_pct: 15, description: 'AWD DCT — transfer case but no converter' },
};


// ─── Calculations ───────────────────────────────────────────────────────

/**
 * Calculate speed at given RPM for each gear
 */
export function calcSpeedAtRPM(gears, finalDrive, tireWidth, tireAspect, tireRim, rpm) {
  const circ = tireCircumference_m(tireWidth, tireAspect, tireRim);
  const tireDia = tireDiameter_mm(tireWidth, tireAspect, tireRim);

  return {
    rpm,
    tireDiameter_mm: Math.round(tireDia),
    tireCircumference_m: Math.round(circ * 1000) / 1000,
    gears: gears.map((ratio, i) => {
      const totalRatio = ratio * finalDrive;
      const wheelRPM = rpm / totalRatio;
      const speed_kmh = wheelRPM * circ * 60 / 1000;
      const speed_mph = speed_kmh / 1.60934;
      return {
        gear: i + 1,
        ratio,
        totalRatio: Math.round(totalRatio * 1000) / 1000,
        speed_kmh: Math.round(speed_kmh * 10) / 10,
        speed_mph: Math.round(speed_mph * 10) / 10,
        wheelRPM: Math.round(wheelRPM),
      };
    }),
  };
}

/**
 * Calculate RPM at given speed for each gear
 */
export function calcRPMAtSpeed(gears, finalDrive, tireWidth, tireAspect, tireRim, speed_kmh) {
  const circ = tireCircumference_m(tireWidth, tireAspect, tireRim);

  return {
    speed_kmh,
    speed_mph: Math.round(speed_kmh / 1.60934 * 10) / 10,
    gears: gears.map((ratio, i) => {
      const totalRatio = ratio * finalDrive;
      const wheelRPM = (speed_kmh * 1000) / (circ * 60);
      const engineRPM = wheelRPM * totalRatio;
      return {
        gear: i + 1,
        ratio,
        totalRatio: Math.round(totalRatio * 1000) / 1000,
        engineRPM: Math.round(engineRPM),
        inPowerBand: engineRPM >= 2500 && engineRPM <= 7000,
      };
    }),
  };
}

/**
 * Calculate wheel HP from crank HP
 */
export function calcWheelHP(crankHP, drivetrainType = 'rwd-manual', customLoss_pct = null) {
  const loss = customLoss_pct !== null ? customLoss_pct : (DRIVETRAIN_LOSS[drivetrainType]?.loss_pct || 15);
  const wheelHP = crankHP * (1 - loss / 100);
  const lostHP = crankHP - wheelHP;

  return {
    crankHP,
    drivetrainType,
    loss_pct: loss,
    wheelHP: Math.round(wheelHP * 10) / 10,
    lostHP: Math.round(lostHP * 10) / 10,
    wheelHP_kw: Math.round(wheelHP * 0.7457 * 10) / 10,
    wheelHP_ps: Math.round(wheelHP * 1.01387 * 10) / 10,
    note: DRIVETRAIN_LOSS[drivetrainType]?.description || 'Custom loss percentage',
  };
}

/**
 * Estimate crank HP from dyno wheel HP
 */
export function estimateCrankHP(wheelHP, drivetrainType = 'rwd-manual', customLoss_pct = null) {
  const loss = customLoss_pct !== null ? customLoss_pct : (DRIVETRAIN_LOSS[drivetrainType]?.loss_pct || 15);
  const crankHP = wheelHP / (1 - loss / 100);

  return {
    wheelHP,
    drivetrainType,
    loss_pct: loss,
    estimatedCrankHP: Math.round(crankHP * 10) / 10,
    estimatedCrankHP_kw: Math.round(crankHP * 0.7457 * 10) / 10,
    estimatedCrankHP_ps: Math.round(crankHP * 1.01387 * 10) / 10,
    note: 'Estimated — actual losses vary with temperature, drivetrain condition, and load',
  };
}

/**
 * Full gear ratio analysis
 */
export function analyzeGearRatios(gears, finalDrive) {
  const drops = [];
  for (let i = 1; i < gears.length; i++) {
    const drop = ((gears[i - 1] - gears[i]) / gears[i - 1]) * 100;
    drops.push({ from: i, to: i + 1, drop_pct: Math.round(drop * 10) / 10 });
  }

  const overallRatio = gears[0] / gears[gears.length - 1];
  const overallDriveRatio = gears[0] * finalDrive;
  const highGearCruise = gears[gears.length - 1] * finalDrive;

  return {
    gearCount: gears.length,
    gears: gears.map((r, i) => ({ gear: i + 1, ratio: r, totalRatio: Math.round(r * finalDrive * 1000) / 1000 })),
    finalDrive,
    gearDrops: drops,
    overallSpread: Math.round(overallRatio * 100) / 100,
    firstGearTotalRatio: Math.round(overallDriveRatio * 1000) / 1000,
    topGearTotalRatio: Math.round(highGearCruise * 1000) / 1000,
    avgDrop_pct: Math.round(drops.reduce((a, d) => a + d.drop_pct, 0) / drops.length * 10) / 10,
    assessment: drops.some(d => d.drop_pct > 35)
      ? 'WARNING: Large gear drop detected — RPM will fall significantly, may cause turbo lag or leave the power band'
      : 'Even gear spacing — smooth power delivery across shifts',
  };
}

/**
 * Estimate 0-100 km/h (simplified model)
 */
export function estimate0to100(crankHP, weight_kg, drivetrainType = 'rwd-manual', tireType = 'summer') {
  const loss = DRIVETRAIN_LOSS[drivetrainType]?.loss_pct || 15;
  const wheelHP = crankHP * (1 - loss / 100);
  const wheelKW = wheelHP * 0.7457;
  const pwRatio = wheelKW / weight_kg * 1000; // W/kg

  // Grip factor
  const gripFactor = { 'summer': 1.0, 'all-season': 1.05, 'winter': 1.15, 'semi-slick': 0.92, 'slick': 0.85 };
  const grip = gripFactor[tireType] || 1.0;

  // AWD launch advantage
  const launchFactor = drivetrainType.startsWith('awd') ? 0.88 : 1.0;

  // Simplified physics-based estimate
  // Using empirical: t ≈ 3.5 × sqrt(weight/wheelHP) × corrections
  const t_base = 3.5 * Math.sqrt(weight_kg / wheelHP);
  const t_corrected = t_base * grip * launchFactor;

  return {
    crankHP,
    wheelHP: Math.round(wheelHP),
    weight_kg,
    powerToWeight_hp_per_ton: Math.round(wheelHP / weight_kg * 1000),
    drivetrainType,
    tireType,
    estimated_0_100_kmh_seconds: Math.round(t_corrected * 100) / 100,
    estimated_0_60_mph_seconds: Math.round(t_corrected * 0.95 * 100) / 100,
    estimated_quarter_mile_seconds: Math.round(t_corrected * 2.75 * 100) / 100,
    estimated_quarter_mile_mph: Math.round(234 * Math.pow(wheelHP / weight_kg, 0.3333)),
    note: 'Simplified estimate — real results depend on launch technique, traction, altitude, temperature',
    factors: {
      drivetrainLoss_pct: loss,
      gripMultiplier: grip,
      launchAdvantage: launchFactor,
    },
  };
}

/**
 * Calculate max speed in each gear
 */
export function calcMaxSpeeds(gears, finalDrive, tireWidth, tireAspect, tireRim, redlineRPM, crankHP, dragCoeff = 0.32, frontalArea_m2 = 2.2, weight_kg = 1500) {
  const circ = tireCircumference_m(tireWidth, tireAspect, tireRim);

  // Aerodynamic top speed estimate (drag limited)
  const rho = 1.225; // air density kg/m3
  const crankHP_watts = crankHP * 745.7;
  const aeroTopSpeed_ms = Math.pow((2 * crankHP_watts) / (rho * dragCoeff * frontalArea_m2), 1 / 3);
  const aeroTopSpeed_kmh = aeroTopSpeed_ms * 3.6;

  const gearSpeeds = gears.map((ratio, i) => {
    const totalRatio = ratio * finalDrive;
    const wheelRPM = redlineRPM / totalRatio;
    const speed_kmh = wheelRPM * circ * 60 / 1000;
    const gearLimited = speed_kmh < aeroTopSpeed_kmh;
    return {
      gear: i + 1,
      ratio,
      maxSpeed_kmh: Math.round(Math.min(speed_kmh, aeroTopSpeed_kmh)),
      maxSpeed_mph: Math.round(Math.min(speed_kmh, aeroTopSpeed_kmh) / 1.60934),
      gearLimited,
      rpmAtMax: gearLimited ? redlineRPM : Math.round(aeroTopSpeed_kmh * 1000 / (circ * 60) * totalRatio),
    };
  });

  return {
    redlineRPM,
    crankHP,
    dragCoefficient: dragCoeff,
    frontalArea_m2: frontalArea_m2,
    aeroTopSpeed_kmh: Math.round(aeroTopSpeed_kmh),
    aeroTopSpeed_mph: Math.round(aeroTopSpeed_kmh / 1.60934),
    gearSpeeds,
    trueTopSpeed_kmh: Math.round(Math.min(gearSpeeds[gearSpeeds.length - 1].maxSpeed_kmh, aeroTopSpeed_kmh)),
  };
}


// ─── Listings ───────────────────────────────────────────────────────────

export function listTransmissions() {
  return Object.entries(TRANSMISSION_DATABASE).map(([name, t]) => ({ name, ...t }));
}

export function getTransmission(name) {
  return TRANSMISSION_DATABASE[name] || null;
}

export function searchTransmissions(query) {
  const q = query.toLowerCase();
  return Object.entries(TRANSMISSION_DATABASE)
    .filter(([name, t]) => name.includes(q) || t.name.toLowerCase().includes(q) || t.application.toLowerCase().includes(q) || t.type.includes(q))
    .map(([name, t]) => ({ name, ...t }));
}

export function listTireSizes() {
  return Object.entries(TIRE_DATABASE).map(([name, t]) => ({ name, ...t, diameter_mm: Math.round(tireDiameter_mm(t.width, t.aspect, t.rim)) }));
}

export function listDrivetrainTypes() {
  return Object.entries(DRIVETRAIN_LOSS).map(([name, d]) => ({ name, ...d }));
}

export function drivetrainCalcStats() {
  return {
    transmissions: Object.keys(TRANSMISSION_DATABASE).length,
    tireSizes: Object.keys(TIRE_DATABASE).length,
    drivetrainTypes: Object.keys(DRIVETRAIN_LOSS).length,
    calculations: ['speedAtRPM', 'rpmAtSpeed', 'wheelHP', 'crankHP', 'gearAnalysis', '0to100', 'maxSpeeds'],
  };
}

export { TRANSMISSION_DATABASE, TIRE_DATABASE, DRIVETRAIN_LOSS };
