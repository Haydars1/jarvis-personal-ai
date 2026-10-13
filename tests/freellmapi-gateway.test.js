import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freeLlmGatewayBase,freeLlmChat,freeLlmModels} from '../src/lib/freellmapi-gateway.js';

test('only public HTTPS FreeLLMAPI endpoints can receive credentials',()=>{
 assert.equal(freeLlmGatewayBase('https://ai.example.org'),'https://ai.example.org/v1');
 assert.equal(freeLlmGatewayBase('https://ai.example.org/v1/'),'https://ai.example.org/v1');
 for(const input of [
  'http://localhost:3001','http://127.0.0.1:3001','https://localhost:3001',
  'http://ai.example.org','https://127.0.0.1','https://[::1]','https://192.168.1.12',
  'https://ai.example.org:8080','https://key:pass@ai.example.org','https://ai.example.org/path',
  'https://ai.example.org/v1?key=secret','file:///etc/passwd'
 ]) assert.throws(()=>freeLlmGatewayBase(input),/FREELLMAPI_/);
});
test('auto model forwards conversation to remote gateway and reports routed provider',async()=>{
 const messages=[{role:'system',content:'Turkish only'},{role:'user',content:'Hi'},{role:'assistant',content:'Merhaba'},{role:'user',content:'Devam'}];
 const response=await freeLlmChat({endpoint:'https://ai.example.org/v1',key:'unified-token',messages},async(url,opts)=>{
  assert.equal(url,'https://ai.example.org/v1/chat/completions');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.authorization,'Bearer unified-token');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'auto');
  assert.deepEqual(body.messages,messages);
  return {ok:true,headers:{get:header=>header==='x-routed-via'?'groq/fast-model':''},json:async()=>({model:'groq/fast-model',choices:[{message:{content:'İşlem devam ediyor'}}]})};
 });
 assert.equal(response.text,'İşlem devam ediyor');
 assert.equal(response.routed_via,'groq/fast-model');
});
test('gateway quota failures raise safe status codes for existing JARVIS fallback',async()=>{
 await assert.rejects(freeLlmChat({endpoint:'https://ai.example.org',key:'x',messages:[{role:'user',content:'ok'}]},async()=>({ok:false,status:429})),/FREELLMAPI_HTTP_429/);
 await assert.rejects(freeLlmChat({endpoint:'https://ai.example.org',key:'x',messages:[{role:'user',content:'ok'}]},async()=>({ok:true,headers:{get:()=>null},json:async()=>({choices:[]})})),/FREELLMAPI_EMPTY/);
});
test('models probe uses authenticated gateway endpoint and never reports live connectivity until checked',async()=>{
 const models=await freeLlmModels({endpoint:'https://api.example.org',key:'key'},async(url,init)=>{
  assert.equal(url,'https://api.example.org/v1/models');
  assert.equal(init.headers.authorization,'Bearer key');
  return {ok:true,json:async()=>({data:[{id:'auto'},{id:'auto:fast'},{id:'auto:smart'}]})};
 });
 assert.deepEqual(models.models,['auto','auto:fast','auto:smart']);
});
test('JARVIS vault router and credential tester support FreeLLMAPI',()=>{
 const router=readFileSync(new URL('../src/application/chat/smart-router.js',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 const orchestration=readFileSync(new URL('../src/lib/orchestration.js',import.meta.url),'utf8');
 const catalog=readFileSync(new URL('../public/provider-catalog.js',import.meta.url),'utf8');
 assert.match(router,/provider === 'freellmapi'/);
 assert.match(router,/freeLlmChat\(/);
 assert.match(legacy,/freeLlmModels\(/);
 assert.match(orchestration,/'freellmapi'/);
 assert.match(catalog,/pcEndpoint/);
});
