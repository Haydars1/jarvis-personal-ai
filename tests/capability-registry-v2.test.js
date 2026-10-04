import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITY_IMPLEMENTATION_STATES,
  CAPABILITY_SOURCE_STATES,
  createCapabilityRegistryV2,
  normalizeCapabilityState,
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
