// Bounded, read-only Cloudflare Agent Hub workflow.
export const HUB_ADAPTERS=['repo-inspect','source-search','source-read','skill-analyze'];
export function validateHubSteps(steps,curated){
  if(!Array.isArray(steps)||!steps.length||steps.length>8)throw Error('STEPS_MUST_BE_1_TO_8');
  return steps.map((s,i)=>{
    const adapter_id=String(s?.adapter_id||''),repo=String(s?.repo||'').trim();
    if(!HUB_ADAPTERS.includes(adapter_id))throw Error('ADAPTER_NOT_ALLOWED_'+i);
    if(!curated.has(repo.toLowerCase()))throw Error('REPOSITORY_NOT_CURATED_'+i);
    const input=s.input&&typeof s.input==='object'&&!Array.isArray(s.input)?s.input:{};
    if(JSON.stringify(input).length>6000||Object.hasOwn(input,'__agent_hub'))throw Error('INVALID_INPUT_'+i);
    return {adapter_id,repo,input};
  });
}
export function nextHubStep(meta,ok){
  if(!meta||!Array.isArray(meta.steps))return null;
  const position=Number(meta.position);
  if(!Number.isInteger(position)||position<0||position>=meta.steps.length)return null;
  if(!ok)return Number(meta.attempts||0)<1?{...meta.steps[position],meta:{...meta,attempts:1}}:null;
  return position+1<meta.steps.length?{...meta.steps[position+1],meta:{...meta,position:position+1,attempts:0}}:null;
}
