// ═══════════════════════════════════════════════════════════════════════════
// Wheel & Tire Fitment Calculator — JARVIS ECU Platform
// Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const BOLT_PATTERNS={
  '4x100':{bolts:4,pcd_mm:100,vehicles:'Honda Civic, Mazda MX-5, Mini Cooper, VW Polo, Toyota Yaris'},
  '4x108':{bolts:4,pcd_mm:108,vehicles:'Ford Fiesta, Peugeot 208, Citroën, Volvo older'},
  '4x114':{bolts:4,pcd_mm:114.3,vehicles:'Honda Accord older, Nissan older, Hyundai older'},
  '5x100':{bolts:5,pcd_mm:100,vehicles:'Subaru BRZ/WRX, VW Golf IV-V, Toyota 86, Audi A3 older'},
  '5x108':{bolts:5,pcd_mm:108,vehicles:'Volvo modern, Ford Focus/Mondeo, Jaguar, Peugeot 308+'},
  '5x112':{bolts:5,pcd_mm:112,vehicles:'VW Golf VI+, Audi A3/A4/A6, Mercedes C/E class, Skoda'},
  '5x114':{bolts:5,pcd_mm:114.3,vehicles:'Honda Accord/Civic Si, Toyota Camry/Supra, Nissan 350Z/370Z, Mazda 3/6, Hyundai, Kia, Lexus IS, Mitsubishi Evo'},
  '5x120':{bolts:5,pcd_mm:120,vehicles:'BMW 3/5/7, Tesla Model 3, Range Rover, Honda Odyssey'},
  '5x127':{bolts:5,pcd_mm:127,vehicles:'Jeep Wrangler, Grand Cherokee, Dodge Charger older'},
  '5x130':{bolts:5,pcd_mm:130,vehicles:'Porsche 911/Cayenne, VW Touareg, Audi Q7'},
  '5x139':{bolts:5,pcd_mm:139.7,vehicles:'Suzuki Jimny, Jeep old, Toyota Land Cruiser old'},
  '6x114':{bolts:6,pcd_mm:114.3,vehicles:'Nissan Navara, Pathfinder, Renault Alaskan'},
  '6x135':{bolts:6,pcd_mm:135,vehicles:'Ford F-150 modern, Lincoln Navigator'},
  '6x139':{bolts:6,pcd_mm:139.7,vehicles:'Toyota Hilux/Land Cruiser, Mitsubishi L200, Isuzu, Ford Ranger, Chevy Colorado'},
  '8x165':{bolts:8,pcd_mm:165.1,vehicles:'Dodge Ram 2500/3500 old, Ford F-250 old'},
  '8x170':{bolts:8,pcd_mm:170,vehicles:'Ford F-250/F-350 Super Duty 1999-2004'},
  '8x180':{bolts:8,pcd_mm:180,vehicles:'Chevy Silverado 2500HD/3500HD 2011+'}
};

export const TIRE_TYPES={
  summer:{name:'Summer / Performance',season:'summer',grip_dry:'Excellent',grip_wet:'Good',grip_snow:'Poor',treadwear:'Moderate',noise:'Low',temp_range_c:'7°C to 50°C',note:'Compound hardens below 7°C — do not use in winter'},
  all_season:{name:'All-Season',season:'all_season',grip_dry:'Good',grip_wet:'Good',grip_snow:'Fair',treadwear:'High',noise:'Moderate',temp_range_c:'-10°C to 45°C',note:'Compromise — acceptable year-round in mild climates'},
  winter:{name:'Winter / Snow',season:'winter',grip_dry:'Good',grip_wet:'Good',grip_snow:'Excellent',treadwear:'Moderate',noise:'Moderate',temp_range_c:'-40°C to 10°C',note:'Soft compound with sipes — must swap for summer above 10°C'},
  all_weather:{name:'All-Weather (3PMSF)',season:'all_weather',grip_dry:'Good',grip_wet:'Good',grip_snow:'Good',treadwear:'Good',noise:'Moderate',temp_range_c:'-30°C to 40°C',note:'Mountain snowflake rated — single set for all conditions'},
  track:{name:'Track / R-Compound',season:'summer',grip_dry:'Outstanding',grip_wet:'Poor',grip_snow:'None',treadwear:'Very Low',noise:'High',temp_range_c:'15°C to 60°C',note:'Needs heat to work — not street legal in many regions'},
  drag:{name:'Drag Radial / Slick',season:'summer',grip_dry:'Maximum',grip_wet:'Dangerous',grip_snow:'None',treadwear:'Very Low',noise:'Low',temp_range_c:'20°C to 60°C',note:'Straight-line traction only — no cornering grip'},
  mud_terrain:{name:'Mud-Terrain (M/T)',season:'all_season',grip_dry:'Fair',grip_wet:'Fair',grip_snow:'Good',treadwear:'Low',noise:'Very High',temp_range_c:'-20°C to 45°C',note:'Aggressive tread — loud on road, excellent off-road'},
  all_terrain:{name:'All-Terrain (A/T)',season:'all_season',grip_dry:'Good',grip_wet:'Good',grip_snow:'Good',treadwear:'Good',noise:'Moderate',temp_range_c:'-25°C to 45°C',note:'Balanced on/off-road — popular for trucks and SUVs'}
};

// ── Calculations ──

export function calcTireDiameter(width_mm, aspectRatio, wheelDiameter_in) {
  const sidewall_mm = width_mm * (aspectRatio / 100);
  const totalDiameter_mm = (wheelDiameter_in * 25.4) + (2 * sidewall_mm);
  const circumference_mm = Math.PI * totalDiameter_mm;
  const revsPerKm = 1000000 / circumference_mm;
  return {
    tireSize: `${width_mm}/${aspectRatio}R${wheelDiameter_in}`,
    width_mm, aspectRatio, wheelDiameter_in,
    sidewallHeight_mm: Math.round(sidewall_mm * 10) / 10,
    totalDiameter_mm: Math.round(totalDiameter_mm * 10) / 10,
    totalDiameter_in: Math.round(totalDiameter_mm / 25.4 * 10) / 10,
    circumference_mm: Math.round(circumference_mm),
    revsPerKm: Math.round(revsPerKm)
  };
}

export function compareTireSizes(stock_w, stock_ar, stock_wd, new_w, new_ar, new_wd) {
  const stock = calcTireDiameter(stock_w, stock_ar, stock_wd);
  const newTire = calcTireDiameter(new_w, new_ar, new_wd);
  const diamDiff_mm = newTire.totalDiameter_mm - stock.totalDiameter_mm;
  const diamDiff_pct = (diamDiff_mm / stock.totalDiameter_mm) * 100;
  const speedoError_pct = -diamDiff_pct; // larger tire = speedo reads lower than actual
  const at100 = 100 + (100 * diamDiff_pct / 100);
  return {
    stock, new: newTire,
    diameterDifference_mm: Math.round(diamDiff_mm * 10) / 10,
    diameterDifference_pct: Math.round(diamDiff_pct * 100) / 100,
    speedometerError_pct: Math.round(speedoError_pct * 100) / 100,
    actualSpeedAt100: Math.round(at100 * 10) / 10,
    gearingEffect: diamDiff_pct > 0 ? 'Taller — lower RPM at speed, slower acceleration' : diamDiff_pct < 0 ? 'Shorter — higher RPM at speed, quicker acceleration' : 'Identical gearing',
    fitment: Math.abs(diamDiff_pct) < 3 ? 'Good — within safe range' : Math.abs(diamDiff_pct) < 5 ? 'Acceptable — minor speedo correction needed' : 'WARNING — significant size change, recalibrate speedo and check clearance'
  };
}

export function calcOffset(wheelWidth_in, et_mm) {
  const wheelWidth_mm = wheelWidth_in * 25.4;
  const backspacing_mm = (wheelWidth_mm / 2) + et_mm;
  const lipClearance_mm = wheelWidth_mm - backspacing_mm;
  return {
    wheelWidth_in, et_mm,
    wheelWidth_mm: Math.round(wheelWidth_mm),
    backspacing_mm: Math.round(backspacing_mm * 10) / 10,
    backspacing_in: Math.round(backspacing_mm / 25.4 * 100) / 100,
    innerClearance_mm: Math.round(backspacing_mm),
    outerLip_mm: Math.round(lipClearance_mm),
    type: et_mm > 25 ? 'High offset — wheel sits deep inward (FWD, modern cars)' :
      et_mm > 0 ? 'Low positive offset — slightly outward' :
      et_mm === 0 ? 'Zero offset — wheel centerline at mounting face' :
      'Negative offset — wheel pokes outward (trucks, off-road, stance)'
  };
}

export function compareOffsets(stockWidth_in, stockET_mm, newWidth_in, newET_mm) {
  const stock = calcOffset(stockWidth_in, stockET_mm);
  const newW = calcOffset(newWidth_in, newET_mm);
  const innerDiff = newW.innerClearance_mm - stock.innerClearance_mm;
  const outerDiff = newW.outerLip_mm - stock.outerLip_mm;
  return {
    stock, new: newW,
    innerClearanceDiff_mm: Math.round(innerDiff),
    outerClearanceDiff_mm: Math.round(outerDiff),
    inner: innerDiff > 10 ? 'Moves inward — check strut/suspension clearance' : innerDiff < -10 ? 'Moves outward — inner clearance gained' : 'Minimal inner change',
    outer: outerDiff > 10 ? 'Lip pokes more — may need fender work or spacers' : outerDiff < -10 ? 'Lip tucked further — fender gap may increase' : 'Minimal outer change',
    rubRisk: Math.abs(innerDiff) > 15 || Math.abs(outerDiff) > 15 ? 'HIGH — test fit before committing' : Math.abs(innerDiff) > 8 || Math.abs(outerDiff) > 8 ? 'MODERATE — careful measurement advised' : 'LOW — should fit without issues'
  };
}

export function calcSpeedoCorrection(stockDiam_mm, newDiam_mm) {
  const ratio = newDiam_mm / stockDiam_mm;
  const error_pct = (1 - ratio) * 100;
  return {
    stockDiameter_mm: stockDiam_mm, newDiameter_mm: newDiam_mm,
    ratio: Math.round(ratio * 10000) / 10000,
    speedoError_pct: Math.round(error_pct * 100) / 100,
    at60kmh: Math.round(60 * ratio * 10) / 10,
    at100kmh: Math.round(100 * ratio * 10) / 10,
    at130kmh: Math.round(130 * ratio * 10) / 10,
    note: Math.abs(error_pct) > 3 ? 'Speedo recalibration recommended' : 'Within acceptable tolerance'
  };
}

export function calcLoadIndex(loadIndex) {
  const table = {60:250,65:290,70:335,71:345,72:355,73:365,74:375,75:387,76:400,77:412,78:425,79:437,80:450,81:462,82:475,83:487,84:500,85:515,86:530,87:545,88:560,89:580,90:600,91:615,92:630,93:650,94:670,95:690,96:710,97:730,98:750,99:775,100:800,101:825,102:850,103:875,104:900,105:925,106:950,107:975,108:1000,109:1030,110:1060,111:1090,112:1120,113:1150,114:1180,115:1215,116:1250,117:1285,118:1320,119:1360,120:1400,121:1450,122:1500,123:1550,124:1600,125:1650,126:1700};
  const kg = table[loadIndex] || null;
  return {
    loadIndex,
    maxLoad_kg: kg,
    maxLoad_lbs: kg ? Math.round(kg * 2.205) : null,
    fourTires_kg: kg ? kg * 4 : null,
    note: kg ? `Each tire supports up to ${kg} kg at maximum inflation` : 'Load index not in table (range 60-126)'
  };
}

export function calcSpeedRating(rating) {
  const table = {L:120,M:130,N:140,P:150,Q:160,R:170,S:180,T:190,U:200,H:210,V:240,W:270,Y:300,ZR:300};
  const speed = table[rating.toUpperCase()] || null;
  return {
    speedRating: rating.toUpperCase(),
    maxSpeed_kmh: speed,
    maxSpeed_mph: speed ? Math.round(speed * 0.621) : null,
    note: speed ? `Tire certified for sustained speeds up to ${speed} km/h` : 'Speed rating not recognized'
  };
}

export function calcStretchFit(tireWidth_mm, wheelWidth_in) {
  const idealMin = Math.round(wheelWidth_in * 25.4 - 20);
  const idealMax = Math.round(wheelWidth_in * 25.4 + 30);
  const diff = tireWidth_mm - (wheelWidth_in * 25.4);
  let fit;
  if (diff < -25) fit = 'EXTREME STRETCH — dangerous, bead may unseat';
  else if (diff < -10) fit = 'Moderate stretch — show stance look, reduced sidewall protection';
  else if (diff < 10) fit = 'Flush / Mild stretch — good performance fitment';
  else if (diff < 30) fit = 'Standard fit — optimal contact patch';
  else if (diff < 50) fit = 'Wide tire on narrow wheel — ballooning, lazy response';
  else fit = 'TOO WIDE — tire will not seat properly';
  return {
    tireWidth_mm, wheelWidth_in,
    wheelWidth_mm: Math.round(wheelWidth_in * 25.4),
    idealTireRange_mm: `${idealMin}–${idealMax}`,
    difference_mm: Math.round(diff),
    fit,
    safety: diff < -20 ? 'UNSAFE — not recommended' : diff < -10 ? 'Caution — monitor regularly' : 'Safe fitment'
  };
}

// ── Query Functions ──

export function listBoltPatterns() { return Object.entries(BOLT_PATTERNS).map(([k, v]) => ({ key: k, ...v })); }
export function getBoltPattern(key) { const b = BOLT_PATTERNS[key]; return b ? { key, ...b } : null; }
export function searchBoltPatterns(q) { const l = q.toLowerCase(); return listBoltPatterns().filter(b => b.key.toLowerCase().includes(l) || (b.vehicles || '').toLowerCase().includes(l)); }
export function listTireTypes() { return Object.entries(TIRE_TYPES).map(([k, v]) => ({ key: k, ...v })); }
export function getTireType(key) { const t = TIRE_TYPES[key]; return t ? { key, ...t } : null; }

export function wheelTireCalcStats() {
  return {
    module: 'Wheel & Tire Fitment Calculator',
    boltPatterns: Object.keys(BOLT_PATTERNS).length,
    tireTypes: Object.keys(TIRE_TYPES).length,
    calculations: ['calcTireDiameter', 'compareTireSizes', 'calcOffset', 'compareOffsets', 'calcSpeedoCorrection', 'calcLoadIndex', 'calcSpeedRating', 'calcStretchFit']
  };
}
