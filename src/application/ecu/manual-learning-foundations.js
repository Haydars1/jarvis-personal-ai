// Original study synthesis based on the ten user-supplied ECU manuals.
// Do not publish verbatim document text here: full page index belongs in the private D1 library.
export const ECU_MANUAL_FOUNDATIONS = Object.freeze([
  {doc:'edc15p_suite',pages:'6-9,14-22,29-31',topics:['EDC15P','binary','backup','hex','checksum','map'],
   lesson:'EDC15P Suite distinguishes binary file handling, projects, map viewers, map editing and checksum verification. Changes should be reversible and compared against the original file; map labels and addresses require verification against the exact firmware.'},
  {doc:'vag_edc15p_maps',pages:'4-13',topics:['EDC15P','flash','C167','memory','axis'],
   lesson:'VAG EDC15P examples describe an Infineon C167 controller, Am29F400 flash and binary axes/map candidate detection. Detected map addresses are hypotheses until lengths, scaling, surrounding data and the target software variant confirm them.'},
  {doc:'vag_edc15p_maps',pages:'14-19',topics:['diesel','EDC15P','torque','IQ','smoke','duration','driver wish'],
   lesson:'Diesel engine torque requests, smoke/air limits, injected quantity and injection duration interact. Increasing a single requested quantity does not establish safe delivered torque, emissions, rail/pump capacity or thermal margin. Driver wish is a request map, not an independent power guarantee.'},
  {doc:'bosch_ms4',pages:'5-13',topics:['MS4','Bosch Motorsport','sensors','inputs','outputs'],
   lesson:'Bosch MS 4 Sport is a motorsport controller with defined input/output, supply, trigger and sensor requirements. Do not transfer its pin assignments or calibration assumptions to stock Bosch Motronic/EDC families merely because the name is similar.'},
  {doc:'bosch_ms4',pages:'14-21',topics:['MS4','start','ignition','lambda','fuel','trigger'],
   lesson:'Initial commissioning requires coherent engine geometry, crank/cam trigger phasing, injector characteristics, ignition reference, sensor ranges and online measurement verification before engine operation.'},
  {doc:'megasquirt3_setup',pages:'1-16',topics:['MS3','Megasquirt','wiring','firmware'],
   lesson:'Megasquirt-3 commissioning starts with the correct MS3 hardware/firmware version, fused wiring, verified serial connection, calibrated sensors and fixed engine/trigger settings. This guide is for MS3 1.5.x rather than MS1, MS2, or Microsquirt.'},
  {doc:'megasquirt3_setup',pages:'56-82',topics:['MS3','fuel','ignition','VE','AFR','timing'],
   lesson:'Calibration must tie commanded mixture, VE/airflow model, injector behavior and commanded spark to stable, logged engine conditions. Misconfigured sensor ranges or timing references invalidate conclusions from maps.'},
  {doc:'megasquirt3_setup',pages:'83-158',topics:['MS3','advanced','troubleshooting','datalog'],
   lesson:'Advanced features and troubleshooting should be approached by distinguishing hardware faults, missing signals, configuration errors and tuning errors before altering maps.'},
  {doc:'megasquirt3_tunerstudio',pages:'27-84',topics:['TunerStudio','MS3','backup','log','communications'],
   lesson:'TunerStudio supports project versions/backups, communications, datalogging and diagnostic utilities. Saving a tune and confirming that settings are written to the controller are separate steps.'},
  {doc:'megasquirt3_tunerstudio',pages:'86-232',topics:['TunerStudio','fuel','ignition','idle','boost','VVT'],
   lesson:'Fuel, ignition, idle, acceleration enrichment, boost and VVT controls are separate modules whose output depends on configured sources and safety settings. Hardware compatibility and logged feedback take precedence over generic online map values.'},
  {doc:'megasquirt3_tunerstudio',pages:'233-344',topics:['TunerStudio','3D','CAN','diagnostic','logging'],
   lesson:'Advanced settings, 3D maps, CAN test modes, diagnostics and high-speed loggers provide evidence for targeted troubleshooting; a chart alone does not establish correct axis units.'},
  {doc:'emu_pro_gdi',pages:'3-14',topics:['EMU PRO','GDI','injection','injector','pressure'],
   lesson:'Direct-injection calibrations depend on high-pressure rail feedback and injector opening, closing and flow behavior. Injector dead time and delivery change with pressure, so port-injection assumptions cannot be copied directly.'},
  {doc:'emu_pro_gdi',pages:'15-36',topics:['EMU PRO','GDI','pump','rail','feedforward'],
   lesson:'A high-pressure pump control model, valve behavior, feed-forward delivery and measured rail pressure must agree. An apparently suitable commanded duty cycle does not prove that target pressure follows load.'},
  {doc:'emu_pro_gdi',pages:'37-43',topics:['EMU PRO','GDI','knock','mixture','troubleshooting'],
   lesson:'GDI performance calibration needs independent validation of injection timing window, rail pressure stability, combustion/knock margin and fuel delivery; diagnose the measured mismatch before making power-related changes.'},
  {doc:'emu_pro_software',pages:'7-74',topics:['EMU PRO','tables','logic','CAN','logs','scope'],
   lesson:'EMU PRO software provides a structured project tree, tables, variable inspectors, logs, scope and CAN stream tooling. Signal names and data transformations must be checked before trusting dashboard or CAN-derived values.'},
  {doc:'emu_pro_software',pages:'90-122',topics:['EMU PRO','APS','DBW','VVT','pedal','throttle'],
   lesson:'APS and drive-by-wire systems require coherent dual sensor signals, plausible actuator tracking and safety monitoring. VVT reference and phase feedback must be confirmed before tuning control gains.'},
  {doc:'motronic_313331_checksum',pages:'2-4',topics:['Motronic','M3.1','M3.3','M3.3.1','checksum'],
   lesson:'The Motronic 3.1/3.3/3.3.1 checksum example identifies a distinct region of calibration tables and stores a checksum dependent on that region. Addresses in the example are not universal: verify layout and checksum algorithm for each binary.'},
  {doc:'motronic_155_checksum',pages:'2-5',topics:['Motronic','M1.5.5','checksum','bank'],
   lesson:'The illustrated M1.5.5 file consists of two repeated 64 KiB banks with checksums near the ends of both banks. The illustrated format uses 16-bit sums and complements; validate bank layout/endianness and the original checksum before modifying anything.'},
  {doc:'bosch_me_motronic',pages:'18-35',topics:['ME Motronic','gasoline','injection','air','torque'],
   lesson:'ME-Motronic coordinates driver torque demand, cylinder air charge, electronic throttle, injected fuel and ignition; a requested load or throttle angle alone does not determine final torque.'},
  {doc:'bosch_me_motronic',pages:'34-64',topics:['ME Motronic','lambda','knock','protection','OBD','ignition'],
   lesson:'Measured air and engine operating state feed lambda, knock, idle, torque and protective functions. Control loops and adaptation may override one-dimensional expectations, so analysis needs both requested and measured values.'}
]);
export const ECU_MANUALS = Object.freeze([
  ['edc15p_suite','EDC15P Suite Manual','2012','EDC15P'],
  ['bosch_ms4','Bosch ECU MS 4 Sport','2012','MS4'],
  ['megasquirt3_setup','Megasquirt-3 Setting Up','2019','MS3 1.5.x'],
  ['emu_pro_gdi','How-to Tune GDI in EMU PRO','2026-02','EMU PRO 226.4+'],
  ['motronic_313331_checksum','Motronic 3.1 / 3.3 / 3.3.1 Checksum','2010','M3.1/M3.3/M3.3.1'],
  ['motronic_155_checksum','Opel Motronic 1.5.5 Checksum','2010','M1.5.5'],
  ['emu_pro_software','EMU PRO Software Guide','2026-09','EMU PRO 261.2.2+'],
  ['megasquirt3_tunerstudio','TunerStudio MS Lite Reference','2018','MS3 1.5.x'],
  ['vag_edc15p_maps','VAG EDC15P Maps','2012','EDC15P'],
  ['bosch_me_motronic','Bosch ME-Motronic Engine Management','1999','ME-Motronic']
].map(([id,title,publication,applies_to])=>({id,title,publication,applies_to})));
export function ecuStudyConcepts(query='',limit=8){
  const terms=String(query).toLowerCase().match(/[\p{L}\p{N}.+-]{3,}/gu)||[];
  const scored=ECU_MANUAL_FOUNDATIONS.map(item=>{
    const hay=(item.topics.join(' ')+' '+item.lesson).toLowerCase();
    const score=terms.reduce((n,term)=>n+(hay.includes(term)?1:0),0);
    return {item,score};
  });
  scored.sort((a,b)=>b.score-a.score);
  return scored.filter(x=>x.score>0).slice(0,Math.max(1,Math.min(30,limit))).map(x=>x.item);
}
