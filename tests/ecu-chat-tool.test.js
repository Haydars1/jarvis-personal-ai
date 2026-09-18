import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuChatTool } from '../src/application/ecu/tool.js';

function chat(text){
  return new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({text})
  });
}

test('answers explicit ECU status request without using a language model', async()=>{
  const calls=[];
  const core={
    async fetch(req){
      const url=new URL(req.url);calls.push(url.pathname);
      if(url.pathname==='/api/ecu/compute/status')return Response.json({preferred:'cloud-container',localOnline:false,cloudContainerReady:true});
      if(url.pathname==='/api/ecu/training/status')return Response.json({status:'COLLECTING_DATA',verifiedExamples:12,minVerifiedExamples:50,productionModel:null});
      if(url.pathname==='/api/ecu/research/status')return Response.json({status:'COMPLETE',counts:{sources:33,verified_claims:4}});
      return new Response('delegate',{status:299});
    }
  };
  const tool=createEcuChatTool(core);
  const res=await tool.fetch(chat('JARVIS ECU brain durumu ne?'),{},{});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.match(body.reply,/Cloud container/i);
  assert.match(body.reply,/12\/50/);
  assert.deepEqual(calls,['/api/ecu/compute/status','/api/ecu/training/status','/api/ecu/research/status']);
});

test('delegates unrelated chat unchanged',async()=>{
  let delegated=0;
  const core={async fetch(){delegated++;return new Response('delegate',{status:299});}};
  const tool=createEcuChatTool(core);
  const res=await tool.fetch(chat('Bugün nasılsın?'),{},{});
  assert.equal(res.status,299);
  assert.equal(delegated,1);
});

test('returns latest ECU job when asked for analysis status',async()=>{
  const core={async fetch(req){
    const url=new URL(req.url);
    if(url.pathname==='/api/ecu/jobs')return Response.json({jobs:[{id:'job-1',state:'NEEDS_REVIEW',result:{ecu_family:'EDC17C46',confidence:.95,map_candidates:[{},{}]}}]});
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const res=await tool.fetch(chat('Son ECU analizim ne durumda?'),{},{});
  const body=await res.json();
  assert.match(body.reply,/EDC17C46/);
  assert.match(body.reply,/2 map/);
  assert.match(body.reply,/NEEDS_REVIEW/);
});
