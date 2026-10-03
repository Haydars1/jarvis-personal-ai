const exact={
  ADBLUE:{scene:'scr',focus:'tank-dose-path',flow:'fluid',label:'AdBlue Versorgung / Dosierung',tone:'amber'},
  P20EE:{scene:'scr',focus:'scr-catalyst',flow:'exhaust',label:'SCR-Katalysator',tone:'amber'},
  P2201:{scene:'scr',focus:'nox-upstream',flow:'data',label:'NOx-Sensor / Messstrecke',tone:'amber'},
  P229F:{scene:'scr',focus:'nox-downstream',flow:'data',label:'NOx-Sensor nach SCR',tone:'amber'},
  DPF:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'Dieselpartikelfilter',tone:'amber'},
  P2002:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'DPF-Wirkbereich',tone:'amber'},
  P2453:{scene:'dpf',focus:'pressure-sensor',flow:'data',label:'Differenzdrucksensor',tone:'amber'},
  P2463:{scene:'dpf',focus:'soot-load',flow:'exhaust',label:'Rußbeladung im DPF',tone:'amber'},
  P246C:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'DPF-Durchsatz / Last',tone:'amber'},
  P0299:{scene:'boost',focus:'boost-path',flow:'air',label:'Ladedruckstrecke',tone:'amber'},
  P0234:{scene:'boost',focus:'boost-path',flow:'air',label:'Ladedruckregelung',tone:'amber'},
  P0236:{scene:'boost',focus:'boost-sensor',flow:'data',label:'Ladedrucksensor',tone:'amber'},
  P0243:{scene:'boost',focus:'boost-control',flow:'electrical',label:'Ladedruckregelventil',tone:'amber'},
  P2263:{scene:'boost',focus:'turbo',flow:'mechanical',label:'Turbolader',tone:'amber'},
  P2279:{scene:'boost',focus:'intake-path',flow:'air',label:'Ansaug-/Ladeluftstrecke',tone:'amber'},
  P2563:{scene:'boost',focus:'turbo-actuator',flow:'mechanical',label:'Turbo-Stellaktuator',tone:'amber'},
  OIL:{scene:'oil',focus:'oil-circuit',flow:'fluid',label:'Öldruckkreislauf',tone:'red'},
  P0520:{scene:'oil',focus:'oil-pressure-sensor',flow:'data',label:'Öldrucksensor',tone:'amber'},
  COOLANT:{scene:'cooling',focus:'hot-zone',flow:'fluid',label:'Kühlmittelkreislauf',tone:'red'},
  P0128:{scene:'cooling',focus:'thermostat',flow:'fluid',label:'Thermostat / Kühlmittelregelung',tone:'amber'},
  P0118:{scene:'cooling',focus:'coolant-sensor',flow:'data',label:'Kühlmitteltemperatursensor',tone:'amber'},
  ABS:{scene:'brakes',focus:'abs-module',flow:'hydraulic',label:'ABS-Hydraulik / Regelung',tone:'amber'},
  ESC:{scene:'brakes',focus:'esc-control',flow:'data',label:'ESC/ESP-Regelung',tone:'amber'},
  BRAKE:{scene:'brakes',focus:'brake-circuit',flow:'hydraulic',label:'Bremskreis',tone:'red'},
  PARKBRAKE:{scene:'brakes',focus:'epb-actuator',flow:'electrical',label:'Elektrische Parkbremse',tone:'amber'},
  U0121:{scene:'brakes',focus:'abs-data-link',flow:'data',label:'Kommunikation ABS/ESP',tone:'amber'},
  BATTERY:{scene:'charging',focus:'battery-path',flow:'electrical',label:'Batterie / Ladesystem',tone:'red'},
  P0562:{scene:'charging',focus:'low-voltage-bus',flow:'electrical',label:'Bordnetzspannung',tone:'amber'},
  STARTSTOP:{scene:'charging',focus:'energy-management',flow:'electrical',label:'Energiemanagement / Start-Stopp',tone:'amber'},
  STEERING:{scene:'steering',focus:'assist-unit',flow:'electrical',label:'Servolenkung / Lenkunterstützung',tone:'amber'}
};
export function getFaultVisual(code=''){
  const key=String(code).toUpperCase();
  return exact[key]||{scene:'generic',focus:'system-zone',flow:'data',label:'Fahrzeugsystem',tone:'neutral'};
}
