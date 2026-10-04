import { CAPABILITY_POLICY_CLASSES, isPolicyExecutable } from './capability-security-v2.js';

export const ADAPTER_MANIFEST_VERSION=2;

const EXECUTION_TARGET_BY_POLICY=Object.freeze({
  'reference-only':'reference',
  'pure-read':'sandbox-local',
  'network-read':'sandbox-cloud',
  'workspace-readwrite':'sandbox-workspace',
  'sandbox-network-readwrite':'sandbox-cloud',
  'device-read':'device-bridge',
  'device-write-confirmed':'device-bridge',
  'production-prohibited':'blocked'
});

function compact(value=''){return String(value??'').trim();}
function canonicalRepo(value=''){return compact(value).toLowerCase();}
function canonicalCapability(value=''){return compact(value).toLowerCase();}

function normalizeFieldList(value=[]){
  if(!Array.isArray(value))return [];
  return value.map((item,index)=>{
    if(typeof item==='string')return {name:item,type:'string',required:true};
    const name=compact(item?.name||`field_${index+1}`);
    return {
      name,
      type:compact(item?.type||'string').toLowerCase(),
      required:item?.required!==false,
      ...(item?.description?{description:compact(item.description)}:{})
    };
  }).filter(item=>item.name);
}

function normalizePlatforms(input={}){
  const values=Array.isArray(input.platforms)?input.platforms:input.platform?[input.platform]:[];
  return [...new Set(values.map(value=>compact(value).toLowerCase()).filter(Boolean))].sort();
}

function normalizeRequirements(input={},policy={}){
  return [...new Set([...(Array.isArray(input.requirements)?input.requirements:[]),...(Array.isArray(policy.requirements)?policy.requirements:[])].map(value=>compact(value)).filter(Boolean))].sort();
}

function deterministicImplementationId(repo,revision,capability){
  return `impl:${repo}@${revision}:${capability}`;
}

export function compileAdapterManifest(input={}){
  const repo=canonicalRepo(input.repo);
  const revision=compact(input.revision??input.commit??input.source_commit).toLowerCase();
  const sourceRevisionId=compact(input.source_revision_id??input.sourceRevisionId);
  const capabilityId=canonicalCapability(input.capability_id??input.capabilityId);
  const policy=input.policy&&typeof input.policy==='object'?input.policy:{};
  if(!repo||!repo.includes('/'))throw new TypeError('repo must be canonical owner/name');
  if(!revision||revision==='latest'||revision==='main'||revision==='master')throw new TypeError('adapter source revision must be pinned');
  if(!sourceRevisionId)throw new TypeError('source_revision_id is required');
  if(!capabilityId)throw new TypeError('capability_id is required');
  if(!CAPABILITY_POLICY_CLASSES.includes(String(policy.policy_class||'')))throw new TypeError('valid capability policy is required');

  const executionTarget=compact(input.execution_target??input.executionTarget??EXECUTION_TARGET_BY_POLICY[policy.policy_class]);
  const executable=isPolicyExecutable(policy);
  const requiresConfirmation=policy.requires_confirmation===true;
  const requirements=normalizeRequirements(input,policy);
  const paidApi=input.requires_paid_api===true||input.requiresPaidApi===true||requirements.includes('paid-api');
  const credentialRequired=input.requires_credentials===true||input.requiresCredentials===true||requirements.includes('credentials');
  const implementationId=compact(input.implementation_id)||deterministicImplementationId(repo,revision,capabilityId);

  return {
    schemaVersion:ADAPTER_MANIFEST_VERSION,
    id:`adapter:${capabilityId}:${repo}@${revision}`,
    capability_id:capabilityId,
    implementation_id:implementationId,
    source:{repo,revision,source_revision_id:sourceRevisionId},
    policy_class:policy.policy_class,
    risk:compact(policy.risk||'low').toLowerCase(),
    execution_target:executionTarget,
    inputs:normalizeFieldList(input.inputs),
    outputs:normalizeFieldList(input.outputs),
    requirements,
    auth:{required:credentialRequired,providers:Array.isArray(input.auth_providers)?[...input.auth_providers]:[]},
    cost:{paid_api:paidApi,mode:paidApi?'external':'free'},
    platforms:normalizePlatforms(input),
    requires_confirmation:requiresConfirmation,
    auto_execute:executable&&!requiresConfirmation&&input.autoExecute!==false,
    proposal_only:true,
    state:executable?'adapter_ready':policy.decision==='blocked'?'blocked':'reference_only'
  };
}

export function validateAdapterManifest(manifest={}){
  const errors=[];
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))return {ok:false,errors:['manifest must be an object']};
  if(manifest.schemaVersion!==ADAPTER_MANIFEST_VERSION)errors.push(`schemaVersion must be ${ADAPTER_MANIFEST_VERSION}`);
  if(!compact(manifest.id))errors.push('id is required');
  if(!canonicalCapability(manifest.capability_id))errors.push('capability_id is required');
  if(!compact(manifest.implementation_id))errors.push('implementation_id is required');
  if(!manifest.source||typeof manifest.source!=='object')errors.push('source is required');
  else {
    if(!canonicalRepo(manifest.source.repo).includes('/'))errors.push('source.repo must be owner/name');
    const revision=compact(manifest.source.revision).toLowerCase();
    if(!revision||['latest','main','master'].includes(revision))errors.push('source.revision must be pinned');
    if(!compact(manifest.source.source_revision_id))errors.push('source.source_revision_id is required');
  }
  if(!CAPABILITY_POLICY_CLASSES.includes(String(manifest.policy_class||'')))errors.push('policy_class is invalid');
  if(!compact(manifest.execution_target))errors.push('execution_target is required');
  if(!Array.isArray(manifest.inputs))errors.push('inputs must be an array');
  if(!Array.isArray(manifest.outputs))errors.push('outputs must be an array');
  if(!Array.isArray(manifest.requirements))errors.push('requirements must be an array');
  if(!Array.isArray(manifest.platforms))errors.push('platforms must be an array');
  if(manifest.auto_execute===true&&['reference-only','production-prohibited'].includes(manifest.policy_class))errors.push('non-executable policy cannot auto execute');
  if(manifest.auto_execute===true&&manifest.requires_confirmation===true)errors.push('confirmation-required adapter cannot auto execute');
  if(manifest.state==='adapter_ready'&&!isPolicyExecutable({policy_class:manifest.policy_class,decision:'approved'}))errors.push('adapter_ready requires executable policy');
  return {ok:errors.length===0,errors};
}

export const ADAPTER_EXECUTION_TARGETS=EXECUTION_TARGET_BY_POLICY;
