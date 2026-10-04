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

function cloneJson(value){
  if(value===undefined)return undefined;
  return JSON.parse(JSON.stringify(value));
}

function compactString(value=''){
  return String(value??'').trim();
}

function normalizeRepoId(repo=''){
  return compactString(repo).toLowerCase();
}

function normalizeRevision(entry={}){
  const value=entry?.commit??entry?.commitSha??entry?.sha??entry?.revision??entry?.release??entry?.tag??'legacy';
  return compactString(value).toLowerCase()||'legacy';
}

function normalizeCapabilityId(value=''){
  return compactString(value).toLowerCase();
}

function normalizeSourceState(value,fallback='resolved'){
  const normalized=normalizeCapabilityState(value);
  return CAPABILITY_SOURCE_STATES.includes(normalized)?normalized:fallback;
}

function normalizeImplementationState(value,fallback='candidate'){
  const normalized=normalizeCapabilityState(value);
  return CAPABILITY_IMPLEMENTATION_STATES.includes(normalized)?normalized:fallback;
}

function sourceId(repo){return `source:${repo}`;}
function revisionId(repo,revision){return `revision:${repo}@${revision}`;}
function implementationId(repo,revision,capability){return `impl:${repo}@${revision}:${capability}`;}

function requireRegistry(registry){
  if(!registry||typeof registry!=='object'||Array.isArray(registry))throw new TypeError('registry must be an object');
  for(const key of COLLECTIONS){
    if(!Array.isArray(registry[key]))throw new TypeError(`${key} must be an array`);
  }
  return registry;
}

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

  const sourceIds=new Set((Array.isArray(registry.sources)?registry.sources:[]).map(item=>compactString(item?.id)).filter(Boolean));
  const revisionIds=new Set((Array.isArray(registry.source_revisions)?registry.source_revisions:[]).map(item=>compactString(item?.id)).filter(Boolean));
  const capabilityIds=new Set((Array.isArray(registry.capabilities)?registry.capabilities:[]).map(item=>compactString(item?.id)).filter(Boolean));
  const verificationById=new Map((Array.isArray(registry.verification_runs)?registry.verification_runs:[]).map(run=>[compactString(run?.id),run]).filter(([id])=>Boolean(id)));

  if(Array.isArray(registry.source_revisions)){
    registry.source_revisions.forEach((item,index)=>{
      if(item?.source_id&&!sourceIds.has(compactString(item.source_id)))errors.push(`source_revisions[${index}] source not found: ${item.source_id}`);
    });
  }

  if(Array.isArray(registry.implementations)){
    registry.implementations.forEach((item,index)=>{
      validateState(errors,item,CAPABILITY_IMPLEMENTATION_STATES,'implementations',index);
      if(item?.source_revision_id&&!revisionIds.has(compactString(item.source_revision_id)))errors.push(`implementations[${index}] source revision not found: ${item.source_revision_id}`);
      if(item?.capability_id&&!capabilityIds.has(compactString(item.capability_id)))errors.push(`implementations[${index}] capability not found: ${item.capability_id}`);
      const state=String(item?.state||'').trim().toLowerCase();
      if(state==='verified'){
        const runId=compactString(item?.verification_run_id);
        const run=verificationById.get(runId);
        if(!runId)errors.push(`implementations[${index}] verified state requires verification evidence`);
        else if(!run)errors.push(`implementations[${index}] verification evidence not found: ${runId}`);
        else {
          if(run.current===false)errors.push(`implementations[${index}] verification evidence is not current: ${runId}`);
          if(run.implementation_id&&compactString(run.implementation_id)!==compactString(item.id))errors.push(`implementations[${index}] verification evidence belongs to another implementation: ${runId}`);
          if(run.source_revision_id&&compactString(run.source_revision_id)!==compactString(item.source_revision_id))errors.push(`implementations[${index}] verification evidence belongs to another source revision: ${runId}`);
        }
      }
    });
  }

  return {ok:errors.length===0,errors};
}

function legacyCategories(entry={}){
  const values=[...(Array.isArray(entry?.categories)?entry.categories:[]),entry?.category];
  return [...new Set(values.map(normalizeCapabilityId).filter(Boolean))].sort();
}

function legacySourceMetadata(entry={}){
  const metadata={};
  for(const key of ['source','catalogSource','guidePage','score','status','autoExecute','restriction','executionTarget']){
    if(entry?.[key]!==undefined&&entry?.[key]!==null)metadata[key]=cloneJson(entry[key]);
  }
  if(Array.isArray(entry?.executionTargets))metadata.executionTargets=cloneJson(entry.executionTargets);
  return metadata;
}

export function migrateLegacyRegistryV1(legacy={},options={}){
  const registry=createCapabilityRegistryV2();
  if(!legacy||typeof legacy!=='object'||Array.isArray(legacy)||legacy.schemaVersion!==1||!Array.isArray(legacy.entries))return registry;

  const sourceByRepo=new Map();
  const revisionByKey=new Map();
  const capabilityById=new Map();
  const implementationByKey=new Map();
  const migratedAt=compactString(options?.migratedAt||legacy.generatedAt||'')||null;

  for(const entry of legacy.entries){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;
    const repo=normalizeRepoId(entry.repo);
    if(!repo||!repo.includes('/'))continue;

    let source=sourceByRepo.get(repo);
    if(!source){
      source={
        id:sourceId(repo),
        repo,
        state:'resolved',
        provenance:[],
        legacy_metadata:{}
      };
      sourceByRepo.set(repo,source);
      registry.sources.push(source);
    }

    const metadata=legacySourceMetadata(entry);
    if(Object.keys(metadata).length){
      source.provenance.push(metadata);
      source.legacy_metadata={...source.legacy_metadata,...metadata};
    }

    const revision=normalizeRevision(entry);
    const revKey=`${repo}@${revision}`;
    let sourceRevision=revisionByKey.get(revKey);
    if(!sourceRevision){
      sourceRevision={
        id:revisionId(repo,revision),
        source_id:source.id,
        revision,
        state:'learned',
        observed_at:migratedAt,
        provenance:metadata.source||metadata.catalogSource?cloneJson(metadata):{}
      };
      revisionByKey.set(revKey,sourceRevision);
      registry.source_revisions.push(sourceRevision);
    }

    for(const capabilityId of legacyCategories(entry)){
      if(!capabilityById.has(capabilityId)){
        const capability={id:capabilityId,domain:capabilityId};
        capabilityById.set(capabilityId,capability);
        registry.capabilities.push(capability);
      }
      const implKey=`${revKey}:${capabilityId}`;
      if(!implementationByKey.has(implKey)){
        const implementation={
          id:implementationId(repo,revision,capabilityId),
          source_revision_id:sourceRevision.id,
          capability_id:capabilityId,
          state:'learned',
          legacy_metadata:cloneJson(metadata)
        };
        implementationByKey.set(implKey,implementation);
        registry.implementations.push(implementation);
      }
    }
  }

  registry.sources.sort((a,b)=>a.repo.localeCompare(b.repo));
  registry.source_revisions.sort((a,b)=>a.id.localeCompare(b.id));
  registry.capabilities.sort((a,b)=>a.id.localeCompare(b.id));
  registry.implementations.sort((a,b)=>a.id.localeCompare(b.id));
  return registry;
}

export function readLegacyRegistryCompatibility(raw){
  const empty=createCapabilityRegistryV2();
  if(raw===null||raw===undefined)return {status:'empty',registry:empty,errors:[]};
  if(typeof raw==='string'&&!raw.trim())return {status:'empty',registry:empty,errors:[]};

  let parsed=raw;
  if(typeof raw==='string'){
    try{parsed=JSON.parse(raw);}catch(error){
      return {status:'invalid',registry:empty,errors:[`invalid JSON: ${error instanceof Error?error.message:'parse error'}`]};
    }
  }

  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {status:'invalid',registry:empty,errors:['registry document must be an object']};

  if(parsed.schemaVersion===2){
    const registry=cloneJson(parsed);
    const validation=validateCapabilityRegistryV2(registry);
    return validation.ok
      ? {status:'ok',registry,errors:[]}
      : {status:'invalid',registry:empty,errors:validation.errors};
  }

  if(parsed.schemaVersion!==1||!Array.isArray(parsed.entries)){
    return {status:'invalid',registry:empty,errors:['unsupported or malformed legacy registry']};
  }

  const registry=migrateLegacyRegistryV1(parsed);
  const validation=validateCapabilityRegistryV2(registry);
  return validation.ok
    ? {status:'ok',registry,errors:[]}
    : {status:'invalid',registry:empty,errors:validation.errors};
}

export function upsertSourceRevision(registry,input={}){
  requireRegistry(registry);
  const repo=normalizeRepoId(input.repo??input.repository??input?.source?.repo);
  if(!repo||!repo.includes('/'))throw new TypeError('repository identity must be owner/name');

  let source=registry.sources.find(item=>normalizeRepoId(item?.repo)===repo);
  const sourceMetadata=cloneJson(input.source_metadata??input.sourceMetadata??{});
  if(!source){
    source={id:sourceId(repo),repo,state:normalizeSourceState(input.source_state??input.sourceState,'resolved'),...sourceMetadata};
    registry.sources.push(source);
  }else{
    Object.assign(source,sourceMetadata);
    source.id=sourceId(repo);
    source.repo=repo;
    if(input.source_state!==undefined||input.sourceState!==undefined)source.state=normalizeSourceState(input.source_state??input.sourceState,source.state||'resolved');
  }

  const revision=normalizeRevision(input);
  const id=revisionId(repo,revision);
  let sourceRevision=registry.source_revisions.find(item=>compactString(item?.id)===id);
  const revisionMetadata=cloneJson(input.revision_metadata??input.revisionMetadata??{});
  if(!sourceRevision){
    sourceRevision={
      id,
      source_id:source.id,
      revision,
      state:normalizeSourceState(input.revision_state??input.revisionState,'learned'),
      ...revisionMetadata
    };
    registry.source_revisions.push(sourceRevision);
  }else{
    Object.assign(sourceRevision,revisionMetadata);
    sourceRevision.id=id;
    sourceRevision.source_id=source.id;
    sourceRevision.revision=revision;
    if(input.revision_state!==undefined||input.revisionState!==undefined)sourceRevision.state=normalizeSourceState(input.revision_state??input.revisionState,sourceRevision.state||'learned');
  }

  return {source,revision:sourceRevision};
}

export function upsertCapability(registry,input={}){
  requireRegistry(registry);
  const id=normalizeCapabilityId(input.id??input.capability_id??input.capabilityId);
  if(!id)throw new TypeError('capability id is required');
  let capability=registry.capabilities.find(item=>normalizeCapabilityId(item?.id)===id);
  const metadata=cloneJson(input.metadata??{});
  if(!capability){
    capability={id,domain:compactString(input.domain||id).toLowerCase()||id,...metadata};
    if(input.name)capability.name=compactString(input.name);
    if(input.description)capability.description=compactString(input.description);
    registry.capabilities.push(capability);
  }else{
    Object.assign(capability,metadata);
    capability.id=id;
    if(input.domain)capability.domain=compactString(input.domain).toLowerCase();
    if(input.name)capability.name=compactString(input.name);
    if(input.description)capability.description=compactString(input.description);
  }
  return capability;
}

export function upsertImplementation(registry,input={}){
  requireRegistry(registry);
  let sourceRevision;
  if(input.source_revision_id||input.sourceRevisionId){
    const requested=compactString(input.source_revision_id??input.sourceRevisionId);
    sourceRevision=registry.source_revisions.find(item=>compactString(item?.id)===requested);
    if(!sourceRevision)throw new TypeError(`source revision not found: ${requested}`);
  }else{
    sourceRevision=upsertSourceRevision(registry,input).revision;
  }

  const source=registry.sources.find(item=>compactString(item?.id)===compactString(sourceRevision.source_id));
  if(!source)throw new TypeError(`source not found for revision: ${sourceRevision.id}`);
  const capability=upsertCapability(registry,{
    id:input.capability_id??input.capabilityId??input?.capability?.id,
    domain:input.domain??input?.capability?.domain,
    name:input?.capability?.name,
    description:input?.capability?.description,
    metadata:input?.capability?.metadata
  });

  const id=implementationId(normalizeRepoId(source.repo),normalizeRevision(sourceRevision),capability.id);
  let implementation=registry.implementations.find(item=>compactString(item?.id)===id);
  const metadata=cloneJson(input.metadata??{});
  if(!implementation){
    implementation={
      id,
      source_revision_id:sourceRevision.id,
      capability_id:capability.id,
      state:normalizeImplementationState(input.state,'candidate'),
      ...metadata
    };
    if(input.verification_run_id)implementation.verification_run_id=compactString(input.verification_run_id);
    registry.implementations.push(implementation);
  }else{
    Object.assign(implementation,metadata);
    implementation.id=id;
    implementation.source_revision_id=sourceRevision.id;
    implementation.capability_id=capability.id;
    if(input.state!==undefined)implementation.state=normalizeImplementationState(input.state,implementation.state||'candidate');
    if(input.verification_run_id!==undefined)implementation.verification_run_id=compactString(input.verification_run_id)||null;
  }
  return implementation;
}

export function invalidateVerificationForImplementation(registry,implementationIdValue,reason='verification_invalidated'){
  requireRegistry(registry);
  const id=compactString(implementationIdValue);
  const implementation=registry.implementations.find(item=>compactString(item?.id)===id);
  if(!implementation)throw new TypeError(`implementation not found: ${id}`);

  if(['verified','executable'].includes(implementation.state))implementation.state='adapter_ready';
  implementation.verification_run_id=null;

  for(const run of registry.verification_runs){
    if(compactString(run?.implementation_id)===id){
      run.current=false;
      run.invalidated_reason=reason;
    }
  }
  for(const health of registry.execution_health){
    if(compactString(health?.implementation_id)===id&&health.current!==false)health.current=false;
  }

  const healthId=`health:${id}:${compactString(reason).toLowerCase()||'verification_invalidated'}`;
  let health=registry.execution_health.find(item=>compactString(item?.id)===healthId);
  if(!health){
    health={id:healthId,implementation_id:id,state:'degraded',reason,current:true};
    registry.execution_health.push(health);
  }else{
    Object.assign(health,{implementation_id:id,state:'degraded',reason,current:true});
  }
  return implementation;
}

export function moveImplementationToRevision(registry,implementationIdValue,revisionIdValue){
  requireRegistry(registry);
  const oldId=compactString(implementationIdValue);
  const targetRevisionId=compactString(revisionIdValue);
  const implementation=registry.implementations.find(item=>compactString(item?.id)===oldId);
  if(!implementation)throw new TypeError(`implementation not found: ${oldId}`);
  const targetRevision=registry.source_revisions.find(item=>compactString(item?.id)===targetRevisionId);
  if(!targetRevision)throw new TypeError(`source revision not found: ${targetRevisionId}`);
  if(compactString(implementation.source_revision_id)===targetRevisionId)return implementation;
  const targetSource=registry.sources.find(item=>compactString(item?.id)===compactString(targetRevision.source_id));
  if(!targetSource)throw new TypeError(`source not found for revision: ${targetRevisionId}`);

  for(const run of registry.verification_runs){
    if(compactString(run?.implementation_id)===oldId){
      run.current=false;
      run.invalidated_reason='source_revision_changed';
    }
  }
  for(const health of registry.execution_health){
    if(compactString(health?.implementation_id)===oldId&&health.current!==false)health.current=false;
  }

  const newId=implementationId(normalizeRepoId(targetSource.repo),normalizeRevision(targetRevision),normalizeCapabilityId(implementation.capability_id));
  if(registry.implementations.some(item=>item!==implementation&&compactString(item?.id)===newId))throw new TypeError(`implementation already exists for target revision: ${newId}`);

  implementation.id=newId;
  implementation.source_revision_id=targetRevision.id;
  implementation.verification_run_id=null;
  if(['verified','executable'].includes(implementation.state))implementation.state='adapter_ready';

  const healthId=`health:${newId}:source_revision_changed`;
  let health=registry.execution_health.find(item=>compactString(item?.id)===healthId);
  if(!health){
    health={id:healthId,implementation_id:newId,state:'degraded',reason:'source_revision_changed',current:true};
    registry.execution_health.push(health);
  }else{
    Object.assign(health,{implementation_id:newId,state:'degraded',reason:'source_revision_changed',current:true});
  }
  return implementation;
}

export function summarizeCapabilityRegistry(registry){
  requireRegistry(registry);
  const revisionsBySource=new Map();
  for(const revision of registry.source_revisions){
    const list=revisionsBySource.get(revision.source_id)??[];
    list.push(revision);
    revisionsBySource.set(revision.source_id,list);
  }
  const sourceCountForState=state=>registry.sources.filter(source=>{
    if(source.state===state)return true;
    return (revisionsBySource.get(source.id)??[]).some(revision=>revision.state===state);
  }).length;
  const implementationCountForState=state=>registry.implementations.filter(item=>item.state===state).length;
  return {
    sources:registry.sources.length,
    resolved:sourceCountForState('resolved'),
    learned:sourceCountForState('learned'),
    security_approved:sourceCountForState('security_approved'),
    reference_only:sourceCountForState('reference_only'),
    blocked:sourceCountForState('blocked'),
    adapter_ready:implementationCountForState('adapter_ready'),
    executable:implementationCountForState('executable'),
    verified:implementationCountForState('verified'),
    degraded:implementationCountForState('degraded')
  };
}
