// ═══════════════════════════════════════════════════════════════════════════
// Differential & Transfer Case Calculator — JARVIS ECU Platform
// C++ style, Cloudflare Workers ESM, zero dependencies
// ═══════════════════════════════════════════════════════════════════════════

export const DIFF_TYPES={
  open:{name:'Open Differential',type:'open',lockingPct:0,biasRatio:1,applications:'Standard passenger cars',pros:'Smooth turning, low cost',cons:'No torque transfer to wheel with grip'},
  limited_slip_clutch:{name:'Clutch-Type LSD',type:'lsd_clutch',lockingPct:75,biasRatio:3,preload_nm:50,applications:'Sports cars, mild off-road',pros:'Good street manners, adjustable preload',cons:'Clutch packs wear over time'},
  limited_slip_gear:{name:'Torsen / Gear-Type LSD',type:'lsd_gear',lockingPct:80,biasRatio:3.5,applications:'AWD systems, performance sedans',pros:'No clutch packs to wear, instant response',cons:'Cannot transfer torque if one wheel is fully unloaded'},
  viscous_coupling:{name:'Viscous Coupling LSD',type:'viscous',lockingPct:50,biasRatio:2,applications:'AWD center diff, light SUVs',pros:'Smooth engagement, maintenance-free',cons:'Heats up under sustained slip, not aggressive enough for racing'},
  electronic_lsd:{name:'Electronic LSD (eLSD)',type:'elsd',lockingPct:100,biasRatio:'variable',applications:'Modern performance cars, BMW M, Audi Sport',pros:'ECU-controlled torque vectoring, fastest response',cons:'Complex, expensive, adds weight'},
  locking:{name:'Selectable Locking Diff',type:'locking',lockingPct:100,biasRatio:'infinite',applications:'Off-road, rock crawling, military',pros:'Full lock = maximum traction',cons:'Cannot turn on pavement when locked'},
  spool:{name:'Spool (Welded/Mini-Spool)',type:'spool',lockingPct:100,biasRatio:'infinite',applications:'Drag racing, drift cars',pros:'Lightest, strongest, zero breakage',cons:'Both wheels always turn at same speed — terrible on street'},
  detroit_locker:{name:'Detroit Locker',type:'auto_locking',lockingPct:100,biasRatio:'infinite',applications:'Heavy trucks, off-road racing',pros:'Automatic locking under torque, full power to both wheels',cons:'Clicks/bangs on turns, tire wear on pavement'},
  quaife_atb:{name:'Quaife ATB Differential',type:'lsd_gear',lockingPct:82,biasRatio:4,applications:'FWD hot hatches, rally cars',pros:'Helical gear — smooth, progressive, no wear items',cons:'Loses effectiveness if one wheel is fully airborne'},
  drexler:{name:'Drexler LSD',type:'lsd_clutch',lockingPct:90,biasRatio:5,preload_nm:80,applications:'GT racing, time attack, high-power builds',pros:'Adjustable ramp angles, high preload',cons:'Requires setup knowledge, periodic rebuild'},
  wavetrac:{name:'Wavetrac ATB Differential',type:'lsd_gear',lockingPct:85,biasRatio:4.2,applications:'Motorsport, high-grip tire setups',pros:'Works even with one wheel unloaded (wave design)',cons:'Premium price'},
  eaton_elocker:{name:'Eaton E-Locker',type:'electronic_locking',lockingPct:100,biasRatio:'infinite',applications:'Off-road trucks, Jeep, Toyota',pros:'Push-button full lock, open when unlocked',cons:'Wiring, solenoid maintenance'}
};

export const DIFF_RATIOS={
  '2.73':{ratio:2.73,use:'Highway cruising, fuel economy',common:'Ford trucks, older sedans'},
  '3.08':{ratio:3.08,use:'Balanced street/highway',common:'GM trucks, muscle cars'},
  '3.23':{ratio:3.23,use:'Mild performance street',common:'Mopar, some imports'},
  '3.42':{ratio:3.42,use:'Street performance',common:'Camaro, Mustang, BMW'},
  '3.55':{ratio:3.55,use:'Performance/towing compromise',common:'Trucks, SUVs'},
  '3.73':{ratio:3.73,use:'Street/strip performance',common:'Mustang GT, Camaro SS'},
  '3.91':{ratio:3.91,use:'Aggressive street, autocross',common:'BMW M, Corvette Z06'},
  '4.10':{ratio:4.10,use:'Drag, autocross, off-road',common:'Jeep, drag builds'},
  '4.30':{ratio:4.30,use:'Deep ratio — short track, off-road',common:'Rock crawling rigs'},
  '4.56':{ratio:4.56,use:'Very deep — big tires, rock crawling',common:'Jeep builds with 37"+ tires'},
  '4.88':{ratio:4.88,use:'Extreme off-road, large tires',common:'Ultra4 racing, 40" tires'},
  '5.13':{ratio:5.13,use:'Maximum crawl ratio',common:'Competition rock crawlers'},
  '5.38':{ratio:5.38,use:'Competition crawl',common:'Ultra4, King of the Hammers'}
};

export const TRANSFER_CASES={
  np231:{name:'NP231 (New Process 231)',type:'part_time',ratios:{high:1.0,low:2.72},chain:true,torqueRating_nm:400,applications:'Jeep Wrangler TJ/YJ, Cherokee XJ',features:'Part-time 4WD, chain drive, light duty'},
  np242:{name:'NP242 (Selec-Trac)',type:'full_time',ratios:{high:1.0,low:2.72},chain:true,torqueRating_nm:500,applications:'Jeep Grand Cherokee ZJ/WJ, Cherokee XJ',features:'Full-time AWD + part-time 4WD, center diff'},
  np241or:{name:'NP241OR',type:'part_time',ratios:{high:1.0,low:2.72},chain:false,torqueRating_nm:800,applications:'Jeep Rubicon, heavy-duty builds',features:'Gear drive, heavy duty, Rubicon spec'},
  np243:{name:'NP243 (AutoTrac)',type:'auto_4wd',ratios:{high:1.0,low:2.72},chain:true,torqueRating_nm:500,applications:'GM Tahoe, Silverado, Suburban',features:'Automatic engagement, clutch-based AWD'},
  np246:{name:'NP246 (AutoTrac)',type:'auto_4wd',ratios:{high:1.0,low:2.72},chain:true,torqueRating_nm:700,applications:'GM Silverado/Sierra 2500, Tahoe/Yukon',features:'Auto 4WD with encoder motor, heavy duty'},
  np271:{name:'NP271 (Manual Shift)',type:'part_time',ratios:{high:1.0,low:2.72},chain:false,torqueRating_nm:1200,applications:'Ford Super Duty, Dodge Ram 2500/3500',features:'Gear drive, manual shift, HD truck spec'},
  np273:{name:'NP273 (Electric Shift)',type:'part_time',ratios:{high:1.0,low:2.72},chain:false,torqueRating_nm:1200,applications:'Ford Super Duty, Ram HD',features:'Gear drive, electric shift, HD rated'},
  borg_warner_4405:{name:'BorgWarner 4405',type:'awd',ratios:{high:1.0},chain:true,torqueRating_nm:600,applications:'Ford Explorer, Mercury Mountaineer',features:'On-demand AWD, electromagnetic clutch'},
  borg_warner_4482:{name:'BorgWarner 4482 (GKN)',type:'awd',ratios:{high:1.0},chain:true,torqueRating_nm:500,applications:'Land Rover, Volvo XC90, BMW xDrive',features:'Hang-on AWD, electrohydraulic clutch'},
  toyota_dual_range:{name:'Toyota Dual-Range Transfer Case',type:'part_time',ratios:{high:1.0,low:2.566},chain:true,torqueRating_nm:700,applications:'Toyota 4Runner, Tacoma, Land Cruiser',features:'Part-time with center diff lock option'},
  magna_mp3023:{name:'Magna MP3023 (Jeep QDII)',type:'full_time',ratios:{high:1.0,low:2.72},chain:true,torqueRating_nm:650,applications:'Jeep Grand Cherokee WK2',features:'Quadra-Drive II, full-time AWD, eLSD center'},
  atlas_4spd:{name:'Atlas 4-Speed Transfer Case',type:'part_time',ratios:{high:1.0,low:3.8,crawl:6.32},chain:false,torqueRating_nm:1500,applications:'Custom rock crawlers, Ultra4',features:'4-speed (2H, 4H, 4L, neutral), gear drive, extreme duty'}
};

export const DIFF_FLUIDS={
  gl4_75w90:{name:'GL-4 75W-90',spec:'API GL-4',viscosity:'75W-90',applications:'Manual transmissions, synchromesh gears',interval_km:60000},
  gl5_75w90:{name:'GL-5 75W-90',spec:'API GL-5',viscosity:'75W-90',applications:'Standard differentials',interval_km:50000},
  gl5_75w140:{name:'GL-5 75W-140',spec:'API GL-5',viscosity:'75W-140',applications:'Heavy-duty, towing, high-temp diffs',interval_km:50000},
  gl5_80w90:{name:'GL-5 80W-90',spec:'API GL-5',viscosity:'80W-90',applications:'Older differentials, budget builds',interval_km:40000},
  lsd_additive:{name:'Limited-Slip Additive (Friction Modifier)',spec:'OEM-specific',viscosity:'additive',applications:'Clutch-type LSD differentials',interval_km:50000},
  atf_tcase:{name:'ATF for Transfer Cases',spec:'Mercon V / Dexron VI',viscosity:'ATF',applications:'Chain-drive transfer cases',interval_km:50000},
  synthetic_75w90:{name:'Full Synthetic 75W-90',spec:'API GL-5 MT-1',viscosity:'75W-90',applications:'Performance diffs, track use',interval_km:80000}
};

// ── Calculations ──

export function calcCrawlRatio(diffRatio,transLowGear,tcaseLowRatio=1.0){
  const crawl=diffRatio*transLowGear*tcaseLowRatio;
  return {diffRatio,transLowGear,tcaseLowRatio,crawlRatio:Math.round(crawl*100)/100,
    rating:crawl>100?'Ultra-crawl — competition rock crawler':crawl>60?'Excellent — serious off-road':crawl>40?'Good — moderate trails':crawl>20?'Adequate — light off-road':'Low — mostly on-road',
    notes:crawl>100?'May need to regear to keep highway speeds reasonable':''}
}

export function calcSpeedAtRPM(diffRatio,transGearRatio,tireDiameter_in,rpm){
  // speed_kph = (rpm * tire_circumference) / (diffRatio * gearRatio * 1000 * conversion)
  const tireCirc_m=tireDiameter_in*0.0254*Math.PI;
  const speed_kph=(rpm*tireCirc_m*60)/(diffRatio*transGearRatio*1000);
  const speed_mph=speed_kph*0.621371;
  return {diffRatio,transGearRatio,tireDiameter_in,rpm,speed_kph:Math.round(speed_kph*10)/10,speed_mph:Math.round(speed_mph*10)/10}
}

export function calcRPMAtSpeed(diffRatio,transGearRatio,tireDiameter_in,speed_kph){
  const tireCirc_m=tireDiameter_in*0.0254*Math.PI;
  const rpm=(speed_kph*1000*diffRatio*transGearRatio)/(tireCirc_m*60);
  return {diffRatio,transGearRatio,tireDiameter_in,speed_kph,rpm:Math.round(rpm)}
}

export function calcTorqueSplit(diffType,inputTorque_nm,leftGrip_pct=100,rightGrip_pct=100){
  const d=DIFF_TYPES[diffType];
  if(!d)return {error:'Unknown diff type'};
  const gripRatio=leftGrip_pct/(leftGrip_pct+rightGrip_pct);
  let leftPct,rightPct;
  if(d.type==='open'){
    // open diff sends equal torque — limited by wheel with least grip
    const minGrip=Math.min(leftGrip_pct,rightGrip_pct);
    const maxPerWheel=inputTorque_nm*(minGrip/100)/2;
    leftPct=50;rightPct=50;
    return {diffType:d.name,inputTorque_nm,leftPct,rightPct,leftTorque_nm:Math.round(maxPerWheel),rightTorque_nm:Math.round(maxPerWheel),
      totalUsable_nm:Math.round(maxPerWheel*2),wastedTorque_nm:Math.round(inputTorque_nm-maxPerWheel*2),
      note:'Open diff limited by wheel with least grip'}
  }
  if(d.type==='spool'||d.type==='locking'||d.type==='auto_locking'||d.type==='electronic_locking'){
    leftPct=gripRatio*100;rightPct=(1-gripRatio)*100;
    return {diffType:d.name,inputTorque_nm,leftPct:Math.round(leftPct),rightPct:Math.round(rightPct),
      leftTorque_nm:Math.round(inputTorque_nm*gripRatio),rightTorque_nm:Math.round(inputTorque_nm*(1-gripRatio)),
      totalUsable_nm:inputTorque_nm,wastedTorque_nm:0,
      note:'Locked diff — torque split follows available grip'}
  }
  // LSD types
  const biasRatio=typeof d.biasRatio==='number'?d.biasRatio:3;
  const minGrip=Math.min(leftGrip_pct,rightGrip_pct);
  const maxGrip=Math.max(leftGrip_pct,rightGrip_pct);
  const lowSide=inputTorque_nm*(minGrip/100)/(1+biasRatio)*biasRatio;
  const highSide=Math.min(inputTorque_nm*(maxGrip/100),lowSide*biasRatio);
  const total=lowSide+highSide;
  if(leftGrip_pct<=rightGrip_pct){leftPct=Math.round(lowSide/total*100);rightPct=100-leftPct}
  else{rightPct=Math.round(lowSide/total*100);leftPct=100-rightPct}
  return {diffType:d.name,biasRatio,inputTorque_nm,leftPct,rightPct,
    leftTorque_nm:Math.round(leftGrip_pct<=rightGrip_pct?lowSide:highSide),
    rightTorque_nm:Math.round(leftGrip_pct<=rightGrip_pct?highSide:lowSide),
    totalUsable_nm:Math.round(total),wastedTorque_nm:Math.round(inputTorque_nm-total),
    note:`LSD transfers up to ${biasRatio}x torque from slipping to gripping wheel`}
}

export function calcDiffTemp(inputTorque_nm,slipRPM_delta,duration_s,oilVolume_l=1.5){
  const frictionCoeff=0.08;
  const power_w=inputTorque_nm*frictionCoeff*(slipRPM_delta*2*Math.PI/60);
  const energy_j=power_w*duration_s;
  const oilMass_kg=oilVolume_l*0.88;
  const specificHeat=2000; // J/(kg·K) for gear oil
  const tempRise=energy_j/(oilMass_kg*specificHeat);
  return {inputTorque_nm,slipRPM_delta,duration_s,oilVolume_l,
    heatGenerated_w:Math.round(power_w),totalEnergy_j:Math.round(energy_j),
    tempRise_c:Math.round(tempRise*10)/10,
    severity:tempRise>60?'CRITICAL — diff cooler mandatory':tempRise>30?'HIGH — consider diff cooler':tempRise>15?'MODERATE — monitor temps':'LOW — within normal range',
    recommendations:tempRise>30?['Install external diff cooler','Use synthetic GL-5 75W-140','Check fluid every 20,000 km']:['Standard maintenance sufficient']}
}

export function recommendDiffRatio(currentRatio,currentTireDiam_in,newTireDiam_in){
  const corrected=currentRatio*(newTireDiam_in/currentTireDiam_in);
  // find nearest available ratio
  const ratios=Object.values(DIFF_RATIOS).map(r=>r.ratio);
  const nearest=ratios.reduce((a,b)=>Math.abs(b-corrected)<Math.abs(a-corrected)?b:a);
  const rpmChange=((nearest/currentRatio)*(currentTireDiam_in/newTireDiam_in)-1)*100;
  return {currentRatio,currentTireDiam_in,newTireDiam_in,
    idealCorrectedRatio:Math.round(corrected*100)/100,
    nearestAvailable:nearest,
    nearestInfo:DIFF_RATIOS[String(nearest)]||{use:'Custom ratio'},
    rpmChangeAtHighway_pct:Math.round(rpmChange*10)/10,
    note:Math.abs(rpmChange)>10?'RPM change is significant — test drive recommended':'RPM change is minor — good swap'}
}

export function recommendDiffFluid(diffType,isLSD=false,heavyDuty=false){
  const d=DIFF_TYPES[diffType];
  const needsFrictionMod=isLSD&&(d?.type==='lsd_clutch');
  const base=heavyDuty?DIFF_FLUIDS.gl5_75w140:DIFF_FLUIDS.gl5_75w90;
  return {diffType:d?.name||diffType,recommended:base,
    frictionModifier:needsFrictionMod?'Required — add LSD friction modifier additive':'Not needed',
    alternatives:heavyDuty?[DIFF_FLUIDS.synthetic_75w90]:[DIFF_FLUIDS.gl5_80w90],
    changeInterval_km:base.interval_km,
    tips:['Drain and fill, not flush','Use magnetic drain plug to catch metal particles',
      needsFrictionMod?'Add friction modifier last, after filling main fluid':'',
      heavyDuty?'Check level every 10,000 km under towing/off-road use':''].filter(Boolean)}
}

export function calcTransferCaseGearing(tcaseKey,diffRatio,transLowGear){
  const tc=TRANSFER_CASES[tcaseKey];
  if(!tc)return {error:'Unknown transfer case'};
  const results={transferCase:tc.name,type:tc.type,torqueRating_nm:tc.torqueRating_nm,chainDrive:tc.chain,
    modes:{}};
  for(const[mode,ratio]of Object.entries(tc.ratios)){
    const overall=diffRatio*transLowGear*ratio;
    results.modes[mode]={ratio,overallCrawlRatio:Math.round(overall*100)/100,
      rating:overall>100?'Ultra-crawl':overall>60?'Excellent':overall>40?'Good':overall>20?'Adequate':'Light duty'}
  }
  return results;
}

// ── Query Functions ──

export function listDiffTypes(){return Object.entries(DIFF_TYPES).map(([k,v])=>({key:k,...v}))}
export function getDiffType(key){const d=DIFF_TYPES[key];return d?{key,...d}:null}
export function searchDiffTypes(q){const l=q.toLowerCase();return listDiffTypes().filter(d=>d.name.toLowerCase().includes(l)||d.type.toLowerCase().includes(l)||(d.applications||'').toLowerCase().includes(l))}
export function listDiffRatios(){return Object.entries(DIFF_RATIOS).map(([k,v])=>({key:k,...v}))}
export function getDiffRatio(key){const d=DIFF_RATIOS[key];return d?{key,...d}:null}
export function listTransferCases(){return Object.entries(TRANSFER_CASES).map(([k,v])=>({key:k,...v}))}
export function getTransferCase(key){const tc=TRANSFER_CASES[key];return tc?{key,...tc}:null}
export function searchTransferCases(q){const l=q.toLowerCase();return listTransferCases().filter(tc=>tc.name.toLowerCase().includes(l)||(tc.applications||'').toLowerCase().includes(l)||(tc.features||'').toLowerCase().includes(l))}
export function listDiffFluids(){return Object.entries(DIFF_FLUIDS).map(([k,v])=>({key:k,...v}))}

export function differentialCalcStats(){
  return {module:'Differential & Transfer Case Calculator',
    diffTypes:Object.keys(DIFF_TYPES).length,
    diffRatios:Object.keys(DIFF_RATIOS).length,
    transferCases:Object.keys(TRANSFER_CASES).length,
    diffFluids:Object.keys(DIFF_FLUIDS).length,
    calculations:['calcCrawlRatio','calcSpeedAtRPM','calcRPMAtSpeed','calcTorqueSplit','calcDiffTemp','recommendDiffRatio','recommendDiffFluid','calcTransferCaseGearing']}
}
