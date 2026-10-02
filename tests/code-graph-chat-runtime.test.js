import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCodeGraphIntent, JARVIS_CODE_GRAPH_REPO, createCodeGraphChatRuntime } from '../src/application/code-graph/chat-runtime.js';

test('routes impacted-file questions to reverse dependency analysis',()=>{
  assert.equal(JARVIS_CODE_GRAPH_REPO,'Haydars1/jarvis-personal-ai');
  assert.deepEqual(parseCodeGraphIntent('JARVIS kodunda src/worker.js dosyasını değiştirsem neler etkilenir?'),{operation:'impact',files:['src/worker.js']});
});

test('routes dependency questions to graph neighbors',()=>{
  assert.deepEqual(parseCodeGraphIntent('Graphify ile `src/application/chat/orchestrator.js` bağımlılıklarını göster'),{operation:'neighbors',query:'src/application/chat/orchestrator.js',direction:'both'});
});

test('routes dependency path questions with two targets',()=>{
  assert.deepEqual(parseCodeGraphIntent('JARVIS code graph `src/app-entry.js` ile `src/worker.js` arasında dependency path göster'),{operation:'path',from:'src/app-entry.js',to:'src/worker.js'});
});

test('routes explicit graph symbol lookup',()=>{
  assert.deepEqual(parseCodeGraphIntent('Graphify code graph içinde `compileRepositorySkill` bul'),{operation:'find',query:'compileRepositorySkill'});
});

test('ordinary chat does not create graph work',()=>{
  assert.equal(parseCodeGraphIntent('Bugün nasılsın?'),null);
  assert.equal(parseCodeGraphIntent('Bana kısa bir mesaj yaz'),null);
});

test('graph-aware chat queues a bounded D1 job and preserves the normal chat response',async()=>{
  const writes=[];
  const env={DB:{prepare:sql=>({bind:(...args)=>({run:async()=>{writes.push({sql,args});return {success:true};}})})}};
  const fallback=async()=>new Response(JSON.stringify({reply:'Normal cevap',trace:[]}),{status:200,headers:{'content-type':'application/json'}});
  const handle=createCodeGraphChatRuntime(fallback);
  const req=new Request('https://jarvis.example/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'JARVIS kodunda src/worker.js değişirse ne etkilenir?'})});
  const response=await handle(req,env,{}),payload=await response.json();
  assert.equal(writes.length,1);
  assert.match(writes[0].sql,/INSERT INTO cloud_tool_jobs/);
  assert.equal(writes[0].args[1],'code-graph-query');
  assert.equal(writes[0].args[2],JARVIS_CODE_GRAPH_REPO);
  assert.deepEqual(JSON.parse(writes[0].args[4]),{operation:'impact',files:['src/worker.js'],source:'chat-code-graph'});
  assert.equal(payload.reply,'Normal cevap');
  assert.equal(payload.job.adapter_id,'code-graph-query');
  assert.equal(payload.job.status,'queued');
  assert.ok(payload.trace.some(row=>row.kind==='code-graph'));
});

test('ordinary chat bypasses D1 graph queue completely',async()=>{
  let prepared=0;
  const env={DB:{prepare:()=>{prepared++;throw new Error('should not prepare');}}};
  const fallback=async()=>new Response(JSON.stringify({reply:'Selam'}),{status:200,headers:{'content-type':'application/json'}});
  const handle=createCodeGraphChatRuntime(fallback);
  const req=new Request('https://jarvis.example/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Bugün nasılsın?'})});
  const payload=await (await handle(req,env,{})).json();
  assert.equal(prepared,0);
  assert.equal(payload.reply,'Selam');
});
