const point=(x,y)=>({x,y});

const PLATFORM={
  'vw-mqb-long':{bodyVariant:'wagon-fwd-long',placements:{
    engine:point(225,215),'engine-out':point(245,230),'fuel-engine':point(225,215),'engine-core':point(225,215),'hot-zone':point(225,215),'oil-engine':point(225,215),'trans-input':point(300,225),
    'intake-path':point(115,190),turbo:point(265,185),'turbo-actuator':point(285,125),'boost-path':point(175,295),'boost-sensor':point(205,145),'boost-control':point(310,285),
    'filter-core':point(455,285),'oxidation-zone':point(385,275),'pressure-sensor':point(500,215),'soot-load':point(470,235),tailpipe:point(880,310),
    'tank-dose-path':point(790,305),'dose-module':point(760,275),'dosing-injector':point(560,275),'nox-upstream':point(530,235),'scr-catalyst':point(625,290),'nox-downstream':point(700,245),
    'fuel-tank':point(775,300),'low-pressure':point(650,275),'fuel-pressure':point(275,170),
    'battery-path':point(180,135),alternator:point(235,170),'energy-management':point(330,115),'low-voltage-bus':point(500,125),starter:point(275,245),loads:point(720,145),
    'abs-module':point(155,240),'wheel-input':point(120,320),'brake-circuit':point(470,330),'brake-wheels':point(820,330),'epb-actuator':point(790,250),'esc-control':point(310,135),'abs-data-link':point(430,120),
    'coolant-pump':point(205,245),'coolant-sensor':point(270,145),thermostat:point(180,185),radiator:point(105,220),'cooling-loop':point(260,300),
    'oil-sump':point(230,285),'oil-pump':point(245,255),'oil-filter':point(285,230),'oil-pressure-sensor':point(280,170),'oil-circuit':point(245,205)
  }},
  'bmw-clar-rwd':{bodyVariant:'sedan-rwd-longnose',placements:{
    engine:point(265,215),'engine-out':point(285,230),'fuel-engine':point(265,215),'engine-core':point(265,215),'hot-zone':point(265,215),'oil-engine':point(265,215),'trans-input':point(365,225),
    'intake-path':point(140,175),turbo:point(315,165),'turbo-actuator':point(335,115),'boost-path':point(170,300),'boost-sensor':point(225,145),'boost-control':point(355,290),
    'filter-core':point(485,290),'oxidation-zone':point(405,280),'pressure-sensor':point(525,220),'soot-load':point(500,240),tailpipe:point(885,315),
    'tank-dose-path':point(825,295),'dose-module':point(790,265),'dosing-injector':point(595,275),'nox-upstream':point(560,235),'scr-catalyst':point(655,290),'nox-downstream':point(735,245),
    'fuel-tank':point(790,300),'low-pressure':point(680,275),'fuel-pressure':point(315,175),
    'battery-path':point(805,155),alternator:point(280,170),'energy-management':point(730,135),'low-voltage-bus':point(535,125),starter:point(330,245),loads:point(650,145),
    'abs-module':point(175,235),'wheel-input':point(130,320),'brake-circuit':point(500,330),'brake-wheels':point(830,330),'epb-actuator':point(800,245),'esc-control':point(330,130),'abs-data-link':point(470,115),
    'coolant-pump':point(240,245),'coolant-sensor':point(315,145),thermostat:point(210,180),radiator:point(110,220),'cooling-loop':point(300,300),
    'oil-sump':point(270,285),'oil-pump':point(285,255),'oil-filter':point(325,230),'oil-pressure-sensor':point(325,170),'oil-circuit':point(285,205)
  }},
  'mercedes-mra-rwd':{bodyVariant:'estate-rwd-longnose',placements:{
    engine:point(250,215),'engine-out':point(270,230),'fuel-engine':point(250,215),'engine-core':point(250,215),'hot-zone':point(250,215),'oil-engine':point(250,215),'trans-input':point(350,225),
    'intake-path':point(125,180),turbo:point(300,175),'turbo-actuator':point(320,120),'boost-path':point(160,302),'boost-sensor':point(215,148),'boost-control':point(340,288),
    'filter-core':point(470,290),'oxidation-zone':point(395,280),'pressure-sensor':point(515,215),'soot-load':point(492,238),tailpipe:point(880,312),
    'tank-dose-path':point(805,300),'dose-module':point(775,270),'dosing-injector':point(580,275),'nox-upstream':point(545,236),'scr-catalyst':point(640,290),'nox-downstream':point(720,245),
    'fuel-tank':point(785,300),'low-pressure':point(665,275),'fuel-pressure':point(300,175),
    'battery-path':point(745,155),alternator:point(270,170),'energy-management':point(690,135),'low-voltage-bus':point(520,125),starter:point(315,245),loads:point(635,145),
    'abs-module':point(165,240),'wheel-input':point(125,320),'brake-circuit':point(490,330),'brake-wheels':point(825,330),'epb-actuator':point(790,250),'esc-control':point(320,135),'abs-data-link':point(455,120),
    'coolant-pump':point(225,245),'coolant-sensor':point(300,145),thermostat:point(195,182),radiator:point(108,220),'cooling-loop':point(285,300),
    'oil-sump':point(255,285),'oil-pump':point(270,255),'oil-filter':point(310,230),'oil-pressure-sensor':point(310,170),'oil-circuit':point(270,205)
  }},
  'ford-c2-fwd':{bodyVariant:'hatch-fwd-short',placements:{
    engine:point(215,220),'engine-out':point(235,235),'fuel-engine':point(215,220),'engine-core':point(215,220),'hot-zone':point(215,220),'oil-engine':point(215,220),'trans-input':point(300,230),
    'intake-path':point(105,190),turbo:point(250,190),'turbo-actuator':point(270,128),'boost-path':point(150,300),'boost-sensor':point(195,150),'boost-control':point(300,288),
    'filter-core':point(430,292),'oxidation-zone':point(365,282),'pressure-sensor':point(475,220),'soot-load':point(452,240),tailpipe:point(870,315),
    'tank-dose-path':point(760,302),'dose-module':point(730,272),'dosing-injector':point(540,278),'nox-upstream':point(510,238),'scr-catalyst':point(605,292),'nox-downstream':point(680,248),
    'fuel-tank':point(745,300),'low-pressure':point(630,275),'fuel-pressure':point(265,176),
    'battery-path':point(160,140),alternator:point(230,175),'energy-management':point(320,120),'low-voltage-bus':point(480,128),starter:point(285,248),loads:point(690,148),
    'abs-module':point(150,245),'wheel-input':point(115,320),'brake-circuit':point(455,332),'brake-wheels':point(805,332),'epb-actuator':point(760,252),'esc-control':point(300,138),'abs-data-link':point(420,122),
    'coolant-pump':point(195,248),'coolant-sensor':point(265,148),thermostat:point(170,185),radiator:point(98,223),'cooling-loop':point(250,302),
    'oil-sump':point(220,288),'oil-pump':point(235,258),'oil-filter':point(275,233),'oil-pressure-sensor':point(275,172),'oil-circuit':point(235,208)
  }},
  'opel-emp2-fwd':{bodyVariant:'hatch-fwd-medium',placements:{
    engine:point(220,220),turbo:point(255,190),'boost-path':point(155,300),'filter-core':point(440,292),'pressure-sensor':point(485,220),'tank-dose-path':point(770,302),'scr-catalyst':point(610,292),'abs-module':point(150,245),'battery-path':point(165,140),radiator:point(100,223),'oil-circuit':point(240,208),'hot-zone':point(220,220)
  }}
};

const ENGINE={
  'ea288-2.0-tdi':{placements:{'dosing-injector':point(565,278),'scr-catalyst':point(630,292),'filter-core':point(455,290),turbo:point(270,182)}},
  'bmw-b47':{placements:{turbo:point(325,162),'filter-core':point(495,290),'scr-catalyst':point(665,292),'dosing-injector':point(602,278)}},
  'om654':{placements:{turbo:point(305,172),'filter-core':point(478,291),'scr-catalyst':point(646,292),'dosing-injector':point(585,278)}},
  'ford-ecoblue-2.0':{placements:{turbo:point(252,188),'filter-core':point(438,292),'scr-catalyst':point(612,292),'dosing-injector':point(545,278)}},
  'ea888-petrol':{placements:{turbo:point(270,180)}},
  'bmw-b48':{placements:{turbo:point(322,165)}},
  'm264':{placements:{turbo:point(303,172)}},
  'ford-ecoboost':{placements:{turbo:point(250,188)}},
  'opel-diesel':{placements:{turbo:point(257,188),'filter-core':point(442,292),'scr-catalyst':point(615,292)}}
};

const profiles=[
  {brand:'Volkswagen',model:'Passat',generation:'B8',yearFrom:2014,yearTo:2023,engine:'2.0 TDI CRLB',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi',overrides:{'tank-dose-path':point(805,305)}},
  {brand:'Volkswagen',model:'Passat',generation:'B8',yearFrom:2016,yearTo:2023,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Volkswagen',model:'Golf',generation:'7',yearFrom:2012,yearTo:2020,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Volkswagen',model:'Golf',generation:'8',yearFrom:2019,yearTo:2026,engine:'2.0 TDI EA288 evo',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Volkswagen',model:'Tiguan',generation:'II',yearFrom:2016,yearTo:2024,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Audi',model:'A3',generation:'8V',yearFrom:2012,yearTo:2020,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Audi',model:'A3',generation:'8Y',yearFrom:2020,yearTo:2026,engine:'2.0 TDI EA288 evo',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Skoda',model:'Octavia',generation:'III',yearFrom:2013,yearTo:2020,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Skoda',model:'Octavia',generation:'IV',yearFrom:2020,yearTo:2026,engine:'2.0 TDI EA288 evo',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Seat / Cupra',model:'Leon',generation:'III',yearFrom:2012,yearTo:2020,engine:'2.0 TDI EA288',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'Seat / Cupra',model:'Leon',generation:'IV',yearFrom:2020,yearTo:2026,engine:'2.0 TDI EA288 evo',platformId:'vw-mqb-long',engineFamilyId:'ea288-2.0-tdi'},
  {brand:'BMW',model:'3er',generation:'F30/F31',yearFrom:2012,yearTo:2019,engine:'320d B47',platformId:'bmw-clar-rwd',engineFamilyId:'bmw-b47'},
  {brand:'BMW',model:'3er',generation:'G20/G21',yearFrom:2019,yearTo:2026,engine:'320d B47',platformId:'bmw-clar-rwd',engineFamilyId:'bmw-b47',overrides:{'battery-path':point(820,160)}},
  {brand:'BMW',model:'5er',generation:'F10/F11',yearFrom:2010,yearTo:2017,engine:'520d B47',platformId:'bmw-clar-rwd',engineFamilyId:'bmw-b47'},
  {brand:'BMW',model:'5er',generation:'G30/G31',yearFrom:2017,yearTo:2024,engine:'520d B47',platformId:'bmw-clar-rwd',engineFamilyId:'bmw-b47'},
  {brand:'BMW',model:'X3',generation:'G01',yearFrom:2017,yearTo:2024,engine:'xDrive20d B47',platformId:'bmw-clar-rwd',engineFamilyId:'bmw-b47'},
  {brand:'Mercedes-Benz',model:'C-Klasse',generation:'W205/S205',yearFrom:2014,yearTo:2021,engine:'C 220 d OM654',platformId:'mercedes-mra-rwd',engineFamilyId:'om654'},
  {brand:'Mercedes-Benz',model:'E-Klasse',generation:'W213/S213',yearFrom:2016,yearTo:2023,engine:'E 220 d OM654',platformId:'mercedes-mra-rwd',engineFamilyId:'om654',overrides:{'tank-dose-path':point(815,300)}},
  {brand:'Mercedes-Benz',model:'GLC',generation:'X253',yearFrom:2015,yearTo:2022,engine:'220 d OM654',platformId:'mercedes-mra-rwd',engineFamilyId:'om654'},
  {brand:'Ford',model:'Focus',generation:'MK4',yearFrom:2018,yearTo:2026,engine:'2.0 EcoBlue',platformId:'ford-c2-fwd',engineFamilyId:'ford-ecoblue-2.0'},
  {brand:'Ford',model:'Mondeo',generation:'MK5',yearFrom:2014,yearTo:2022,engine:'2.0 EcoBlue',platformId:'ford-c2-fwd',engineFamilyId:'ford-ecoblue-2.0'},
  {brand:'Ford',model:'Kuga',generation:'III',yearFrom:2020,yearTo:2026,engine:'2.0 EcoBlue',platformId:'ford-c2-fwd',engineFamilyId:'ford-ecoblue-2.0'},
  {brand:'Opel',model:'Astra',generation:'K',yearFrom:2015,yearTo:2021,engine:'1.6 CDTI',platformId:'opel-emp2-fwd',engineFamilyId:'opel-diesel'},
  {brand:'Opel',model:'Insignia',generation:'B',yearFrom:2017,yearTo:2022,engine:'2.0 Diesel',platformId:'opel-emp2-fwd',engineFamilyId:'opel-diesel'},
  {brand:'Opel',model:'Grandland',generation:'A',yearFrom:2017,yearTo:2026,engine:'1.5 Diesel',platformId:'opel-emp2-fwd',engineFamilyId:'opel-diesel'}
];

export const vehicleProfiles=profiles.map((p,i)=>({...p,profileKey:`v${String(i+1).padStart(3,'0')}`}));

const uniq=(arr)=>[...new Set(arr)].sort((a,b)=>typeof a==='number'?a-b:String(a).localeCompare(String(b),'de'));

export function getVehicleOptions(selection={}){
  const byBrand=selection.brand?vehicleProfiles.filter(p=>p.brand===selection.brand):vehicleProfiles;
  const byModel=selection.model?byBrand.filter(p=>p.model===selection.model):byBrand;
  const byGen=selection.generation?byModel.filter(p=>p.generation===selection.generation):byModel;
  const byYear=selection.year?byGen.filter(p=>Number(selection.year)>=p.yearFrom&&Number(selection.year)<=p.yearTo):byGen;
  return {
    brands:uniq(vehicleProfiles.map(p=>p.brand)),
    models:uniq(byBrand.map(p=>p.model)),
    generations:uniq(byModel.map(p=>p.generation)),
    years:uniq(byGen.flatMap(p=>Array.from({length:p.yearTo-p.yearFrom+1},(_,i)=>p.yearFrom+i))),
    engines:uniq(byYear.map(p=>p.engine))
  };
}

const genericProfile={
  profileKey:null,brand:null,model:null,generation:null,year:null,engine:null,
  platformId:'generic',engineFamilyId:'generic',bodyVariant:'generic',accuracy:'generic',
  label:'Allgemeine Systemdarstellung',placements:{}
};

export function resolveVehicleProfile(selection={}){
  const {brand,model,generation,year,engine}=selection;
  if(!brand||!model||!generation||!year||!engine) return {...genericProfile};
  const exact=vehicleProfiles.find(p=>p.brand===brand&&p.model===model&&p.generation===generation&&p.engine===engine&&Number(year)>=p.yearFrom&&Number(year)<=p.yearTo);
  if(exact){
    const platform=PLATFORM[exact.platformId]||{bodyVariant:'generic',placements:{}};
    const engineProfile=ENGINE[exact.engineFamilyId]||{placements:{}};
    return {
      ...exact,year:Number(year),accuracy:'platform',
      label:`${exact.brand} ${exact.model} ${exact.generation} · ${year} · ${exact.engine}`,
      bodyVariant:platform.bodyVariant,
      placements:{...platform.placements,...engineProfile.placements,...(exact.overrides||{})}
    };
  }
  const platformMatch=vehicleProfiles.find(p=>p.brand===brand&&p.model===model&&p.generation===generation);
  if(platformMatch){
    const platform=PLATFORM[platformMatch.platformId]||{bodyVariant:'generic',placements:{}};
    return {
      ...platformMatch,profileKey:null,year:Number(year),engine,accuracy:'platform',
      label:`${brand} ${model} ${generation} · Plattformdarstellung`,
      bodyVariant:platform.bodyVariant,placements:{...platform.placements}
    };
  }
  return {...genericProfile};
}

export function profileDisclaimer(profile){
  if(profile.accuracy==='generic') return 'Allgemeine Systemdarstellung – für diese Variante liegt noch kein verifiziertes Fahrzeugprofil vor.';
  if(profile.accuracy==='exact') return 'Fahrzeugspezifische technische Darstellung für die ausgewählte Variante.';
  return 'Fahrzeugspezifische schematische Darstellung auf Plattform-/Motorfamilienbasis; Bauzustand und Ausstattung können abweichen.';
}
