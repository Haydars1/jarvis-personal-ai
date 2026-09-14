import core from './media-rescue-entry.js';

const te=new TextEncoder(),td=new TextDecoder();
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const q=async(env,sql,...bind)=>(await env.DB.prepare(sql).bind(...bind).all()).results||[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function deadline(p,ms,fallback){return Promise.race([Promise.resolve(p).catch(()=>fallback),sleep(ms).then(()=>fallback)])}

function wantsResearch(text=''){return /(araştır|bak|bul|karşılaştır|güncel|son durum|kaynak|google|internette|webde|web'de|hangi|nereden|nasıl yapılır|video|foto|fotoğraf|şema|örnek|fiyat|haber)/i.test(String(text))}
function wantsTools(text=''){return /(araç|tool|ai bul|yapay zeka bul|bunu yapacak|entegre et|sisteme ekle|otomasyon|üret|oluştur)/i.test(String(text))}
function taskKind(text=''){
  const s=String(text).toLowerCase();
  if(/(kod|code|javascript|typescript|python|sql|github|debug|hata|refactor|api|worker|cloudflare)/i.test(s))return'coding';
  if(/(hesapla|analiz|neden|karşılaştır|strateji|plan|mantık|teşhis|diagnose|karar)/i.test(s))return'reasoning';
  if(/(foto|fotoğraf|resim|görsel|image|ekran görüntüsü|şema|diagram)/i.test(s))return'vision';
  if(/(reels|video|animasyon|klip|text.?to.?video|image.?to.?video)/i.test(s))return'video';
  if(/(metin yaz|caption|açıklama|başlık|senaryo|script|reklam metni|yaratıcı|creative)/i.test(s))return'creative';
  if(wantsResearch(s))return'research';
  return'chat';
}
function complexity(text=''){const s=String(text);let n=0;if(s.length>220)n++;if(/(ve|sonra|ayrıca|hem|bir de|karşılaştır|araştır|analiz)/i.test(s))n++;if((s.match(/[?.!,;]/g)||[]).length>3)n++;return n>=2?'complex':'simple'}
function caps(row){try{return JSON.parse(row.capabilities||'[]')}catch{return[]}}
function providerBias(provider,kind){
  const p=String(provider||'').toLowerCase();
  const map={
    coding:{nvidia:26,deepseek:25,xai:20,mistral:18,openrouter:16,together:14,fireworks:14,gemini:17,groq:15},
    reasoning:{deepseek:26,nvidia:24,xai:22,gemini:20,mistral:18,openrouter:16,together:14,fireworks:14},
    research:{gemini:23,xai:22,openrouter:18,nvidia:16,deepseek:15,mistral:14},
    vision:{gemini:27,nvidia:24,xai:18,openrouter:16},
    creative:{gemini:21,mistral:20,xai:19,openrouter:18,nvidia:16},
    chat:{nvidia:22,groq:21,gemini:20,mistral:18,xai:18,deepseek:17,openrouter:16}
  };
  return map[kind]?.[p]||10;
}
async function expertPool(env,kind){
  const rows=await q(env,"SELECT c.*,m.avg_latency_ms,m.samples,m.successes,m.failures FROM credentials c LEFT JOIN provider_metrics m ON m.provider=c.label OR m.provider=c.provider WHERE c.enabled=1 AND c.last_status='ok' ORDER BY c.priority ASC");
  const supported=new Set(['gemini','nvidia','deepseek','mistral','xai','together','fireworks','groq','openrouter','openai-compatible']);
  const need=kind==='coding'?'coding':kind==='reasoning'?'reasoning':kind==='vision'?'vision':'chat';
  return rows.filter(r=>supported.has(String(r.provider||'').toLowerCase())).map(r=>{
    const cs=caps(r);let score=providerBias(r.provider,kind);
    if(cs.includes(need))score+=30;else if(cs.includes('reasoning')&&need==='coding')score+=14;else if(cs.includes('chat'))score+=8;
    const samples=Number(r.samples||0),succ=Number(r.successes||0),lat=Number(r.avg_latency_ms||0);
    if(samples>=3)score+=Math.round((succ/Math.max(1,samples))*12);
    if(lat&&lat<1800)score+=9;else if(lat>4500)score-=12;
    score-=Math.min(12,Number(r.priority||100)/20);
    return{...r,score};
  }).sort((a,b)=>b.score-a.score);
}
function b64uToBytes(s){s=String(s||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function masterKey(env){const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();if(raw.length<24)throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');let bytes=null;try{const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));if([16,24,32].includes(x.length))bytes=x}catch{}if(!bytes)bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt'])}
async function dec(env,v){const[a,b]=String(v||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64uToBytes(a)},k,b64uToBytes(b));return td.decode(pt)}
async function callExpert(env,c,text,kind){
  const p=String(c.provider||'').toLowerCase(),secret=await dec(env,c.encrypted_secret);
  const system=`Sen JARVIS'in arka plandaki ${kind} uzmanısın. Kullanıcıya hitap etme; JARVIS'e kısa, doğrulanabilir uzman notları ver. Gereksiz meta açıklama ve iç düşünce yazma.`;
  if(p==='gemini'){
    const model=c.model||'gemini-2.5-flash',ac=new AbortController(),tm=setTimeout(()=>ac.abort(),3200);
    try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{maxOutputTokens:500,temperature:.15}})});if(!r.ok)throw Error('GEMINI_'+r.status);const x=await r.json();return String(x.candidates?.[0]?.content?.parts?.map(z=>z.text).join('')||'').trim()}finally{clearTimeout(tm)}
  }
  const base=String(c.endpoint||(p==='nvidia'?'https://integrate.api.nvidia.com/v1':'')).replace(/\/$/,'');if(!base||!c.model)throw Error('EXPERT_CONFIG_MISSING');
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),3200);
  try{const r=await fetch(base+'/chat/completions',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json',authorization:'Bearer '+secret,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'},body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},{role:'user',content:text}],temperature:.15,max_tokens:500})});if(!r.ok)throw Error('EXPERT_'+p+'_'+r.status);const x=await r.json();return String(x.choices?.[0]?.message?.content||'').trim()}finally{clearTimeout(tm)}
}
async function getExperts(env,text){
  const kind=taskKind(text),pool=await expertPool(env,kind),count=complexity(text)==='complex'?2:1,out=[];
  const picks=pool.slice(0,count);
  const settled=await Promise.all(picks.map(async c=>({c,value:await deadline(callExpert(env,c,text,kind),2600,'')})));
  for(const x of settled)if(x.value)out.push({provider:x.c.label||x.c.provider,kind,text:x.value,score:Math.round(x.c.score)});
  return{kind,picks:picks.map(x=>({provider:x.label||x.provider,score:Math.round(x.score)})),answers:out};
}
async function callJson(coreReq,env,ctx){const r=await core.fetch(coreReq,env,ctx);if(!r.ok)return null;try{return await r.json()}catch{return null}}
async function research(req,env,ctx,text){const u=new URL('/api/google-search',req.url);u.searchParams.set('q',text);u.searchParams.set('num','5');return(await deadline(callJson(new Request(u,{headers:req.headers}),env,ctx),2200,null))?.results||[]}
async function tools(req,env,ctx,text){const u=new URL('/api/tools/discover',req.url);u.searchParams.set('capability',text);return(await deadline(callJson(new Request(u,{headers:req.headers}),env,ctx),1800,null))?.results||[]}
async function synthesize(env,text,base,researchRows,toolRows,experts){
  if(!env.AI)return base;
  const web=researchRows.slice(0,5).map((r,i)=>`[${i+1}] ${r.title}\n${r.snippet||''}\n${r.url||''}`).join('\n\n');
  const toolsText=toolRows.slice(0,4).map((r,i)=>`[T${i+1}] ${r.title}\n${r.snippet||''}\n${r.url||''}`).join('\n\n');
  const expertText=(experts.answers||[]).map((e,i)=>`[AI${i+1}] ${e.text}`).join('\n\n');
  const run=env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`Sen JARVIS'sin. Tek birleşik Türkçe cevap ver. Mevcut cevap zaten iyiyse bozma; yalnız uzman/web/araç verisi somut katkı sağlıyorsa ekle. Gereksiz meta açıklama yapma.\n\nKULLANICI:\n${text}\n\nMEVCUT CEVAP:\n${String(base||'').slice(0,5000)}\n\nUZMAN:\n${expertText}\n\nWEB:\n${web}\n\nARAÇLAR:\n${toolsText}`,max_tokens:900,temperature:.15});
  try{const x=await deadline(run,2200,null);if(!x)return base;return String(x?.response||x?.result?.response||x?.text||base).trim()||base}catch{return base}
}
function needsOrchestration(text){const k=taskKind(text);return complexity(text)==='complex'||['coding','reasoning','research','vision','video'].includes(k)||wantsTools(text)}
function expertFallback(text,experts){const a=experts?.answers?.[0]?.text;return a?{reply:a,history:[{role:'user',content:text},{role:'assistant',content:a,provider:'JARVIS'}],provider:'JARVIS',trace:[{kind:'fallback',label:'JARVIS yedek uzman',value:'Ana yanıt yolu başarısız olduğu için hızlı yedek yanıt kullanıldı'}]}:null}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);if(u.pathname!=='/api/chat/send'||req.method!=='POST')return core.fetch(req,env,ctx);
    let text='';try{text=String((await req.clone().json())?.text||'').trim()}catch{}

    // Normal sohbetlerde ek AI turu açma: doğrudan ana yanıtı döndür.
    if(!text||!needsOrchestration(text))return core.fetch(req,env,ctx);

    const started=Date.now();
    const basePromise=deadline(core.fetch(req,env,ctx),8500,null);
    const expertPromise=getExperts(env,text).catch(()=>({kind:taskKind(text),picks:[],answers:[]}));
    const webPromise=wantsResearch(text)?research(req,env,ctx,text).catch(()=>[]):Promise.resolve([]);
    const toolPromise=wantsTools(text)?tools(req,env,ctx,text).catch(()=>[]):Promise.resolve([]);
    const [baseRes,experts,webRows,toolRows]=await Promise.all([basePromise,expertPromise,webPromise,toolPromise]);

    // Ana sağlayıcı hata verirse kullanıcıya ham hata göstermek yerine uzman havuzundan cevap ver.
    if(!baseRes||!baseRes.ok){const fb=expertFallback(text,experts);if(fb){fb.trace.push({kind:'timing',label:'JARVIS yanıt süresi',value:`${Date.now()-started} ms`});return json(fb,200)}return baseRes||json({error:'JARVIS_TEMPORARY_UNAVAILABLE',message:'JARVIS şu an yanıt yolunu yeniliyor. Lütfen aynı mesajı tekrar gönder.'},503)}

    let x;try{x=await baseRes.clone().json()}catch{return baseRes}
    if(webRows.length&&!x.results)x.results=webRows;if(toolRows.length&&!x.tools)x.tools=toolRows;

    // Sentez zorunlu değil: 2.2 sn içinde bitmezse ana cevabı anında kullan.
    if(experts.answers.length||webRows.length||toolRows.length)x.reply=await synthesize(env,text,x.reply,webRows,toolRows,experts);
    x.trace=[...(Array.isArray(x.trace)?x.trace:[]),...(experts.picks.length?[{kind:'pool',label:'JARVIS uzman havuzu',value:`${experts.kind}: `+experts.picks.map(p=>`${p.provider} (${p.score})`).join(' + ')}]:[]),...(webRows.length?[{kind:'search',label:'JARVIS araştırması',value:`${webRows.length} web sonucu incelendi`}]:[]),...(toolRows.length?[{kind:'tool',label:'JARVIS araç seçimi',value:`${toolRows.length} araç değerlendirildi`}]:[]),{kind:'timing',label:'JARVIS yanıt süresi',value:`${Date.now()-started} ms`}];
    x.provider='JARVIS';if(Array.isArray(x.history))x.history=x.history.map(m=>m?.role==='assistant'?{...m,provider:'JARVIS'}:m);return json(x,baseRes.status);
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};