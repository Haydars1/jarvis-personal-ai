import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseExecutableSkill, canExecuteNativeSkill, deviceIntentIsWrite } from '../src/application/capabilities/native-skill-executor.js';

const skill=(adapter,extra={})=>({adapter_status:'ready',requires_paid_api:false,native_adapter:{id:adapter},repo:'example/tool',...extra});

test('executor skips unsupported ready skill and selects a later runnable one',()=>{
  const rows=[skill('social-growth'),skill('repo-cloud-tools')];
  const picked=chooseExecutableSkill(rows,'kaynak kodda checksum ara');
  assert.equal(picked?.native_adapter?.id,'repo-cloud-tools');
});

test('device bridge is executable only for recognized ECU/device intents',()=>{
  assert.equal(canExecuteNativeSkill(skill('device-bridge'),'DTC arıza kodlarını oku'),true);
  assert.equal(canExecuteNativeSkill(skill('device-bridge'),'yarın hava nasıl'),false);
});

test('device write/service intents stay confirmation gated',()=>{
  assert.equal(deviceIntentIsWrite('DTC kodlarını temizle'),true);
  assert.equal(deviceIntentIsWrite('servis reset yap'),true);
  assert.equal(deviceIntentIsWrite('DTC arıza kodlarını oku'),false);
});

test('paid or unready learned skills are never auto executed',()=>{
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),adapter_status:'unverified'},'repo ara'),false);
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),requires_paid_api:true},'repo ara'),false);
});
