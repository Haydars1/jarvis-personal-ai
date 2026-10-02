import test from 'node:test';
import assert from 'node:assert/strict';
import { skillFirstResponse } from '../src/application/chat/orchestrator.js';

const repoSkill={
  id:'aider',
  repo:'aider-ai/aider',
  primary_capability:'coding',
  adapter_status:'ready',
  requires_paid_api:false,
  native_adapter:{id:'repo-cloud-tools'}
};

const request=text=>new Request('https://jarvis.test/api/chat/send',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})
});

test('chat orchestrator does not execute repository skills for ordinary weather chat',async()=>{
  let cloudJobs=0;
  const core={fetch:async req=>{
    if(new URL(req.url).pathname==='/api/tools/cloud/jobs'){
      cloudJobs++;
      return new Response(JSON.stringify({job:{id:'should-not-run'}}),{headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{headers:{'content-type':'application/json'}});
  }};
  const result=await skillFirstResponse(core,request('selam almanyada hava durumu ne 1 haftalık'),{}, {},'selam almanyada hava durumu ne 1 haftalık',[repoSkill]);
  assert.equal(result,null);
  assert.equal(cloudJobs,0);
});

test('chat orchestrator still executes repository skill for explicit source-code search',async()=>{
  let cloudJobs=0;
  const core={fetch:async req=>{
    if(new URL(req.url).pathname==='/api/tools/cloud/jobs'){
      cloudJobs++;
      return new Response(JSON.stringify({job:{id:'job-12345678'}}),{headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{headers:{'content-type':'application/json'}});
  }};
  const text='github kaynak kodunda checksum fonksiyonunu bul';
  const result=await skillFirstResponse(core,request(text),{}, {},text,[repoSkill]);
  assert.equal(cloudJobs,1);
  assert.equal(result?.provider,'JARVIS Skill');
});
