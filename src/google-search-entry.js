import core from './smart-router-entry.js';

const te = new TextEncoder();
const td = new TextDecoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const json = (x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const q1 = (env,sql,...bind)=>env.DB.prepare(sql).bind(...bind).first();
const run = (env,sql,...bind)=>env.DB.prepare(sql).bind(...bind).run();
async function body(req){try{return await req.json()}catch{return{}}}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64u(s){s=String(s||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function masterKey(env){const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();if(raw.length<24)throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');let bytes=null;try{const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));if([16,24,32].includes(x.length))bytes=x}catch{}if(!bytes)bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function enc(env,v){const iv=crypto.getRandomValues(new Uint8Array(12)),k=await masterKey(env),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(String(v))));return b64u(iv)+'.'+b64u(ct)}
async function dec(env,v){const [a,b]=String(v||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b));return td.decode(pt)}
async function kvGet(env,key,fb=null){const r=await q1(env,'SELECT value FROM kv WHERE key=?',key);if(!r)return fb;try{return JSON.parse(r.value)}catch{return r.value}}
async function kvSet(env,key,val){await run(env,'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,JSON.stringify(val),now())}
async function authed(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);try{return !!(await r.json()).authenticated}catch{return false}}

async function cfg(env){const x=await kvGet(env,'google_search_cfg',null);if(!x?.blob)return null;try{return JSON.parse(await dec(env,x.blob))}catch{return null}}
async function setup(req,env){const b=await body(req),key=String(b.api_key||'').trim(),cx=String(b.cx||'').trim();if(!key||!cx)return json({error:'GOOGLE_SEARCH_API_KEY_AND_CX_REQUIRED'},400);await kvSet(env,'google_search_cfg',{blob:await enc(env,JSON.stringify({key,cx})),updated_at:now()});const test=await searchGoogle(env,'OpenAI',{num:1});return json({ok:true,test:!!test.length})}
async function status(env){const c=await cfg(env);return json({configured:!!c,provider:'Google Programmable Search JSON API'})}
async function searchGoogle(env,q,{num=10,start=1}={}){const c=await cfg(env);if(!c)throw Error('GOOGLE_SEARCH_NOT_CONFIGURED');const u=new URL('https://customsearch.googleapis.com/customsearch/v1');u.searchParams.set('key',c.key);u.searchParams.set('cx',c.cx);u.searchParams.set('q',String(q||''));u.searchParams.set('num',String(Math.min(10,Math.max(1,num))));u.searchParams.set('start',String(Math.max(1,start)));const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok){const t=await r.text().catch(()=> '');throw Error('GOOGLE_SEARCH_'+r.status+(t?':'+t.slice(0,240):''))}const x=await r.json();return (x.items||[]).map(i=>({title:i.title||'',url:i.link||'',snippet:i.snippet||'',displayLink:i.displayLink||'',source:'Google'}))}
async function apiSearch(req,env){const u=new URL(req.url),q=String(u.searchParams.get('q')||'').trim();if(!q)return json({error:'QUERY_REQUIRED'},400);const results=await searchGoogle(env,q,{num:Number(u.searchParams.get('num')||10)});return json({provider:'Google',results})}
function isGoogleIntent(text=''){return /(google'?da|google’da|google dan|google’dan|googledan|google ara|google.?da ara|google search)/i.test(String(text))}
async function saveMessage(env,role,content,provider=null){await run(env,'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)',uid(),role,String(content||''),provider,now())}
async function state(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/state',req.url),{headers:req.headers}),env,ctx);return r.json()}
async function fullHistory(env,limit=160){const r=await env.DB.prepare('SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?').bind(limit).all();return (r.results||[]).reverse()}
async function answerFromGoogle(env,query,results){const compact=results.slice(0,6).map((r,i)=>`[${i+1}] ${r.title}\n${r.snippet}\n${r.url}`).join('\n\n');if(env.AI){try{const prompt=`Kullanıcı sorusu: ${query}\n\nGoogle arama sonuçları:\n${compact}\n\nYalnız bu sonuçlara dayanarak Türkçe, kısa ve net cevap ver. Kaynakları [1], [2] diye belirt.`;const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt,max_tokens:700,temperature:0.2});const t=String(x?.response||x?.result?.response||x?.text||'').trim();if(t)return t}catch{}}return compact}
async function chatGoogle(req,env,ctx,text){const results=await searchGoogle(env,text,{num:8});await saveMessage(env,'user',text,null);const reply=await answerFromGoogle(env,text,results);await saveMessage(env,'assistant',reply,'Google Search');return json({reply,provider:'Google Search',results,state:await state(req,env,ctx),history:await fullHistory(env)})}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname,m=req.method;
    if(p==='/api/google-search/status'&&m==='GET'){
      if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
      return status(env);
    }
    if(p==='/api/google-search/setup'&&m==='POST'){
      if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
      try{return await setup(req,env)}catch(e){return json({error:e.message},400)}
    }
    if(p==='/api/google-search'&&m==='GET'){
      if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
      try{return await apiSearch(req,env)}catch(e){return json({error:e.message},400)}
    }
    if(p==='/api/research'&&m==='GET'){
      if(await cfg(env)){
        if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
        try{return await apiSearch(req,env)}catch{}
      }
    }
    if(p==='/api/chat/send'&&m==='POST'){
      const b=await body(req.clone()),text=String(b.text||'').trim();
      if(text&&isGoogleIntent(text)&&await cfg(env)){
        if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
        try{return await chatGoogle(req,env,ctx,text)}catch(e){return json({error:e.message},500)}
      }
    }
    return core.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};