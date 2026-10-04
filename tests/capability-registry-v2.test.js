import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITY_IMPLEMENTATION_STATES,
  CAPABILITY_SOURCE_STATES,
  createCapabilityRegistryV2,
  migrateLegacyRegistryV1,
  normalizeCapabilityState,
  readLegacyRegistryCompatibility,
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
