import { execute, jsonResponse, queryAll, queryOne, readJson } from '../../lib/runtime.js';
import { CURATED_CAPABILITY_SEEDS } from '../../lib/open-source-capabilities.js';
import { OBD_PDF_SEEDS } from '../../lib/obd-pdf-seeds.js';

const now=()=>Date.now();
const uid=()=>crypto.randomUUID();
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_AUDIENCE='jarvis-cloud-tool-runner';
const TRUSTED_REPOSITORY='Haydars1/jarvis-personal-ai';
const TRUSTED_WORKFLOW='Haydars1/jarvis-personal-ai/.github/workflows/cloud-tool-runner.yml@refs/heads/main';
const ALLOWED_ADAPTERS=Object.freeze({
  'repo-inspect':{label:'Repository inspect',mode:'read-only'},
  'source-search':{label:'Source search',mode:'read-only'},
  'source-read':{label:'Source file read',mode:'read-only'}
});
const CURATED_REPOS=new Set([...CURATED_CAPABILITY_SEEDS,...OBD_PDF_SEEDS].map(item=>String(item.repo||'').toLowerCase()).filter(Boolean));
let oidcCache={expires:0,jwks:null};

function b64url(value){
  const input=value.replace(/-/g,'+').replace(/_/g,'/');
  const padded=input+'='.repeat((4-input.length%4)%4);
  return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
}
function decodeJson(value){return JSON.parse(new TextDecoder().decode(b64url(value)));}
async function oidcJwks(){
  if(oidcCache.jwks&&oidcCache.expires>now())return oidcCache.jwks;
  const response=await fetch(`${OIDC_ISSUER}/.well-known/jwks`);
  if(!response.ok)throw new Error(`OIDC_JWKS_${response.status}`);
  const jwks=await response.json();oidcCache={jwks,expires:now()+60*60*1000};return jwks;
}
async function verifyRunnerJwt(token){
  const parts=String(token||'').split('.');if(parts.length!==3)throw new Error('OIDC_TOKEN_INVALID');
  const header=decodeJson(parts[0]),payload=decodeJson(parts[1]);
  const jwks=await oidcJwks(),jwk=(jwks.keys||[]).find(key=>key.kid===header.kid);
  if(!jwk)throw new Error('OIDC_KEY_NOT_FOUND');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid)throw new Error('OIDC_SIGNATURE_INVALID');
  const epoch=Math.floor(Date.now()/1000);
  if(payload.iss!==OIDC_ISSUER||payload.aud!==OIDC_AUDIENCE||Number(payload.exp||0)<epoch||Number(payload.nbf||0)>epoch+30)throw new Error('OIDC_CLAIMS_INVALID');
  if(payload.repository!==TRUSTED_REPOSITORY||payload.workflow_ref!==TRUSTED_WORKFLOW||payload.runner_environment!=='github-hosted')throw new Error('OIDC_RUNNER_NOT_TRUSTED');
  return payload;
}
function bearer(req){const m=String(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function runnerAuth(req){try{return await verifyRunnerJwt(bearer(req));}catch{return null;}}
async function appAuthed(core,req,env,ctx){
  const response=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await response.json()).authenticated;}catch{return false;}
}
function parse(value,fallback={}){try{return JSON.parse(value||'')}catch{return fallback}}
function publicJob(row){if(!row)return null;return {id:row.id,adapter_id:row.adapter_id,repo:row.repo,commit:row.commit_sha||null,input:parse(row.input_json,{}),status:row.status,result:parse(row.result_json,null),error:row.error,claimed_by:row.claimed_by,created_at:row.created_at,claimed_at:row.claimed_at,finished_at:row.finished_at,updated_at:row.updated_at};}
function validRepo(repo){return CURATED_REPOS.has(String(repo||'').toLowerCase());}

export function createCloudCapabilityExecution(core){
  if(!core?.fetch)throw new Error('CLOUD_CAPABILITY_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url),path=url.pathname,method=req.method;
      if(path==='/api/tools/cloud/adapters'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        return jsonResponse({adapters:Object.entries(ALLOWED_ADAPTERS).map(([id,meta])=>({id,...meta})),curated_repositories:CURATED_REPOS.size});
      }
      if(path==='/api/tools/cloud/jobs'&&method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const body=await readJson(req),adapterId=String(body.adapter_id||''),repo=String(body.repo||'');
        if(!ALLOWED_ADAPTERS[adapterId])return jsonResponse({error:'ADAPTER_NOT_ALLOWED'},400);
        if(!validRepo(repo))return jsonResponse({error:'REPOSITORY_NOT_CURATED'},400);
        const commit=/^[0-9a-f]{40}$/i.test(String(body.commit||''))?String(body.commit):null;
        const ts=now(),id=uid();
        await execute(env,'INSERT INTO cloud_tool_jobs(id,adapter_id,repo,commit_sha,input_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',id,adapterId,repo,commit,JSON.stringify(body.input||{}),'queued',ts,ts);
        return jsonResponse({job:publicJob(await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',id))},201);
      }
      if(path==='/api/tools/cloud/jobs'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const rows=await queryAll(env,'SELECT * FROM cloud_tool_jobs ORDER BY created_at DESC LIMIT 100');return jsonResponse({jobs:rows.map(publicJob)});
      }
      if(path==='/api/tools/cloud/runner/claim'&&method==='POST'){
        const claims=await runnerAuth(req);if(!claims)return jsonResponse({error:'RUNNER_AUTH_REQUIRED'},401);
        const row=await queryOne(env,"SELECT * FROM cloud_tool_jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 1");
        if(!row)return jsonResponse({job:null});
        const ts=now(),claimedBy=`github:${claims.run_id||'unknown'}`;
        await execute(env,"UPDATE cloud_tool_jobs SET status='running',claimed_by=?,claimed_at=?,updated_at=? WHERE id=? AND status='queued'",claimedBy,ts,ts,row.id);
        return jsonResponse({job:publicJob(await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',row.id))});
      }
      const resultMatch=path.match(/^\/api\/tools\/cloud\/runner\/jobs\/([^/]+)\/result$/);
      if(resultMatch&&method==='POST'){
        const claims=await runnerAuth(req);if(!claims)return jsonResponse({error:'RUNNER_AUTH_REQUIRED'},401);
        const id=decodeURIComponent(resultMatch[1]),body=await readJson(req),ts=now(),ok=body.ok===true;
        const row=await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',id);if(!row)return jsonResponse({error:'JOB_NOT_FOUND'},404);
        await execute(env,'UPDATE cloud_tool_jobs SET status=?,result_json=?,error=?,finished_at=?,updated_at=? WHERE id=?',ok?'completed':'failed',JSON.stringify(body.result??null),ok?null:String(body.error||'CLOUD_TOOL_FAILED'),ts,ts,id);
        return jsonResponse({ok:true,job:publicJob(await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',id))});
      }
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}

export { ALLOWED_ADAPTERS as CLOUD_TOOL_ADAPTERS, verifyRunnerJwt };
