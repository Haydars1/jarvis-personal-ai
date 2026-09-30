import { jsonResponse } from '../../lib/runtime.js';
import { queueSkillLearningBatch, verifyRunnerJwt } from './cloud-execution.js';

function bearer(req){
  const match=String(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);
  return match?match[1].trim():'';
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
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
