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

function sourceId(repo){return `source:${repo}`;}
function revisionId(repo,revision){return `revision:${repo}@${revision}`;}
function implementationId(repo,revision,capability){return `impl:${repo}@${revision}:${capability}`;}

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
