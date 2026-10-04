import { jsonResponse, queryAll, queryOne } from '../../lib/runtime.js';
import { CURATED_CAPABILITY_SEEDS } from '../../lib/open-source-capabilities.js';
import { OBD_PDF_SEEDS } from '../../lib/obd-pdf-seeds.js';
import { resolveNativeSkillAdapter } from '../../lib/native-skill-adapters.js';
import { queueSkillLearningBatch, summarizeExecutionStates, verifyRunnerJwt } from './cloud-execution.js';

const CURATED_REPOS=new Set([...CURATED_CAPABILITY_SEEDS,...OBD_PDF_SEEDS].map(item=>String(item.repo||'').toLowerCase()).filter(Boolean));

function bearer(req){
  const match=String(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);
  return match?match[1].trim():'';
}

function parse(value,fallback=[]){try{return JSON.parse(value||'')}catch{return fallback}}

function summarySkill(row){
  const skill={
    repo:row.repo,
    status:row.status,
    adapter_status:row.adapter_status,
    requires_paid_api:!!row.requires_paid_api,
    execution_lane:row.execution_lane,
    capabilities:parse(row.capabilities_json,[])
  };
  const nativeAdapter=resolveNativeSkillAdapter(skill);
  return nativeAdapter?{...skill,adapter_status:'ready',native_adapter:nativeAdapter}:skill;
}

async function runnerExecutionSummary(env){
  const rows=await queryAll(env,'SELECT * FROM repo_skills ORDER BY updated_at DESC LIMIT 1000');
  const cutoff=Date.now()-7*24*60*60*1000;
  const recent=await queryOne(env,"SELECT COUNT(*) AS count FROM cloud_tool_jobs WHERE status='completed' AND finished_at>=?",cutoff);
  return summarizeExecutionStates(rows.map(summarySkill),CURATED_REPOS.size,Number(recent?.count||0));
}

export function createSkillSeeding(core){
  if(!core?.fetch)throw new Error('SKILL_SEEDING_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url);
      if(url.pathname==='/api/tools/cloud/runner/seed-learning'&&req.method==='POST'){
        let claims=null;
        try{claims=await verifyRunnerJwt(bearer(req));}catch{}
        if(!claims)return jsonResponse({error:'RUNNER_AUTH_REQUIRED'},401);
        let requested=6;
        try{requested=Number((await req.clone().json())?.limit||6);}catch{}
        const limit=Math.max(1,Math.min(8,Number.isFinite(requested)?requested:6));
        const jobs=await queueSkillLearningBatch(env,limit);
        return jsonResponse({queued:jobs.length,jobs,limit,run_id:claims.run_id||null});
      }
      if(url.pathname==='/api/tools/skills/execution-summary'&&req.method==='GET'){
        let claims=null;
        try{claims=await verifyRunnerJwt(bearer(req));}catch{}
        if(claims)return jsonResponse(await runnerExecutionSummary(env));
      }
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
