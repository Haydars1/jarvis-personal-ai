import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAdapterManifest, validateAdapterManifest } from '../src/lib/capability-adapter-compiler-v2.js';

test('adapter manifest pins exact source revision and typed contract', () => {
  const manifest=compileAdapterManifest({
    repo:'Owner/Tool',
    revision:'ABC123',
    source_revision_id:'revision:owner/tool@abc123',
    capability_id:'browser.navigate',
    policy:{policy_class:'sandbox-network-readwrite',decision:'approved',risk:'medium',requirements:['network']},
    inputs:[{name:'url',type:'string',required:true}],
    outputs:[{name:'title',type:'string'}],
    platforms:['linux','darwin']
  });
  assert.equal(manifest.source.repo,'owner/tool');
  assert.equal(manifest.source.revision,'abc123');
  assert.equal(manifest.execution_target,'sandbox-cloud');
  assert.equal(manifest.state,'adapter_ready');
  assert.equal(manifest.auto_execute,true);
  assert.deepEqual(validateAdapterManifest(manifest),{ok:true,errors:[]});
});

test('un-pinned latest branch is rejected', () => {
  assert.throws(()=>compileAdapterManifest({
    repo:'owner/tool',revision:'main',source_revision_id:'revision:owner/tool@main',capability_id:'browser.navigate',
    policy:{policy_class:'pure-read',decision:'approved',risk:'low'}
  }),/pinned/i);
});

test('reference-only policy cannot become executable adapter', () => {
  const manifest=compileAdapterManifest({
    repo:'owner/tool',revision:'abc',source_revision_id:'revision:owner/tool@abc',capability_id:'reference.learn',
    policy:{policy_class:'reference-only',decision:'reference_only',risk:'medium'}
  });
  assert.equal(manifest.state,'reference_only');
  assert.equal(manifest.auto_execute,false);
  assert.equal(manifest.execution_target,'reference');
  assert.deepEqual(validateAdapterManifest(manifest),{ok:true,errors:[]});
});

test('device-write adapter is never automatic and preserves confirmation requirement', () => {
  const manifest=compileAdapterManifest({
    repo:'owner/device-tool',revision:'deadbeef',source_revision_id:'revision:owner/device-tool@deadbeef',capability_id:'vehicle.service',
    policy:{policy_class:'device-write-confirmed',decision:'approved',risk:'high',requires_confirmation:true,requirements:['device']}
  });
  assert.equal(manifest.execution_target,'device-bridge');
  assert.equal(manifest.requires_confirmation,true);
  assert.equal(manifest.auto_execute,false);
  assert.equal(manifest.state,'adapter_ready');
});

test('paid or credential requirements stay visible in manifest', () => {
  const manifest=compileAdapterManifest({
    repo:'owner/seo',revision:'1234',source_revision_id:'revision:owner/seo@1234',capability_id:'seo.audit',
    policy:{policy_class:'network-read',decision:'approved',risk:'low',requirements:['network']},
    requiresPaidApi:true,
    requiresCredentials:true,
    auth_providers:['example'],
    platforms:['cloud']
  });
  assert.equal(manifest.cost.paid_api,true);
  assert.equal(manifest.cost.mode,'external');
  assert.equal(manifest.auth.required,true);
  assert.deepEqual(manifest.auth.providers,['example']);
});

test('validator refuses auto-execute on prohibited policy', () => {
  const manifest={
    schemaVersion:2,id:'adapter:x',capability_id:'x',implementation_id:'impl:x',
    source:{repo:'owner/tool',revision:'abc',source_revision_id:'revision:owner/tool@abc'},
    policy_class:'reference-only',risk:'low',execution_target:'reference',inputs:[],outputs:[],requirements:[],platforms:[],
    requires_confirmation:false,auto_execute:true,proposal_only:true,state:'reference_only'
  };
  const result=validateAdapterManifest(manifest);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.includes('auto execute')));
});
