import { execute, jsonResponse, queryOne } from '../../lib/runtime.js';

const now=()=>Date.now();
let schemaReady=false;

async function ensureSchema(env){
  if(schemaReady)return;
  await execute(env,"CREATE TABLE IF NOT EXISTS source_pool_state (bridge_id TEXT PRIMARY KEY, summary_json TEXT NOT NULL DEFAULT '{}', last_seen_at INTEGER, updated_at INTEGER NOT NULL, FOREIGN KEY(bridge_id) REFERENCES ecu_device_bridges(id) ON DELETE CASCADE)");
  schemaReady=true;
}
async function sha256(value=''){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function bearer(req){
  const match=String(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);
  return match?match[1].trim():'';
}
async function bridgeFromRequest(req,env){
  const token=bearer(req);if(!token)return null;
  return queryOne(env,'SELECT id,label,status,last_seen_at FROM ecu_device_bridges WHERE token_sha256=?',await sha256(token));
}
async function appAuthed(core,req,env,ctx){
  const response=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await response.json()).authenticated;}catch{return false;}
}
function sanitizeSummary(value={}){
  const source=value&&typeof value==='object'?value:{};
  return {
    status:String(source.status||'unknown').slice(0,40),
    root:String(source.root||'').slice(0,500),
    requested:Math.max(0,Number(source.requested||source.requestedRepositories||0)),
    ready:Math.max(0,Number(source.ready||0)),
    failed:Math.max(0,Number(source.failed||0)),
    dryRun:Math.max(0,Number(source.dryRun||0)),
    startedAt:Number(source.startedAt||0)||null,
    completedAt:Number(source.completedAt||0)||null,
    error:source.error?String(source.error).slice(0,1000):null
  };
}

export function createSourcePoolState(core){
  if(!core?.fetch)throw new Error('SOURCE_POOL_STATE_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url),path=url.pathname,method=req.method;
      if(path==='/api/ecu/device/heartbeat'&&method==='POST'){
        const bridge=await bridgeFromRequest(req,env);
        if(bridge){
          try{
            const body=await req.clone().json();
            if(body?.source_pool){
              await ensureSchema(env);
              const summary=sanitizeSummary(body.source_pool),ts=now();
              await execute(env,'INSERT INTO source_pool_state(bridge_id,summary_json,last_seen_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(bridge_id) DO UPDATE SET summary_json=excluded.summary_json,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at',bridge.id,JSON.stringify(summary),ts,ts);
            }
          }catch{}
        }
        return core.fetch(req,env,ctx);
      }
      if(path==='/api/ecu/device/source-pool'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        await ensureSchema(env);
        const row=await queryOne(env,'SELECT s.*,b.label,b.status AS bridge_status,b.last_seen_at AS bridge_last_seen_at FROM source_pool_state s JOIN ecu_device_bridges b ON b.id=s.bridge_id ORDER BY s.updated_at DESC LIMIT 1');
        if(!row)return jsonResponse({source_pool:null});
        let summary={};try{summary=JSON.parse(row.summary_json||'{}')}catch{}
        return jsonResponse({source_pool:{...summary,bridge_id:row.bridge_id,bridge_label:row.label,bridge_status:row.bridge_status,last_seen_at:row.last_seen_at,updated_at:row.updated_at}});
      }
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}

export { sanitizeSummary as sanitizeSourcePoolSummary };
