import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseExecutableSkill, canExecuteNativeSkill, deviceIntentIsWrite, executeNativeSkill } from '../src/application/capabilities/native-skill-executor.js';

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

test('ECU binary inspector is executable only when a supported binary attachment exists',()=>{
  const binarySkill=skill('ecu-binary-inspector');
  assert.equal(canExecuteNativeSkill(binarySkill,'bu dosyayı analiz et',{attachments:[{name:'passat.bin',base64:'AA=='}]}),true);
  assert.equal(canExecuteNativeSkill(binarySkill,'bu dosyayı analiz et',{attachments:[{name:'notes.txt',base64:'AA=='}]}),false);
  assert.equal(canExecuteNativeSkill(binarySkill,'bu dosyayı analiz et',{attachments:[]}),false);
});

test('ECU binary native executor forwards the original attachment through ECU deterministic analysis',async()=>{
  const seen=[];
  const core={fetch:async req=>{
    const body=await req.json();
    seen.push(body);
    return new Response(JSON.stringify({reply:'byte analizi tamam',provider:'JARVIS ECU Binary Inspector',trace:[{kind:'binary'}]}),{status:200,headers:{'content-type':'application/json'}});
  }};
  const request=new Request('https://jarvis.example/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'bu dosyayı analiz et',attachments:[{name:'passat.bin',type:'application/octet-stream',base64:'AA=='}]})});
  const result=await executeNativeSkill(core,request,{}, {},'bu dosyayı analiz et',skill('ecu-binary-inspector'),{attachments:[{name:'passat.bin',type:'application/octet-stream',base64:'AA=='}]});
  assert.equal(result?.provider,'JARVIS ECU Binary Inspector');
  assert.equal(seen.length,1);
  assert.equal(seen[0].channel,'ecu');
  assert.equal(seen[0].attachments[0].name,'passat.bin');
});

test('paid or unready learned skills are never auto executed',()=>{
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),adapter_status:'unverified'},'repo ara'),false);
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),requires_paid_api:true},'repo ara'),false);
});

test('application places native skill gate before the chat orchestrator fallback',()=>{
  const source=readFileSync(new URL('../src/app-entry.js',import.meta.url),'utf8');
  assert.match(source,/createNativeSkillFirstChat/);
  assert.match(source,/const orchestratedChat = createEmergencyChatFallback\(createChatOrchestrator\(ecuCore\)\)/);
  assert.match(source,/const handleChat = createNativeSkillFirstChat\(ecuCore, orchestratedChat\)/);
});
