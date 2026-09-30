import { execute, jsonResponse, queryAll, queryOne, readJson } from '../../lib/runtime.js';
import { CURATED_CAPABILITY_SEEDS } from '../../lib/open-source-capabilities.js';
import { OBD_PDF_SEEDS } from '../../lib/obd-pdf-seeds.js';
import { classifyCapability } from '../../lib/capability-policy.js';
import { skillMatchesTask } from '../../lib/repo-skill-compiler.js';
import { selectSkillLearningRepos } from '../../lib/skill-learning.js';
import { resolveNativeSkillAdapter } from '../../lib/native-skill-adapters.js';

const now=()=>Date.now();
const uid=()=>crypto.randomUUID();
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_AUDIENCE='jarvis-cloud-tool-runner';
const SKILL_BUILDER_AUDIENCE='jarvis-skill-builder';
const TRUSTED_REPOSITORY='Haydars1/jarvis-personal-ai';
const TRUSTED_WORKFLOW='Haydars1/jarvis-personal-ai/.github/workflows/cloud-tool-runner.yml@refs/heads/main';
const SKILL_BUILDER_WORKFLOWS=Object.freeze([
  'Haydars1/jarvis-personal-ai/.github/workflows/jarvis-codex-agent.yml@refs/heads/main',
  'Haydars1/jarvis-personal-ai/.github/workflows/jarvis-codex-agent.yml@refs/heads/test/autonomy-runtime'
]);
const ALLOWED_ADAPTERS=Object.freeze({
  'repo-inspect':{label:'Repository inspect',mode:'read-only'},
  'source-search':{label:'Source search',mode:'read-only'},
  'source-read':{label:'Source file read',mode:'read-only'},
  'skill-analyze':{label:'Learn repository skill',mode:'read-only'}
});
const CURATED_REPOS=new Set([...CURATED_CAPABILITY_SEEDS,...OBD_PDF_SEEDS].map(item=>String(item.repo||'').toLowerCase()).filter(Boolean));
const CURATED_REPO_LIST=[...CURATED_REPOS].sort((a,b)=>a.localeCompare(b));
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
async function verifyGithubOidc(token,audience,workflowRefs){
  const parts=String(token||'').split('.');if(parts.length!==3)throw new Error('OIDC_TOKEN_INVALID');
  const header=decodeJson(parts[0]),payload=decodeJson(parts[1]);
  const jwks=await oidcJwks(),jwk=(jwks.keys||[]).find(key=>key.kid===header.kid);
  if(!jwk)throw new Error('OIDC_KEY_NOT_FOUND');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid)throw new Error('OIDC_SIGNATURE_INVALID');
  const epoch=Math.floor(Date.now()/1000);
  if(payload.iss!==OIDC_ISSUER||payload.aud!==audience||Number(payload.exp||0)<epoch||Number(payload.nbf||0)>epoch+30)throw new Error('OIDC_CLAIMS_INVALID');
  const allowedWorkflowRefs=Array.isArray(workflowRefs)?workflowRefs:[workflowRefs];
  if(payload.repository!==TRUSTED_REPOSITORY||!allowedWorkflowRefs.includes(payload.workflow_ref)||payload.runner_environment!=='github-hosted')throw new Error('OIDC_RUNNER_NOT_TRUSTED');
  return payload;
}
async function verifyRunnerJwt(token){return verifyGithubOidc(token,OIDC_AUDIENCE,TRUSTED_WORKFLOW);}
async function verifySkillBuilderJwt(token){return verifyGithubOidc(token,SKILL_BUILDER_AUDIENCE,SKILL_BUILDER_WORKFLOWS);}
function bearer(req){const m=String(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function runnerAuth(req){try{return await verifyRunnerJwt(bearer(req));}catch{return null;}}
async function skillBuilderAuth(req){try{return await verifySkillBuilderJwt(bearer(req));}catch{return null;}}
async function appAuthed(core,req,env,ctx){
  const response=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await response.json()).authenticated;}catch{return false;}
}
function parse(value,fallback={}){try{return JSON.parse(value||'')}catch{return fallback}}
function publicJob(row){if(!row)return null;return {id:row.id,adapter_id:row.adapter_id,repo:row.repo,commit:row.commit_sha||null,input:parse(row.input_json,{}),status:row.status,result:parse(row.result_json,null),error:row.error,claimed_by:row.claimed_by,created_at:row.created_at,claimed_at:row.claimed_at,finished_at:row.finished_at,updated_at:row.updated_at};}
function publicSkill(row){
  if(!row)return null;
  const skill={
    id:row.id,repo:row.repo,source_commit:row.source_commit||null,
    primary_capability:row.primary_capability,
    capabilities:parse(row.capabilities_json,[]),execution_lane:row.execution_lane,
    risk:row.risk,status:row.status,verification:row.verification,
    adapter_status:row.adapter_status,requires_paid_api:!!row.requires_paid_api,
    manifest:parse(row.manifest_json,{}),learned_at:row.learned_at,last_verified_at:row.last_verified_at,updated_at:row.updated_at
  };
  const nativeAdapter=resolveNativeSkillAdapter(skill);
  return nativeAdapter?{...skill,adapter_status:'ready',native_adapter:nativeAdapter}:skill;
}
function validRepo(repo){return CURATED_REPOS.has(String(repo||'').toLowerCase());}
async function queueCloudJob(env,{adapterId,repo,commit=null,input={}}){
  const ts=now(),id=uid();
  await execute(env,'INSERT INTO cloud_tool_jobs(id,adapter_id,repo,commit_sha,input_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',id,adapterId,repo,commit,JSON.stringify(input||{}),'queued',ts,ts);
  return publicJob(await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',id));
}
async function queueSkillLearningBatch(env,limit=8){
  const learnedRows=await queryAll(env,'SELECT repo FROM repo_skills');
  const pendingRows=await queryAll(env,"SELECT repo FROM cloud_tool_jobs WHERE adapter_id='skill-analyze' AND status IN ('queued','running')");
  const learned=new Set(learnedRows.map(row=>String(row.repo||'').toLowerCase()));
  const pending=new Set(pendingRows.map(row=>String(row.repo||'').toLowerCase()));
  const selected=selectSkillLearningRepos(CURATED_REPO_LIST,learned,pending,limit);
  const jobs=[];
  for(const repo of selected)jobs.push(await queueCloudJob(env,{adapterId:'skill-analyze',repo,input:{source:'automatic-skill-learning'}}));
  return jobs;
}
async function upsertRepositorySkill(env,skill,ts=now()){
  const repo=String(skill?.repo||'').trim();if(!validRepo(repo))throw new Error('REPOSITORY_NOT_CURATED');
  const capabilities=Array.isArray(skill.capabilities)?skill.capabilities.map(String).filter(Boolean):[];
  const nativeAdapter=resolveNativeSkillAdapter({...skill,capabilities});
  const adapterStatus=nativeAdapter?'ready':String(skill.adapter_status||'unverified');
  const id=String(skill.id||`repo:${repo.toLowerCase()}`);
  const learnedAt=Number(skill.learned_at||ts);
  const manifest={...skill,capabilities,adapter_status:adapterStatus,native_adapter:nativeAdapter||null};
  await execute(env,`INSERT INTO repo_skills(id,repo,source_commit,primary_capability,capabilities_json,execution_lane,risk,status,verification,adapter_status,requires_paid_api,manifest_json,learned_at,last_verified_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(repo) DO UPDATE SET id=excluded.id,source_commit=excluded.source_commit,primary_capability=excluded.primary_capability,capabilities_json=excluded.capabilities_json,execution_lane=excluded.execution_lane,risk=excluded.risk,status=excluded.status,verification=excluded.verification,adapter_status=excluded.adapter_status,requires_paid_api=excluded.requires_paid_api,manifest_json=excluded.manifest_json,last_verified_at=excluded.last_verified_at,updated_at=excluded.updated_at`,
    id,repo,skill.source_commit||null,String(skill.primary_capability||capabilities[0]||'repository-knowledge'),JSON.stringify(capabilities),String(nativeAdapter?.lane||skill.execution_lane||'cloud-runner'),String(skill.risk||nativeAdapter?.risk||'low'),String(skill.status||'learned'),String(skill.verification||'repository-inspection'),adapterStatus,skill.requires_paid_api?1:0,JSON.stringify(manifest),learnedAt,ts,ts);
  return publicSkill(await queryOne(env,'SELECT * FROM repo_skills WHERE repo=?',repo));
}
async function discoverSkills(env,query=''){
  const kind=classifyCapability(query),rows=await queryAll(env,"SELECT * FROM repo_skills WHERE status IN ('learned','ready') ORDER BY updated_at DESC LIMIT 300");
  const q=String(query||'').toLowerCase();
  return rows.map(publicSkill).map(skill=>{
    let score=skillMatchesTask(skill,kind);
    const haystack=[skill.repo,skill.primary_capability,...skill.capabilities].join(' ').toLowerCase();
    if(q&&haystack.includes(q))score+=35;
    if(skill.adapter_status==='ready')score+=20;
    return {...skill,kind,score};
  }).filter(skill=>skill.score>0).sort((a,b)=>b.score-a.score||String(a.repo).localeCompare(String(b.repo))).slice(0,30);
}
async function nativeSkillBacklog(env,limit=12){
  const rows=await queryAll(env,"SELECT * FROM repo_skills WHERE adapter_status='unverified' AND status IN ('learned','ready') ORDER BY CASE risk WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, updated_at ASC LIMIT 100");
  return rows.map(publicSkill).filter(skill=>skill.adapter_status!=='ready').slice(0,Math.max(1,Math.min(25,Number(limit)||12)));
}

export function createCloudCapabilityExecution(core){
  if(!core?.fetch)throw new Error('CLOUD_CAPABILITY_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url),path=url.pathname,method=req.method;
      if(path==='/api/tools/cloud/adapters'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        return jsonResponse({adapters:Object.entries(ALLOWED_ADAPTERS).map(([id,meta])=>({id,...meta})),curated_repositories:CURATED_REPOS.size});
      }
      if(path==='/api/tools/skills/runner/backlog'&&method==='GET'){
        const claims=await skillBuilderAuth(req);if(!claims)return jsonResponse({error:'SKILL_BUILDER_AUTH_REQUIRED'},401);
        const limit=Number(url.searchParams.get('limit')||12);
        return jsonResponse({skills:await nativeSkillBacklog(env,limit),run_id:claims.run_id||null,source:'repo_skills'});
      }
      if(path==='/api/tools/skills/compile'&&method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const body=await readJson(req),repo=String(body.repo||'');
        if(!validRepo(repo))return jsonResponse({error:'REPOSITORY_NOT_CURATED'},400);
        const commit=/^[0-9a-f]{40}$/i.test(String(body.commit||''))?String(body.commit):null;
        const job=await queueCloudJob(env,{adapterId:'skill-analyze',repo,commit,input:{source:'skill-compiler'}});
        return jsonResponse({job},202);
      }
      if(path==='/api/tools/skills'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const repo=String(url.searchParams.get('repo')||'').trim();
        const rows=repo?await queryAll(env,'SELECT * FROM repo_skills WHERE repo=? ORDER BY updated_at DESC LIMIT 20',repo):await queryAll(env,'SELECT * FROM repo_skills ORDER BY updated_at DESC LIMIT 300');
        return jsonResponse({skills:rows.map(publicSkill)});
      }
      if(path==='/api/tools/discover'&&method==='GET'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const capability=String(url.searchParams.get('capability')||'');
        return jsonResponse({results:await discoverSkills(env,capability),source:'repo-skills'});
      }
      if(path==='/api/tools/cloud/jobs'&&method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        const body=await readJson(req),adapterId=String(body.adapter_id||''),repo=String(body.repo||'');
        if(!ALLOWED_ADAPTERS[adapterId])return jsonResponse({error:'ADAPTER_NOT_ALLOWED'},400);
        if(!validRepo(repo))return jsonResponse({error:'REPOSITORY_NOT_CURATED'},400);
        const commit=/^[0-9a-f]{40}$/i.test(String(body.commit||''))?String(body.commit):null;
        return jsonResponse({job:await queueCloudJob(env,{adapterId,repo,commit,input:body.input||{}})},201);
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
        let persistedSkill=null;
        if(ok&&row.adapter_id==='skill-analyze')persistedSkill=await upsertRepositorySkill(env,body.result,ts);
        await execute(env,'UPDATE cloud_tool_jobs SET status=?,result_json=?,error=?,finished_at=?,updated_at=? WHERE id=?',ok?'completed':'failed',JSON.stringify(body.result??null),ok?null:String(body.error||'CLOUD_TOOL_FAILED'),ts,ts,id);
        return jsonResponse({ok:true,skill:persistedSkill,job:publicJob(await queryOne(env,'SELECT * FROM cloud_tool_jobs WHERE id=?',id))});
      }
      return core.fetch(req,env,ctx);
    },
    async scheduled(event,env,ctx){
      await core.scheduled?.(event,env,ctx);
      await queueSkillLearningBatch(env,8).catch(()=>[]);
    }
  };
}

export { ALLOWED_ADAPTERS as CLOUD_TOOL_ADAPTERS, verifyRunnerJwt, verifySkillBuilderJwt, upsertRepositorySkill, discoverSkills, queueSkillLearningBatch, nativeSkillBacklog };
