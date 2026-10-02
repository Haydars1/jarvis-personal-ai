import { jsonResponse } from '../../lib/runtime.js';
import { parseEcuDeviceIntent, ECU_DEVICE_ACTIONS } from '../ecu/device-bridge.js';
import { socialDraftIntent } from '../social/native-draft.js';

const SUPPORTED_ADAPTERS=new Set(['repo-cloud-tools','device-bridge','ecu-binary-inspector','social-growth','youtube-teaching']);

function ready(skill){return skill?.adapter_status==='ready'&&skill?.native_adapter&&skill?.requires_paid_api!==true;}
function binaryAttachments(context={}){
  return (Array.isArray(context?.attachments)?context.attachments:[]).filter(file=>{
    const name=String(file?.name||''),type=String(file?.type||'');
    return !!file?.base64&&(/\.(bin|ori|hex|rom)$/i.test(name)||/octet-stream|macbinary/i.test(type));
  });
}

function repoToolIntent(text=''){
  const value=String(text||'').trim().toLowerCase();
  if(!value)return false;
  const explicitRepo=/\b(repo|repository|github|git|codebase|source\s*code|kaynak\s*kod|kod\s*taban[ıi])\b/i.test(value);
  const codeTarget=/\b(checksum|parser|endpoint|api|fonksiyon|function|class|sınıf|dosya|file|commit|branch|test|kaynak|source|kod|code)\b/i.test(value);
  const inspectAction=/\b(ara|bul|incele|nerede|hangi|search|find|inspect|locate|göster|listele)\b/i.test(value);
  return (explicitRepo&&inspectAction)||(codeTarget&&inspectAction);
}

function extractYouTubeUrl(text=''){
  const match=String(text||'').match(/https:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=[A-Za-z0-9_-]+|shorts\/[A-Za-z0-9_-]+|live\/[A-Za-z0-9_-]+|embed\/[A-Za-z0-9_-]+|@[^\s/?#]+|channel\/UC[A-Za-z0-9_-]+|c\/[^\s/?#]+|user\/[^\s/?#]+)|youtu\.be\/[A-Za-z0-9_-]+)[^\s]*/i);
  return match?match[0].replace(/[),.;!?]+$/,''):'';
}

function youtubeTeachingIntent(text=''){
  const value=String(text||'').toLocaleLowerCase('tr-TR');
  if(!extractYouTubeUrl(value))return false;
  return /(?:yt|youtube).*(?:öğreti|ogreti|öğren|ogren|eğitim|egitim|analiz et.*öğren|kaynak olarak işle|teach)|(?:öğreti|ogreti|öğren|ogren|eğitim|egitim|teach|kaynak olarak işle).*(?:youtube|youtu\.be)/i.test(value);
}

export function deviceIntentIsWrite(text=''){
  const action=parseEcuDeviceIntent(text),meta=action?ECU_DEVICE_ACTIONS[action]:null;
  return !!meta?.write;
}

export function canExecuteNativeSkill(skill,text='',context={}){
  if(!ready(skill))return false;
  const id=String(skill.native_adapter?.id||'');
  if(!SUPPORTED_ADAPTERS.has(id))return false;
  if(id==='repo-cloud-tools')return !!skill.repo&&repoToolIntent(text);
  if(id==='device-bridge')return !!parseEcuDeviceIntent(text);
  if(id==='ecu-binary-inspector')return binaryAttachments(context).length>0;
  if(id==='social-growth')return socialDraftIntent(text);
  if(id==='youtube-teaching')return youtubeTeachingIntent(text);
  return false;
}

export function chooseExecutableSkill(rows=[],text='',context={}){
  return (Array.isArray(rows)?rows:[]).find(skill=>canExecuteNativeSkill(skill,text,context))||null;
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
async function readJsonResponse(response){try{return await response.json();}catch{return null;}}

async function repoJobStatus(core,req,env,ctx,jobId){
  if(!jobId)return null;
  const url=new URL(`/api/tools/cloud/jobs/${encodeURIComponent(jobId)}`,req.url);
  const response=await core.fetch(new Request(url,{headers:req.headers}),env,ctx);
  if(!response.ok)return null;
  const payload=await readJsonResponse(response);
  return payload?.job?{job:payload.job,answer:payload?.answer?String(payload.answer):null}:null;
}

async function executeRepoCloudSkill(core,req,env,ctx,text,skill){
  const adapterId=repoJobAdapter(text),url=new URL('/api/tools/cloud/jobs',req.url);
  const body={adapter_id:adapterId,repo:skill.repo,commit:skill.source_commit||null,input:adapterId==='source-search'?{term:String(text).slice(0,200)}:{source:'skill-first-chat'}};
  const response=await core.fetch(jsonRequest(url,req,body),env,ctx);
  if(!response.ok)return null;
  const payload=await readJsonResponse(response);
  const queuedJob=payload?.job;if(!queuedJob?.id)return null;

  const current=await repoJobStatus(core,req,env,ctx,queuedJob.id);
  if(current?.job?.status==='completed'&&current.answer){
    return skillPayload(text,skill,current.answer,{job:current.job});
  }
  if(['queued','running'].includes(String(current?.job?.status||queuedJob.status||''))){
    return {
      pendingSkillJob:current?.job||queuedJob,
      pendingSkill:{id:skill.id,repo:skill.repo,capability:skill.primary_capability,adapter:skill.native_adapter?.id}
    };
  }
  return null;
}

async function executeYouTubeTeachingSkill(core,req,env,ctx,text,skill){
  const sourceUrl=extractYouTubeUrl(text);if(!sourceUrl)return null;
  const url=new URL('/api/tools/cloud/jobs',req.url);
  const body={adapter_id:'youtube-teaching',repo:skill.repo,commit:null,input:{url:sourceUrl,source:'yt-teaching'}};
  const response=await core.fetch(jsonRequest(url,req,body),env,ctx);
  if(!response.ok)return null;
  const payload=await readJsonResponse(response),queuedJob=payload?.job;
  if(!queuedJob?.id)return null;
  const current=await repoJobStatus(core,req,env,ctx,queuedJob.id);
  if(current?.job?.status==='completed'&&current.answer)return skillPayload(text,skill,current.answer,{job:current.job});
  if(['queued','running'].includes(String(current?.job?.status||queuedJob.status||''))){
    return {pendingSkillJob:current?.job||queuedJob,pendingSkill:{id:skill.id,repo:skill.repo,capability:skill.primary_capability,adapter:'youtube-teaching'}};
  }
  return null;
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

async function executeBinarySkill(core,req,env,ctx,text,skill,context={}){
  const attachments=binaryAttachments(context);if(!attachments.length)return null;
  let original={};try{original=await req.clone().json();}catch{}
  const url=new URL('/api/chat/send',req.url);
  const body={...original,text:String(original?.text||text).trim()||text,channel:'ecu',attachments};
  const response=await core.fetch(jsonRequest(url,req,body),env,ctx);
  if(!response.ok)return null;
  let payload={};try{payload=await response.json();}catch{return null;}
  if(!payload?.reply)return null;
  return {
    ...payload,
    skill:{id:skill.id,repo:skill.repo,capability:skill.primary_capability,adapter:skill.native_adapter?.id},
    trace:[...(Array.isArray(payload.trace)?payload.trace:[]),{kind:'skill',label:'JARVIS native skill',value:`${skill.repo||skill.primary_capability} · ecu-binary-inspector · hosted AI API kullanılmadı`}]
  };
}

async function executeSocialDraftSkill(core,req,env,ctx,text,skill){
  const url=new URL('/api/social-growth/native-draft',req.url);
  const body={topic:text,request:text,plan_mode:'deterministic',execution_mode:'draft',source:'native-skill'};
  const response=await core.fetch(jsonRequest(url,req,body),env,ctx);
  if(!response.ok)return null;
  let campaign={};try{campaign=await response.json();}catch{return null;}
  if(!campaign?.id)return null;
  const reply=`Sosyal medya için API'siz içerik taslağını oluşturdum. ${campaign.items||0} taslak içerik kaydedildi; video üretimi veya yayınlama başlatılmadı.`;
  return skillPayload(text,skill,reply,{campaign});
}

export async function executeNativeSkill(core,req,env,ctx,text,skill,context={}){
  if(!canExecuteNativeSkill(skill,text,context))return null;
  const id=skill.native_adapter.id;
  if(id==='repo-cloud-tools')return executeRepoCloudSkill(core,req,env,ctx,text,skill);
  if(id==='youtube-teaching')return executeYouTubeTeachingSkill(core,req,env,ctx,text,skill);
  if(id==='device-bridge')return executeDeviceSkill(core,req,env,ctx,text,skill);
  if(id==='ecu-binary-inspector')return executeBinarySkill(core,req,env,ctx,text,skill,context);
  if(id==='social-growth')return executeSocialDraftSkill(core,req,env,ctx,text,skill);
  return null;
}

export async function executeFirstNativeSkill(core,req,env,ctx,text,rows=[],context={}){
  for(const skill of Array.isArray(rows)?rows:[]){
    if(!canExecuteNativeSkill(skill,text,context))continue;
    const result=await executeNativeSkill(core,req,env,ctx,text,skill,context).catch(()=>null);
    if(result?.reply)return result;
    if(result?.pendingSkillJob)return result;
  }
  return null;
}

async function discoverSkills(core,req,env,ctx,text){
  const url=new URL('/api/tools/discover',req.url);url.searchParams.set('capability',text);
  const response=await core.fetch(new Request(url,{headers:req.headers}),env,ctx);
  if(!response.ok)return [];
  try{return (await response.json())?.results||[];}catch{return [];}
}

async function fallbackWithPendingJob(fallback,req,env,ctx,job){
  const headers=new Headers(req.headers);
  headers.set('x-jarvis-skill-skip','1');
  const response=await fallback(new Request(req,{headers}),env,ctx);
  if(!job||!response?.ok)return response;
  let payload=null;try{payload=await response.clone().json();}catch{return response;}
  if(!payload||typeof payload!=='object')return response;
  if(!payload.job)payload.job=job;
  return jsonResponse(payload,response.status);
}

export function createNativeSkillFirstChat(core,fallback){
  if(!core?.fetch||typeof fallback!=='function')throw new Error('NATIVE_SKILL_GATE_REQUIRED');
  return async function handleNativeSkillFirst(req,env,ctx){
    let body={};try{body=await req.clone().json();}catch{}
    const text=String(body?.text||'').trim();
    if(!text)return fallback(req,env,ctx);
    const rows=await discoverSkills(core,req,env,ctx,text).catch(()=>[]);
    const payload=await executeFirstNativeSkill(core,req,env,ctx,text,rows,body).catch(()=>null);
    if(payload?.reply)return jsonResponse(payload);
    if(payload?.pendingSkillJob)return fallbackWithPendingJob(fallback,req,env,ctx,payload.pendingSkillJob);
    return fallback(req,env,ctx);
  };
}
