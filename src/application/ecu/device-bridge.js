import { execute, jsonResponse, queryAll, queryOne, readJson } from '../../lib/runtime.js';

const now=()=>Date.now();
const uid=()=>crypto.randomUUID();

const ACTIONS=Object.freeze({
  read_dtc:{label:'DTC oku',write:false,hazard:'low'},
  clear_dtc:{label:'DTC temizle',write:true,hazard:'medium'},
  read_live_data:{label:'Canlı veri oku',write:false,hazard:'low'},
  long_coding_read:{label:'Long coding oku',write:false,hazard:'low'},
  long_coding_write:{label:'Long coding yaz',write:true,hazard:'high'},
  adaptation_read:{label:'Adaptation/uyarlama oku',write:false,hazard:'low'},
  adaptation_write:{label:'Adaptation/uyarlama yaz',write:true,hazard:'high'},
  basic_setting:{label:'Basic setting çalıştır',write:true,hazard:'high'},
  service_reset:{label:'Servis reset',write:true,hazard:'medium'},
  dpf_service_regen:{label:'DPF servis rejenerasyonu',write:true,hazard:'high'}
});

async function sha256(value=''){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function bearer(req){
  const value=String(req.headers.get('authorization')||'');
  const m=value.match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():'';
}
function parseJson(value,fallback={}){
  try{return JSON.parse(value||'');}catch{return fallback;}
}
export function bridgeSupportsAction(capabilities,action){return Array.isArray(capabilities)&&capabilities.includes(String(action||''));}
export function parseEcuDeviceIntent(text=''){
  const value=String(text||'').toLocaleLowerCase('tr-TR');
  if(/(?:dtc|arıza\s*kod(?:u|ları)?)\s*(?:oku|tara|scan)|(?:oku|tara|scan).*?(?:dtc|arıza\s*kod)/i.test(value))return 'read_dtc';
  if(/(?:dtc|arıza\s*kod(?:u|ları)?)\s*(?:sil|temizle)|(?:sil|temizle).*?(?:dtc|arıza\s*kod)/i.test(value))return 'clear_dtc';
  if(/canlı\s*(?:veri|data)|live\s*data/i.test(value))return 'read_live_data';
  if(/long\s*coding.*(?:oku|göster)|(?:oku|göster).*long\s*coding/i.test(value))return 'long_coding_read';
  if(/long\s*coding.*(?:yaz|değiştir|uygula)/i.test(value))return 'long_coding_write';
  if(/(?:adaptation|adaptasyon|uyarlama).*(?:oku|göster)|(?:oku|göster).*(?:adaptation|adaptasyon|uyarlama)/i.test(value))return 'adaptation_read';
  if(/(?:adaptation|adaptasyon|uyarlama).*(?:yaz|değiştir|uygula)/i.test(value))return 'adaptation_write';
  if(/basic\s*setting/i.test(value))return 'basic_setting';
  if(/servis\s*(?:reset|sıfırla)|service\s*reset/i.test(value))return 'service_reset';
  if(/dpf.*(?:rejenerasyon|regen|reinigung)|(?:rejenerasyon|regen|reinigung).*dpf/i.test(value))return 'dpf_service_regen';
  return null;
}
function chatDevicePayload(text,reply,extra={}){
  return {reply,provider:'JARVIS ECU Device Bridge',history:[{role:'user',content:text},{role:'assistant',content:reply,provider:'JARVIS ECU Device Bridge'}],...extra};
}
async function appAuthed(core,req,env,ctx){
  const response=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await response.json()).authenticated;}catch{return false;}
}
async function bridgeAuth(req,env){
  const token=bearer(req);
  if(!token)return null;
  const hash=await sha256(token);
  return queryOne(env,'SELECT * FROM ecu_device_bridges WHERE token_sha256=?',hash);
}
async function latestBridge(env){
  return queryOne(env,"SELECT * FROM ecu_device_bridges ORDER BY CASE WHEN status='online' THEN 0 ELSE 1 END,last_seen_at DESC,created_at DESC LIMIT 1");
}
function publicBridge(row){
  if(!row)return null;
  return {
    id:row.id,label:row.label,transport:row.transport,status:row.status,
    capabilities:parseJson(row.capabilities,[]),last_seen_at:row.last_seen_at,
    created_at:row.created_at,updated_at:row.updated_at
  };
}
function publicJob(row){
  if(!row)return null;
  return {
    id:row.id,bridge_id:row.bridge_id,action:row.action,module:row.module,
    request:parseJson(row.request_json,{}),status:row.status,
    requires_confirmation:!!row.requires_confirmation,confirmed_at:row.confirmed_at,
    claimed_at:row.claimed_at,finished_at:row.finished_at,
    result:parseJson(row.result_json,null),error:row.error,
    created_at:row.created_at,updated_at:row.updated_at
  };
}

export function createEcuDeviceBridge(core){
  if(!core?.fetch)throw new Error('ECU_DEVICE_BRIDGE_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url),path=url.pathname,method=req.method;

      if(path==='/api/chat/send'&&method==='POST'){
        const body=await readJson(req.clone());
        if(String(body?.channel||'').toLowerCase()==='ecu'&&!(body.attachments||[]).length){
          const text=String(body.text||'').trim(),action=parseEcuDeviceIntent(text),meta=ACTIONS[action];
          if(action&&meta){
            if(!(await appAuthed(core,req,env,ctx)))return core.fetch(req,env,ctx);
            const bridge=await latestBridge(env);
            if(!bridge){
              return jsonResponse(chatDevicePayload(text,'Cihaz komutunu algıladım fakat kayıtlı yerel ECU/OBD bridge yok. ECU Studio → CİHAZ bölümünden bridge oluşturup bilgisayardaki local bridge ajanını bağla.',{device_action:{action,status:'blocked',reason:'NO_DEVICE_BRIDGE'}}));
            }
            if(meta.write&&body.deviceConfirmed!==true){
              return jsonResponse(chatDevicePayload(text,`${meta.label} yazma/servis işlemi olarak algılandı. Gerçek araca komut göndermeden önce ECU Studio → CİHAZ bölümünden işlemi açıkça onaylaman gerekiyor.`,{device_action:{action,status:'confirmation_required',requires_confirmation:true,hazard:meta.hazard}}));
            }
            const ts=now(),id=uid();
            await execute(env,'INSERT INTO ecu_device_jobs(id,bridge_id,action,module,request_json,status,requires_confirmation,confirmed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
              id,bridge.id,action,String(body.deviceModule||'').slice(0,120),JSON.stringify({source:'ecu-chat',text,safety:{hazard:meta.hazard,write:meta.write}}),'pending',meta.write?1:0,meta.write?ts:null,ts,ts);
            const job=publicJob(await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',id));
            const availability=bridge.status==='online'?'Bridge online; iş cihaz tarafından alınmayı bekliyor.':'Bridge şu an offline; iş kuyrukta bekleyecek.';
            return jsonResponse(chatDevicePayload(text,`${meta.label} işi kuyruğa alındı. ${availability} Job: ${id.slice(0,8)}`,{device_action:{action,status:'queued',job}}));
          }
        }
      }

      if(path==='/api/ecu/device/capabilities'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        return jsonResponse({actions:Object.entries(ACTIONS).map(([id,meta])=>({id,...meta}))});
      }

      if(path==='/api/ecu/device/bridges/register'&&method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const body=await readJson(req),id=uid(),token=`${crypto.randomUUID()}.${crypto.randomUUID()}`,ts=now();
        await execute(env,'INSERT INTO ecu_device_bridges(id,label,token_sha256,transport,capabilities,status,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
          id,String(body.label||'Local ECU Bridge').slice(0,120),await sha256(token),'local-agent','[]','offline',null,ts,ts);
        return jsonResponse({bridge:{id,label:String(body.label||'Local ECU Bridge')},token,token_notice:'Bu token yalnız bu yanıtta gösterilir; yerel bridge tarafında güvenli sakla.'},201);
      }

      if(path==='/api/ecu/device/bridges'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const rows=await queryAll(env,'SELECT * FROM ecu_device_bridges ORDER BY last_seen_at DESC,created_at DESC LIMIT 50');
        return jsonResponse({bridges:rows.map(publicBridge)});
      }

      if(path==='/api/ecu/device/heartbeat'&&method==='POST'){
        const bridge=await bridgeAuth(req,env);
        if(!bridge)return jsonResponse({error:'BRIDGE_AUTH_REQUIRED'},401);
        const body=await readJson(req),caps=Array.isArray(body.capabilities)?body.capabilities.filter(x=>ACTIONS[String(x)]):[];
        const ts=now();
        await execute(env,'UPDATE ecu_device_bridges SET status=?,capabilities=?,last_seen_at=?,updated_at=? WHERE id=?','online',JSON.stringify(caps),ts,ts,bridge.id);
        return jsonResponse({ok:true,bridge_id:bridge.id,server_time:ts});
      }

      if(path==='/api/ecu/device/jobs'&&method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const body=await readJson(req),action=String(body.action||'').trim();
        const meta=ACTIONS[action];
        if(!meta)return jsonResponse({error:'UNSUPPORTED_ACTION',allowed:Object.keys(ACTIONS)},400);
        const bridge=body.bridge_id?await queryOne(env,'SELECT * FROM ecu_device_bridges WHERE id=?',String(body.bridge_id)):await latestBridge(env);
        if(!bridge)return jsonResponse({error:'NO_DEVICE_BRIDGE'},409);
        if(meta.write&&body.confirmed!==true)return jsonResponse({error:'CONFIRMATION_REQUIRED',action,hazard:meta.hazard},409);
        const ts=now(),id=uid(),request={...(body.request||{}),safety:{hazard:meta.hazard,write:meta.write}};
        await execute(env,'INSERT INTO ecu_device_jobs(id,bridge_id,action,module,request_json,status,requires_confirmation,confirmed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          id,bridge.id,action,String(body.module||'').slice(0,120),JSON.stringify(request),'pending',meta.write?1:0,meta.write?ts:null,ts,ts);
        return jsonResponse({job:publicJob(await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',id))},201);
      }

      if(path==='/api/ecu/device/jobs'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const rows=await queryAll(env,'SELECT * FROM ecu_device_jobs ORDER BY created_at DESC LIMIT 100');
        return jsonResponse({jobs:rows.map(publicJob)});
      }

      if(path==='/api/ecu/device/jobs/next'&&method==='GET'){
        const bridge=await bridgeAuth(req,env);
        if(!bridge)return jsonResponse({error:'BRIDGE_AUTH_REQUIRED'},401);
        const caps=parseJson(bridge.capabilities,[]);
        const pending=await queryAll(env,"SELECT * FROM ecu_device_jobs WHERE bridge_id=? AND status='pending' ORDER BY created_at ASC LIMIT 20",bridge.id);
        const job=pending.find(row=>bridgeSupportsAction(caps,row.action));
        if(!job)return jsonResponse({job:null});
        const ts=now();
        await execute(env,"UPDATE ecu_device_jobs SET status='running',claimed_at=?,updated_at=? WHERE id=? AND status='pending'",ts,ts,job.id);
        return jsonResponse({job:publicJob(await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',job.id))});
      }

      const resultMatch=path.match(/^\/api\/ecu\/device\/jobs\/([^/]+)\/result$/);
      if(resultMatch&&method==='POST'){
        const bridge=await bridgeAuth(req,env);
        if(!bridge)return jsonResponse({error:'BRIDGE_AUTH_REQUIRED'},401);
        const id=decodeURIComponent(resultMatch[1]),job=await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',id);
        if(!job||job.bridge_id!==bridge.id)return jsonResponse({error:'JOB_NOT_FOUND'},404);
        const body=await readJson(req),ok=body.ok===true,ts=now();
        await execute(env,'UPDATE ecu_device_jobs SET status=?,result_json=?,error=?,finished_at=?,updated_at=? WHERE id=?',
          ok?'completed':'failed',JSON.stringify(body.result??null),ok?null:String(body.error||'DEVICE_JOB_FAILED'),ts,ts,id);
        return jsonResponse({ok:true,job:publicJob(await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',id))});
      }

      const jobMatch=path.match(/^\/api\/ecu\/device\/jobs\/([^/]+)$/);
      if(jobMatch&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const job=await queryOne(env,'SELECT * FROM ecu_device_jobs WHERE id=?',decodeURIComponent(jobMatch[1]));
        return job?jsonResponse({job:publicJob(job)}):jsonResponse({error:'JOB_NOT_FOUND'},404);
      }

      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}

export const ECU_DEVICE_ACTIONS=ACTIONS;
