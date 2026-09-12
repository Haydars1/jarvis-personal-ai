import core from './provider-entry.js';

const te = new TextEncoder();
const td = new TextDecoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const FAST_CF_MODEL = '@cf/zai-org/glm-4.7-flash';
const IMAGE_CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const json = (x, status=200) => new Response(JSON.stringify(x), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function body(req){ try { return await req.json(); } catch { return {}; } }
async function q(env, sql, ...bind){ return (await env.DB.prepare(sql).bind(...bind).all()).results || []; }
async function run(env, sql, ...bind){ return env.DB.prepare(sql).bind(...bind).run(); }

function b64u(bytes){ return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function fromB64u(s){ s=String(s||'').replaceAll('-','+').replaceAll('_','/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
async function masterKey(env){
  const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();
  if(raw.length<24) throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');
  let bytes=null;
  try { const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0)); if([16,24,32].includes(x.length))bytes=x; } catch {}
  if(!bytes) bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));
  return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt']);
}
async function dec(env,blob){ const [a,b]=String(blob||'').split('.'); if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB'); const k=await masterKey(env); const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b)); return td.decode(pt); }

function intent(text=''){
  const s=String(text).toLowerCase();
  if(/(video|reels?|klip|animasyon|hareketli|text.?to.?video|image.?to.?video)/i.test(s) && /(oluştur|yap|üret|hazırla|çiz|generate|create|göster)/i.test(s)) return 'video';
  if(/(resim|görsel|foto|fotoğraf|logo|amblem|emblem|poster|kapak|afiş|image)/i.test(s) && /(oluştur|çiz|yap|üret|hazırla|generate|create|göster)/i.test(s)) return 'image';
  if(/(kod|code|javascript|typescript|python|sql|debug|hata düzelt|refactor)/i.test(s)) return 'coding';
  if(/(araştır|internette|güncel|son durum|kaynak|webde|web'de|haber)/i.test(s)) return 'research';
  if(/(neden|analiz|karşılaştır|hesapla|mantık|planla|strateji)/i.test(s)) return 'reasoning';
  return 'chat';
}
function parseCaps(row){ try{return JSON.parse(row.capabilities||'[]')}catch{return[]} }
function limitation(text=''){
  return /(yeteneğim yok|yapamıyorum|yapamam|doğrudan .* yapamam|görsel .* yok|cannot (generate|create|draw)|i can.?t (generate|create|draw)|bu özelliğe sahip değilim)/i.test(String(text));
}

async function authed(req, env, ctx){
  const r=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await r.json()).authenticated}catch{return false}
}
async function history(env, limit=24){
  const rows=await q(env,'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?',limit);
  return rows.reverse();
}
async function fullHistory(env, limit=160){
  const rows=await q(env,'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?',limit);
  return rows.reverse();
}
async function saveMessage(env, role, content, provider=null){
  await run(env,'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)',uid(),role,String(content||''),provider,now());
  await run(env,'DELETE FROM chat_messages WHERE id IN (SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT -1 OFFSET 1000)');
}
async function state(req,env,ctx){
  const r=await core.fetch(new Request(new URL('/api/state',req.url),{headers:req.headers}),env,ctx);
  return r.json();
}
function messagesFor(hist,text){
  const system={role:'system',content:'Sen JARVIS kişisel asistansın. Türkçe yanıt ver. Kısa, doğrudan ve eylem odaklı ol. Kullanıcı bir şey yapılmasını istediğinde gereksiz izin isteme veya "istersen" deme. Modalite/yetenek eksikliği söyleme; görsel ve video işleri capability router tarafından ayrı yürütülür.'};
  const recent=(hist||[]).slice(-14).map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content}));
  return [system,...recent,{role:'user',content:text}];
}

async function cfText(env,messages){
  if(!env.AI) throw Error('CLOUDFLARE_AI_UNAVAILABLE');
  const prompt=messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n')+'\n\nASSISTANT:';
  const r=await env.AI.run(FAST_CF_MODEL,{prompt,max_tokens:900,temperature:0.25});
  const text=String(r?.response||r?.result?.response||r?.text||'').trim();
  if(!text) throw Error('CLOUDFLARE_AI_EMPTY');
  return {provider:'Cloudflare AI · GLM 4.7 Flash',text};
}
async function vaultRows(env,cap){
  const rows=await q(env,"SELECT * FROM credentials WHERE enabled=1 AND last_status='ok' ORDER BY priority ASC,created_at ASC");
  const supported=['gemini','groq','openrouter','nvidia','deepseek','mistral','xai','together','fireworks','openai-compatible'];
  return rows.filter(r=>{
    if(!supported.includes(String(r.provider||'').toLowerCase()))return false;
    const caps=parseCaps(r);
    if(cap==='coding')return caps.includes('coding')||caps.includes('reasoning')||caps.includes('chat');
    if(cap==='reasoning')return caps.includes('reasoning')||caps.includes('chat');
    return caps.includes('chat')||caps.length===0;
  });
}
async function callVault(env,c,messages,timeoutMs=8500){
  const p=String(c.provider||'').toLowerCase();
  const secret=await dec(env,c.encrypted_secret);
  if(p==='gemini'){
    const model=c.model||'gemini-2.5-flash';
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeoutMs);
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json'},body:JSON.stringify({contents:messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),systemInstruction:{parts:[{text:messages.find(x=>x.role==='system')?.content||''}]}})});
      if(!r.ok)throw Error('GEMINI_'+r.status);
      const x=await r.json(),text=x.candidates?.[0]?.content?.parts?.map(z=>z.text).join('')||'';
      if(!text)throw Error('GEMINI_EMPTY');
      return {provider:c.label||'Gemini',text};
    } finally {clearTimeout(timer)}
  }
  const base=String(c.endpoint||'').replace(/\/$/,'');
  if(!base)throw Error('NO_ENDPOINT');
  const model=String(c.model||'').trim();
  if(!model)throw Error('NO_MODEL');
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeoutMs);
  try{
    const headers={'content-type':'application/json','authorization':'Bearer '+secret,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'};
    const r=await fetch(base+'/chat/completions',{method:'POST',signal:ac.signal,headers,body:JSON.stringify({model,messages,temperature:0.25,max_tokens:900})});
    if(!r.ok)throw Error((p||'AI').toUpperCase()+'_'+r.status);
    const x=await r.json(),text=x.choices?.[0]?.message?.content||'';
    if(!text)throw Error((p||'AI').toUpperCase()+'_EMPTY');
    return {provider:c.label||c.provider,text};
  } finally {clearTimeout(timer)}
}
async function fastText(env,cap,messages){
  const rows=await vaultRows(env,cap);
  let settled=false;
  const jobs=[];
  const external=rows.slice(0,2);
  if(cap==='coding'||cap==='reasoning'){
    if(external[0]) jobs.push(callVault(env,external[0],messages));
    if(env.AI) jobs.push(sleep(450).then(()=>{if(settled)throw Error('SKIP'); return cfText(env,messages)}));
    if(external[1]) jobs.push(sleep(900).then(()=>{if(settled)throw Error('SKIP'); return callVault(env,external[1],messages)}));
  } else {
    if(env.AI) jobs.push(cfText(env,messages));
    if(external[0]) jobs.push(sleep(500).then(()=>{if(settled)throw Error('SKIP'); return callVault(env,external[0],messages)}));
    if(external[1]) jobs.push(sleep(1100).then(()=>{if(settled)throw Error('SKIP'); return callVault(env,external[1],messages)}));
  }
  if(!jobs.length) throw Error('NO_FAST_PROVIDER');
  const first=await Promise.any(jobs); settled=true;
  if(!limitation(first.text)) return first;
  for(const c of external){
    try{const alt=await callVault(env,c,messages,7000);if(!limitation(alt.text))return alt}catch{}
  }
  return first;
}
async function imageGenerate(env,text){
  if(!env.AI)throw Error('CLOUDFLARE_AI_UNAVAILABLE');
  const r=await env.AI.run(IMAGE_CF_MODEL,{prompt:String(text).slice(0,2048),steps:4});
  const image=r?.image;
  if(!image)throw Error('IMAGE_GENERATION_EMPTY');
  return {provider:'Cloudflare Workers AI · FLUX.1 schnell',dataURI:'data:image/jpeg;base64,'+image};
}
async function tryVideo(req,env,ctx,text){
  const payload={capability:'text-to-video',input:{prompt:text}};
  const r=await core.fetch(new Request(new URL('/api/higgsfield/generate',req.url),{method:'POST',headers:req.headers,body:JSON.stringify(payload)}),env,ctx);
  if(!r.ok) throw Error('HIGGSFIELD_'+r.status);
  return r.json();
}
async function synthetic(req,env,ctx,reply,provider,media=[]){
  await saveMessage(env,'assistant',reply,provider);
  return json({reply,provider,media,state:await state(req,env,ctx),history:await fullHistory(env)});
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname!=='/api/chat/send'||req.method!=='POST') return core.fetch(req,env,ctx);
    if(!(await authed(req,env,ctx))) return core.fetch(req,env,ctx);
    const b=await body(req.clone());
    const text=String(b.text||'').trim();
    if(!text)return core.fetch(req,env,ctx);
    const cap=intent(text);
    if(cap==='research') return core.fetch(req,env,ctx);
    await saveMessage(env,'user',text,null);
    try{
      if(cap==='image'){
        const img=await imageGenerate(env,text);
        return synthetic(req,env,ctx,'Görseli doğrudan oluşturdum.',img.provider,[{type:'image',src:img.dataURI,alt:text}]);
      }
      if(cap==='video'){
        try{
          const v=await tryVideo(req,env,ctx,text);
          const rid=v.request_id||v.id||v.requestId||null;
          return synthetic(req,env,ctx,rid?`Videoyu Higgsfield'a gönderdim. İş ID: ${rid}`:'Video üretimini Higgsfield üzerinden başlattım.','Higgsfield',[{type:'video-job',data:v}]);
        }catch{}
      }
      const hist=await history(env,20);
      const answer=await fastText(env,cap,messagesFor(hist.slice(0,-1),text));
      return synthetic(req,env,ctx,answer.text,answer.provider,[]);
    }catch(e){
      // If the fast router cannot complete the task, remove our pre-saved user row
      // only from this exact request window and let the proven core path handle it.
      try{await run(env,"DELETE FROM chat_messages WHERE id=(SELECT id FROM chat_messages WHERE role='user' AND content=? ORDER BY created_at DESC LIMIT 1)",text)}catch{}
      return core.fetch(req,env,ctx);
    }
  },
  async scheduled(event,env,ctx){ if(core.scheduled)return core.scheduled(event,env,ctx); }
};
