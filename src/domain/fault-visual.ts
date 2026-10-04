import { faultByCode } from './faults';

export type SystemSceneId = 'scr'|'dpf'|'boost'|'fuel'|'combustion'|'cooling'|'oil'|'brakes'|'steering'|'charging'|'transmission'|'generic';
export type FlowMode = 'fluid'|'air'|'exhaust'|'electrical'|'hydraulic'|'mechanical'|'data';
export type FaultVisual = { scene:SystemSceneId; focus:string; flow:FlowMode; label:string; tone:'amber'|'red'|'neutral' };

const exact: Record<string, Partial<FaultVisual>> = {
  ADBLUE:{scene:'scr',focus:'tank-dose-path',flow:'fluid',label:'AdBlue Versorgung / Dosierung'},
  P20EE:{scene:'scr',focus:'scr-catalyst',flow:'exhaust',label:'SCR-Katalysator'},
  P2201:{scene:'scr',focus:'nox-upstream',flow:'data',label:'NOx-Sensor / Messstrecke'},
  P229F:{scene:'scr',focus:'nox-downstream',flow:'data',label:'NOx-Sensor nach SCR'},
  DPF:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'Dieselpartikelfilter'},
  P2002:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'DPF-Wirkbereich'},
  P2453:{scene:'dpf',focus:'pressure-sensor',flow:'data',label:'Differenzdrucksensor'},
  P2463:{scene:'dpf',focus:'soot-load',flow:'exhaust',label:'Rußbeladung im DPF'},
  P246C:{scene:'dpf',focus:'filter-core',flow:'exhaust',label:'DPF-Durchsatz / Last'},
  P0299:{scene:'boost',focus:'boost-path',flow:'air',label:'Ladedruckstrecke'},
  P0234:{scene:'boost',focus:'boost-path',flow:'air',label:'Ladedruckregelung'},
  P0236:{scene:'boost',focus:'boost-sensor',flow:'data',label:'Ladedrucksensor'},
  P0243:{scene:'boost',focus:'boost-control',flow:'electrical',label:'Ladedruckregelventil'},
  P2263:{scene:'boost',focus:'turbo',flow:'mechanical',label:'Turbolader'},
  P2279:{scene:'boost',focus:'intake-path',flow:'air',label:'Ansaug-/Ladeluftstrecke'},
  P2563:{scene:'boost',focus:'turbo-actuator',flow:'mechanical',label:'Turbo-Stellaktuator'},
  OIL:{scene:'oil',focus:'oil-circuit',flow:'fluid',label:'Öldruckkreislauf'},
  P0520:{scene:'oil',focus:'oil-pressure-sensor',flow:'data',label:'Öldrucksensor'},
  COOLANT:{scene:'cooling',focus:'hot-zone',flow:'fluid',label:'Kühlmittelkreislauf'},
  P0128:{scene:'cooling',focus:'thermostat',flow:'fluid',label:'Thermostat / Kühlmittelregelung'},
  P0118:{scene:'cooling',focus:'coolant-sensor',flow:'data',label:'Kühlmitteltemperatursensor'},
  ABS:{scene:'brakes',focus:'abs-module',flow:'hydraulic',label:'ABS-Hydraulik / Regelung'},
  ESC:{scene:'brakes',focus:'esc-control',flow:'data',label:'ESC/ESP-Regelung'},
  BRAKE:{scene:'brakes',focus:'brake-circuit',flow:'hydraulic',label:'Bremskreis'},
  PARKBRAKE:{scene:'brakes',focus:'epb-actuator',flow:'electrical',label:'Elektrische Parkbremse'},
  U0121:{scene:'brakes',focus:'abs-data-link',flow:'data',label:'Kommunikation ABS/ESP'},
  BATTERY:{scene:'charging',focus:'battery-path',flow:'electrical',label:'Batterie / Ladesystem'},
  P0562:{scene:'charging',focus:'low-voltage-bus',flow:'electrical',label:'Bordnetzspannung'},
  STARTSTOP:{scene:'charging',focus:'energy-management',flow:'electrical',label:'Energiemanagement / Start-Stopp'},
  STEERING:{scene:'steering',focus:'assist-unit',flow:'electrical',label:'Servolenkung / Lenkunterstützung'}
};

function inferred(code: string): FaultVisual {
  const fault = faultByCode(code);
  const text = `${fault?.code ?? code} ${fault?.title ?? ''} ${fault?.system ?? ''}`.toLowerCase();
  const tone = fault?.tone ?? 'neutral';
  if (/getriebe|wandler|übersetz|drehzahl/.test(text)) return {scene:'transmission',focus:'gearbox-zone',flow:'mechanical',label:'Getriebe / Kraftfluss',tone};
  if (/einspritz|kraftstoff|rail/.test(text)) return {scene:'fuel',focus:'fuel-pressure',flow:'fluid',label:'Kraftstoff- / Einspritzsystem',tone};
  if (/verbrennung|kurbel|nocken|klopf|zylinder/.test(text)) return {scene:'combustion',focus:'engine-core',flow:'mechanical',label:'Motorsteuerung / Verbrennung',tone};
  if (/kühl|temperatur/.test(text)) return {scene:'cooling',focus:'cooling-loop',flow:'fluid',label:'Kühlkreislauf',tone};
  if (/öl|schmierung/.test(text)) return {scene:'oil',focus:'oil-circuit',flow:'fluid',label:'Schmier- / Öldrucksystem',tone};
  if (/abgas|lambda|katalys|evap|tankentlüft/.test(text)) return {scene:'generic',focus:'exhaust-sensor-zone',flow:'exhaust',label:'Abgas- / Sensorsystem',tone};
  if (/luftmassen|ansaugluft|leerlauf/.test(text)) return {scene:'boost',focus:'intake-path',flow:'air',label:'Luftversorgung / Ansaugung',tone};
  if (/vorglüh|glüh/.test(text)) return {scene:'combustion',focus:'glow-control',flow:'electrical',label:'Vorglühanlage',tone};
  if (/can|kommunikation|steuergerät|prozessor/.test(text)) return {scene:'generic',focus:'control-data',flow:'data',label:'Steuergeräte / Kommunikation',tone};
  if (/airbag|srs/.test(text)) return {scene:'generic',focus:'restraint-zone',flow:'electrical',label:'Rückhaltesystem / SRS',tone};
  if (/reifen|rdks|tpms/.test(text)) return {scene:'generic',focus:'wheel-sensor-zone',flow:'data',label:'Reifendruck / Radsensorik',tone};
  if (/epc|motorsteuer/.test(text)) return {scene:'combustion',focus:'engine-control',flow:'data',label:'Motorsteuerung',tone};
  return {scene:'generic',focus:'system-zone',flow:'data',label:fault?.system ?? 'Fahrzeugsystem',tone};
}

export function getFaultVisual(code: string): FaultVisual {
  const normalized = String(code ?? '').trim().toUpperCase();
  const base = inferred(normalized);
  return { ...base, ...exact[normalized], tone: faultByCode(normalized)?.tone ?? base.tone };
}
