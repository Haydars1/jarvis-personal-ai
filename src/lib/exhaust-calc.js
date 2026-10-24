// Exhaust Flow & Downpipe Calculator
// Exhaust gas flow, pipe sizing, backpressure, catalytic converter flow, header design

// ─── Exhaust Gas Properties ─────────────────────────────────────────────

const EXHAUST_GAS = {
  gamma: 1.35,         // specific heat ratio
  R: 287,              // J/(kg·K)
  cp: 1.1,             // kJ/(kg·K) at typical exhaust temps
  rho_at_500C: 0.457,  // kg/m³ at 500°C 1atm
};

// ─── Pipe Sizes (common aftermarket) ─────────────────────────────────────

const PIPE_SIZES = {
  '2.0': { od_mm: 50.8, id_mm: 48.3, area_cm2: 18.3 },
  '2.25': { od_mm: 57.15, id_mm: 54.8, area_cm2: 23.6 },
  '2.5': { od_mm: 63.5, id_mm: 61.0, area_cm2: 29.2 },
  '2.75': { od_mm: 69.85, id_mm: 67.3, area_cm2: 35.6 },
  '3.0': { od_mm: 76.2, id_mm: 73.7, area_cm2: 42.6 },
  '3.5': { od_mm: 88.9, id_mm: 86.4, area_cm2: 58.6 },
  '4.0': { od_mm: 101.6, id_mm: 99.1, area_cm2: 77.1 },
  '5.0': { od_mm: 127.0, id_mm: 124.5, area_cm2: 121.7 },
};

// ─── Catalytic Converter Database ────────────────────────────────────────

const CAT_DATABASE = {
  'oem-small': { cellDensity: 400, length_mm: 120, diameter_mm: 100, substrate: 'ceramic', maxTemp_C: 1000, flowCapacity_hp: 250 },
  'oem-medium': { cellDensity: 400, length_mm: 150, diameter_mm: 120, substrate: 'ceramic', maxTemp_C: 1000, flowCapacity_hp: 350 },
  'oem-large': { cellDensity: 400, length_mm: 180, diameter_mm: 140, substrate: 'ceramic', maxTemp_C: 1000, flowCapacity_hp: 500 },
  'hjs-200cell': { cellDensity: 200, length_mm: 130, diameter_mm: 100, substrate: 'metallic', maxTemp_C: 1100, flowCapacity_hp: 500 },
  'hjs-200cell-large': { cellDensity: 200, length_mm: 130, diameter_mm: 130, substrate: 'metallic', maxTemp_C: 1100, flowCapacity_hp: 700 },
  'hjs-100cell': { cellDensity: 100, length_mm: 130, diameter_mm: 100, substrate: 'metallic', maxTemp_C: 1100, flowCapacity_hp: 700 },
  'hjs-100cell-large': { cellDensity: 100, length_mm: 130, diameter_mm: 130, substrate: 'metallic', maxTemp_C: 1100, flowCapacity_hp: 1000 },
  'vibrant-high-flow': { cellDensity: 200, length_mm: 150, diameter_mm: 100, substrate: 'metallic', maxTemp_C: 1050, flowCapacity_hp: 600 },
  'magnaflow-200cell': { cellDensity: 200, length_mm: 140, diameter_mm: 115, substrate: 'metallic', maxTemp_C: 1100, flowCapacity_hp: 650 },
  'gesi-gen2': { cellDensity: 300, length_mm: 100, diameter_mm: 100, substrate: 'metallic', maxTemp_C: 1050, flowCapacity_hp: 550 },
  'catless': { cellDensity: 0, length_mm: 0, diameter_mm: 0, substrate: 'none', maxTemp_C: 9999, flowCapacity_hp: 9999 },
};


// ─── Exhaust Gas Flow Calculation ────────────────────────────────────────

/**
 * Calculate exhaust gas mass flow and volume flow
 */
export function calcExhaustFlow(hp, afr = 14.7, bsfc = 0.50, exhaustTemp_C = 700) {
  const fuelFlow_kg_hr = (bsfc * hp * 0.4536); // convert lb to kg
  const airFlow_kg_hr = fuelFlow_kg_hr * afr;
  const totalFlow_kg_hr = airFlow_kg_hr + fuelFlow_kg_hr;
  const totalFlow_kg_s = totalFlow_kg_hr / 3600;

  const exhaustTemp_K = exhaustTemp_C + 273.15;
  const rho = 101325 / (EXHAUST_GAS.R * exhaustTemp_K); // density at exhaust temp
  const volumeFlow_m3_s = totalFlow_kg_s / rho;
  const volumeFlow_cfm = volumeFlow_m3_s * 2118.88;

  return {
    hp,
    afr,
    bsfc,
    exhaustTemp_C,
    fuelFlow_kg_hr: Math.round(fuelFlow_kg_hr * 100) / 100,
    airFlow_kg_hr: Math.round(airFlow_kg_hr * 100) / 100,
    totalMassFlow_kg_hr: Math.round(totalFlow_kg_hr * 100) / 100,
    totalMassFlow_kg_s: Math.round(totalFlow_kg_s * 1000) / 1000,
    exhaustDensity_kg_m3: Math.round(rho * 1000) / 1000,
    volumeFlow_m3_s: Math.round(volumeFlow_m3_s * 10000) / 10000,
    volumeFlow_cfm: Math.round(volumeFlow_cfm * 10) / 10,
  };
}


// ─── Pipe Sizing ─────────────────────────────────────────────────────────

/**
 * Recommend exhaust pipe diameter for target power
 */
export function sizeExhaustPipe(hp, numPipes = 1, exhaustTemp_C = 700, maxVelocity_m_s = 80) {
  const flow = calcExhaustFlow(hp, 14.7, 0.50, exhaustTemp_C);
  const flowPerPipe = flow.volumeFlow_m3_s / numPipes;

  // Required area = flow / max_velocity
  const requiredArea_m2 = flowPerPipe / maxVelocity_m_s;
  const requiredArea_cm2 = requiredArea_m2 * 10000;
  const requiredDiameter_mm = Math.sqrt(requiredArea_m2 * 4 / Math.PI) * 1000;
  const requiredDiameter_in = requiredDiameter_mm / 25.4;

  // Find matching pipe sizes
  const recommendations = Object.entries(PIPE_SIZES)
    .map(([size, data]) => {
      const velocity = flowPerPipe / (data.area_cm2 / 10000);
      let fit = 'GOOD';
      if (velocity > maxVelocity_m_s * 1.1) fit = 'TOO_SMALL';
      else if (velocity > maxVelocity_m_s * 0.9) fit = 'TIGHT';
      else if (velocity < maxVelocity_m_s * 0.5) fit = 'OVERSIZED';
      return {
        pipeSize_inches: size,
        od_mm: data.od_mm,
        id_mm: data.id_mm,
        area_cm2: data.area_cm2,
        gasVelocity_m_s: Math.round(velocity),
        fit,
      };
    })
    .filter(r => r.fit !== 'TOO_SMALL')
    .slice(0, 4);

  return {
    hp,
    numPipes,
    exhaustTemp_C,
    maxVelocity_m_s,
    exhaustFlow: flow,
    requiredDiameter_mm: Math.round(requiredDiameter_mm),
    requiredDiameter_in: Math.round(requiredDiameter_in * 100) / 100,
    requiredArea_cm2: Math.round(requiredArea_cm2 * 10) / 10,
    recommendations,
    tips: [
      'Larger pipes reduce backpressure but can reduce exhaust velocity and torque at low RPM',
      'Dual exhaust halves the flow per pipe — often allows smaller diameter',
      'Mandrel bends maintain constant ID through bends vs. crush bends',
      'Merge collectors should match combined pipe area',
    ],
  };
}


// ─── Backpressure Estimation ─────────────────────────────────────────────

/**
 * Estimate exhaust backpressure for a given setup
 */
export function calcBackpressure(hp, pipeDiameter_in, pipeLength_ft = 10, numBends = 3, hasCat = true, catType = 'oem-medium', hasMuffler = true) {
  const flow = calcExhaustFlow(hp);
  const pipe = PIPE_SIZES[String(pipeDiameter_in)];
  if (!pipe) return { error: `Unknown pipe size: ${pipeDiameter_in}". Available: ${Object.keys(PIPE_SIZES).join(', ')}` };

  const velocity = flow.volumeFlow_m3_s / (pipe.area_cm2 / 10000);
  const rho = flow.exhaustDensity_kg_m3;

  // Dynamic pressure
  const dynPressure = 0.5 * rho * velocity * velocity; // Pa

  // Friction losses (Darcy-Weisbach)
  const roughness = 0.045; // mm, typical steel
  const Re = rho * velocity * (pipe.id_mm / 1000) / 0.00004; // exhaust viscosity ~4e-5
  const f = 0.25 / Math.pow(Math.log10(roughness / (3.7 * pipe.id_mm) + 5.74 / Math.pow(Re, 0.9)), 2);
  const pipeLoss_Pa = f * (pipeLength_ft * 0.3048) / (pipe.id_mm / 1000) * dynPressure;

  // Bend losses
  const bendK = 0.3; // typical mandrel bend
  const bendLoss_Pa = numBends * bendK * dynPressure;

  // Catalytic converter pressure drop
  let catLoss_Pa = 0;
  if (hasCat) {
    const cat = CAT_DATABASE[catType] || CAT_DATABASE['oem-medium'];
    const cellFactor = cat.cellDensity / 200;
    catLoss_Pa = dynPressure * 2.5 * cellFactor * (cat.length_mm / 130);
  }

  // Muffler pressure drop
  const mufflerLoss_Pa = hasMuffler ? dynPressure * 1.5 : 0;

  const totalLoss_Pa = pipeLoss_Pa + bendLoss_Pa + catLoss_Pa + mufflerLoss_Pa;
  const totalLoss_psi = totalLoss_Pa / 6894.76;
  const totalLoss_inHg = totalLoss_Pa / 3386.39;

  let assessment = 'GOOD';
  if (totalLoss_psi > 3) assessment = 'HIGH';
  else if (totalLoss_psi > 5) assessment = 'EXCESSIVE';
  else if (totalLoss_psi > 1.5) assessment = 'MODERATE';
  else assessment = 'LOW';

  return {
    hp,
    pipeDiameter_in,
    pipeLength_ft,
    numBends,
    hasCat,
    catType: hasCat ? catType : 'none',
    hasMuffler,
    gasVelocity_m_s: Math.round(velocity),
    breakdown: {
      pipeFriction_Pa: Math.round(pipeLoss_Pa),
      bends_Pa: Math.round(bendLoss_Pa),
      catalyticConverter_Pa: Math.round(catLoss_Pa),
      muffler_Pa: Math.round(mufflerLoss_Pa),
    },
    totalBackpressure_Pa: Math.round(totalLoss_Pa),
    totalBackpressure_psi: Math.round(totalLoss_psi * 100) / 100,
    totalBackpressure_inHg: Math.round(totalLoss_inHg * 100) / 100,
    assessment,
    powerLoss_pct: Math.round(totalLoss_psi * 1.5 * 10) / 10, // ~1.5% per psi
  };
}


// ─── Header Design ──────────────────────────────────────────────────────

/**
 * Calculate header primary tube sizing
 */
export function calcHeaderSize(displacement_cc, numCylinders, peakPowerRPM = 6500, headerType = 'equal-length') {
  const displacementPerCylinder_cc = displacement_cc / numCylinders;
  const displacementPerCylinder_ci = displacementPerCylinder_cc / 16.387;

  // Primary tube diameter — empirical formula
  const primaryDiameter_in = Math.sqrt(displacementPerCylinder_ci / (peakPowerRPM * 0.00177));
  const primaryDiameter_mm = primaryDiameter_in * 25.4;

  // Primary tube length — tuned for peak power RPM
  // Based on acoustic tuning: L = (850 * ED) / RPM where ED is exhaust duration in degrees
  const exhaustDuration = 240; // typical degrees of exhaust valve open
  const primaryLength_in = (850 * exhaustDuration) / peakPowerRPM;
  const primaryLength_mm = primaryLength_in * 25.4;

  // Collector sizing
  const totalPrimaryArea = (Math.PI / 4) * Math.pow(primaryDiameter_in, 2) * numCylinders;
  const collectorDiameter_in = Math.sqrt(totalPrimaryArea * 4 / Math.PI) * 0.9; // 90% of combined primary area
  const collectorDiameter_mm = collectorDiameter_in * 25.4;

  return {
    displacement_cc,
    numCylinders,
    peakPowerRPM,
    headerType,
    primary: {
      diameter_in: Math.round(primaryDiameter_in * 100) / 100,
      diameter_mm: Math.round(primaryDiameter_mm),
      length_in: Math.round(primaryLength_in * 10) / 10,
      length_mm: Math.round(primaryLength_mm),
    },
    collector: {
      diameter_in: Math.round(collectorDiameter_in * 100) / 100,
      diameter_mm: Math.round(collectorDiameter_mm),
    },
    stepUp: headerType === 'stepped' ? {
      note: 'Stepped headers increase primary diameter 1/8" at 40% and 70% of primary length',
      step1_diameter_in: Math.round((primaryDiameter_in + 0.125) * 100) / 100,
      step2_diameter_in: Math.round((primaryDiameter_in + 0.25) * 100) / 100,
    } : null,
    antiReversion: {
      note: 'Anti-reversion chambers at the port prevent exhaust backflow',
      recommendedLength_mm: Math.round(primaryDiameter_mm * 0.5),
    },
    tips: [
      'Equal-length headers: best power across RPM range, critical for boxer/flat engines',
      'Tri-Y (4-2-1): broader torque curve, better mid-range than 4-1',
      '4-1 merge: best top-end power, narrower powerband',
      'Stepped headers: progressive diameter increase for scavenging effect',
      'Ceramic coating reduces under-hood heat and improves exhaust velocity',
    ],
  };
}


// ─── Catalytic Converter Sizing ──────────────────────────────────────────

/**
 * Size catalytic converter for target power
 */
export function sizeCat(targetHp, requirements = 'street') {
  const recommendations = Object.entries(CAT_DATABASE)
    .filter(([name, cat]) => {
      if (requirements === 'race' && name !== 'catless') return false;
      if (requirements === 'street' && name === 'catless') return false;
      return cat.flowCapacity_hp >= targetHp * 0.8;
    })
    .sort((a, b) => Math.abs(a[1].flowCapacity_hp - targetHp) - Math.abs(b[1].flowCapacity_hp - targetHp))
    .slice(0, 5)
    .map(([name, cat]) => {
      const headroom = ((cat.flowCapacity_hp - targetHp) / targetHp * 100);
      let fit = 'GOOD';
      if (headroom < 10) fit = 'TIGHT';
      else if (headroom < 0) fit = 'UNDERSIZED';
      else if (headroom > 100) fit = 'OVERSIZED';
      return {
        model: name,
        ...cat,
        flowHeadroom_pct: Math.round(headroom),
        fit,
      };
    });

  return {
    targetHp,
    requirements,
    recommendations,
  };
}


// ─── EGT Safety Check ───────────────────────────────────────────────────

/**
 * Exhaust Gas Temperature safety analysis
 */
export function checkEGT(egt_C, fuelType = 'gasoline') {
  const limits = {
    gasoline: { normal: 700, warning: 850, danger: 950, melt: 1050, turboMax: 1000 },
    diesel: { normal: 550, warning: 650, danger: 750, melt: 850, turboMax: 700 },
    e85: { normal: 650, warning: 800, danger: 900, melt: 1000, turboMax: 950 },
  };

  const limit = limits[fuelType] || limits.gasoline;
  let status, detail;

  if (egt_C < limit.normal) {
    status = 'NORMAL';
    detail = 'Operating within normal temperature range.';
  } else if (egt_C < limit.warning) {
    status = 'ELEVATED';
    detail = 'Temperature is elevated but within safe range. Monitor closely under sustained load.';
  } else if (egt_C < limit.danger) {
    status = 'WARNING';
    detail = 'Temperature is high. Enrichen mixture, reduce load, or improve cooling. Risk of component damage with sustained operation.';
  } else if (egt_C < limit.melt) {
    status = 'DANGER';
    detail = 'CRITICAL temperature! Immediate action required. Risk of turbo damage, manifold cracking, or catalyst meltdown.';
  } else {
    status = 'CATASTROPHIC';
    detail = 'BEYOND SAFE LIMITS. Shutdown immediately. Component failure imminent — turbo housing glow, manifold warp, catalyst destruction.';
  }

  return {
    egt_C,
    egt_F: Math.round(egt_C * 9 / 5 + 32),
    fuelType,
    limits: limit,
    status,
    detail,
    turboSafe: egt_C < limit.turboMax,
    catSafe: egt_C < 950,
    manifoldSafe: egt_C < limit.danger,
  };
}


// ─── Listing / Lookup ────────────────────────────────────────────────────

export function listPipeSizes() {
  return Object.entries(PIPE_SIZES).map(([size, data]) => ({ size_inches: size, ...data }));
}

export function listCats() {
  return Object.entries(CAT_DATABASE).map(([name, data]) => ({ name, ...data }));
}

export function getCat(name) {
  return CAT_DATABASE[name] || null;
}

export function exhaustCalcStats() {
  return {
    pipeSizes: Object.keys(PIPE_SIZES).length,
    catalyticConverters: Object.keys(CAT_DATABASE).length,
    calculations: ['exhaustFlow', 'pipeSize', 'backpressure', 'headerSize', 'catSizing', 'egtCheck'],
  };
}

export { PIPE_SIZES, CAT_DATABASE, EXHAUST_GAS };
