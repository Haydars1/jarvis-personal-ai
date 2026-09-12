import core from './google-search-entry.js';

const te=new TextEncoder(),td=new TextDecoder();
const now=()=>Date.now(),uid=()=>crypto.randomUUID();
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function body(req){try{return await req.json()}catch{return{}}}
async function q(env,sql,...bind){return (await env.DB.prepare(sql).bind(...bind).all()).results||[]}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64u(s){s=String(s||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function masterKey(env){const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();if(raw.length<24)throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');let bytes=null;try{const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));if([16,24,32].includes(x.length))bytes=x}catch{}if(!bytes)bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt'])}
async function dec(env,v){const [a,b]=String(v||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b));return td.decode(pt)}
async function authed(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);try{return !!(await r.json()).authenticated}catch{return false}}
async function state(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/state',req.url),{headers:req.headers}),env,ctx);return r.json()}
async function history(env,limit=160){const rows=await q(env,'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?',limit);return rows.reverse()}
async function save(env,role,content,provider=null){await run(env,'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)',uid(),role,String(content||''),provider,now())}

function toolIntent(text=''){return /(ai aracı|araç bul|tool bul|plugin bul|hangi ai|hangi araç|bunu yapacak ai|bunu yapabilen ai|uygun ai|sisteme ekle|jarvis.?e ekle|entegre et)/i.test(String(text))}
function addIntent(text=''){return /(sisteme ekle|jarvis.?e ekle|entegre et|bağla|kur)/i.test(String(text))}
function limitation(text=''){return /(yeteneğim yok|yapamıyorum|yapamam|bu özelliğe sahip değilim|cannot (generate|create|do)|i can.?t (generate|create|do))/i.test(String(text))}
function inferCapability(text=''){
  const s=String(text).toLowerCase();
  if(/video|reels|klip/.test(s))return 'video-generation';
  if(/görsel|resim|foto|image|logo|poster/.test(s))return 'image-generation';
  if(/müzik|music|şarkı|beat|ses/.test(s))return 'music-generation';
  if(/voice|seslendir|tts/.test(s))return 'tts';
  if(/kod|code|yazılım/.test(s))return 'coding';
  return String(text).slice(0,180);
}
async function discover(req,env,ctx,text){
  const cap=inferCapability(text);
  const r=await core.fetch(new Request(new URL('/api/tools/discover?capability='+encodeURIComponent(cap),req.url),{headers:req.headers}),env,ctx);
  if(!r.ok)throw Error('TOOL_DISCOVERY_'+r.status);
  const x=await r.json();
  const tools=(x.results||[]).slice(0,5);
  let queued=false,change=null;
  if(addIntent(text)&&tools.length){
    try{
      const top=tools[0];
      const payload={request:`${text}\n\nAI Tool Scout sonucu: ${top.title||''} ${top.url||''}. Önce mevcut provider/capability sistemine uyumunu kontrol et; resmi API ve auth yöntemini kullan; uydurma endpoint/model kullanma; test edip güvenli şekilde entegre et.`};
      const sr=await core.fetch(new Request(new URL('/api/self-update/request',req.url),{method:'POST',headers:req.headers,body:JSON.stringify(payload)}),env,ctx);
      if(sr.ok){change=await sr.json().catch(()=>null);queued=true}
    }catch{}
  }
  const lines=tools.map((t,i)=>`${i+1}. ${t.title||'Araç'}${t.url?' — '+t.url:''}`).join('\n');
  const reply=tools.length?(queued?'Uygun aracı buldum ve entegrasyon isteğini Self Update hattına gönderdim.\n\n':'Uygun araçları buldum.\n\n')+lines:'Bu iş için uygun bir araç bulamadım.';
  await save(env,'user',text,null);await save(env,'assistant',reply,'AI Tool Scout');
  return json({reply,provider:'AI Tool Scout',tools,change,state:await state(req,env,ctx),history:await history(env)});
}

function cleanAttachments(items){return (Array.isArray(items)?items:[]).filter(x=>x&&/^image\//i.test(String(x.type||''))&&String(x.base64||'').length>20).slice(0,3).map(x=>({name:String(x.name||'image'),type:String(x.type||'image/jpeg'),base64:String(x.base64||'')}))}
async function geminiVision(env,c,text,images){
  const secret=await dec(env,c.encrypted_secret),model=c.model||'gemini-2.5-flash';
  const parts=[{text:text||'Bu görseli ayrıntılı şekilde incele ve Türkçe cevap ver.'},...images.map(i=>({inline_data:{mime_type:i.type,data:i.base64}}))];
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),9000);
  try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}]})});if(!r.ok)throw Error('GEMINI_VISION_'+r.status);const x=await r.json(),out=x.candidates?.[0]?.content?.parts?.map(p=>p.text).filter(Boolean).join('')||'';if(!out)throw Error('GEMINI_VISION_EMPTY');return {provider:'Gemini Vision',text:out}}finally{clearTimeout(tm)}}
async function nvidiaModels(base,secret){const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),1800);try{const r=await fetch(base+'/models',{signal:ac.signal,headers:{authorization:'Bearer '+secret,accept:'application/json'}});if(!r.ok)return[];const x=await r.json();return (x.data||x.models||[]).map(m=>String(m.id||m.name||'')).filter(Boolean)}catch{return[]}finally{clearTimeout(tm)}}
function visionScore(id){const s=String(id).toLowerCase();let n=0;if(/vision|vlm|multimodal/.test(s))n+=120;if(/kimi/.test(s))n+=90;if(/muse/.test(s))n+=85;if(/cosmos/.test(s))n+=80;if(/nemotron/.test(s)&&/vision|vl/.test(s))n+=75;return n}
async function nvidiaVision(env,c,text,images){
  const secret=await dec(env,c.encrypted_secret),base=String(c.endpoint||'https://integrate.api.nvidia.com/v1').replace(/\/$/,'');
  const ids=await nvidiaModels(base,secret),ranked=ids.map(id=>({id,score:visionScore(id)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.id);
  const candidates=[...new Set([...ranked,String(c.model||'').trim()].filter(Boolean))].slice(0,4);
  let last='NVIDIA_VISION_NO_MODEL';
  for(const model of candidates){const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),8500);try{const content=[{type:'text',text:text||'Bu görseli ayrıntılı şekilde incele ve Türkçe cevap ver.'},...images.map(i=>({type:'image_url',image_url:{url:`data:${i.type};base64,${i.base64}`}}))];const r=await fetch(base+'/chat/completions',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','authorization':'Bearer '+secret},body:JSON.stringify({model,messages:[{role:'user',content}],temperature:0.2,max_tokens:900})});if(!r.ok){last='NVIDIA_VISION_'+r.status;continue}const x=await r.json(),out=x.choices?.[0]?.message?.content||'';if(out)return{provider:'NVIDIA NIM Vision · '+model.split('/').pop(),text:out}}catch(e){last=e?.message||String(e)}finally{clearTimeout(tm)}}
  throw Error(last);
}
async function vision(req,env,ctx,text,items){
  const images=cleanAttachments(items);if(!images.length)throw Error('IMAGE_ATTACHMENT_REQUIRED');
  const note=(text||'Bu fotoğrafı incele')+'\n'+images.map(i=>`[Fotoğraf: ${i.name}]`).join(' ');
  const rows=await q(env,"SELECT * FROM credentials WHERE enabled=1 AND last_status='ok' AND provider IN ('gemini','nvidia') ORDER BY priority ASC,created_at ASC");
  let answer=null,last='VISION_PROVIDER_NOT_CONNECTED';
  for(const c of rows){try{answer=String(c.provider).toLowerCase()==='gemini'?await geminiVision(env,c,text,images):await nvidiaVision(env,c,text,images);if(answer)break}catch(e){last=e?.message||String(e)}}
  if(!answer)throw Error(last);
  await save(env,'user',note,null);await save(env,'assistant',answer.text,answer.provider);
  return json({reply:answer.text,provider:answer.provider,state:await state(req,env,ctx),history:await history(env)});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/chat/send'&&req.method==='POST'){
      if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
      const b=await body(req.clone()),text=String(b.text||'').trim(),attachments=cleanAttachments(b.attachments);
      if(attachments.length){try{return await vision(req,env,ctx,text,attachments)}catch(e){return json({error:e.message},400)}}
      if(text&&toolIntent(text)){try{return await discover(req,env,ctx,text)}catch{}}
      const r=await core.fetch(req,env,ctx);
      if(r.ok){try{const x=await r.clone().json();if(text&&limitation(x?.reply||'')){try{return await discover(req,env,ctx,text)}catch{}}}catch{}}
      return r;
    }
    return core.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};
