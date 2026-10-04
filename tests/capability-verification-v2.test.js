import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRegistryV2, upsertCapability, upsertImplementation, upsertSourceRevision } from '../src/lib/capability-registry-v2.js';
import { currentHealthFor, currentVerificationFor, recordExecutionHealth, recordVerificationRun } from '../src/lib/capability-verification-v2.js';

function fixture(){
  const registry=createCapabilityRegistryV2();
  const revision=upsertSourceRevision(registry,{repo:'owner/tool',commit:'abc'}).revision;
  upsertCapability(registry,{id:'browser.navigate'});
  const implementation=upsertImplementation(registry,{source_revision_id:revision.id,capability_id:'browser.navigate',state:'adapter_ready'});
  return {registry,revision,implementation};
}

test('passing verification binds evidence to implementation and exact source revision', () => {
  const {registry,revision,implementation}=fixture();
  const run=recordVerificationRun(registry,{
    implementation_id:implementation.id,
    source_revision_id:revision.id,
    result:'pass',
    acceptance_contract:'known fixture title marker',
    exit_status:0,
    duration_ms:42,
    output_digest:'sha256:abc',
    evidence:{marker:'Example Domain'},
    reliability:0.99
  });
  assert.equal(implementation.state,'verified');
  assert.equal(implementation.verification_run_id,run.id);
  assert.equal(currentVerificationFor(registry,implementation.id).id,run.id);
  assert.equal(currentHealthFor(registry,implementation.id).state,'healthy');
});

test('verification against stale source revision is rejected', () => {
  const {registry,implementation}=fixture();
  assert.throws(()=>recordVerificationRun(registry,{
    implementation_id:implementation.id,
    source_revision_id:'revision:owner/tool@old',
    result:'pass'
  }),/REVISION_MISMATCH/);
  assert.equal(registry.verification_runs.length,0);
});

test('new verification preserves historical runs and only latest passing evidence is current', () => {
  const {registry,implementation}=fixture();
  const first=recordVerificationRun(registry,{implementation_id:implementation.id,result:'pass',id:'verify:first'});
  const second=recordVerificationRun(registry,{implementation_id:implementation.id,result:'pass',id:'verify:second'});
  assert.equal(registry.verification_runs.length,2);
  assert.equal(first.current,false);
  assert.equal(second.current,true);
  assert.equal(currentVerificationFor(registry,implementation.id).id,'verify:second');
});

test('failed verification degrades implementation and records current degraded health', () => {
  const {registry,implementation}=fixture();
  recordVerificationRun(registry,{implementation_id:implementation.id,result:'pass',id:'verify:pass'});
  const failed=recordVerificationRun(registry,{implementation_id:implementation.id,result:'fail',id:'verify:fail',reason:'fixture_mismatch'});
  assert.equal(failed.current,false);
  assert.equal(implementation.state,'degraded');
  assert.equal(implementation.verification_run_id,null);
  const health=currentHealthFor(registry,implementation.id);
  assert.equal(health.state,'degraded');
  assert.equal(health.reason,'fixture_mismatch');
});

test('health updates preserve history and can restore verified state only with current evidence', () => {
  const {registry,implementation}=fixture();
  recordVerificationRun(registry,{implementation_id:implementation.id,result:'pass',id:'verify:one'});
  const degraded=recordExecutionHealth(registry,{implementation_id:implementation.id,state:'degraded',reason:'timeout'});
  assert.equal(implementation.state,'degraded');
  const healthy=recordExecutionHealth(registry,{implementation_id:implementation.id,state:'healthy',reason:'recovered'});
  assert.equal(degraded.current,false);
  assert.equal(healthy.current,true);
  assert.equal(implementation.state,'verified');
  assert.equal(registry.execution_health.length,3,'verification health plus degradation plus recovery are retained');
});
