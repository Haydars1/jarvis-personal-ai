function json(payload,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

async function readBody(req){
  try{return await req.clone().json();}catch{return {};}
}
async function readText(req){
  const body=await readBody(req);
  return String(body?.text||'').trim();
}
function tuningIntent(text=''){
  return /\bstage\s*1\b|\bstage1\b|chip\s*tun|\btuning\b|remap|performans.*yap|mod.*dosya/i.test(String(text||''));
}
function binaryAttachment(body={}){
  return (Array.isArray(body.attachments)?body.attachments:[]).find(file=>/\.bin$/i.test(String(file?.name||''))||/octet-stream|macbinary/i.test(String(file?.type||'')));
}
function b64Bytes(value=''){
  const raw=atob(String(value||''));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;
}
async function startStage1(core,req,env,ctx,attachment){
  const bytes=b64Bytes(attachment.base64||'');
  const headers=new Headers(req.headers);
  headers.set('content-type',attachment.type||'application/octet-stream');
  headers.set('x-ecu-filename',encodeURIComponent(String(attachment.name||'original.bin')));
  const upload=await core.fetch(new Request(new URL('/api/ecu/files',req.url),{method:'POST',headers,body:bytes}),env,ctx);
  if(!upload.ok)return null;
  const uploaded=await upload.json();
  const fileId=uploaded?.file?.id;
  if(!fileId)return null;
  const jobHeaders=new Headers(req.headers);jobHeaders.set('content-type','application/json');
  const jobRes=await core.fetch(new Request(new URL('/api/ecu/jobs',req.url),{method:'POST',headers:jobHeaders,body:JSON.stringify({fileId,operation:'stage1_proposal'})}),env,ctx);
  if(!jobRes.ok)return null;
  return {file:uploaded.file,job:(await jobRes.json())?.job};
}

async function readJson(core,url,req,env,ctx){
  const r=await core.fetch(new Request(new URL(url,req.url),{method:'GET',headers:req.headers}),env,ctx);
  if(!r.ok)return null;
  try{return await r.json();}catch{return null;}
}

function chatPayload(text,reply){
  return {
    reply,
    provider:'JARVIS ECU Brain',
    history:[
      {role:'user',content:text},
      {role:'assistant',content:reply,provider:'JARVIS ECU Brain'},
    ],
    trace:[{kind:'tool',label:'ECU Brain',value:'Deterministik ECU durum aracı'}],
  };
}

function isEcuText(text){
  const t=text.toLowerCase();
  return /\becu\b|ecu brain|motor beyni|beyin dosya|\bstage\s*1\b|\bstage1\b|chip\s*tun|\btuning\b|remap/.test(t);
}

function wantsLatestAnalysis(text){
  const t=text.toLowerCase();
  return /analiz|dosya|job|iş/.test(t)&&/durum|son|ne oldu|bitti/.test(t);
}

function wantsSystemStatus(text){
  const t=text.toLowerCase();
  return /durum|status|öğren|eğitim|araştır|compute|worker|model/.test(t);
}

export function createEcuChatTool(core){
  if(!core?.fetch)throw new Error('ECU_CHAT_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url);
      if(url.pathname!=='/api/chat/send'||req.method!=='POST')return core.fetch(req,env,ctx);
      const body=await readBody(req);
      const text=String(body?.text||'').trim();
      const attachment=binaryAttachment(body);
      if(tuningIntent(text)&&attachment){
        const started=await startStage1(core,req,env,ctx,attachment);
        if(!started)return json(chatPayload(text,'ECU Brain dosyayı Stage 1 akışına alamadı. Depolama/compute bağlantısını kontrol et.'));
        const job=started.job||{};
        const reply=`ORI dosyası ECU Brain'e alındı. Stage 1 işi oluşturuldu: ${job.id||'bilinmiyor'}. Durum: ${job.state||'QUEUED'}. Sistem doğrulanmış map/rulepack ve checksum geçerse MOD dosyayı READY yapacak.`;
        return json(chatPayload(text,reply));
      }
      if(!text||!isEcuText(text))return core.fetch(req,env,ctx);

      if(wantsLatestAnalysis(text)){
        const jobs=await readJson(core,'/api/ecu/jobs?limit=1',req,env,ctx);
        const job=jobs?.jobs?.[0];
        if(!job)return json(chatPayload(text,'Henüz kayıtlı bir ECU analiz işi yok.'));
        const family=job.result?.ecu_family||'UNKNOWN';
        const confidence=Math.round(Number(job.result?.confidence||0)*100);
        const mapCount=Array.isArray(job.result?.map_candidates)?job.result.map_candidates.length:0;
        const reply=`Son ECU işi: ${job.state}. ECU ailesi: ${family}. Güven: %${confidence}. ${mapCount} map adayı bulundu.`;
        return json(chatPayload(text,reply));
      }

      if(wantsSystemStatus(text)){
        const [compute,training,research,rulepacks]=await Promise.all([
          readJson(core,'/api/ecu/compute/status',req,env,ctx),
          readJson(core,'/api/ecu/training/status',req,env,ctx),
          readJson(core,'/api/ecu/research/status',req,env,ctx),
          readJson(core,'/api/ecu/rulepacks/status',req,env,ctx),
        ]);
        const computeText=compute?.preferred==='local'?'Laptop worker aktif':
          compute?.preferred==='cloud-container'?'Cloud container hazır':
          compute?.preferred==='cloud'?'Cloud worker hazır':'Compute bekliyor';
        const verified=Number(training?.verifiedExamples||0);
        const required=Number(training?.minVerifiedExamples||0);
        const sources=Number(research?.counts?.sources||0);
        const verifiedClaims=Number(research?.counts?.verified_claims||0);
        const verifiedChanges=Number(training?.verifiedChangeEvidence||0);
        const model=training?.productionModel?.version||'baseline';
        const rulepackText=rulepacks?.production?.version?`production rulepack ${rulepacks.production.version}`:rulepacks?.latest?.version?`kanıt adayı ${rulepacks.latest.version}`:'rulepack kanıtı yetersiz';
        const reply=`ECU Brain durumu: ${computeText}. Doğrulanmış map verisi: ${verified}/${required}. ORI/MOD değişim kanıtı: ${verifiedChanges}. Aktif model: ${model}. Rulepack: ${rulepackText}. Araştırma kaynağı: ${sources}; doğrulanmış claim: ${verifiedClaims}.`;
        return json(chatPayload(text,reply));
      }

      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){
      return core.scheduled?.(event,env,ctx);
    },
  };
}
