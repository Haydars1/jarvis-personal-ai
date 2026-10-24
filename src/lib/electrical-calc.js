// ─── electrical-calc.js ── Automotive Electrical System Calculator ───
// Module #36 — Alternator sizing, battery capacity, wiring gauge, voltage drop,
// relay/fuse sizing, electrical load analysis for modified vehicles
// Pure JS, zero deps, Cloudflare Workers ESM

export const WIRE_GAUGES = {
  '0000': { awg:'0000', area_mm2:107.2, maxAmps_chassis:260, maxAmps_engine:200, resistance_per_m:0.000161, desc:'Main battery cables' },
  '000':  { awg:'000',  area_mm2:85.0,  maxAmps_chassis:225, maxAmps_engine:175, resistance_per_m:0.000203, desc:'Heavy battery/starter cables' },
  '00':   { awg:'00',   area_mm2:67.4,  maxAmps_chassis:195, maxAmps_engine:150, resistance_per_m:0.000256, desc:'Battery/alternator cables' },
  '0':    { awg:'0',    area_mm2:53.5,  maxAmps_chassis:170, maxAmps_engine:125, resistance_per_m:0.000323, desc:'High-current feeds' },
  '1':    { awg:'1',    area_mm2:42.4,  maxAmps_chassis:150, maxAmps_engine:110, resistance_per_m:0.000407, desc:'Alternator output' },
  '2':    { awg:'2',    area_mm2:33.6,  maxAmps_chassis:130, maxAmps_engine:95,  resistance_per_m:0.000513, desc:'Large accessory feeds' },
  '4':    { awg:'4',    area_mm2:21.1,  maxAmps_chassis:100, maxAmps_engine:75,  resistance_per_m:0.000815, desc:'Fuel pump, large fan' },
  '6':    { awg:'6',    area_mm2:13.3,  maxAmps_chassis:80,  maxAmps_engine:60,  resistance_per_m:0.001296, desc:'Electric fan, winch' },
  '8':    { awg:'8',    area_mm2:8.37,  maxAmps_chassis:60,  maxAmps_engine:46,  resistance_per_m:0.002061, desc:'Fuel pump, horn' },
  '10':   { awg:'10',   area_mm2:5.26,  maxAmps_chassis:40,  maxAmps_engine:32,  resistance_per_m:0.003277, desc:'Headlights, heater blower' },
  '12':   { awg:'12',   area_mm2:3.31,  maxAmps_chassis:25,  maxAmps_engine:20,  resistance_per_m:0.005211, desc:'Brake lights, accessories' },
  '14':   { awg:'14',   area_mm2:2.08,  maxAmps_chassis:20,  maxAmps_engine:15,  resistance_per_m:0.008286, desc:'Dash lights, radio' },
  '16':   { awg:'16',   area_mm2:1.31,  maxAmps_chassis:13,  maxAmps_engine:10,  resistance_per_m:0.01317,  desc:'Sensors, small LEDs' },
  '18':   { awg:'18',   area_mm2:0.823, maxAmps_chassis:7,   maxAmps_engine:6,   resistance_per_m:0.02095,  desc:'Signal wires, switches' },
  '20':   { awg:'20',   area_mm2:0.518, maxAmps_chassis:3,   maxAmps_engine:2.5, resistance_per_m:0.03331,  desc:'ECU signal wires' }
};

export const BATTERY_TYPES = {
  lead_acid:  { name:'Lead-Acid (Flooded)', voltage:12.6, energyDensity_WhPerKg:35, cycleLife:300, selfDischarge_pctPerMonth:5, chargingVoltage:14.4, desc:'Cheapest, heavy, needs ventilation' },
  agm:        { name:'AGM (Absorbed Glass Mat)', voltage:12.8, energyDensity_WhPerKg:45, cycleLife:600, selfDischarge_pctPerMonth:3, chargingVoltage:14.7, desc:'Vibration resistant, maintenance-free' },
  gel:        { name:'Gel Cell', voltage:12.8, energyDensity_WhPerKg:40, cycleLife:700, selfDischarge_pctPerMonth:2, chargingVoltage:14.1, desc:'Deep cycle, sensitive to overcharge' },
  lithium:    { name:'Lithium (LiFePO4)', voltage:13.2, energyDensity_WhPerKg:120, cycleLife:3000, selfDischarge_pctPerMonth:1, chargingVoltage:14.6, desc:'Lightest, longest life, most expensive' },
  optima_red: { name:'Optima RedTop (SLI)', voltage:12.6, energyDensity_WhPerKg:42, cycleLife:400, selfDischarge_pctPerMonth:3, chargingVoltage:14.7, desc:'High CCA, vibration resistant' },
  optima_yel: { name:'Optima YellowTop (Dual)', voltage:12.6, energyDensity_WhPerKg:44, cycleLife:500, selfDischarge_pctPerMonth:3, chargingVoltage:14.7, desc:'Starting + deep cycle capable' }
};

export const COMMON_LOADS = {
  headlights_halogen:  { name:'Halogen Headlights (pair)', amps:13, priority:'essential' },
  headlights_hid:      { name:'HID/Xenon Headlights (pair)', amps:8, priority:'essential' },
  headlights_led:      { name:'LED Headlights (pair)', amps:4, priority:'essential' },
  tail_lights:         { name:'Tail/Brake Lights', amps:5, priority:'essential' },
  horn:                { name:'Horn', amps:5, priority:'essential' },
  ignition_system:     { name:'Ignition System', amps:8, priority:'essential' },
  fuel_pump_stock:     { name:'Fuel Pump (Stock)', amps:8, priority:'essential' },
  fuel_pump_perf:      { name:'Fuel Pump (Performance)', amps:18, priority:'essential' },
  ecu:                 { name:'ECU/Engine Management', amps:5, priority:'essential' },
  electric_fan_single: { name:'Electric Fan (Single)', amps:25, priority:'high' },
  electric_fan_dual:   { name:'Electric Fans (Dual)', amps:50, priority:'high' },
  ac_compressor:       { name:'A/C Compressor Clutch', amps:4, priority:'comfort' },
  ac_blower:           { name:'A/C Blower Motor', amps:15, priority:'comfort' },
  heated_seats:        { name:'Heated Seats (pair)', amps:10, priority:'comfort' },
  radio_stock:         { name:'Radio/Infotainment (Stock)', amps:3, priority:'comfort' },
  radio_aftermarket:   { name:'Aftermarket Sound System', amps:30, priority:'comfort' },
  subwoofer_amp:       { name:'Subwoofer Amplifier', amps:60, priority:'comfort' },
  power_windows:       { name:'Power Windows (all)', amps:20, priority:'comfort' },
  wipers:              { name:'Windshield Wipers', amps:6, priority:'essential' },
  rear_defogger:       { name:'Rear Window Defogger', amps:15, priority:'comfort' },
  boost_controller:    { name:'Electronic Boost Controller', amps:2, priority:'performance' },
  wideband_o2:         { name:'Wideband O2 Controller', amps:1, priority:'performance' },
  water_injection:     { name:'Water/Meth Injection Pump', amps:8, priority:'performance' },
  intercooler_pump:    { name:'Intercooler Water Pump', amps:10, priority:'performance' },
  nitrous_solenoid:    { name:'Nitrous Solenoid(s)', amps:15, priority:'performance' },
  data_logger:         { name:'Data Logger/Display', amps:2, priority:'performance' },
  light_bar:           { name:'LED Light Bar', amps:20, priority:'accessory' },
  winch:               { name:'Winch (Running)', amps:400, priority:'accessory' },
  air_compressor:      { name:'Onboard Air Compressor', amps:20, priority:'accessory' },
  dashcam:             { name:'Dash Camera', amps:1, priority:'accessory' },
  starter_motor:       { name:'Starter Motor (Cranking)', amps:200, priority:'essential' }
};

const COPPER_RESISTIVITY = 1.724e-8; // Ω·m at 20°C

// Calculate voltage drop in a wire run
export function calcVoltageDrop(current_A, wireLength_m, gaugeAWG, systemVoltage=13.8) {
  const gauge = WIRE_GAUGES[String(gaugeAWG)];
  if(!gauge) return { error: 'Unknown gauge. Use: '+Object.keys(WIRE_GAUGES).join(', ') };

  // Round trip (power + ground)
  const totalLength = wireLength_m * 2;
  const resistance = gauge.resistance_per_m * totalLength;
  const vDrop = current_A * resistance;
  const vDropPct = (vDrop / systemVoltage) * 100;
  const powerLoss_W = current_A * current_A * resistance;

  return {
    current_A,
    wireLength_m,
    gauge: gaugeAWG,
    wireArea_mm2: gauge.area_mm2,
    roundTripLength_m: totalLength,
    totalResistance_ohm: Math.round(resistance*10000)/10000,
    voltageDrop_V: Math.round(vDrop*1000)/1000,
    voltageDropPercent: Math.round(vDropPct*10)/10,
    deliveredVoltage_V: Math.round((systemVoltage - vDrop)*100)/100,
    powerLoss_W: Math.round(powerLoss_W*100)/100,
    rating: vDropPct < 3 ? 'excellent' : vDropPct < 5 ? 'acceptable' : vDropPct < 10 ? 'marginal' : 'excessive',
    maxRecommended: vDropPct > 3 ? 'Consider upgrading to a larger gauge for this run length' : 'Wire size is adequate'
  };
}

// Recommend wire gauge for given load
export function recommendWireGauge(current_A, wireLength_m, maxDropPercent=3, environment='chassis') {
  const results = [];
  const sortedGauges = Object.entries(WIRE_GAUGES).sort((a,b) => b[1].area_mm2 - a[1].area_mm2);

  for(const [k,g] of sortedGauges) {
    const maxAmps = environment === 'engine' ? g.maxAmps_engine : g.maxAmps_chassis;
    const totalR = g.resistance_per_m * wireLength_m * 2;
    const vDrop = current_A * totalR;
    const vDropPct = (vDrop / 13.8) * 100;

    if(current_A <= maxAmps && vDropPct <= maxDropPercent) {
      results.push({
        gauge: k,
        area_mm2: g.area_mm2,
        maxAmps,
        voltageDrop_V: Math.round(vDrop*1000)/1000,
        voltageDropPercent: Math.round(vDropPct*10)/10,
        headroom_pct: Math.round(((maxAmps - current_A) / maxAmps) * 100)
      });
    }
  }

  // Pick smallest gauge that meets spec (last in filtered list = smallest wire)
  const recommended = results.length > 0 ? results[results.length - 1] : null;
  const upgrade = results.length > 1 ? results[results.length - 2] : null;

  return {
    current_A,
    wireLength_m,
    maxDropPercent,
    environment,
    recommended,
    upgradeOption: upgrade,
    allSuitable: results.reverse(),
    fuseRating_A: recommended ? Math.ceil(current_A * 1.25 / 5) * 5 : null, // 125% rounded up to nearest 5A
    notes: !recommended ? 'No standard gauge meets requirements — use parallel runs or bus bar' : null
  };
}

// Size alternator for total electrical load
export function sizeAlternator(loads, idleRPMRatio=0.33, headroom_pct=20) {
  // loads: array of { name, amps, dutyPercent }
  // or just string IDs from COMMON_LOADS
  let totalContinuous = 0;
  let totalPeak = 0;
  const breakdown = [];

  for(const load of loads) {
    let name, amps, duty;
    if(typeof load === 'string') {
      const cl = COMMON_LOADS[load];
      if(!cl) continue;
      name = cl.name; amps = cl.amps; duty = 100;
    } else {
      name = load.name || 'Custom';
      amps = load.amps || 0;
      duty = load.dutyPercent || 100;
    }
    const continuous = amps * (duty / 100);
    totalContinuous += continuous;
    totalPeak += amps;
    breakdown.push({ name, amps, dutyPercent: duty, continuousLoad_A: Math.round(continuous*10)/10 });
  }

  // Alternator output at idle is ~33% of rated
  const requiredRated = totalContinuous / idleRPMRatio;
  const withHeadroom = requiredRated * (1 + headroom_pct / 100);
  const recommendedSize = Math.ceil(withHeadroom / 10) * 10; // round up to nearest 10A

  // Standard alternator sizes
  const stdSizes = [65, 80, 100, 120, 140, 160, 180, 200, 240, 270, 320, 370];
  const bestStd = stdSizes.find(s => s >= recommendedSize) || stdSizes[stdSizes.length-1];

  return {
    loads: breakdown,
    totalContinuousLoad_A: Math.round(totalContinuous*10)/10,
    totalPeakLoad_A: Math.round(totalPeak*10)/10,
    idleRPMRatio,
    requiredAtIdle_A: Math.round(totalContinuous*10)/10,
    requiredRatedOutput_A: Math.round(requiredRated),
    withHeadroom_A: Math.round(withHeadroom),
    recommendedAlternator_A: bestStd,
    dualAlternator: bestStd > 270 ? { primary: 200, secondary: Math.ceil((withHeadroom - 200) / 10) * 10 } : null,
    notes: bestStd > 270 ? 'Consider dual alternator setup for this load level' :
           bestStd > 200 ? 'High-output aftermarket alternator required' :
           'Standard aftermarket or OEM upgrade alternator'
  };
}

// Battery capacity analysis
export function analyzeBattery(batteryType, capacity_Ah, loads, cranking_A=200) {
  const bt = BATTERY_TYPES[batteryType];
  if(!bt) return { error: 'Unknown type. Use: '+Object.keys(BATTERY_TYPES).join(', ') };

  const totalLoad_A = loads.reduce((sum, l) => {
    if(typeof l === 'string') { const cl = COMMON_LOADS[l]; return sum + (cl ? cl.amps : 0); }
    return sum + (l.amps || 0);
  }, 0);

  const energyCapacity_Wh = capacity_Ah * bt.voltage;
  const usableCapacity_Ah = capacity_Ah * (batteryType === 'lithium' ? 0.90 : 0.50); // DOD limits
  const runtimeWithoutAlt_min = (usableCapacity_Ah / totalLoad_A) * 60;

  // CCA estimate (rough: 1Ah ≈ 7-10 CCA for lead acid, 15+ for lithium)
  const ccaFactor = batteryType === 'lithium' ? 15 : batteryType.includes('optima') ? 10 : 8;
  const estimatedCCA = Math.round(capacity_Ah * ccaFactor);
  const crankingAdequate = estimatedCCA >= cranking_A * 1.5;

  return {
    batteryType,
    typeName: bt.name,
    capacity_Ah,
    voltage: bt.voltage,
    energyCapacity_Wh: Math.round(energyCapacity_Wh),
    usableCapacity_Ah: Math.round(usableCapacity_Ah*10)/10,
    estimatedCCA,
    crankingRequirement_A: cranking_A,
    crankingAdequate,
    totalAccessoryLoad_A: Math.round(totalLoad_A*10)/10,
    runtimeWithoutAlternator_min: Math.round(runtimeWithoutAlt_min*10)/10,
    selfDischarge_pctPerMonth: bt.selfDischarge_pctPerMonth,
    expectedCycleLife: bt.cycleLife,
    chargingVoltage: bt.chargingVoltage,
    weight_estimate_kg: Math.round(energyCapacity_Wh / bt.energyDensity_WhPerKg * 10)/10,
    recommendation: !crankingAdequate ? 'Battery CCA too low for starter — increase capacity or use lithium' :
                    runtimeWithoutAlt_min < 10 ? 'Very limited reserve — reduce parasitic loads or increase capacity' :
                    runtimeWithoutAlt_min < 30 ? 'Adequate for normal use, limited key-on-engine-off time' :
                    'Good reserve capacity for accessory use'
  };
}

// Fuse and relay sizing
export function sizeFuseRelay(current_A, loadType='resistive', wireGauge=null) {
  // Fuse sizing: 125% of continuous, 80% of intermittent
  const fuseFactor = loadType === 'motor' ? 1.5 : loadType === 'inductive' ? 1.4 : 1.25;
  const fuseRating = Math.ceil(current_A * fuseFactor / 5) * 5; // nearest 5A

  // Relay sizing
  const relayRating = current_A <= 30 ? 30 : current_A <= 40 ? 40 : current_A <= 70 ? 70 : 80;
  const needsRelay = current_A > 5;

  // Wire gauge check
  let wireCheck = null;
  if(wireGauge) {
    const g = WIRE_GAUGES[String(wireGauge)];
    if(g) {
      wireCheck = {
        gauge: wireGauge,
        maxAmps: g.maxAmps_chassis,
        adequate: g.maxAmps_chassis >= current_A,
        note: g.maxAmps_chassis < current_A ? 'Wire gauge too small for this load' : 'Wire gauge OK'
      };
    }
  }

  return {
    current_A,
    loadType,
    fuseFactor,
    recommendedFuse_A: fuseRating,
    fuseType: fuseRating <= 30 ? 'ATC/ATO Mini Blade' : fuseRating <= 60 ? 'Maxi Blade' : 'ANL/Mega Fuse',
    needsRelay,
    relayRating_A: needsRelay ? relayRating : null,
    relayType: !needsRelay ? null : current_A > 40 ? 'Heavy-Duty SPDT' : 'Standard Bosch SPDT',
    wireCheck,
    notes: loadType === 'motor' ? 'Motor loads have high inrush current — fuse sized at 150%' :
           loadType === 'inductive' ? 'Inductive loads (solenoids, coils) — add flyback diode' :
           'Standard resistive load fusing'
  };
}

// Full electrical system audit
export function auditElectricalSystem(alternator_A, battery_Ah, batteryType, loadIds=[], customLoads=[]) {
  const allLoads = [];
  for(const id of loadIds) {
    const cl = COMMON_LOADS[id];
    if(cl) allLoads.push({ ...cl, id, dutyPercent:100 });
  }
  for(const cl of customLoads) {
    allLoads.push({ name:cl.name||'Custom', amps:cl.amps||0, priority:cl.priority||'accessory', dutyPercent:cl.dutyPercent||100 });
  }

  const essential = allLoads.filter(l=>l.priority==='essential');
  const high = allLoads.filter(l=>l.priority==='high');
  const comfort = allLoads.filter(l=>l.priority==='comfort');
  const perf = allLoads.filter(l=>l.priority==='performance');
  const acc = allLoads.filter(l=>l.priority==='accessory');

  const sumAmps = arr => arr.reduce((s,l) => s + l.amps * (l.dutyPercent/100), 0);
  const essentialLoad = sumAmps(essential);
  const totalLoad = sumAmps(allLoads);

  const bt = BATTERY_TYPES[batteryType] || BATTERY_TYPES.agm;
  const altOutputAtIdle = alternator_A * 0.33;
  const altOutputAtCruise = alternator_A * 0.70;
  const altOutputAtHigh = alternator_A * 0.95;

  const deficitAtIdle = totalLoad - altOutputAtIdle;
  const deficitAtCruise = totalLoad - altOutputAtCruise;

  return {
    alternator_A,
    battery_Ah,
    batteryType,
    loadBreakdown: {
      essential: { count:essential.length, amps:Math.round(essentialLoad*10)/10 },
      high:      { count:high.length, amps:Math.round(sumAmps(high)*10)/10 },
      comfort:   { count:comfort.length, amps:Math.round(sumAmps(comfort)*10)/10 },
      performance:{ count:perf.length, amps:Math.round(sumAmps(perf)*10)/10 },
      accessory: { count:acc.length, amps:Math.round(sumAmps(acc)*10)/10 }
    },
    totalContinuousLoad_A: Math.round(totalLoad*10)/10,
    alternatorOutput: {
      atIdle: Math.round(altOutputAtIdle),
      atCruise: Math.round(altOutputAtCruise),
      atHighRPM: Math.round(altOutputAtHigh)
    },
    surplus: {
      atIdle: Math.round(altOutputAtIdle - totalLoad),
      atCruise: Math.round(altOutputAtCruise - totalLoad),
      atHighRPM: Math.round(altOutputAtHigh - totalLoad)
    },
    verdict: deficitAtCruise > 0 ? 'CRITICAL: Alternator undersized — battery will drain at cruise' :
             deficitAtIdle > 0 && deficitAtCruise <= 0 ? 'WARNING: Battery drains at idle — OK at cruise RPM' :
             totalLoad > altOutputAtCruise * 0.85 ? 'CAUTION: Running close to alternator capacity' :
             'GOOD: Alternator adequately sized for current loads',
    recommendations: [
      ...(deficitAtCruise > 0 ? [`Upgrade alternator to ${Math.ceil((totalLoad/0.70)/10)*10}A minimum`] : []),
      ...(deficitAtIdle > 20 ? ['Consider higher-idle setting or idle-up solenoid'] : []),
      ...(battery_Ah < totalLoad * 0.5 ? ['Battery capacity low — consider upgrading for reserve'] : []),
      ...(allLoads.length > 10 ? ['Consider fuse distribution block for organization'] : [])
    ]
  };
}

// Big 3 upgrade calculator
export function calcBig3Upgrade(alternator_A, cableLength_battery_to_engine_m=0.5, cableLength_battery_to_chassis_m=0.6, cableLength_alternator_to_battery_m=0.8) {
  // Big 3: battery-to-chassis ground, alternator-to-battery positive, engine-to-chassis ground
  const totalCurrent = alternator_A;

  const cables = [
    { name:'Battery Negative → Chassis Ground', length_m: cableLength_battery_to_chassis_m, current_A: totalCurrent },
    { name:'Alternator Output → Battery Positive', length_m: cableLength_alternator_to_battery_m, current_A: totalCurrent },
    { name:'Engine Block → Chassis Ground', length_m: cableLength_battery_to_engine_m, current_A: totalCurrent * 0.8 }
  ];

  const recommendations = cables.map(c => {
    const rec = recommendWireGauge(c.current_A, c.length_m, 2, 'engine');
    return {
      cable: c.name,
      length_m: c.length_m,
      current_A: c.current_A,
      recommendedGauge: rec.recommended ? rec.recommended.gauge : '0000',
      voltageDrop: rec.recommended ? rec.recommended.voltageDrop_V : null
    };
  });

  return {
    alternator_A,
    purpose: 'Big 3 Upgrade — improves charging efficiency and reduces voltage drop to battery',
    cables: recommendations,
    additionalParts: [
      'Ring terminals (gold-plated recommended)',
      'Heat shrink tubing',
      'Split loom for protection',
      alternator_A > 200 ? 'ANL fuse holder + fuse on alternator-to-battery cable' : 'Inline mega fuse on alternator cable'
    ],
    notes: 'Always disconnect battery before starting. Use OEM ground points. Do NOT remove OEM wiring — add parallel runs.'
  };
}

// Query helpers
export function listWireGauges() { return Object.entries(WIRE_GAUGES).map(([k,v])=>({id:k,...v})); }
export function getWireGauge(id) { const w=WIRE_GAUGES[String(id)]; return w?{id,...w}:null; }
export function listBatteryTypes() { return Object.entries(BATTERY_TYPES).map(([k,v])=>({id:k,...v})); }
export function getBatteryType(id) { const b=BATTERY_TYPES[id]; return b?{id,...b}:null; }
export function listCommonLoads() { return Object.entries(COMMON_LOADS).map(([k,v])=>({id:k,...v})); }
export function getCommonLoad(id) { const l=COMMON_LOADS[id]; return l?{id,...l}:null; }
export function searchCommonLoads(q) {
  const lq = q.toLowerCase();
  return Object.entries(COMMON_LOADS).filter(([k,v])=>k.includes(lq)||v.name.toLowerCase().includes(lq)).map(([k,v])=>({id:k,...v}));
}

export function electricalCalcStats() {
  return {
    module: 'electrical-calc',
    version: '1.0.0',
    wireGauges: Object.keys(WIRE_GAUGES).length,
    batteryTypes: Object.keys(BATTERY_TYPES).length,
    commonLoads: Object.keys(COMMON_LOADS).length,
    calculations: [
      'calcVoltageDrop','recommendWireGauge','sizeAlternator','analyzeBattery',
      'sizeFuseRelay','auditElectricalSystem','calcBig3Upgrade'
    ]
  };
}
