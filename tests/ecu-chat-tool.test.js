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
  assert.deepEqual(calls,['/api/ecu/compute/status','/api/ecu/training/status','/api/ecu/research/status','/api/ecu/rulepacks/status']);
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


test('routes multiple ECU service requests from chat attachment into one composite job',async()=>{
  const calls=[];
  const req=new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      text:'Bu dosyada EGR off ve DPF off yap',
      attachments:[{name:'ori.bin',type:'application/octet-stream',base64:'AAECAwQ='}]
    })
  });
  const core={async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/ecu/files'){
      return Response.json({file:{id:'file-1'}},{status:201});
    }
    if(url.pathname==='/api/ecu/jobs/composite'){
      const body=await request.json();
      calls.push(body);
      return Response.json({job:{id:'job-composite',state:'QUEUED',operation:'multi_service_proposal'}},{status:202});
    }
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const response=await tool.fetch(req,{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(calls,[{
    fileId:'file-1',
    operations:['egr_off_proposal','dpf_off_proposal'],
  }]);
  assert.match(body.reply,/Tek MOD işi oluşturuldu/);
  assert.match(body.reply,/EGR OFF \+ DPF OFF/);
  assert.match(body.reply,/job-composite/);
});

test('teaches ORI MOD pair directly from two chat attachments',async()=>{
  const calls=[];
  const req=new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      text:'Bu ORI ve MOD dosyasından EGR off öğren',
      attachments:[
        {name:'car_ORI.bin',type:'application/octet-stream',base64:'AAECAwQ='},
        {name:'car_MOD.bin',type:'application/octet-stream',base64:'AAEJAwQ='},
      ]
    })
  });
  let uploadIndex=0;
  const core={async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/ecu/files'){
      uploadIndex+=1;
      calls.push(['upload',request.headers.get('x-ecu-filename')]);
      return Response.json({file:{id:'file-'+uploadIndex}},{status:201});
    }
    if(url.pathname==='/api/ecu/training/pairs'){
      const body=await request.json();
      calls.push(['pair',body]);
      return Response.json({pair:{id:'pair-1',state:'DISPATCHED',operationLabel:body.operationLabel}},{status:202});
    }
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const response=await tool.fetch(req,{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  const pairCall=calls.find(item=>item[0]==='pair');
  assert.deepEqual(pairCall[1],{
    oriFileId:'file-1',
    modFileId:'file-2',
    operationLabel:'egr_off',
  });
  assert.match(body.reply,/ORI \+ MOD öğrenme çifti alındı/);
  assert.match(body.reply,/EGR OFF/);
});


test('does not amplify evidence when backend reports cached ORI MOD pair',async()=>{
  const req=new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      text:'Stage 1 için bu ORI MOD çiftini öğret',
      attachments:[
        {name:'stock.bin',type:'application/octet-stream',base64:'AAECAwQ='},
        {name:'stage1.bin',type:'application/octet-stream',base64:'AAEJAwQ='},
      ]
    })
  });
  let uploads=0;
  const core={async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/ecu/files'){
      uploads+=1;
      return Response.json({file:{id:'file-'+uploads}},{status:201});
    }
    if(url.pathname==='/api/ecu/training/pairs'){
      return Response.json({pair:{id:'pair-old',state:'COMPLETE',cached:true}},{status:202});
    }
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const response=await tool.fetch(req,{},{});
  const body=await response.json();
  assert.match(body.reply,/tekrar kanıt sayılmadı/);
});


test('reports live service availability for latest ECU file',async()=>{
  const req=new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({text:'Bu ECU dosyasında hangi işlemler hazır?'}),
  });
  const core={async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/ecu/jobs'){
      return Response.json({jobs:[{
        id:'job-1',fileId:'file-1',state:'READY',
        result:{ecu_family:'EDC17C46'}
      }]});
    }
    if(url.pathname==='/api/ecu/services'){
      assert.equal(url.searchParams.get('fileId'),'file-1');
      return Response.json({
        identity:{ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1'},
        services:[
          {title:'Stage 1',state:'AVAILABLE'},
          {title:'EGR OFF',state:'LEARNING'},
          {title:'DPF OFF',state:'CONTEXT_VERIFY'},
        ],
      });
    }
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const response=await tool.fetch(req,{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.match(body.reply,/ECU: EDC17C46/);
  assert.match(body.reply,/Stage 1: Hazır/);
  assert.match(body.reply,/EGR OFF: Öğreniliyor/);
  assert.match(body.reply,/DPF OFF: Dosyada doğrulanacak/);
});


test('service availability prompt asks for ECU file when no analysis exists',async()=>{
  const req=new Request('https://jarvis.test/api/chat/send',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({text:'Hangi tuning seçenekleri hazır?'}),
  });
  const core={async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/ecu/jobs')return Response.json({jobs:[]});
    return new Response('delegate',{status:299});
  }};
  const tool=createEcuChatTool(core);
  const response=await tool.fetch(req,{},{});
  const body=await response.json();
  assert.match(body.reply,/Önce bir ECU\/BIN dosyası/);
});


test('ECU chat channel analyzes generic BIN directly',async()=>{const req=new Request('https://jarvis.test/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Bu dosyayı incele ve sonucu ver',channel:'ecu',attachments:[{name:'car.bin',type:'application/octet-stream',base64:'AAECAwQ='}]})});const calls=[];const core={async fetch(r){const u=new URL(r.url);calls.push(u.pathname);if(u.pathname==='/api/ecu/analyze-file')return Response.json({file:{id:'file-ecu'},job:{id:'job-ecu',state:'QUEUED',result:{}}},{status:202});return new Response('delegate',{status:299})}};const response=await createEcuChatTool(core).fetch(req,{},{});const body=await response.json();assert.deepEqual(calls,['/api/ecu/analyze-file']);assert.match(body.reply,/analiz başlatıldı/i);assert.match(body.reply,/job-ecu/);assert.equal(body.provider,'JARVIS ECU Brain');});
