export const CAPABILITY_SOURCE_STATES=Object.freeze([
  'candidate',
  'resolved',
  'learned',
  'security_scanned',
  'security_approved',
  'reference_only',
  'blocked'
]);

export const CAPABILITY_IMPLEMENTATION_STATES=Object.freeze([
  'candidate',
  'learned',
  'adapter_ready',
  'executable',
  'verified',
  'degraded',
  'blocked'
]);

const COLLECTIONS=Object.freeze([
  'sources',
  'source_revisions',
  'capabilities',
  'implementations',
  'adapter_manifests',
  'security_findings',
  'verification_runs',
  'execution_health',
  'learning_evidence',
  'development_candidates'
]);

const ALL_STATES=new Set([...CAPABILITY_SOURCE_STATES,...CAPABILITY_IMPLEMENTATION_STATES]);

export function normalizeCapabilityState(state=''){
  const normalized=String(state||'').trim().toLowerCase();
  return ALL_STATES.has(normalized)?normalized:null;
}

export function createCapabilityRegistryV2(){
  return {
    schemaVersion:2,
    sources:[],
    source_revisions:[],
    capabilities:[],
    implementations:[],
    adapter_manifests:[],
    security_findings:[],
    verification_runs:[],
    execution_health:[],
    learning_evidence:[],
    development_candidates:[]
  };
}

function validateState(errors,item,allowed,label,index){
  if(item?.state===undefined||item?.state===null||item?.state==='')return;
  const state=String(item.state).trim().toLowerCase();
  if(!allowed.includes(state))errors.push(`${label}[${index}] invalid lifecycle state: ${String(item.state)}`);
}

export function validateCapabilityRegistryV2(registry={}){
  const errors=[];
  if(!registry||typeof registry!=='object'||Array.isArray(registry))return {ok:false,errors:['registry must be an object']};
  if(registry.schemaVersion!==2)errors.push('schemaVersion must be 2');

  for(const key of COLLECTIONS){
    if(!Array.isArray(registry[key]))errors.push(`${key} must be an array`);
  }

  if(Array.isArray(registry.sources))registry.sources.forEach((item,index)=>validateState(errors,item,CAPABILITY_SOURCE_STATES,'sources',index));
  if(Array.isArray(registry.source_revisions))registry.source_revisions.forEach((item,index)=>validateState(errors,item,CAPABILITY_SOURCE_STATES,'source_revisions',index));

  const verificationIds=new Set((Array.isArray(registry.verification_runs)?registry.verification_runs:[]).map(run=>String(run?.id||'')).filter(Boolean));
  if(Array.isArray(registry.implementations)){
    registry.implementations.forEach((item,index)=>{
      validateState(errors,item,CAPABILITY_IMPLEMENTATION_STATES,'implementations',index);
      const state=String(item?.state||'').trim().toLowerCase();
      if(state==='verified'){
        const runId=String(item?.verification_run_id||'').trim();
        if(!runId)errors.push(`implementations[${index}] verified state requires verification evidence`);
        else if(!verificationIds.has(runId))errors.push(`implementations[${index}] verification evidence not found: ${runId}`);
      }
    });
  }

  return {ok:errors.length===0,errors};
}
