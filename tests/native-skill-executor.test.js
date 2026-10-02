import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canExecuteNativeSkill, chooseExecutableSkill, deviceIntentIsWrite, executeNativeSkill } from '../src/application/capabilities/native-skill-executor.js';

function skill(id='repo-cloud-tools'){
  return {id:'repo:test/demo',repo:'test/demo',primary_capability:'coding-agent',adapter_status:'ready',requires_paid_api:false,native_adapter:{id,lane:'cloud-runner'}};
}

test('executor skips unsupported ready skill and selects a later runnable one',()=>{
  const rows=[skill('unsupported-adapter'),skill('repo-cloud-tools')];
  assert.equal(chooseExecutableSkill(rows,'repo içinde parser kodunu ara')?.native_adapter?.id,'repo-cloud-tools');
});

test('repo cloud skills require explicit source-code or repository intent',()=>{
  const row=skill('repo-cloud-tools');
  assert.equal(canExecuteNativeSkill(row,'Bugün hava nasıl?'),false);
  assert.equal(canExecuteNativeSkill(row,'repoda checksum fonksiyonu nerede ara'),true);
  assert.equal(canExecuteNativeSkill(row,'kaynak kod içinde parser dosyasını bul'),true);
});

test('device bridge is executable only for recognized ECU/device intents',()=>{
  const row=skill('device-bridge');
  assert.equal(canExecuteNativeSkill(row,'arabadaki hata kodlarını oku'),true);
  assert.equal(canExecuteNativeSkill(row,'merhaba nasılsın'),false);
});

test('device write/service intents stay confirmation gated',()=>{
  assert.equal(deviceIntentIsWrite('servis reset yap'),true);
  assert.equal(deviceIntentIsWrite('hata kodlarını oku'),false);
});

test('ECU binary inspector is executable only when a supported binary attachment exists',()=>{
  const row=skill('ecu-binary-inspector');
  assert.equal(canExecuteNativeSkill(row,'dosyayı analiz et',{attachments:[{name:'ecu.bin',base64:'AA=='}]}),true);
  assert.equal(canExecuteNativeSkill(row,'dosyayı analiz et',{attachments:[]}),false);
});

test('ECU binary native executor forwards the original attachment through ECU deterministic analysis',async()=>{
  const seen=[];
  const core={fetch:async req=>{seen.push({url:new URL(req.url).pathname,body:await req.clone().json()});return new Response(JSON.stringify({reply:'binary-ok',trace:[]}),{status:200,headers:{'content-type':'application/json'}});}};
  const req=new Request('https://jarvis.test/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'analiz et',attachments:[{name:'ecu.bin',base64:'AA=='}]})});
  const result=await executeNativeSkill(core,req,{},null,'analiz et',skill('ecu-binary-inspector'),{attachments:[{name:'ecu.bin',base64:'AA=='}]});
  assert.equal(seen[0].url,'/api/chat/send');
  assert.equal(seen[0].body.channel,'ecu');
  assert.equal(seen[0].body.attachments[0].name,'ecu.bin');
  assert.equal(result?.reply,'binary-ok');
});

test('social growth is executable only for explicit social campaign intent',()=>{
  const row=skill('social-growth');
  assert.equal(canExecuteNativeSkill(row,'Instagram için 7 günlük içerik planı hazırla'),true);
  assert.equal(canExecuteNativeSkill(row,'bugün nasılsın'),false);
});

test('social native executor creates a deterministic paused draft without chat AI fallback',async()=>{
  const seen=[];
  const core={fetch:async req=>{seen.push({url:new URL(req.url).pathname,body:await req.clone().json()});return new Response(JSON.stringify({id:'campaign-1',items:7}),{status:200,headers:{'content-type':'application/json'}});}};
  const req=new Request('https://jarvis.test/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Instagram için 7 günlük içerik planı hazırla'})});
  const result=await executeNativeSkill(core,req,{},null,'Instagram için 7 günlük içerik planı hazırla',skill('social-growth'));
  assert.equal(seen[0].url,'/api/social-growth/native-draft');
  assert.equal(seen[0].body.plan_mode,'deterministic');
  assert.equal(seen[0].body.execution_mode,'draft');
  assert.equal(result?.campaign?.id,'campaign-1');
});

test('paid or unready learned skills are never auto executed',()=>{
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),adapter_status:'unverified'},'repo ara'),false);
  assert.equal(canExecuteNativeSkill({...skill('repo-cloud-tools'),requires_paid_api:true},'repo ara'),false);
});

test('application places native skill gate before graph-aware chat and orchestrator fallback',()=>{
  const source=readFileSync(new URL('../src/app-entry.js',import.meta.url),'utf8');
  assert.match(source,/createNativeSkillFirstChat/);
  assert.match(source,/createCodeGraphChatRuntime/);
  assert.match(source,/createSocialNativeDraft\(createSocialGrowth\(osCore\)\)/);
  assert.match(source,/const orchestratedChat = createEmergencyChatFallback\(createChatOrchestrator\(ecuCore\)\)/);
  assert.match(source,/const nativeSkillChat = createNativeSkillFirstChat\(ecuCore, orchestratedChat\)/);
  assert.match(source,/const handleChat = createCodeGraphChatRuntime\(nativeSkillChat\)/);
});
