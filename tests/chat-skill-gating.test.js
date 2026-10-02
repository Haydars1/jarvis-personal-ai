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

test('queued repository cloud job is not returned as a completed chat answer',async()=>{
  let cloudJobs=0;
  const core={fetch:async req=>{
    const path=new URL(req.url).pathname;
    if(path==='/api/tools/cloud/jobs'){
      cloudJobs++;
      return new Response(JSON.stringify({job:{id:'job-queued',status:'queued'}}),{status:201,headers:{'content-type':'application/json'}});
    }
    if(path==='/api/tools/cloud/jobs/job-queued'){
      return new Response(JSON.stringify({job:{id:'job-queued',status:'queued'},answer:null}),{headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{headers:{'content-type':'application/json'}});
  }};
  const text='github kaynak kodunda checksum fonksiyonunu bul';
  const result=await skillFirstResponse(core,request(text),{}, {},text,[repoSkill]);
  assert.equal(cloudJobs,1);
  assert.equal(result,null);
});

test('completed repository cloud job returns its concrete answer',async()=>{
  const core={fetch:async req=>{
    const path=new URL(req.url).pathname;
    if(path==='/api/tools/cloud/jobs'){
      return new Response(JSON.stringify({job:{id:'job-done',status:'queued'}}),{status:201,headers:{'content-type':'application/json'}});
    }
    if(path==='/api/tools/cloud/jobs/job-done'){
      return new Response(JSON.stringify({job:{id:'job-done',status:'completed'},answer:'checksum helper src/checksum.js:42 satırında bulundu'}),{headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{headers:{'content-type':'application/json'}});
  }};
  const text='github kaynak kodunda checksum fonksiyonunu bul';
  const result=await skillFirstResponse(core,request(text),{}, {},text,[repoSkill]);
  assert.equal(result?.provider,'JARVIS Skill');
  assert.match(result?.reply||'',/checksum helper/);
});

test('failed first repository skill falls through to the next executable skill',async()=>{
  const second={...repoSkill,id:'second',repo:'ffmpeg/ffmpeg'};
  const posted=[];
  const core={fetch:async req=>{
    const path=new URL(req.url).pathname;
    if(path==='/api/tools/cloud/jobs'){
      const body=await req.clone().json();
      posted.push(body.repo);
      const id=body.repo===repoSkill.repo?'job-fail':'job-second';
      return new Response(JSON.stringify({job:{id,status:'queued'}}),{status:201,headers:{'content-type':'application/json'}});
    }
    if(path==='/api/tools/cloud/jobs/job-fail'){
      return new Response(JSON.stringify({job:{id:'job-fail',status:'failed',error:'SOURCE_SEARCH_FAILED'},answer:null}),{headers:{'content-type':'application/json'}});
    }
    if(path==='/api/tools/cloud/jobs/job-second'){
      return new Response(JSON.stringify({job:{id:'job-second',status:'completed'},answer:'ikinci skill gerçek sonucu'}),{headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{headers:{'content-type':'application/json'}});
  }};
  const text='github kaynak kodunda checksum fonksiyonunu bul';
  const result=await skillFirstResponse(core,request(text),{}, {},text,[repoSkill,second]);
  assert.deepEqual(posted,[repoSkill.repo,second.repo]);
  assert.equal(result?.reply,'ikinci skill gerçek sonucu');
});
