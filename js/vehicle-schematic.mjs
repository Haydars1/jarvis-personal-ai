import { getFaultVisual } from './fault-visual.mjs';
import { profileDisclaimer } from './vehicle-profiles.mjs';

const DEFAULT={
  'intake-path':{x:130,y:190},turbo:{x:275,y:185},'turbo-actuator':{x:300,y:120},'boost-path':{x:185,y:300},'boost-sensor':{x:220,y:145},'boost-control':{x:330,y:288},engine:{x:250,y:215},
  'engine-out':{x:250,y:220},'oxidation-zone':{x:390,y:280},'filter-core':{x:470,y:292},'soot-load':{x:490,y:240},'pressure-sensor':{x:520,y:220},tailpipe:{x:880,y:315},
  'tank-dose-path':{x:800,y:302},'dose-module':{x:765,y:270},'dosing-injector':{x:575,y:278},'nox-upstream':{x:540,y:236},'scr-catalyst':{x:640,y:292},'nox-downstream':{x:720,y:245},
  'wheel-input':{x:125,y:320},'abs-data-link':{x:440,y:120},'esc-control':{x:315,y:135},'abs-module':{x:160,y:245},'brake-circuit':{x:485,y:330},'epb-actuator':{x:790,y:250},'brake-wheels':{x:825,y:330},
  alternator:{x:250,y:170},'battery-path':{x:180,y:140},'energy-management':{x:340,y:120},'low-voltage-bus':{x:520,y:128},starter:{x:300,y:245},loads:{x:700,y:148},
  'oil-sump':{x:245,y:288},'oil-pump':{x:260,y:258},'oil-filter':{x:300,y:233},'oil-pressure-sensor':{x:300,y:172},'oil-circuit':{x:260,y:208},'oil-engine':{x:245,y:218},
  'coolant-pump':{x:215,y:248},'hot-zone':{x:245,y:218},'coolant-sensor':{x:290,y:148},thermostat:{x:190,y:185},radiator:{x:105,y:223},'cooling-loop':{x:275,y:302},
  'system-zone':{x:500,y:215}
};

const SCENES={
  boost:{title:'Ansaugluft → Turbo → Ladeluft → Motor',nodes:[
    ['intake-path','Ansaugluft / LMM','sensor'],['turbo','Turbolader','turbo'],['turbo-actuator','VTG / Wastegate','module'],['boost-path','Ladeluft / Intercooler','pipe'],['boost-sensor','Ladedrucksensor','sensor'],['boost-control','Regelventil','module'],['engine','Motor','engine']
  ],route:['intake-path','turbo','boost-path','engine']},
  dpf:{title:'Abgas → DPF → Differenzdruck',nodes:[
    ['engine-out','Motor / Abgas','engine'],['oxidation-zone','Abgasvorstufe','filter'],['filter-core','DPF','filter'],['soot-load','Filterbeladung','filter'],['pressure-sensor','Differenzdrucksensor','sensor'],['tailpipe','Auslass','pipe']
  ],route:['engine-out','oxidation-zone','filter-core','tailpipe']},
  scr:{title:'AdBlue → Dosierung → SCR',nodes:[
    ['tank-dose-path','AdBlue-Tank','tank'],['dose-module','Pumpe / Modul','module'],['dosing-injector','Dosierinjektor','sensor'],['nox-upstream','NOx-Sensor vor SCR','sensor'],['scr-catalyst','SCR-Katalysator','filter'],['nox-downstream','NOx-Sensor nach SCR','sensor']
  ],route:['tank-dose-path','dose-module','dosing-injector','scr-catalyst','nox-downstream']},
  brakes:{title:'Radsensoren → ABS/ESC → Hydraulik → Räder',nodes:[
    ['wheel-input','Raddrehzahlsensoren','wheel'],['abs-data-link','CAN / Datenbus','module'],['esc-control','ESC-Regelung','module'],['abs-module','ABS-Hydraulikblock','module'],['brake-circuit','Bremskreise','pipe'],['epb-actuator','EPB-Aktuator','module'],['brake-wheels','Radbremsen','wheel']
  ],route:['wheel-input','abs-module','brake-circuit','brake-wheels']},
  charging:{title:'Generator → Batterie → Bordnetz → Verbraucher',nodes:[
    ['alternator','Generator','module'],['battery-path','Batterie','battery'],['energy-management','Energiemanagement','module'],['low-voltage-bus','12-V-Bordnetz','pipe'],['starter','Starter','module'],['loads','Steuergeräte / Verbraucher','module']
  ],route:['alternator','battery-path','low-voltage-bus','loads']},
  oil:{title:'Ölwanne → Pumpe → Filter → Lagerstellen',nodes:[
    ['oil-sump','Ölwanne','tank'],['oil-pump','Ölpumpe','module'],['oil-filter','Ölfilter','filter'],['oil-pressure-sensor','Öldrucksensor','sensor'],['oil-circuit','Hauptölkanal','pipe'],['oil-engine','Motor / Turbo','engine']
  ],route:['oil-sump','oil-pump','oil-filter','oil-circuit','oil-engine']},
  cooling:{title:'Pumpe → Motor → Thermostat → Kühler',nodes:[
    ['coolant-pump','Wasserpumpe','module'],['hot-zone','Motor / Zylinderkopf','engine'],['coolant-sensor','Temperatursensor','sensor'],['thermostat','Thermostat','module'],['radiator','Kühler','filter'],['cooling-loop','Rücklauf','pipe']
  ],route:['coolant-pump','hot-zone','thermostat','radiator','cooling-loop']},
  steering:{title:'Lenkwinkel → Steuergerät → Servoantrieb',nodes:[
    ['system-zone','Lenksystem','module']
  ],route:['system-zone']},
  generic:{title:'Sensor → Steuergerät → Aktor / System',nodes:[['system-zone','Betroffenes System','module']],route:['system-zone']}
};

const bodyPaths={
  'wagon-fwd-long':'M80 272 C115 210 180 174 290 162 L520 150 C610 150 695 175 760 215 L850 235 C885 242 908 264 910 298 L875 305 C860 348 790 350 772 307 L235 307 C218 350 150 349 132 307 L82 300 Z',
  'sedan-rwd-longnose':'M70 278 C110 215 205 176 332 164 L555 154 C635 155 700 180 755 220 L850 240 C882 248 903 266 907 298 L870 304 C852 346 787 348 768 306 L236 306 C218 348 150 349 130 306 L75 300 Z',
  'estate-rwd-longnose':'M70 276 C110 214 195 174 315 160 L625 160 C688 166 742 190 785 222 L855 240 C885 248 905 268 908 298 L870 305 C851 347 790 348 770 306 L236 306 C218 349 151 349 130 306 L74 300 Z',
  'hatch-fwd-short':'M86 275 C120 220 185 183 285 170 L545 170 C625 175 685 198 735 230 L830 245 C870 252 896 273 900 298 L862 305 C844 345 785 347 765 306 L238 306 C218 347 158 348 136 306 L88 300 Z',
  'hatch-fwd-medium':'M82 275 C118 216 190 180 295 168 L565 168 C640 173 700 197 750 228 L835 244 C875 252 900 272 903 298 L864 305 C845 346 786 347 766 306 L238 306 C218 347 156 348 135 306 L84 300 Z',
  generic:'M90 275 C125 220 195 184 300 170 L570 170 C650 176 710 200 760 232 L845 247 C880 254 900 275 902 298 L865 304 C846 344 785 346 766 306 L235 306 C216 346 155 347 135 306 L90 300 Z'
};

function pointFor(profile,id){ return profile?.placements?.[id]||DEFAULT[id]||DEFAULT['system-zone']; }
function nodeShape(type,x,y,active){
  const cls=active?'schematic-node fault-focus':'schematic-node';
  if(type==='wheel') return `<g class="${cls}"><circle cx="${x}" cy="${y}" r="22"/><circle cx="${x}" cy="${y}" r="7"/></g>`;
  if(type==='engine') return `<g class="${cls}"><rect x="${x-28}" y="${y-20}" width="56" height="40" rx="8"/><path d="M${x-18} ${y-20} l8 -12 h26 l8 12"/></g>`;
  if(type==='tank') return `<g class="${cls}"><rect x="${x-27}" y="${y-20}" width="54" height="40" rx="10"/><path d="M${x-12} ${y-26} h24 v7"/></g>`;
  if(type==='filter') return `<g class="${cls}"><rect x="${x-28}" y="${y-20}" width="56" height="40" rx="6"/><path d="M${x-18} ${y-10} h36 M${x-18} ${y} h36 M${x-18} ${y+10} h36"/></g>`;
  if(type==='battery') return `<g class="${cls}"><rect x="${x-28}" y="${y-19}" width="56" height="38" rx="5"/><path d="M${x-13} ${y-25} v6 M${x+13} ${y-25} v6 M${x-16} ${y} h12 M${x+6} ${y} h12 M${x+12} ${y-6} v12"/></g>`;
  if(type==='pipe') return `<g class="${cls}"><circle cx="${x}" cy="${y}" r="18"/><path d="M${x-28} ${y} h56"/></g>`;
  if(type==='sensor') return `<g class="${cls}"><circle cx="${x}" cy="${y}" r="17"/><circle cx="${x}" cy="${y}" r="5"/></g>`;
  if(type==='turbo') return `<g class="${cls}"><circle cx="${x}" cy="${y}" r="21"/><path d="M${x} ${y-13} c12 4 16 15 7 24 c-8 8-20 4-24-5 c-4-11 4-20 17-19"/></g>`;
  return `<g class="${cls}"><rect x="${x-22}" y="${y-16}" width="44" height="32" rx="7"/></g>`;
}
function curve(a,b){ const mx=(a.x+b.x)/2; return `M${a.x} ${a.y} C${mx} ${a.y},${mx} ${b.y},${b.x} ${b.y}`; }

export function buildVehicleSchematicModel(profile,code){
  const fault=getFaultVisual(code);
  const scene=SCENES[fault.scene]||SCENES.generic;
  const nodes=scene.nodes.map(([id,label,type])=>({id,label,type,...pointFor(profile,id)}));
  const route=scene.route.map(id=>({id,...pointFor(profile,id)}));
  const focusPoint=pointFor(profile,fault.focus);
  return {
    code:String(code).toUpperCase(),scene:fault.scene,title:scene.title,focusId:fault.focus,focusLabel:fault.label,
    focusPoint,nodes,route,bodyVariant:profile?.bodyVariant||'generic',isGeneric:!profile||profile.accuracy==='generic',profile
  };
}

export function renderVehicleSchematicSvg(profile,code){
  const model=buildVehicleSchematicModel(profile,code);
  const body=bodyPaths[model.bodyVariant]||bodyPaths.generic;
  const pathMarkup=model.route.slice(0,-1).map((p,i)=>{
    const d=curve(p,model.route[i+1]);
    return `<g class="flow-segment"><path class="flow-track" d="${d}"/><path class="flow-live" d="${d}"/><circle class="flow-particle" r="4"><animateMotion dur="${2.5+i*.2}s" repeatCount="indefinite" path="${d}"/></circle></g>`;
  }).join('');
  const nodeMarkup=model.nodes.map(n=>`${nodeShape(n.type,n.x,n.y,n.id===model.focusId)}<text class="schematic-label" x="${n.x}" y="${n.y+38}">${n.label}</text>`).join('');
  const mode=model.isGeneric?'Allgemeine Systemdarstellung':profile.label;
  return `<div class="vehicle-schematic-wrap" data-scene="${model.scene}" data-body="${model.bodyVariant}">
    <div class="schematic-head"><div><span>SYSTEMFUNKTION</span><h3>${model.title}</h3></div><strong>${mode}</strong></div>
    <svg class="vehicle-schematic" viewBox="0 0 980 390" role="img" aria-label="${model.code}: ${model.focusLabel}">
      <defs><filter id="focus-glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path class="car-shell" d="${body}"/>
      <circle class="wheel-shell" cx="185" cy="307" r="47"/><circle class="wheel-shell" cx="818" cy="307" r="47"/>
      <path class="cutaway-line" d="M140 262 H845 M300 170 L278 260 M620 165 L660 260"/>
      ${pathMarkup}${nodeMarkup}
    </svg>
    <div class="schematic-focus"><span>FEHLERBEREICH</span><strong>${model.focusLabel}</strong><p>Die Hervorhebung beweist nicht, dass dieses Bauteil sicher defekt ist.</p></div>
    <p class="schematic-disclaimer">${profileDisclaimer(profile||{accuracy:'generic'})}</p>
  </div>`;
}
