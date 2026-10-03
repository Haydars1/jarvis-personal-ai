import { getVehicleOptions, resolveVehicleProfile } from './vehicle-profiles.mjs';
import { nextSelection, saveVehicleSelection } from './vehicle-selection.mjs';
const defs=[['brand','MARKE','Marke wählen'],['model','MODELL','Modell wählen'],['generation','BAUREIHE / GENERATION','Baureihe wählen'],['year','BAUJAHR','Baujahr wählen'],['engine','MOTORISIERUNG','Motor wählen']];
export function buildSelectorModel(selection={}){
  const options=getVehicleOptions(selection); const values={brand:options.brands,model:options.models,generation:options.generations,year:options.years,engine:options.engines};
  const prerequisites={brand:true,model:!!selection.brand,generation:!!selection.brand&&!!selection.model,year:!!selection.brand&&!!selection.model&&!!selection.generation,engine:!!selection.brand&&!!selection.model&&!!selection.generation&&!!selection.year};
  const fields=defs.map(([name,label,placeholder])=>({name,label,placeholder,value:selection[name]??'',options:values[name]??[],disabled:!prerequisites[name]}));
  const resolved=resolveVehicleProfile(selection); return {fields,resolved,summary:resolved.profileKey?resolved.label:'Allgemeine Darstellung'};
}
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
function optionsMarkup(field){return `<option value="">${esc(field.placeholder)}</option>`+field.options.map(opt=>`<option value="${esc(opt)}" ${String(field.value)===String(opt)?'selected':''}>${esc(opt)}</option>`).join('');}
export function renderVehicleSelector(container,initialSelection={},onChange=()=>{}){
  let selection={...initialSelection};
  const render=()=>{const model=buildSelectorModel(selection);container.innerHTML=`<div class="vehicle-selector-card"><div class="vehicle-selector-head"><div><span>FAHRZEUGPROFIL</span><h3>Fahrzeug auswählen</h3></div><button type="button" class="vehicle-reset">Allgemeine Darstellung</button></div><div class="vehicle-selector-grid">${model.fields.map(f=>`<label><span>${f.label}</span><select data-field="${f.name}" ${f.disabled?'disabled':''}>${optionsMarkup(f)}</select></label>`).join('')}</div><div class="vehicle-selection-summary"><span>AUSGEWÄHLTES FAHRZEUG</span><strong>${esc(model.summary)}</strong></div></div>`;
    container.querySelectorAll('select[data-field]').forEach(select=>select.addEventListener('change',event=>{const field=event.currentTarget.dataset.field;selection=nextSelection(selection,field,event.currentTarget.value);saveVehicleSelection(globalThis.localStorage,selection);render();onChange(selection,resolveVehicleProfile(selection));}));
    container.querySelector('.vehicle-reset')?.addEventListener('click',()=>{selection={};saveVehicleSelection(globalThis.localStorage,selection);render();onChange(selection,resolveVehicleProfile(selection));});};
  render();return {getSelection:()=>({...selection}),reset:()=>{selection={};render();}};
}
