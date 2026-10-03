import { resolveVehicleProfile } from './vehicle-profiles.mjs';
const STORAGE_KEY='6006.vehicle';
const ORDER=['brand','model','generation','year','engine'];
export function loadVehicleSelection(storage=globalThis.localStorage){
  try{
    const raw=storage?.getItem?.(STORAGE_KEY); if(!raw) return {};
    const parsed=JSON.parse(raw); if(!parsed||typeof parsed!=='object') return {};
    const candidate={brand:parsed.brand,model:parsed.model,generation:parsed.generation,year:Number(parsed.year),engine:parsed.engine};
    if(!candidate.brand||!candidate.model||!candidate.generation||!Number.isFinite(candidate.year)||!candidate.engine) return {};
    return resolveVehicleProfile(candidate).profileKey?candidate:{};
  }catch{return {};}
}
export function saveVehicleSelection(storage=globalThis.localStorage,selection={}){
  if(!selection||!Object.keys(selection).length){storage?.removeItem?.(STORAGE_KEY);return;}
  storage?.setItem?.(STORAGE_KEY,JSON.stringify(selection));
}
export function nextSelection(current={},field,value){
  const index=ORDER.indexOf(field); if(index<0) return {...current}; const next={};
  for(let i=0;i<index;i++){const key=ORDER[i];if(current[key]!==undefined&&current[key]!==null&&current[key]!=='') next[key]=current[key];}
  if(value!==undefined&&value!==null&&value!=='') next[field]=field==='year'?Number(value):value;
  return next;
}
