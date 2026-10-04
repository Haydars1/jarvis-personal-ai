import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAdapterManifest } from '../src/lib/capability-adapter-compiler-v2.js';
import { createCapabilityRegistryV2, upsertCapability, upsertImplementation, upsertSourceRevision } from '../src/lib/capability-registry-v2.js';
import { executeCapabilityWithFallback, rankCapabilityImplementations } from '../src/lib/capability-router-v2.js';
import { recordExecutionHealth, recordVerificationRun } from '../src/lib/capability-verification-v2.js';

function addImplementation(registry,{repo,revision,capability='browser.navigate',state='adapter_ready',priority=0,policyClass='pure-read',requirements=[],platforms=[],paid=false,confirmation=false,reliability=0.9}){
  const sourceRevision=upsertSourceRevision(registry,{repo,commit:revision}).revision;
  upsertCapability(registry,{id:capability});
  const implementation=upsertImplementation(registry,{source_revision_id:sourceRevision.id,capability_id:capability,state,metadata:{priority}});
  const manifest=compileAdapterManifest({
    repo,revision,source_revision_id:sourceRevision.id,capability_id:capability,implementation_id:implementation.id,
    policy:{policy_class:policyClass,decision:'approved',risk:'low',requires_confirmation:confirmation,requirements},
    requirements,platforms,requiresPaidApi:paid
  });
  registry.adapter_manifests.push(manifest);
  if(state==='verified')recordVerificationRun(registry,{implementation_id:implementation.id,result:'pass',id:`verify:${repo}`,reliability});
  else if(state==='executable'&&reliability!==null)recordExecutionHealth(registry,{implementation_id:implementation.id,state:'healthy',reliability});
  return {implementation,manifest};
}

test('router ignores learned and adapter-only implementations', () => {
  const registry=createCapabilityRegistryV2();
  addImplementation(registry,{repo:'owner/learned',revision:'1',state:'learned'});
  addImplementation(registry,{repo:'owner/adapter',revision:'1',state:'adapter_ready'});
  const verified=addImplementation(registry,{repo:'owner/verified',revision:'1',state:'verified'});
  const ranked=rankCapabilityImplementations(registry,{capability_id:'browser.navigate'});
  assert.deepEqual(ranked.map(row=>row.implementation.id),[verified.implementation.id]);
});

test('router filters missing requirements, platform mismatch, paid API and confirmation gates', () => {
  const registry=createCapabilityRegistryV2();
  const network=addImplementation(registry,{repo:'owner/network',revision:'1',state:'verified',policyClass:'network-read',requirements:['network']});
  addImplementation(registry,{repo:'owner/linux',revision:'1',state:'verified',platforms:['linux']});
  addImplementation(registry,{repo:'owner/paid',revision:'1',state:'verified',paid:true});
  addImplementation(registry,{repo:'owner/device',revision:'1',state:'verified',policyClass:'device-write-confirmed',requirements:['device'],confirmation:true});
  assert.equal(rankCapabilityImplementations(registry,{capability_id:'browser.navigate'}).length,0);
  const ranked=rankCapabilityImplementations(registry,{capability_id:'browser.navigate',available_requirements:['network'],platform:'darwin'});
  assert.deepEqual(ranked.map(row=>row.implementation.id),[network.implementation.id]);
});

test('router excludes degraded current health even if implementation still says verified', () => {
  const registry=createCapabilityRegistryV2();
  const row=addImplementation(registry,{repo:'owner/tool',revision:'1',state:'verified'});
  recordExecutionHealth(registry,{implementation_id:row.implementation.id,state:'degraded',reason:'timeout'});
  row.implementation.state='verified';
  assert.equal(rankCapabilityImplementations(registry,{capability_id:'browser.navigate'}).length,0);
});

test('verified implementation outranks merely executable implementation', () => {
  const registry=createCapabilityRegistryV2();
  const executable=addImplementation(registry,{repo:'owner/executable',revision:'1',state:'executable',priority:20,reliability:1});
  const verified=addImplementation(registry,{repo:'owner/verified',revision:'1',state:'verified',priority:0,reliability:0.5});
  const ranked=rankCapabilityImplementations(registry,{capability_id:'browser.navigate'});
  assert.equal(ranked[0].implementation.id,verified.implementation.id);
  assert.equal(ranked[1].implementation.id,executable.implementation.id);
});

test('fallback trace records failed first implementation and successful second implementation', async () => {
  const registry=createCapabilityRegistryV2();
  const first=addImplementation(registry,{repo:'owner/first',revision:'1',state:'verified',priority:20,reliability:1});
  const second=addImplementation(registry,{repo:'owner/second',revision:'1',state:'verified',priority:0,reliability:0.8});
  const result=await executeCapabilityWithFallback(registry,{capability_id:'browser.navigate'},async ({implementation})=>{
    if(implementation.id===first.implementation.id)throw new Error('FIRST_FAILED');
    return {title:'ok'};
  });
  assert.equal(result.ok,true);
  assert.equal(result.selected_implementation_id,second.implementation.id);
  assert.deepEqual(result.attempts.map(item=>item.status),['failed','completed']);
  assert.equal(result.attempts[0].error,'FIRST_FAILED');
  assert.deepEqual(result.trace.map(item=>item.state),['running','failed','running','completed']);
});

test('router reports no compatible implementation truthfully', async () => {
  const registry=createCapabilityRegistryV2();
  addImplementation(registry,{repo:'owner/reference',revision:'1',state:'adapter_ready',policyClass:'reference-only'});
  const result=await executeCapabilityWithFallback(registry,{capability_id:'browser.navigate'},async ()=>({ok:true}));
  assert.deepEqual(result,{ok:false,error:'NO_COMPATIBLE_IMPLEMENTATION',attempts:[],trace:[]});
});
