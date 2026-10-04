function compact(value=''){return String(value??'').trim();}

function requireRegistry(registry){
  if(!registry||typeof registry!=='object'||Array.isArray(registry))throw new TypeError('registry must be an object');
  for(const key of ['implementations','verification_runs','execution_health'])if(!Array.isArray(registry[key]))throw new TypeError(`${key} must be an array`);
  return registry;
}

function findImplementation(registry,id){
  const value=compact(id);
  const implementation=registry.implementations.find(item=>compact(item?.id)===value);
  if(!implementation)throw new TypeError(`implementation not found: ${value}`);
  return implementation;
}

function nextId(prefix,registry,implementationId){
  const collection=prefix==='verification'?registry.verification_runs:registry.execution_health;
  return `${prefix}:${implementationId}:${collection.length+1}`;
}

export function currentVerificationFor(registry,implementationId){
  requireRegistry(registry);
  const implementation=findImplementation(registry,implementationId);
  const runId=compact(implementation.verification_run_id);
  if(!runId)return null;
  const run=registry.verification_runs.find(item=>compact(item?.id)===runId);
  if(!run||run.current===false||run.result!=='pass')return null;
  if(compact(run.implementation_id)!==compact(implementation.id))return null;
  if(compact(run.source_revision_id)!==compact(implementation.source_revision_id))return null;
  return run;
}

export function currentHealthFor(registry,implementationId){
  requireRegistry(registry);
  const id=compact(implementationId);
  findImplementation(registry,id);
  return registry.execution_health.find(item=>compact(item?.implementation_id)===id&&item.current!==false)||null;
}

export function recordExecutionHealth(registry,input={}){
  requireRegistry(registry);
  const implementation=findImplementation(registry,input.implementation_id??input.implementationId);
  const state=compact(input.state||'healthy').toLowerCase();
  if(!['healthy','degraded','unavailable'].includes(state))throw new TypeError(`invalid health state: ${state}`);
  for(const item of registry.execution_health){
    if(compact(item?.implementation_id)===implementation.id&&item.current!==false)item.current=false;
  }
  const health={
    id:compact(input.id)||nextId('health',registry,implementation.id),
    implementation_id:implementation.id,
    source_revision_id:implementation.source_revision_id,
    state,
    reason:compact(input.reason)||null,
    reliability:Number.isFinite(Number(input.reliability))?Math.max(0,Math.min(1,Number(input.reliability))):null,
    latency_ms:Number.isFinite(Number(input.latency_ms??input.latencyMs))?Math.max(0,Number(input.latency_ms??input.latencyMs)):null,
    checked_at:input.checked_at??input.checkedAt??null,
    current:true
  };
  registry.execution_health.push(health);
  if(state!=='healthy'&&['verified','executable'].includes(implementation.state))implementation.state='degraded';
  if(state==='healthy'&&implementation.state==='degraded'&&currentVerificationFor(registry,implementation.id))implementation.state='verified';
  return health;
}

export function recordVerificationRun(registry,input={}){
  requireRegistry(registry);
  const implementation=findImplementation(registry,input.implementation_id??input.implementationId);
  const sourceRevisionId=compact(input.source_revision_id??input.sourceRevisionId??implementation.source_revision_id);
  if(sourceRevisionId!==compact(implementation.source_revision_id))throw new Error('VERIFICATION_REVISION_MISMATCH');
  const result=compact(input.result||'').toLowerCase();
  if(!['pass','fail'].includes(result))throw new TypeError('verification result must be pass or fail');
  for(const run of registry.verification_runs){
    if(compact(run?.implementation_id)===implementation.id&&run.current!==false)run.current=false;
  }
  const run={
    id:compact(input.id)||nextId('verification',registry,implementation.id),
    implementation_id:implementation.id,
    source_revision_id:sourceRevisionId,
    result,
    acceptance_contract:compact(input.acceptance_contract??input.acceptanceContract)||null,
    exit_status:input.exit_status??input.exitStatus??null,
    duration_ms:Number.isFinite(Number(input.duration_ms??input.durationMs))?Math.max(0,Number(input.duration_ms??input.durationMs)):null,
    output_digest:compact(input.output_digest??input.outputDigest)||null,
    evidence:input.evidence&&typeof input.evidence==='object'?JSON.parse(JSON.stringify(input.evidence)):{},
    verified_at:input.verified_at??input.verifiedAt??null,
    current:result==='pass'
  };
  registry.verification_runs.push(run);
  if(result==='pass'){
    implementation.state='verified';
    implementation.verification_run_id=run.id;
    recordExecutionHealth(registry,{implementation_id:implementation.id,state:'healthy',reason:'verification_passed',reliability:input.reliability,latency_ms:input.latency_ms??input.latencyMs,checked_at:run.verified_at});
  }else{
    implementation.verification_run_id=null;
    if(['verified','executable','adapter_ready'].includes(implementation.state))implementation.state='degraded';
    recordExecutionHealth(registry,{implementation_id:implementation.id,state:'degraded',reason:compact(input.reason)||'verification_failed',reliability:input.reliability,latency_ms:input.latency_ms??input.latencyMs,checked_at:run.verified_at});
  }
  return run;
}
