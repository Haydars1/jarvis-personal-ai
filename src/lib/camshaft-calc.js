// Camshaft Profile Analyzer
// Duration, lift, LSA, overlap, timing events, valve float RPM, cam comparison

// ─── Camshaft Profiles Database ──────────────────────────────────────────

const CAM_DATABASE = {
  // Stock / mild
  'stock-economy': { intake: { duration_at_050: 190, lift_mm: 8.5, centerline: 115 }, exhaust: { duration_at_050: 185, lift_mm: 8.0, centerline: 115 }, lsa: 115, type: 'stock', application: 'Economy / daily driver' },
  'stock-sport': { intake: { duration_at_050: 210, lift_mm: 9.5, centerline: 112 }, exhaust: { duration_at_050: 205, lift_mm: 9.0, centerline: 112 }, lsa: 112, type: 'stock', application: 'Sport / factory performance' },

  // Mild street
  'stage1-street': { intake: { duration_at_050: 218, lift_mm: 10.0, centerline: 112 }, exhaust: { duration_at_050: 214, lift_mm: 9.5, centerline: 112 }, lsa: 112, type: 'aftermarket', application: 'Mild street — bolt-on power gains, stock-like idle' },
  'stage2-street': { intake: { duration_at_050: 228, lift_mm: 10.8, centerline: 110 }, exhaust: { duration_at_050: 224, lift_mm: 10.3, centerline: 110 }, lsa: 110, type: 'aftermarket', application: 'Street/strip — noticeable idle lope, needs intake work' },

  // Aggressive street
  'stage3-aggressive': { intake: { duration_at_050: 240, lift_mm: 11.5, centerline: 108 }, exhaust: { duration_at_050: 236, lift_mm: 11.0, centerline: 108 }, lsa: 108, type: 'aftermarket', application: 'Aggressive street — rough idle, requires supporting mods' },
  'stage4-race-street': { intake: { duration_at_050: 252, lift_mm: 12.2, centerline: 107 }, exhaust: { duration_at_050: 248, lift_mm: 11.8, centerline: 107 }, lsa: 107, type: 'race', application: 'Race/street — lumpy idle, high RPM power band' },

  // Race
  'race-na': { intake: { duration_at_050: 265, lift_mm: 13.0, centerline: 106 }, exhaust: { duration_at_050: 260, lift_mm: 12.5, centerline: 106 }, lsa: 106, type: 'race', application: 'Race NA — aggressive profile, poor idle, high RPM' },
  'race-turbo': { intake: { duration_at_050: 272, lift_mm: 12.5, centerline: 110 }, exhaust: { duration_at_050: 268, lift_mm: 12.0, centerline: 110 }, lsa: 110, type: 'race', application: 'Race turbo — wide LSA for boost control, long duration' },
  'drag-na': { intake: { duration_at_050: 285, lift_mm: 14.0, centerline: 105 }, exhaust: { duration_at_050: 280, lift_mm: 13.5, centerline: 105 }, lsa: 105, type: 'race', application: 'Drag race — extreme duration, very rough idle' },

  // VTEC / variable
  'vtec-lo': { intake: { duration_at_050: 195, lift_mm: 8.0, centerline: 117 }, exhaust: { duration_at_050: 190, lift_mm: 7.5, centerline: 117 }, lsa: 117, type: 'stock', application: 'VTEC low cam — economy and emissions' },
  'vtec-hi': { intake: { duration_at_050: 240, lift_mm: 11.5, centerline: 105 }, exhaust: { duration_at_050: 235, lift_mm: 10.5, centerline: 105 }, lsa: 105, type: 'stock', application: 'VTEC high cam — performance' },

  // Turbo specific
  'turbo-mild': { intake: { duration_at_050: 210, lift_mm: 9.5, centerline: 114 }, exhaust: { duration_at_050: 218, lift_mm: 9.8, centerline: 114 }, lsa: 114, type: 'aftermarket', application: 'Turbo mild — wide LSA for spool, low overlap' },
  'turbo-aggressive': { intake: { duration_at_050: 240, lift_mm: 11.0, centerline: 112 }, exhaust: { duration_at_050: 248, lift_mm: 11.5, centerline: 112 }, lsa: 112, type: 'aftermarket', application: 'Turbo aggressive — longer exhaust for scavenging' },
};


// ─── Valve Timing Events ─────────────────────────────────────────────────

/**
 * Calculate valve timing events from cam specs
 */
export function calcTimingEvents(intake_duration, intake_centerline, exhaust_duration, exhaust_centerline) {
  // Intake
  const ivo = intake_centerline - (intake_duration / 2); // degrees BTDC
  const ivc = intake_duration - (180 - ivo); // degrees ABDC

  // Exhaust
  const evc = exhaust_centerline - (exhaust_duration / 2); // degrees ATDC
  const evo = exhaust_duration - (180 - evc); // degrees BBDC

  // Overlap
  const overlap = ivo + evc;

  // LSA
  const lsa = (intake_centerline + exhaust_centerline) / 2;

  // Advance/retard
  const installed_centerline = intake_centerline;
  const advance = lsa - installed_centerline;

  return {
    intake: {
      duration_at_050: intake_duration,
      centerline: intake_centerline,
      opens_BTDC: Math.round(ivo * 10) / 10,
      closes_ABDC: Math.round(ivc * 10) / 10,
    },
    exhaust: {
      duration_at_050: exhaust_duration,
      centerline: exhaust_centerline,
      opens_BBDC: Math.round(evo * 10) / 10,
      closes_ATDC: Math.round(evc * 10) / 10,
    },
    overlap_degrees: Math.round(overlap * 10) / 10,
    lsa: Math.round(lsa * 10) / 10,
    advance_degrees: Math.round(advance * 10) / 10,
    overlapAssessment: assessOverlap(overlap),
  };
}

function assessOverlap(overlap) {
  if (overlap < 5) return { status: 'MINIMAL', detail: 'Very little overlap — good idle vacuum, emissions friendly, suited for turbo or daily driving' };
  if (overlap < 20) return { status: 'MILD', detail: 'Mild overlap — good drivability, mild idle quality decrease' };
  if (overlap < 40) return { status: 'MODERATE', detail: 'Moderate overlap — noticeable idle lope, improved top-end at cost of low-end' };
  if (overlap < 60) return { status: 'AGGRESSIVE', detail: 'Aggressive overlap — rough idle, significant scavenging effect, poor vacuum' };
  return { status: 'EXTREME', detail: 'Extreme overlap — racing only, very poor idle and vacuum, maximum scavenging' };
}


// ─── Valve Float RPM Estimate ────────────────────────────────────────────

/**
 * Estimate valve float RPM
 */
export function calcValveFloat(lift_mm, springRate_N_mm, installedPreload_N, valveMass_g, retainerMass_g, springMass_g, followerType = 'roller') {
  const totalMass_kg = (valveMass_g + retainerMass_g + (springMass_g / 3)) / 1000; // 1/3 spring mass effective
  const followerFactor = followerType === 'roller' ? 1.0 : 0.9; // flat tappet less RPM headroom

  const lift_m = lift_mm / 1000;
  const maxForce = installedPreload_N + (springRate_N_mm * lift_mm);

  // Simplified valve float speed estimate
  // Based on natural frequency of valve/spring system
  const naturalFreq = Math.sqrt(springRate_N_mm * 1000 / totalMass_kg) / (2 * Math.PI); // Hz
  const floatRPM_estimate = naturalFreq * 60 / 2 * followerFactor; // /2 for valve event = half crank revolution (on 4-stroke)

  return {
    lift_mm,
    springRate_N_mm,
    installedPreload_N,
    openForce_N: Math.round(maxForce),
    valveMass_g,
    retainerMass_g,
    effectiveSpringMass_g: Math.round(springMass_g / 3),
    totalEffectiveMass_g: Math.round(totalMass_kg * 1000),
    followerType,
    naturalFrequency_Hz: Math.round(naturalFreq),
    estimatedFloatRPM: Math.round(floatRPM_estimate / 100) * 100,
    safeMaxRPM: Math.round(floatRPM_estimate * 0.85 / 100) * 100,
    note: 'Estimated valve float RPM with 15% safety margin. Actual float depends on cam lobe acceleration rate, oil temperature, and spring fatigue.',
    upgradeSuggestions: [
      'Titanium retainers: reduce mass 40-50%, increase float RPM ~15%',
      'Beehive springs: progressive rate, lighter, better at high RPM',
      'Dual springs: higher total spring rate for extreme applications',
      'Lightweight valves (hollow/sodium): reduce mass 15-25%',
    ],
  };
}


// ─── Cam Comparison ──────────────────────────────────────────────────────

/**
 * Compare two camshaft profiles
 */
export function compareCams(cam1Name, cam2Name) {
  const c1 = CAM_DATABASE[cam1Name];
  const c2 = CAM_DATABASE[cam2Name];
  if (!c1) return { error: `Cam not found: ${cam1Name}` };
  if (!c2) return { error: `Cam not found: ${cam2Name}` };

  const t1 = calcTimingEvents(c1.intake.duration_at_050, c1.intake.centerline, c1.exhaust.duration_at_050, c1.exhaust.centerline);
  const t2 = calcTimingEvents(c2.intake.duration_at_050, c2.intake.centerline, c2.exhaust.duration_at_050, c2.exhaust.centerline);

  return {
    cam1: { name: cam1Name, ...c1, timingEvents: t1 },
    cam2: { name: cam2Name, ...c2, timingEvents: t2 },
    differences: {
      intakeDuration: c2.intake.duration_at_050 - c1.intake.duration_at_050,
      exhaustDuration: c2.exhaust.duration_at_050 - c1.exhaust.duration_at_050,
      intakeLift: Math.round((c2.intake.lift_mm - c1.intake.lift_mm) * 10) / 10,
      exhaustLift: Math.round((c2.exhaust.lift_mm - c1.exhaust.lift_mm) * 10) / 10,
      lsa: Math.round((c2.lsa - c1.lsa) * 10) / 10,
      overlap: Math.round((t2.overlap_degrees - t1.overlap_degrees) * 10) / 10,
    },
    assessment: {
      moreDuration: c2.intake.duration_at_050 > c1.intake.duration_at_050
        ? `${cam2Name} has more duration — higher RPM power band, less idle quality`
        : `${cam1Name} has more duration — higher RPM power band, less idle quality`,
      moreLift: c2.intake.lift_mm > c1.intake.lift_mm
        ? `${cam2Name} has more lift — requires spring upgrade verification`
        : `${cam1Name} has more lift — requires spring upgrade verification`,
      overlapDiff: Math.abs(t2.overlap_degrees - t1.overlap_degrees) > 10
        ? 'Significant overlap difference — will noticeably affect idle and vacuum'
        : 'Similar overlap — drivability difference will be moderate',
    },
  };
}


// ─── Cam Recommendation ─────────────────────────────────────────────────

/**
 * Recommend cam profile for application
 */
export function recommendCam(application = 'street', forced_induction = false, targetRPM = 6500) {
  const scored = Object.entries(CAM_DATABASE).map(([name, cam]) => {
    let score = 0;

    if (application === 'daily') {
      if (cam.intake.duration_at_050 < 220) score += 30;
      if (cam.lsa >= 112) score += 20;
      if (cam.type === 'stock') score += 10;
    } else if (application === 'street') {
      if (cam.intake.duration_at_050 >= 210 && cam.intake.duration_at_050 <= 240) score += 30;
      if (cam.lsa >= 108 && cam.lsa <= 114) score += 20;
    } else if (application === 'street-strip') {
      if (cam.intake.duration_at_050 >= 230 && cam.intake.duration_at_050 <= 260) score += 30;
      if (cam.lsa >= 106 && cam.lsa <= 112) score += 20;
    } else if (application === 'race') {
      if (cam.intake.duration_at_050 >= 250) score += 30;
      if (cam.lsa <= 108) score += 20;
      if (cam.type === 'race') score += 15;
    }

    if (forced_induction) {
      if (cam.lsa >= 110) score += 15; // wide LSA for boost
      if (cam.exhaust.duration_at_050 >= cam.intake.duration_at_050) score += 10; // longer exhaust for scavenging
      if (name.includes('turbo')) score += 20;
    }

    // RPM target matching
    const estimatedPeakRPM = 4500 + (cam.intake.duration_at_050 - 190) * 30;
    if (Math.abs(estimatedPeakRPM - targetRPM) < 500) score += 15;
    else if (Math.abs(estimatedPeakRPM - targetRPM) < 1000) score += 8;

    return { name, ...cam, score, estimatedPeakRPM: Math.round(estimatedPeakRPM) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    application,
    forced_induction,
    targetRPM,
    recommendations: scored,
  };
}


// ─── Listings ────────────────────────────────────────────────────────────

export function listCams() {
  return Object.entries(CAM_DATABASE).map(([name, cam]) => ({ name, ...cam }));
}

export function getCam(name) {
  return CAM_DATABASE[name] || null;
}

export function searchCams(query) {
  const q = query.toLowerCase();
  return Object.entries(CAM_DATABASE)
    .filter(([name, cam]) =>
      name.toLowerCase().includes(q) ||
      cam.application.toLowerCase().includes(q) ||
      cam.type.toLowerCase().includes(q)
    )
    .map(([name, cam]) => ({ name, ...cam }));
}

export function camCalcStats() {
  return {
    camProfiles: Object.keys(CAM_DATABASE).length,
    calculations: ['timingEvents', 'valveFloat', 'camCompare', 'camRecommend'],
  };
}

export { CAM_DATABASE };
