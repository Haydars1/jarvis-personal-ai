// Pure reporting logic shared by Workflow runtime and deterministic unit tests.
export const HUB_WORKFLOW_LIMITS = Object.freeze({ maxChecks: 12, interval: '5 minutes', maxAiCharacters: 9000 });
const safeJson=(input)=>{try{return JSON.parse(input||'null')??{};}catch{return {};}};
const redact=text=>String(text||'').replace(/(ghp_|github_pat_|sk-[a-zA-Z0-9_-]+)[a-zA-Z0-9_-]{8,}/g,'[REDACTED]');
export function hubWorkflowProgress(rows=[], workflowId, stepCount=3) {
  const matching=(rows||[]).map(row=>({ ...row, hub:safeJson(row.input_json).__agent_hub }))
    .filter(row=>row.hub?.workflow_id===workflowId)
    .sort((a,b)=>Number(a.hub.position||0)-Number(b.hub.position||0)||Number(a.hub.attempts||0)-Number(b.hub.attempts||0)||Number(a.created_at||0)-Number(b.created_at||0));
  const latest=matching.at(-1);
  if(!latest)return {status:'queued',finished:false,steps:0};
  const failed=latest.status==='failed' && Number(latest.hub.attempts||0)>=1;
  const completed=latest.status==='completed' && Number(latest.hub.position)===stepCount-1;
  return {
    status:completed?'completed':failed?'failed':'running',
    finished:completed||failed,
    steps:matching.length,
    current_step:Number(latest.hub.position)+1
  };
}
export function deterministicHubReport(rows=[],workflowId,stepCount=3){
  const matches=(rows||[]).filter(row=>safeJson(row.input_json).__agent_hub?.workflow_id===workflowId);
  const progress=hubWorkflowProgress(matches,workflowId,stepCount);
  const audits=matches.filter(row=>row.adapter_id==='source-audit'&&row.status==='completed')
    .flatMap(row=>Array.isArray(safeJson(row.result_json).findings)?safeJson(row.result_json).findings:[])
    .slice(0,80).map(f=>({file:String(f.file||'').slice(0,220),line:Number(f.line||0),rule:String(f.rule||'').slice(0,80),message:String(f.message||'').slice(0,220),severity:String(f.severity||'low')}));
  return {
    ...progress,
    audit_findings:audits,
    jobs:matches.slice(-16).map(row=>({
      adapter:row.adapter_id,repo:row.repo,status:row.status,
      result:redact(JSON.stringify(safeJson(row.result_json))?.slice(0,1200)||''),
      error:redact(row.error).slice(0,250)
    }))
  };
}
