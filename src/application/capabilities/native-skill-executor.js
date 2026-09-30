import { jsonResponse } from '../../lib/runtime.js';
import { parseEcuDeviceIntent, ECU_DEVICE_ACTIONS } from '../ecu/device-bridge.js';

const SUPPORTED_ADAPTERS=new Set(['repo-cloud-tools','device-bridge']);

function ready(skill){return skill?.adapter_status==='ready'&&skill?.native_adapter&&skill?.requires_paid_api!==true;}

export function deviceIntentIsWrite(text=''){
  const action=parseEcuDeviceIntent(text),meta=action?ECU_DEVICE_ACTIONS[action]:null;
  return !!meta?.write;
}

export function canExecuteNativeSkill(skill,text=''){
  if(!ready(skill))return false;
  const id=String(skill.native_adapter?.id||'');
  if(!SUPPORTED_ADAPTERS.has(id))return false;
  if(id==='repo-cloud-tools')return !!skill.repo;
  if(id==='device-bridge')return !!parseEcuDeviceIntent(text);
  return false;
}

export function chooseExecutableSkill(rows=[],text=''){
  return (Array.isArray(rows)?rows:[]).find(skill=>canExecuteNativeSkill(skill,text))||null;
}

function jsonRequest(url,req,body){
  const headers=new Headers(req.headers);headers.set('content-type','application/json');
  return new Request(url,{method:'POST',headers,body:JSON.stringify(body)});
}

function skillPayload(text,skill,reply,extra={}){
  return {
    reply,
    history:[{role:'user',content:text},{role:'assistant',content:reply,provider:'JARVIS Skill'}],
    provider:'JARVIS Skill',
    skill:{id:skill.id,repo:skill.repo,capability:skill.primary_capability,adapter:skill.native_adapter?.id},
    trace:[{kind:'skill',label:'JARVIS native skill',value:`${skill.repo||skill.primary_capability} · ${skill.native_adapter?.id} · hosted AI API kullanılmadı`}],
    ...extra
  };
}

function repoJobAdapter(text=''){return /(ara|bul|search|kaynak|source|kod|code|dosya|file|nerede|hangi)/i.test(String(text))?'source-search':'repo-inspect';}

async function executeRepoCloudSkill(core,req,env,ctx,text,skill){
  const adapterId=repoJobAdapter(text),url=new URL('/api/tools/cloud/jobs',req.url);
  const body={adapter_id:adapterId,repo:skill.repo,commit:skill.source_commit||null,input:adapterId==='source-search'?{term:String(text).slice(0,200)}:{source:'skill-first-chat'}};
  const response=await core.fetch(jsonRequest(url,req,body),env,ctx);
  if(!response.ok)return null;
  let payload={};try{payload=await response.json();}catch{return null;}
  const job=payload?.job;if(!job)return null;
  return skillPayload(text,skill,`JARVIS bu işi ${skill.repo} becerisine verdi. Bulut skill işi kuyruğa alındı: ${String(job.id||'').slice(0,8)}.`,{job});
}

async function executeDeviceSkill(core,req,env,ctx,text,skill){
  const action=parseEcuDeviceIntent(text);if(!action)return null;
  const meta=ECU_DEVICE_ACTIONS[action];if(!meta)return null;
  const url=new URL('/api/ecu/device/jobs',req.url);
  const response=await core.fetch(jsonRequest(url,req,{action,module:'',request:{source:'skill-first-chat',text},confirmed:false}),env,ctx);
  let payload={};try{payload=await response.json();}catch{}
  if(response.ok&&payload?.job){
    const job=payload.job;
    return skillPayload(text,skill,`${meta.label} işi doğrudan JARVIS cihaz becerisine verildi. Job: ${String(job.id||'').slice(0,8)}.`,{device_action:{action,status:'queued',job}});
  }
  if(response.status===409&&payload?.error==='CONFIRMATION_REQUIRED'){
    return skillPayload(text,skill,`${meta.label} yazma/servis işlemi. JARVIS bunu otomatik çalıştırmadı; açık kullanıcı onayı gerekiyor.`,{device_action:{action,status:'confirmation_required',requires_confirmation:true,hazard:meta.hazard}});
  }
  if(response.status===409&&payload?.error==='NO_DEVICE_BRIDGE'){
    return skillPayload(text,skill,'Cihaz becerisi bulundu fakat bağlı ECU/OBD bridge yok. Fiziksel araç işlemi başlatılmadı.',{device_action:{action,status:'blocked',reason:'NO_DEVICE_BRIDGE'}});
  }
  return null;
}

export async function executeNativeSkill(core,req,env,ctx,text,skill){
  if(!canExecuteNativeSkill(skill,text))return null;
  const id=skill.native_adapter.id;
  if(id==='repo-cloud-tools')return executeRepoCloudSkill(core,req,env,ctx,text,skill);
  if(id==='device-bridge')return executeDeviceSkill(core,req,env,ctx,text,skill);
  return null;
}

export async function executeFirstNativeSkill(core,req,env,ctx,text,rows=[]){
  for(const skill of Array.isArray(rows)?rows:[]){
    if(!canExecuteNativeSkill(skill,text))continue;
    const result=await executeNativeSkill(core,req,env,ctx,text,skill).catch(()=>null);
    if(result)return result;
  }
  return null;
}

async function discoverSkills(core,req,env,ctx,text){
  const url=new URL('/api/tools/discover',req.url);url.searchParams.set('capability',text);
  const response=await core.fetch(new Request(url,{headers:req.headers}),env,ctx);
  if(!response.ok)return [];
  try{return (await response.json())?.results||[];}catch{return [];}
}

export function createNativeSkillFirstChat(core,fallback){
  if(!core?.fetch||typeof fallback!=='function')throw new Error('NATIVE_SKILL_GATE_REQUIRED');
  return async function handleNativeSkillFirst(req,env,ctx){
    let body={};try{body=await req.clone().json();}catch{}
    const text=String(body?.text||'').trim();
    if(!text)return fallback(req,env,ctx);
    const rows=await discoverSkills(core,req,env,ctx,text).catch(()=>[]);
    const payload=await executeFirstNativeSkill(core,req,env,ctx,text,rows).catch(()=>null);
    if(payload)return jsonResponse(payload);
    return fallback(req,env,ctx);
  };
}
