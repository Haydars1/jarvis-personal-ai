import { loadVehicleSelection } from './vehicle-selection.mjs';
import { resolveVehicleProfile } from './vehicle-profiles.mjs';
import { renderVehicleSelector } from './vehicle-selector-ui.mjs';
import { renderVehicleSchematicSvg } from './vehicle-schematic.mjs';

const params=new URLSearchParams(window.location.search);
const code=(params.get('code')||'P0299').toUpperCase();
const fallback={
  label:code,title:'Fahrzeugwarnung',system:'Fahrzeugsystem',severity:'Fahrzeugspezifisch',
  drive:'Die Weiterfahrt hängt von Warnfarbe, Begleitsymptomen und Fahrzeugzustand ab.',
  meaning:'Zu diesem Eintrag liegen noch keine ausführlichen fahrzeugspezifischen Informationen vor.',
  symptoms:['Warnleuchte oder Fehlermeldung im Fahrzeug'],
  causes:['Mehrere fahrzeug- und herstellerspezifische Ursachen sind möglich'],
  diagnosis:['Fehlerspeicher und Freeze-Frame-Daten auslesen','Live-Daten und Versorgung prüfen','Herstellerspezifische Prüfroutine verwenden'],
  solutions:['Ursache nach eindeutiger Diagnose instand setzen'],
  note:'Allgemeine Fehlercodeinformationen ersetzen keine fahrzeugspezifische Diagnose.'
};
const d=window.faultData?.[code]||fallback;

const setText=(id,value)=>{const el=document.getElementById(id);if(el) el.textContent=value};
const fillList=(id,items=[])=>{const el=document.getElementById(id);if(!el)return;el.innerHTML='';items.forEach(item=>{const li=document.createElement('li');li.textContent=item;el.appendChild(li)})};

function fillFaultDetails(){
  document.title=`${d.label} – ${d.title} | 6006 Performance`;
  setText('fault-code',d.label);setText('fault-title',d.title);setText('fault-system',d.system);setText('fault-severity',`Priorität: ${d.severity}`);
  setText('fault-meaning',d.meaning);setText('fault-drive',d.drive);setText('fault-note',d.note);
  fillList('fault-symptoms',d.symptoms);fillList('fault-causes',d.causes);fillList('fault-diagnosis',d.diagnosis);fillList('fault-solutions',d.solutions);
}

function renderSchematic(profile){
  const container=document.getElementById('vehicle-schematic-host');
  if(container) container.innerHTML=renderVehicleSchematicSvg(profile,code);
}

fillFaultDetails();
const selection=loadVehicleSelection(window.localStorage);
const resolved=resolveVehicleProfile(selection);
renderSchematic(resolved);
const selectorHost=document.getElementById('vehicle-selector-host');
if(selectorHost){
  renderVehicleSelector(selectorHost,selection,(_next,nextProfile)=>renderSchematic(nextProfile));
}
