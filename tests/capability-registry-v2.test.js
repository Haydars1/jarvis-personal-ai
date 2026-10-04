import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  CAPABILITY_IMPLEMENTATION_STATES,
  CAPABILITY_SOURCE_STATES,
  createCapabilityRegistryV2,
  invalidateVerificationForImplementation,
  migrateLegacyRegistryV1,
  moveImplementationToRevision,
  normalizeCapabilityState,
  readLegacyRegistryCompatibility,
  summarizeCapabilityRegistry,
  upsertCapability,
  upsertImplementation,
  upsertSourceRevision,
  validateCapabilityRegistryV2
} from '../src/lib/capability-registry-v2.js';

test('registry v2 creates all normalized collections', () => {
  const registry=createCapabilityRegistryV2();
  assert.equal(registry.schemaVersion,2);
  for(const key of [
    'sources','source_revisions','capabilities','implementations','adapter_manifests',
    'security_findings','verification_runs','execution_health','learning_evidence','development_candidates'
  ]) assert.ok(Array.isArray(registry[key]),`${key} must be an array`);
  assert.deepEqual(validateCapabilityRegistryV2(registry),{ok:true,errors:[]});
});

test('lifecycle constants and normalizer reject invented states', () => {
  assert.ok(CAPABILITY_SOURCE_STATES.includes('candidate'));
  assert.ok(CAPABILITY_SOURCE_STATES.includes('security_scanned'));
  assert.ok(CAPABILITY_IMPLEMENTATION_STATES.includes('adapter_ready'));
  assert.ok(CAPABILITY_IMPLEMENTATION_STATES.includes('verified'));
  assert.equal(normalizeCapabilityState(' VERIFIED '),'verified');
  assert.equal(normalizeCapabilityState('magically-working'),null);
});

test('verified implementation requires current verification evidence', () => {
  const registry=createCapabilityRegistryV2();
  registry.sources.push({id:'source:owner/tool',repo:'owner/tool',state:'resolved'});
  registry.source_revisions.push({id:'revision:owner/tool@abc',source_id:'source:owner/tool',revision:'abc',state:'learned'});
  registry.capabilities.push({id:'browser.navigate',domain:'browser'});
  registry.implementations.push({
    id:'impl:owner/tool@abc:browser.navigate',
    source_revision_id:'revision:owner/tool@abc',
    capability_id:'browser.navigate',
    state:'verified',
    verification_run_id:null
  });
  const result=validateCapabilityRegistryV2(registry);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.includes('verification')));
});

test('verified evidence must match current implementation and source revision', () => {
  const registry=createCapabilityRegistryV2();
  registry.sources.push({id:'source:owner/tool',repo:'owner/tool',state:'resolved'});
  registry.source_revisions.push({id:'revision:owner/tool@abc',source_id:'source:owner/tool',revision:'abc',state:'learned'});
  registry.capabilities.push({id:'browser.navigate',domain:'browser'});
  registry.verification_runs.push({
    id:'verify:one',
    implementation_id:'impl:owner/tool@old:browser.navigate',
    source_revision_id:'revision:owner/tool@old',
    current:true
  });
  registry.implementations.push({
    id:'impl:owner/tool@abc:browser.navigate',
    source_revision_id:'revision:owner/tool@abc',
    capability_id:'browser.navigate',
    state:'verified',
    verification_run_id:'verify:one'
  });
  const result=validateCapabilityRegistryV2(registry);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.includes('another implementation')));
  assert.ok(result.errors.some(error=>error.includes('another source revision')));
});

test('legacy compatibility reader handles empty and malformed content without throwing', () => {
  const empty=readLegacyRegistryCompatibility('   ');
  assert.equal(empty.status,'empty');
  assert.equal(empty.registry.schemaVersion,2);
  assert.deepEqual(empty.errors,[]);

  const malformed=readLegacyRegistryCompatibility('{ definitely-not-json');
  assert.equal(malformed.status,'invalid');
  assert.equal(malformed.registry.schemaVersion,2);
  assert.ok(malformed.errors.length>0);
});

test('legacy v1 repository becomes one normalized source and one revision without mutating input', () => {
  const legacy={
    schemaVersion:1,
    generatedAt:'2026-10-01T10:00:00.000Z',
    entries:[{
      repo:'Owner/Tool',
      category:'browser-automation',
      categories:['browser-automation','web-scraping'],
      commit:'ABC123',
      score:91,
      source:'curated',
      catalogSource:'uploaded-screenshot',
      guidePage:7
    }]
  };
  const before=structuredClone(legacy);
  const registry=migrateLegacyRegistryV1(legacy);
  assert.deepEqual(legacy,before,'migration must not mutate legacy input');
  assert.equal(registry.schemaVersion,2);
  assert.equal(registry.sources.length,1);
  assert.equal(registry.sources[0].repo,'owner/tool');
  assert.equal(registry.source_revisions.length,1);
  assert.equal(registry.source_revisions[0].source_id,registry.sources[0].id);
  assert.equal(registry.source_revisions[0].revision,'abc123');
  assert.deepEqual(registry.capabilities.map(item=>item.id).sort(),['browser-automation','web-scraping']);
  assert.equal(registry.sources.length,1,'legacy categories must not duplicate repository source objects');
  assert.equal(validateCapabilityRegistryV2(registry).ok,true);
});

test('legacy migration deduplicates canonical repo identity case-insensitively', () => {
  const registry=migrateLegacyRegistryV1({schemaVersion:1,entries:[
    {repo:'OWNER/Tool',category:'browser-automation',commit:'same'},
    {repo:'owner/tool',category:'web-scraping',commit:'same'}
  ]});
  assert.equal(registry.sources.length,1);
  assert.equal(registry.source_revisions.length,1);
  assert.deepEqual(registry.capabilities.map(item=>item.id).sort(),['browser-automation','web-scraping']);
});

test('source revision upsert deduplicates same commit and preserves one source across revisions', () => {
  const registry=createCapabilityRegistryV2();
  const first=upsertSourceRevision(registry,{repo:'Owner/Tool',commit:'ABC'});
  const duplicate=upsertSourceRevision(registry,{repo:'owner/tool',commit:'abc'});
  const changed=upsertSourceRevision(registry,{repo:'OWNER/TOOL',commit:'DEF'});
  assert.equal(registry.sources.length,1);
  assert.equal(registry.source_revisions.length,2);
  assert.equal(first.source.id,duplicate.source.id);
  assert.equal(first.revision.id,duplicate.revision.id);
  assert.equal(changed.revision.source_id,first.source.id);
  assert.notEqual(changed.revision.id,first.revision.id);
});

test('one source exposes many capabilities and many sources can implement one capability', () => {
  const registry=createCapabilityRegistryV2();
  const a=upsertSourceRevision(registry,{repo:'owner/tool-a',commit:'a'}).revision;
  const b=upsertSourceRevision(registry,{repo:'owner/tool-b',commit:'b'}).revision;
  upsertCapability(registry,{id:'browser.navigate',domain:'browser'});
  upsertCapability(registry,{id:'browser.extract',domain:'browser'});
  const aNavigate=upsertImplementation(registry,{source_revision_id:a.id,capability_id:'browser.navigate',state:'adapter_ready'});
  const aExtract=upsertImplementation(registry,{source_revision_id:a.id,capability_id:'browser.extract',state:'learned'});
  const bNavigate=upsertImplementation(registry,{source_revision_id:b.id,capability_id:'browser.navigate',state:'candidate'});
  assert.equal(registry.capabilities.length,2);
  assert.equal(registry.implementations.length,3);
  assert.notEqual(aNavigate.id,bNavigate.id,'implementation identity must include source revision');
  assert.notEqual(aNavigate.id,aExtract.id,'implementation identity must include capability');
  assert.equal(validateCapabilityRegistryV2(registry).ok,true);
});

test('moving implementation to a new source revision invalidates verification but keeps history', () => {
  const registry=createCapabilityRegistryV2();
  const oldRevision=upsertSourceRevision(registry,{repo:'owner/tool',commit:'old'}).revision;
  const newRevision=upsertSourceRevision(registry,{repo:'owner/tool',commit:'new'}).revision;
  upsertCapability(registry,{id:'browser.navigate'});
  const implementation=upsertImplementation(registry,{
    source_revision_id:oldRevision.id,
    capability_id:'browser.navigate',
    state:'verified',
    verification_run_id:'verify:old'
  });
  registry.verification_runs.push({
    id:'verify:old',
    implementation_id:implementation.id,
    source_revision_id:oldRevision.id,
    current:true,
    result:'pass'
  });
  registry.execution_health.push({id:'health:old',implementation_id:implementation.id,state:'healthy',current:true});
  const oldImplementationId=implementation.id;
  const moved=moveImplementationToRevision(registry,oldImplementationId,newRevision.id);
  assert.equal(moved.source_revision_id,newRevision.id);
  assert.equal(moved.state,'adapter_ready');
  assert.equal(moved.verification_run_id,null);
  assert.notEqual(moved.id,oldImplementationId);
  assert.equal(registry.verification_runs.length,1,'historical verification must not be deleted');
  assert.equal(registry.verification_runs[0].current,false);
  assert.equal(registry.verification_runs[0].invalidated_reason,'source_revision_changed');
  assert.equal(registry.execution_health.find(item=>item.id==='health:old').current,false);
  const currentHealth=registry.execution_health.find(item=>item.implementation_id===moved.id&&item.current===true);
  assert.equal(currentHealth.state,'degraded');
  assert.equal(currentHealth.reason,'source_revision_changed');
  assert.equal(validateCapabilityRegistryV2(registry).ok,true);
});

test('explicit verification invalidation degrades current health without deleting run evidence', () => {
  const registry=createCapabilityRegistryV2();
  const revision=upsertSourceRevision(registry,{repo:'owner/tool',commit:'abc'}).revision;
  upsertCapability(registry,{id:'browser.navigate'});
  const implementation=upsertImplementation(registry,{
    source_revision_id:revision.id,
    capability_id:'browser.navigate',
    state:'verified',
    verification_run_id:'verify:one'
  });
  registry.verification_runs.push({id:'verify:one',implementation_id:implementation.id,source_revision_id:revision.id,current:true,result:'pass'});
  const invalidated=invalidateVerificationForImplementation(registry,implementation.id,'manual_recheck');
  assert.equal(invalidated.state,'adapter_ready');
  assert.equal(invalidated.verification_run_id,null);
  assert.equal(registry.verification_runs[0].current,false);
  assert.equal(registry.execution_health.at(-1).reason,'manual_recheck');
});

test('truthful summary separates source learning from executable implementation state', () => {
  const registry=createCapabilityRegistryV2();
  registry.sources.push(
    {id:'source:a',repo:'owner/a',state:'resolved'},
    {id:'source:b',repo:'owner/b',state:'security_approved'},
    {id:'source:c',repo:'owner/c',state:'reference_only'},
    {id:'source:d',repo:'owner/d',state:'blocked'}
  );
  registry.source_revisions.push(
    {id:'revision:a@1',source_id:'source:a',revision:'1',state:'learned'},
    {id:'revision:b@1',source_id:'source:b',revision:'1',state:'learned'}
  );
  registry.implementations.push(
    {id:'impl:a',state:'adapter_ready'},
    {id:'impl:b',state:'executable'},
    {id:'impl:c',state:'verified'},
    {id:'impl:d',state:'degraded'},
    {id:'impl:learned-only',state:'learned'}
  );
  assert.deepEqual(summarizeCapabilityRegistry(registry),{
    sources:4,
    resolved:1,
    learned:2,
    security_approved:1,
    reference_only:1,
    blocked:1,
    adapter_ready:1,
    executable:1,
    verified:1,
    degraded:1
  });
});

test('checked-in registry v2 cache validates and syntax checks include registry module', () => {
  const v2Url=new URL('../data/capability-registry-v2.json',import.meta.url);
  const legacyUrl=new URL('../data/capability-registry.json',import.meta.url);
  const packageUrl=new URL('../package.json',import.meta.url);
  assert.equal(existsSync(v2Url),true,'additive registry v2 cache must exist');
  assert.equal(existsSync(legacyUrl),true,'legacy registry must remain present');
  const cached=JSON.parse(readFileSync(v2Url,'utf8'));
  assert.deepEqual(validateCapabilityRegistryV2(cached),{ok:true,errors:[]});
  const packageJson=JSON.parse(readFileSync(packageUrl,'utf8'));
  assert.match(packageJson.scripts['check:syntax'],/src\/lib\/capability-registry-v2\.js/);
});
