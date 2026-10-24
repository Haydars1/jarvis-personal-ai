// ═══════════════════════════════════════════════════════════════════════════
// Suspension & Alignment Calculator — JARVIS ECU Platform
// Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const SPRING_TYPES={
  linear:{name:'Linear Rate Spring',type:'linear',description:'Constant rate throughout travel'},
  progressive:{name:'Progressive Rate Spring',type:'progressive',description:'Rate increases with compression — soft ride, firm under load'},
  dual_rate:{name:'Dual Rate Spring',type:'dual_rate',description:'Two distinct rates with a tender spring'},
  coilover:{name:'Coilover Spring',type:'coilover',description:'Threaded body for height adjustment'},
  air_spring:{name:'Air Spring',type:'air',description:'Adjustable rate via air pressure — load leveling'},
  leaf_spring:{name:'Leaf Spring',type:'leaf',description:'Multi-leaf for trucks and heavy axles'},
  torsion_bar:{name:'Torsion Bar',type:'torsion',description:'Twisted bar spring — common in older vehicles and off-road'}
};

export const DAMPER_TYPES={
  twin_tube:{name:'Twin-Tube Shock',type:'twin_tube',gasCharged:false,adjustable:false,application:'OEM replacement, budget builds',pros:'Low cost, adequate performance',cons:'Fades under sustained hard use'},
  twin_tube_gas:{name:'Gas-Charged Twin-Tube',type:'twin_tube',gasCharged:true,adjustable:false,application:'Improved OEM, daily performance',pros:'Better fade resistance, less aeration',cons:'Slightly harsher ride than hydraulic'},
  monotube:{name:'Monotube Shock',type:'monotube',gasCharged:true,adjustable:false,application:'Performance, track day',pros:'Superior heat dissipation, more consistent',cons:'Higher cost, transmits more road noise'},
  monotube_adj:{name:'Adjustable Monotube',type:'monotube',gasCharged:true,adjustable:true,adjustments:'compression+rebound',application:'Track, autocross, spirited street',pros:'Tunable damping, monotube cooling',cons:'Requires setup knowledge'},
  coilover_adj:{name:'Adjustable Coilover',type:'coilover',gasCharged:true,adjustable:true,adjustments:'compression+rebound+height',application:'Motorsport, serious track cars',pros:'Full adjustability, precise corner balance',cons:'Premium cost, needs proper setup'},
  remote_res:{name:'Remote Reservoir Shock',type:'remote_reservoir',gasCharged:true,adjustable:true,adjustments:'compression+rebound+preload',application:'Off-road racing, desert running, Baja',pros:'Massive oil volume, extreme fade resistance',cons:'Complex routing, expensive'},
  bilstein_b6:{name:'Bilstein B6 (HD)',type:'monotube',gasCharged:true,adjustable:false,application:'Heavy-duty OEM upgrade, towing',pros:'Monotube reliability, firm control',cons:'Firm ride for daily comfort'},
  koni_sport:{name:'Koni Sport (Yellow)',type:'twin_tube',gasCharged:true,adjustable:true,adjustments:'rebound',application:'Street performance, autocross',pros:'Adjustable rebound, excellent value',cons:'Twin-tube fade on long sessions'},
  ohlins_road_track:{name:'Öhlins Road & Track',type:'monotube',gasCharged:true,adjustable:true,adjustments:'compression+rebound (dual)',application:'Premium track/street, GT cars',pros:'DFV technology, excellent ride quality',cons:'Premium price'},
  king_oem:{name:'King OEM Performance',type:'remote_reservoir',gasCharged:true,adjustable:true,adjustments:'compression+rebound',application:'Off-road trucks, overland',pros:'Race-proven, huge oil volume',cons:'Requires lift for proper travel'}
};

export const SWAY_BAR_SIZES={
  '19mm':{diameter_mm:19,stiffness_relative:1.0,application:'Stock economy car front'},
  '22mm':{diameter_mm:22,stiffness_relative:1.8,application:'Stock sport sedan front'},
  '24mm':{diameter_mm:24,stiffness_relative:2.4,application:'Mild upgrade front'},
  '26mm':{diameter_mm:26,stiffness_relative:3.2,application:'Performance upgrade front'},
  '28mm':{diameter_mm:28,stiffness_relative:4.3,application:'Track-focused front'},
  '30mm':{diameter_mm:30,stiffness_relative:5.6,application:'Race car front, rear heavy cars'},
  '32mm':{diameter_mm:32,stiffness_relative:7.3,application:'Race only, high downforce'},
  '16mm':{diameter_mm:16,stiffness_relative:0.5,application:'Stock economy car rear'},
  '19mm_rear':{diameter_mm:19,stiffness_relative:1.0,application:'Stock sport sedan rear'},
  '22mm_rear':{diameter_mm:22,stiffness_relative:1.8,application:'Upgraded rear for balance'}
};

export const ALIGNMENT_SPECS={
  street_neutral:{name:'Street Neutral',camber_front_deg:-0.5,camber_rear_deg:-0.3,toe_front_mm:0,toe_rear_mm:1,caster_deg:5.0,use:'Daily driving, even tire wear'},
  street_sporty:{name:'Street Sporty',camber_front_deg:-1.0,camber_rear_deg:-0.8,toe_front_mm:0,toe_rear_mm:1.5,caster_deg:6.0,use:'Spirited driving, mild autocross'},
  autocross:{name:'Autocross',camber_front_deg:-2.5,camber_rear_deg:-1.8,toe_front_mm:-1,toe_rear_mm:2,caster_deg:7.0,use:'Autocross, aggressive handling'},
  track_grip:{name:'Track Grip',camber_front_deg:-3.0,camber_rear_deg:-2.0,toe_front_mm:-1,toe_rear_mm:2,caster_deg:7.5,use:'Circuit racing, maximum grip'},
  drift:{name:'Drift',camber_front_deg:-4.0,camber_rear_deg:-1.0,toe_front_mm:-2,toe_rear_mm:3,caster_deg:8.0,use:'Drifting — maximum steering angle, rear slip'},
  drag:{name:'Drag Racing',camber_front_deg:0,camber_rear_deg:0,toe_front_mm:0,toe_rear_mm:0,caster_deg:5.0,use:'Drag strip — straight-line stability'},
  off_road:{name:'Off-Road',camber_front_deg:0,camber_rear_deg:0,toe_front_mm:1,toe_rear_mm:1,caster_deg:4.0,use:'Off-road, trail running — durability focus'},
  stance:{name:'Stance / Show',camber_front_deg:-6.0,camber_rear_deg:-6.0,toe_front_mm:0,toe_rear_mm:0,caster_deg:5.0,use:'Show car — extreme camber (rapid tire wear warning)'}
};

// ── Calculations ──

export function calcSpringRate(vehicleWeight_kg,wheelRate_pct=60,naturalFreq_hz=1.5){
  // k = (2π·f)² · m
  const cornerWeight_kg=vehicleWeight_kg/4;
  const springRate_n_m=(2*Math.PI*naturalFreq_hz)**2*cornerWeight_kg;
  const springRate_kg_mm=springRate_n_m/9810;
  const wheelRate=springRate_n_m*(wheelRate_pct/100);
  return {vehicleWeight_kg,cornerWeight_kg,naturalFreq_hz,wheelRate_pct,
    springRate_n_m:Math.round(springRate_n_m),
    springRate_kg_mm:Math.round(springRate_kg_mm*100)/100,
    springRate_lbs_in:Math.round(springRate_n_m/175.13),
    wheelRate_n_m:Math.round(wheelRate),
    recommendation:naturalFreq_hz<1.2?'Very soft — comfort/luxury ride':naturalFreq_hz<1.5?'Soft — touring/GT':naturalFreq_hz<2.0?'Medium — street performance':naturalFreq_hz<2.5?'Firm — track day':naturalFreq_hz<3.0?'Stiff — race car':'Very stiff — formula car / high downforce'}
}

export function calcDamperRatio(springRate_n_m,cornerWeight_kg,targetRatio=0.3){
  // critical damping = 2·√(k·m)
  const criticalDamping=2*Math.sqrt(springRate_n_m*cornerWeight_kg);
  const targetDamping=criticalDamping*targetRatio;
  return {springRate_n_m,cornerWeight_kg,criticalDamping_ns_m:Math.round(criticalDamping),
    targetDampingRatio:targetRatio,
    targetDamping_ns_m:Math.round(targetDamping),
    reboundDamping_ns_m:Math.round(targetDamping*0.65),
    compressionDamping_ns_m:Math.round(targetDamping*0.35),
    recommendation:targetRatio<0.2?'Underdamped — bouncy, slow to settle':targetRatio<0.3?'Light damping — comfort ride':targetRatio<0.5?'Moderate — street performance':targetRatio<0.7?'Firm — track use':'Overdamped — harsh, slow response'}
}

export function calcRideHeight(springRate_n_m,cornerWeight_kg,springFreeLength_mm,desiredDrop_mm=0){
  const staticDeflection_mm=(cornerWeight_kg*9.81/springRate_n_m)*1000;
  const installedLength_mm=springFreeLength_mm-staticDeflection_mm-desiredDrop_mm;
  const remainingTravel_mm=installedLength_mm*0.3; // approx
  return {springRate_n_m,cornerWeight_kg,springFreeLength_mm,desiredDrop_mm,
    staticDeflection_mm:Math.round(staticDeflection_mm),
    installedLength_mm:Math.round(installedLength_mm),
    estimatedRemainingTravel_mm:Math.round(remainingTravel_mm),
    warning:remainingTravel_mm<30?'LOW TRAVEL — risk of bottoming out on bumps':
      remainingTravel_mm<50?'Limited travel — fine for smooth surfaces':'Adequate travel'}
}

export function calcSwayBarEffect(frontBar_mm,rearBar_mm,vehicleWeight_kg,cg_height_mm=500,trackWidth_mm=1500){
  // Sway bar stiffness ∝ d⁴ (solid bar)
  const frontStiffness=Math.pow(frontBar_mm,4);
  const rearStiffness=Math.pow(rearBar_mm,4);
  const totalStiffness=frontStiffness+rearStiffness;
  const frontRollPct=frontStiffness/totalStiffness*100;
  const rearRollPct=rearStiffness/totalStiffness*100;
  const rollStiffness_nm_deg=(frontStiffness+rearStiffness)*0.0001*trackWidth_mm/1000;
  const lateralG=1.0;
  const rollAngle=(vehicleWeight_kg*9.81*lateralG*cg_height_mm/1000)/(rollStiffness_nm_deg*57.3);
  return {frontBar_mm,rearBar_mm,frontRollDistribution_pct:Math.round(frontRollPct),rearRollDistribution_pct:Math.round(rearRollPct),
    estimatedRollAngle_deg_at_1g:Math.round(rollAngle*10)/10,
    handling:frontRollPct>55?'Understeer bias — front bar dominant':frontRollPct<45?'Oversteer bias — rear bar dominant':'Neutral balance',
    recommendation:rollAngle>4?'High body roll — stiffer bars or springs needed':rollAngle>2?'Moderate roll — acceptable for street':'Low roll — good track setup'}
}

export function calcCornerWeight(fl_kg,fr_kg,rl_kg,rr_kg){
  const total=fl_kg+fr_kg+rl_kg+rr_kg;
  const frontPct=(fl_kg+fr_kg)/total*100;
  const rearPct=(rl_kg+rr_kg)/total*100;
  const leftPct=(fl_kg+rl_kg)/total*100;
  const rightPct=(fr_kg+rr_kg)/total*100;
  const crossFL_RR=fl_kg+rr_kg;
  const crossFR_RL=fr_kg+rl_kg;
  const crossWeightPct=crossFL_RR/total*100;
  const diagonalDiff=Math.abs(crossFL_RR-crossFR_RL);
  return {fl_kg,fr_kg,rl_kg,rr_kg,total_kg:total,
    frontDistribution_pct:Math.round(frontPct*10)/10,rearDistribution_pct:Math.round(rearPct*10)/10,
    leftDistribution_pct:Math.round(leftPct*10)/10,rightDistribution_pct:Math.round(rightPct*10)/10,
    crossWeight_pct:Math.round(crossWeightPct*10)/10,
    diagonalDifference_kg:Math.round(diagonalDiff),
    balance:diagonalDiff<5?'Excellent balance':diagonalDiff<15?'Good — minor adjustment needed':diagonalDiff<30?'Fair — adjust spring preload/ride height':'Poor — significant rebalancing needed',
    idealCrossWeight:'50.0%',
    adjustments:diagonalDiff>5?[`${crossFL_RR>crossFR_RL?'Lower FL or RR':'Lower FR or RL'} spring preload by ${Math.round(diagonalDiff/2)} kg equivalent`]:[]}
}

export function calcBumpSteer(steeringRackHeight_mm,tieRodLength_mm,suspTravel_mm){
  // simplified bump steer estimate
  const arcDiff=(suspTravel_mm/tieRodLength_mm)*steeringRackHeight_mm/10;
  const bumpSteer_deg=Math.atan(arcDiff/tieRodLength_mm)*57.3;
  return {steeringRackHeight_mm,tieRodLength_mm,suspTravel_mm,
    estimatedBumpSteer_deg:Math.round(Math.abs(bumpSteer_deg)*100)/100,
    severity:Math.abs(bumpSteer_deg)>0.5?'HIGH — steering feels twitchy over bumps, re-shim rack or adjust tie rod angle':
      Math.abs(bumpSteer_deg)>0.2?'MODERATE — noticeable, consider adjustment':'LOW — acceptable'}
}

export function calcAntiSquat(pivotHeight_mm,wheelbase_mm,cg_height_mm,driveType='rwd'){
  // Anti-squat % = (instant center height / CG height) * 100 for rear drive
  let antiSquat_pct;
  if(driveType==='rwd'||driveType==='awd'){
    antiSquat_pct=(pivotHeight_mm/cg_height_mm)*100;
  }else{
    antiSquat_pct=(pivotHeight_mm/cg_height_mm)*50; // FWD has less anti-squat geometry
  }
  return {pivotHeight_mm,wheelbase_mm,cg_height_mm,driveType,
    antiSquat_pct:Math.round(antiSquat_pct),
    effect:antiSquat_pct>120?'Excessive — rear lifts under hard acceleration':antiSquat_pct>80?'High — minimal squat, good for drag racing':antiSquat_pct>40?'Moderate — balanced for street/track':'Low — significant squat under acceleration'}
}

export function recommendAlignment(use='street_neutral'){
  const spec=ALIGNMENT_SPECS[use];
  if(!spec)return {error:'Unknown alignment preset',available:Object.keys(ALIGNMENT_SPECS)};
  return {preset:spec,
    tireWearNote:Math.abs(spec.camber_front_deg)>2?'Aggressive camber will cause accelerated inner tire wear — rotate tires frequently':'Normal tire wear expected',
    tips:['Always set caster first, then camber, then toe',
      'Let the car settle on its own weight before measuring',
      'Drive 50 km then recheck — bushings settle',
      Math.abs(spec.camber_front_deg)>3?'Use camber plates or adjustable arms for this much camber':'',
      spec.caster_deg>7?'High caster improves straight-line stability but increases steering effort':''].filter(Boolean)}
}

// ── Query Functions ──

export function listSpringTypes(){return Object.entries(SPRING_TYPES).map(([k,v])=>({key:k,...v}))}
export function getSpringType(key){const s=SPRING_TYPES[key];return s?{key,...s}:null}
export function listDamperTypes(){return Object.entries(DAMPER_TYPES).map(([k,v])=>({key:k,...v}))}
export function getDamperType(key){const d=DAMPER_TYPES[key];return d?{key,...d}:null}
export function searchDamperTypes(q){const l=q.toLowerCase();return listDamperTypes().filter(d=>d.name.toLowerCase().includes(l)||(d.application||'').toLowerCase().includes(l))}
export function listSwayBarSizes(){return Object.entries(SWAY_BAR_SIZES).map(([k,v])=>({key:k,...v}))}
export function listAlignmentSpecs(){return Object.entries(ALIGNMENT_SPECS).map(([k,v])=>({key:k,...v}))}
export function getAlignmentSpec(key){const a=ALIGNMENT_SPECS[key];return a?{key,...a}:null}

export function suspensionCalcStats(){
  return {module:'Suspension & Alignment Calculator',
    springTypes:Object.keys(SPRING_TYPES).length,
    damperTypes:Object.keys(DAMPER_TYPES).length,
    swayBarSizes:Object.keys(SWAY_BAR_SIZES).length,
    alignmentPresets:Object.keys(ALIGNMENT_SPECS).length,
    calculations:['calcSpringRate','calcDamperRatio','calcRideHeight','calcSwayBarEffect','calcCornerWeight','calcBumpSteer','calcAntiSquat','recommendAlignment']}
}
