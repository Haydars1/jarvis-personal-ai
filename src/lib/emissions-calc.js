// ─── emissions-calc.js ── Emissions & Environmental Compliance Calculator ───
// Module #37 — CO2, NOx, HC, CO, PM estimation, emissions standards compliance,
// catalyst efficiency, EGR impact, lambda-based emission modeling
// Pure JS, zero deps, Cloudflare Workers ESM

export const EMISSION_STANDARDS = {
  euro1:  { year:1992, co_gPerKm:2.72, hc_nox_gPerKm:0.97, pm_gPerKm:0.14, nox_gPerKm:null, name:'Euro 1', region:'EU' },
  euro2:  { year:1996, co_gPerKm:1.0,  hc_nox_gPerKm:0.70, pm_gPerKm:0.08, nox_gPerKm:null, name:'Euro 2', region:'EU' },
  euro3:  { year:2000, co_gPerKm:0.64, hc_nox_gPerKm:null, pm_gPerKm:0.05, nox_gPerKm:0.50, hc_gPerKm:0.20, name:'Euro 3', region:'EU' },
  euro4:  { year:2005, co_gPerKm:0.50, hc_nox_gPerKm:null, pm_gPerKm:0.025, nox_gPerKm:0.25, hc_gPerKm:0.10, name:'Euro 4', region:'EU' },
  euro5:  { year:2009, co_gPerKm:0.50, hc_nox_gPerKm:null, pm_gPerKm:0.005, nox_gPerKm:0.18, hc_gPerKm:0.10, name:'Euro 5', region:'EU' },
  euro6:  { year:2014, co_gPerKm:0.50, hc_nox_gPerKm:null, pm_gPerKm:0.005, nox_gPerKm:0.08, hc_gPerKm:0.10, name:'Euro 6', region:'EU' },
  euro6d: { year:2020, co_gPerKm:0.50, hc_nox_gPerKm:null, pm_gPerKm:0.0045, nox_gPerKm:0.06, hc_gPerKm:0.10, name:'Euro 6d', region:'EU' },
  euro7:  { year:2025, co_gPerKm:0.50, hc_nox_gPerKm:null, pm_gPerKm:0.003, nox_gPerKm:0.06, hc_gPerKm:0.10, name:'Euro 7', region:'EU' },
  // Diesel variants
  euro3d: { year:2000, co_gPerKm:0.64, pm_gPerKm:0.05, nox_gPerKm:0.50, name:'Euro 3 Diesel', region:'EU', fuel:'diesel' },
  euro4d: { year:2005, co_gPerKm:0.50, pm_gPerKm:0.025, nox_gPerKm:0.25, name:'Euro 4 Diesel', region:'EU', fuel:'diesel' },
  euro5d: { year:2009, co_gPerKm:0.50, pm_gPerKm:0.005, nox_gPerKm:0.18, name:'Euro 5 Diesel', region:'EU', fuel:'diesel' },
  euro6d_diesel: { year:2014, co_gPerKm:0.50, pm_gPerKm:0.005, nox_gPerKm:0.08, name:'Euro 6 Diesel', region:'EU', fuel:'diesel' },
  // US
  tier1:  { year:1994, co_gPerMi:3.4, nox_gPerMi:0.4, hc_gPerMi:0.25, name:'Tier 1', region:'US' },
  tier2b5:{ year:2004, co_gPerMi:4.2, nox_gPerMi:0.07, hc_gPerMi:0.09, pm_gPerMi:0.01, name:'Tier 2 Bin 5', region:'US' },
  tier3b30:{ year:2017, co_gPerMi:1.0, nox_gPerMi:0.03, hc_gPerMi:0.03, pm_gPerMi:0.003, name:'Tier 3 Bin 30', region:'US' },
  lev3:   { year:2015, co_gPerMi:1.0, nox_gPerMi:0.03, hc_gPerMi:0.03, pm_gPerMi:0.003, name:'LEV III (California)', region:'US-CA' },
  // Turkey
  euro4_tr: { year:2009, co_gPerKm:0.50, pm_gPerKm:0.025, nox_gPerKm:0.25, hc_gPerKm:0.10, name:'Euro 4 (Turkey)', region:'TR' },
  euro6_tr: { year:2019, co_gPerKm:0.50, pm_gPerKm:0.005, nox_gPerKm:0.08, hc_gPerKm:0.10, name:'Euro 6 (Turkey)', region:'TR' }
};

export const FUEL_PROPERTIES = {
  gasoline:  { co2_gPerL:2310, density_kgPerL:0.745, stoich_afr:14.7, carbon_pct:0.87, hc_base:0.5, co_base:5.0, nox_factor:1.0 },
  diesel:    { co2_gPerL:2680, density_kgPerL:0.835, stoich_afr:14.5, carbon_pct:0.86, hc_base:0.1, co_base:0.5, nox_factor:1.8, pm_factor:3.0 },
  e85:       { co2_gPerL:1610, density_kgPerL:0.785, stoich_afr:9.76, carbon_pct:0.57, hc_base:0.3, co_base:3.0, nox_factor:0.7 },
  e10:       { co2_gPerL:2195, density_kgPerL:0.748, stoich_afr:14.1, carbon_pct:0.83, hc_base:0.45, co_base:4.5, nox_factor:0.95 },
  lpg:       { co2_gPerL:1510, density_kgPerL:0.51,  stoich_afr:15.7, carbon_pct:0.82, hc_base:0.2, co_base:2.0, nox_factor:0.8 },
  cng:       { co2_gPerKg:2750, density_kgPerL:0.18,  stoich_afr:17.2, carbon_pct:0.75, hc_base:0.1, co_base:1.0, nox_factor:0.6 },
  methanol:  { co2_gPerL:1100, density_kgPerL:0.792, stoich_afr:6.47, carbon_pct:0.375, hc_base:0.2, co_base:2.0, nox_factor:0.5 },
  hydrogen:  { co2_gPerL:0,    density_kgPerL:0.071, stoich_afr:34.3, carbon_pct:0, hc_base:0, co_base:0, nox_factor:0.3 }
};

export const CATALYST_TYPES = {
  twc:      { name:'Three-Way Catalyst (TWC)', co_eff:0.95, hc_eff:0.95, nox_eff:0.90, pm_eff:0, lightoff_C:300, fuel:'gasoline', desc:'Standard gasoline cat — requires lambda ≈ 1.0' },
  oxidation:{ name:'Diesel Oxidation Catalyst (DOC)', co_eff:0.90, hc_eff:0.90, nox_eff:0, pm_eff:0.20, lightoff_C:250, fuel:'diesel', desc:'Oxidizes CO and HC, partial PM' },
  dpf:      { name:'Diesel Particulate Filter (DPF)', co_eff:0, hc_eff:0, nox_eff:0, pm_eff:0.97, lightoff_C:null, fuel:'diesel', desc:'Traps soot, needs regen at 600°C' },
  scr:      { name:'Selective Catalytic Reduction (SCR)', co_eff:0, hc_eff:0, nox_eff:0.95, pm_eff:0, lightoff_C:200, fuel:'diesel', desc:'AdBlue/DEF injection for NOx' },
  gpf:      { name:'Gasoline Particulate Filter (GPF)', co_eff:0, hc_eff:0, nox_eff:0, pm_eff:0.90, lightoff_C:null, fuel:'gasoline', desc:'Euro 6d+ requirement for GDI engines' },
  lnt:      { name:'Lean NOx Trap (LNT)', co_eff:0, hc_eff:0, nox_eff:0.70, pm_eff:0, lightoff_C:250, fuel:'diesel', desc:'Stores NOx, periodically purged' },
  sport_cat:{ name:'Sport/High-Flow Cat', co_eff:0.80, hc_eff:0.80, nox_eff:0.70, pm_eff:0, lightoff_C:350, fuel:'gasoline', desc:'200-cell metallic, less restriction, lower efficiency' },
  decat:    { name:'Decat / Test Pipe', co_eff:0, hc_eff:0, nox_eff:0, pm_eff:0, lightoff_C:null, fuel:'any', desc:'No emissions control — track/off-road only' }
};

// Estimate tailpipe emissions from engine parameters
export function estimateEmissions(power_hp, fuelConsumption_LPer100km, fuelType='gasoline', lambda=1.0, catalystType='twc') {
  const fuel = FUEL_PROPERTIES[fuelType];
  if(!fuel) return { error: 'Unknown fuel. Use: '+Object.keys(FUEL_PROPERTIES).join(', ') };
  const cat = CATALYST_TYPES[catalystType];
  if(!cat) return { error: 'Unknown catalyst. Use: '+Object.keys(CATALYST_TYPES).join(', ') };

  // CO2 from fuel consumption
  const co2_gPerKm = fuelConsumption_LPer100km * (fuel.co2_gPerL || fuel.co2_gPerKg * fuel.density_kgPerL) / 100;

  // Raw emissions before catalyst (g/km estimates)
  // CO increases dramatically when rich (lambda < 1)
  const richFactor = lambda < 1 ? Math.pow((1 - lambda) * 20 + 1, 2) : 1 / (lambda * 2);
  const raw_co = fuel.co_base * (fuelConsumption_LPer100km / 8) * richFactor;

  // HC increases when rich or very lean
  const hcFactor = lambda < 0.95 ? 1.5 : lambda > 1.1 ? 2.0 : 1.0;
  const raw_hc = fuel.hc_base * (fuelConsumption_LPer100km / 8) * hcFactor;

  // NOx peaks at lambda 1.05-1.10
  const noxLambdaFactor = lambda > 0.98 && lambda < 1.12 ? 1.0 + Math.sin((lambda - 0.98) / 0.14 * Math.PI) * 0.5 :
                          lambda >= 1.12 ? 0.5 : 0.3;
  const raw_nox = 2.0 * fuel.nox_factor * (power_hp / 150) * noxLambdaFactor;

  // PM — mostly diesel and GDI
  const raw_pm = (fuel.pm_factor || 0.1) * 0.01 * (fuelConsumption_LPer100km / 8);

  // Apply catalyst efficiency
  const post_co = raw_co * (1 - cat.co_eff);
  const post_hc = raw_hc * (1 - cat.hc_eff);
  const post_nox = raw_nox * (1 - cat.nox_eff);
  const post_pm = raw_pm * (1 - cat.pm_eff);

  return {
    power_hp,
    fuelConsumption_LPer100km,
    fuelType,
    lambda,
    catalystType,
    catalystName: cat.name,
    co2_gPerKm: Math.round(co2_gPerKm*10)/10,
    co2_gPerMi: Math.round(co2_gPerKm * 1.609 * 10)/10,
    rawEmissions_gPerKm: {
      co: Math.round(raw_co*1000)/1000,
      hc: Math.round(raw_hc*1000)/1000,
      nox: Math.round(raw_nox*1000)/1000,
      pm: Math.round(raw_pm*10000)/10000
    },
    tailpipeEmissions_gPerKm: {
      co: Math.round(post_co*1000)/1000,
      hc: Math.round(post_hc*1000)/1000,
      nox: Math.round(post_nox*1000)/1000,
      pm: Math.round(post_pm*10000)/10000
    },
    catalystReduction: {
      co_pct: Math.round(cat.co_eff*100),
      hc_pct: Math.round(cat.hc_eff*100),
      nox_pct: Math.round(cat.nox_eff*100),
      pm_pct: Math.round(cat.pm_eff*100)
    },
    notes: lambda < 0.90 ? 'Very rich — high CO, fuel smell, cat overheating risk' :
           lambda < 0.95 ? 'Rich — elevated CO, reduced cat efficiency' :
           lambda > 1.15 ? 'Very lean — misfire risk, elevated HC and NOx' :
           'Normal operating range'
  };
}

// Check compliance against a standard
export function checkCompliance(emissions_gPerKm, standardId) {
  const std = EMISSION_STANDARDS[standardId];
  if(!std) return { error: 'Unknown standard. Use: '+Object.keys(EMISSION_STANDARDS).join(', ') };

  const checks = [];
  const isUS = std.region === 'US' || std.region === 'US-CA';
  const factor = isUS ? 1.609 : 1; // convert g/km to g/mi for US standards

  if(std.co_gPerKm !== undefined && std.co_gPerKm !== null) {
    const limit = std.co_gPerKm;
    const actual = emissions_gPerKm.co || 0;
    checks.push({ pollutant:'CO', actual_gPerKm: actual, limit_gPerKm: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }
  if(std.co_gPerMi !== undefined) {
    const limit = std.co_gPerMi;
    const actual = (emissions_gPerKm.co || 0) * 1.609;
    checks.push({ pollutant:'CO', actual_gPerMi: Math.round(actual*1000)/1000, limit_gPerMi: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }
  if(std.nox_gPerKm !== undefined && std.nox_gPerKm !== null) {
    const limit = std.nox_gPerKm;
    const actual = emissions_gPerKm.nox || 0;
    checks.push({ pollutant:'NOx', actual_gPerKm: actual, limit_gPerKm: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }
  if(std.nox_gPerMi !== undefined) {
    const limit = std.nox_gPerMi;
    const actual = (emissions_gPerKm.nox || 0) * 1.609;
    checks.push({ pollutant:'NOx', actual_gPerMi: Math.round(actual*1000)/1000, limit_gPerMi: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }
  if(std.hc_gPerKm !== undefined && std.hc_gPerKm !== null) {
    const limit = std.hc_gPerKm;
    const actual = emissions_gPerKm.hc || 0;
    checks.push({ pollutant:'HC', actual_gPerKm: actual, limit_gPerKm: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }
  if(std.pm_gPerKm !== undefined && std.pm_gPerKm !== null) {
    const limit = std.pm_gPerKm;
    const actual = emissions_gPerKm.pm || 0;
    checks.push({ pollutant:'PM', actual_gPerKm: actual, limit_gPerKm: limit, pass: actual <= limit, margin_pct: Math.round(((limit - actual)/limit)*100) });
  }

  const allPass = checks.every(c => c.pass);
  const failCount = checks.filter(c => !c.pass).length;

  return {
    standard: standardId,
    standardName: std.name,
    region: std.region,
    year: std.year,
    checks,
    overallPass: allPass,
    failedCount: failCount,
    verdict: allPass ? `PASS — Compliant with ${std.name}` : `FAIL — ${failCount} pollutant(s) exceed ${std.name} limits`
  };
}

// Estimate CO2 from fuel consumption
export function estimateCO2(fuelConsumption_LPer100km, fuelType='gasoline', annualDistance_km=15000) {
  const fuel = FUEL_PROPERTIES[fuelType];
  if(!fuel) return { error: 'Unknown fuel type' };

  const co2PerL = fuel.co2_gPerL || (fuel.co2_gPerKg * fuel.density_kgPerL);
  const co2_gPerKm = fuelConsumption_LPer100km * co2PerL / 100;
  const annual_kg = co2_gPerKm * annualDistance_km / 1000;
  const annual_tonnes = annual_kg / 1000;

  // EU CO2 fleet target
  const eu2025target = 93.6; // g/km for new cars
  const eu2030target = 49.5;

  return {
    fuelType,
    fuelConsumption_LPer100km,
    co2_gPerKm: Math.round(co2_gPerKm*10)/10,
    co2_gPerMi: Math.round(co2_gPerKm * 1.609 * 10)/10,
    annualDistance_km,
    annualCO2_kg: Math.round(annual_kg),
    annualCO2_tonnes: Math.round(annual_tonnes*10)/10,
    fuelCost_annual_L: Math.round(fuelConsumption_LPer100km * annualDistance_km / 100),
    euFleetComparison: {
      eu2025_target_gPerKm: eu2025target,
      eu2030_target_gPerKm: eu2030target,
      vs2025: co2_gPerKm <= eu2025target ? 'Below target' : `${Math.round(co2_gPerKm - eu2025target)}g/km above target`,
      vs2030: co2_gPerKm <= eu2030target ? 'Below target' : `${Math.round(co2_gPerKm - eu2030target)}g/km above target`
    }
  };
}

// EGR system impact calculator
export function calcEGRImpact(egrRate_pct, baseNox_gPerKm, baseCO2_gPerKm, basePM_gPerKm=0.005) {
  // EGR reduces NOx by lowering combustion temp
  // But increases PM and slightly increases CO2
  const noxReduction = egrRate_pct * 0.02; // ~2% NOx reduction per 1% EGR
  const pmIncrease = egrRate_pct * 0.015; // PM increases with EGR
  const co2Increase = egrRate_pct * 0.003; // small CO2 penalty
  const powerLoss_pct = egrRate_pct * 0.15; // ~0.15% power loss per 1% EGR

  const newNox = baseNox_gPerKm * (1 - Math.min(0.85, noxReduction));
  const newPM = basePM_gPerKm * (1 + pmIncrease);
  const newCO2 = baseCO2_gPerKm * (1 + co2Increase);

  return {
    egrRate_pct,
    nox: {
      before_gPerKm: baseNox_gPerKm,
      after_gPerKm: Math.round(newNox*1000)/1000,
      reduction_pct: Math.round(Math.min(85, noxReduction*100)*10)/10
    },
    pm: {
      before_gPerKm: basePM_gPerKm,
      after_gPerKm: Math.round(newPM*10000)/10000,
      increase_pct: Math.round(pmIncrease*100*10)/10
    },
    co2: {
      before_gPerKm: baseCO2_gPerKm,
      after_gPerKm: Math.round(newCO2*10)/10,
      increase_pct: Math.round(co2Increase*100*10)/10
    },
    powerLoss_pct: Math.round(powerLoss_pct*10)/10,
    tradeoff: egrRate_pct > 30 ? 'High EGR — significant PM penalty, carbon buildup risk' :
              egrRate_pct > 20 ? 'Moderate EGR — good NOx reduction, manageable PM' :
              egrRate_pct > 10 ? 'Light EGR — mild NOx benefit, minimal penalties' :
              'Very light EGR — marginal NOx effect'
  };
}

// Catalyst health / efficiency estimator
export function estimateCatHealth(catAge_km, catType='twc', operatingConditions='normal') {
  const cat = CATALYST_TYPES[catType];
  if(!cat) return { error: 'Unknown catalyst type' };

  // Degradation model
  const conditionFactors = {
    normal: 1.0,
    aggressive: 1.5,    // heavy driving
    city_only: 0.8,     // low temp, slow warmup
    short_trips: 1.3,   // never reaches full operating temp
    modified_rich: 2.0, // running rich damages cat faster
    track: 1.8          // high temps, rapid cycling
  };
  const cf = conditionFactors[operatingConditions] || 1.0;

  // Typical cat life: 150,000-200,000 km
  const normalLife_km = 175000;
  const ageRatio = (catAge_km * cf) / normalLife_km;

  // Efficiency degrades: starts at rated, drops to ~50% at end of life
  const degradation = Math.min(0.50, ageRatio * 0.50);
  const currentEff = {
    co: Math.round(Math.max(0, cat.co_eff * (1 - degradation)) * 100),
    hc: Math.round(Math.max(0, cat.hc_eff * (1 - degradation)) * 100),
    nox: Math.round(Math.max(0, cat.nox_eff * (1 - degradation)) * 100),
    pm: Math.round(Math.max(0, cat.pm_eff * (1 - degradation)) * 100)
  };

  const remainingLife_km = Math.max(0, Math.round((normalLife_km / cf) - catAge_km));
  const healthScore = Math.max(0, Math.round((1 - degradation) * 100));

  return {
    catType,
    catName: cat.name,
    age_km: catAge_km,
    operatingConditions,
    conditionFactor: cf,
    healthScore,
    currentEfficiency: currentEff,
    ratedEfficiency: {
      co: Math.round(cat.co_eff*100),
      hc: Math.round(cat.hc_eff*100),
      nox: Math.round(cat.nox_eff*100),
      pm: Math.round(cat.pm_eff*100)
    },
    estimatedRemainingLife_km: remainingLife_km,
    lightoffTemp_C: cat.lightoff_C,
    status: healthScore > 80 ? 'Good' : healthScore > 60 ? 'Aging — monitor closely' : healthScore > 40 ? 'Worn — replacement soon' : 'End of life — replace',
    p0420_risk: healthScore < 60 ? 'HIGH — likely to trigger P0420/P0430 code' :
                healthScore < 80 ? 'MODERATE — may trigger under specific conditions' :
                'LOW — catalyst operating normally'
  };
}

// Compare fuel types emissions
export function compareFuelEmissions(fuelConsumption_LPer100km, fuelTypes=['gasoline','diesel','e85','lpg']) {
  const results = [];
  for(const ft of fuelTypes) {
    const fuel = FUEL_PROPERTIES[ft];
    if(!fuel) continue;
    const co2PerL = fuel.co2_gPerL || (fuel.co2_gPerKg * fuel.density_kgPerL);
    const co2 = fuelConsumption_LPer100km * co2PerL / 100;
    results.push({
      fuel: ft,
      co2_gPerKm: Math.round(co2*10)/10,
      relativeNox: fuel.nox_factor,
      relativeCO: Math.round((fuel.co_base / FUEL_PROPERTIES.gasoline.co_base)*100)/100,
      relativeHC: Math.round((fuel.hc_base / FUEL_PROPERTIES.gasoline.hc_base)*100)/100,
      carbonContent_pct: fuel.carbon_pct * 100
    });
  }

  results.sort((a,b) => a.co2_gPerKm - b.co2_gPerKm);

  return {
    baseFuelConsumption_LPer100km: fuelConsumption_LPer100km,
    comparison: results,
    cleanest_co2: results[0]?.fuel,
    notes: 'Relative values compared to gasoline baseline. Actual emissions depend on engine tuning, catalyst, and driving conditions.'
  };
}

// Mod impact on emissions
export function assessModImpact(modifications=[]) {
  const modEffects = {
    decat:         { co:5.0, hc:5.0, nox:3.0, pm:1.5, legal:'ILLEGAL on road vehicles in most jurisdictions' },
    sport_cat:     { co:1.3, hc:1.3, nox:1.5, pm:1.0, legal:'Legal if CARB-approved or passes emissions test' },
    dpf_delete:    { co:1.0, hc:1.0, nox:1.0, pm:20.0, legal:'ILLEGAL — federal offense in US, illegal in EU/TR' },
    egr_delete:    { co:0.9, hc:0.9, nox:3.0, pm:0.7, legal:'ILLEGAL for road use — emissions tampering' },
    adblue_delete: { co:1.0, hc:1.0, nox:5.0, pm:1.0, legal:'ILLEGAL — disabling emissions control' },
    cold_air_intake:{ co:0.95, hc:0.95, nox:1.1, pm:1.0, legal:'Generally legal' },
    exhaust_upgrade:{ co:1.0, hc:1.0, nox:1.0, pm:1.0, legal:'Legal if catalyst retained' },
    remap_stage1:  { co:1.1, hc:1.05, nox:1.15, pm:1.1, legal:'Legal varies by jurisdiction — may void warranty' },
    remap_stage2:  { co:1.3, hc:1.1, nox:1.3, pm:1.2, legal:'Often fails emissions test at higher power levels' },
    pop_bang_tune:  { co:3.0, hc:4.0, nox:0.8, pm:2.0, legal:'Increased raw emissions, cat damage risk' },
    flex_fuel:     { co:0.85, hc:0.9, nox:0.7, pm:0.9, legal:'Legal with proper calibration' },
    meth_injection:{ co:0.9, hc:0.8, nox:0.6, pm:0.8, legal:'Legal varies — not CARB exempt typically' }
  };

  let totalCO = 1.0, totalHC = 1.0, totalNOx = 1.0, totalPM = 1.0;
  const details = [];
  const legalIssues = [];

  for(const mod of modifications) {
    const effect = modEffects[mod];
    if(!effect) { details.push({ mod, note:'Unknown modification — no data' }); continue; }
    totalCO *= effect.co;
    totalHC *= effect.hc;
    totalNOx *= effect.nox;
    totalPM *= effect.pm;
    details.push({ mod, co_factor:effect.co, hc_factor:effect.hc, nox_factor:effect.nox, pm_factor:effect.pm, legal:effect.legal });
    if(effect.legal.includes('ILLEGAL')) legalIssues.push({ mod, issue:effect.legal });
  }

  return {
    modifications,
    combinedMultipliers: {
      co: Math.round(totalCO*100)/100,
      hc: Math.round(totalHC*100)/100,
      nox: Math.round(totalNOx*100)/100,
      pm: Math.round(totalPM*100)/100
    },
    details,
    legalIssues,
    overallImpact: Math.max(totalCO, totalHC, totalNOx, totalPM) > 3 ? 'SEVERE — likely fails emissions testing' :
                   Math.max(totalCO, totalHC, totalNOx, totalPM) > 1.5 ? 'MODERATE — may fail strict emissions tests' :
                   'MINOR — should pass standard emissions testing'
  };
}

// Query helpers
export function listEmissionStandards(region=null) {
  return Object.entries(EMISSION_STANDARDS)
    .filter(([k,v]) => !region || v.region === region)
    .map(([k,v]) => ({id:k,...v}));
}
export function getEmissionStandard(id) { const s=EMISSION_STANDARDS[id]; return s?{id,...s}:null; }
export function listFuelProperties() { return Object.entries(FUEL_PROPERTIES).map(([k,v])=>({id:k,...v})); }
export function getFuelProperty(id) { const f=FUEL_PROPERTIES[id]; return f?{id,...f}:null; }
export function listCatalystTypes() { return Object.entries(CATALYST_TYPES).map(([k,v])=>({id:k,...v})); }
export function getCatalystType(id) { const c=CATALYST_TYPES[id]; return c?{id,...c}:null; }

export function emissionsCalcStats() {
  return {
    module: 'emissions-calc',
    version: '1.0.0',
    emissionStandards: Object.keys(EMISSION_STANDARDS).length,
    fuelTypes: Object.keys(FUEL_PROPERTIES).length,
    catalystTypes: Object.keys(CATALYST_TYPES).length,
    calculations: [
      'estimateEmissions','checkCompliance','estimateCO2','calcEGRImpact',
      'estimateCatHealth','compareFuelEmissions','assessModImpact'
    ]
  };
}
