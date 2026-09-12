import core from './worker-entry.js';

const te = new TextEncoder();
const td = new TextDecoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const GRAPH = 'https://graph.facebook.com/v24.0';
const FB_DIALOG = 'https://www.facebook.com/v24.0/dialog/oauth';
const META_SCOPES = ['pages_show_list','pages_read_engagement','pages_manage_posts','instagram_basic','instagram_content_publish'];
const YT_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.upload'];
const json = (x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const txt = (s,status=200)=>new Response(s,{status,headers:{'content-type':'text/plain; charset=utf-8'}});
const q1 = (env,sql,...bind)=>env.DB.prepare(sql).bind(...bind).first();
const qall = async(env,sql,...bind)=>(await env.DB.prepare(sql).bind(...bind).all()).results||[];
const run = (env,sql,...bind)=>env.DB.prepare(sql).bind(...bind).run();

function cookies(req){return Object.fromEntries((req.headers.get('cookie')||'').split(';').filter(Boolean).map(x=>{const [k,...v]=x.trim().split('=');return [k,decodeURIComponent(v.join('='))]}))}
async function hmac(secret,data){const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',k,te.encode(data))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function sign(secret,p){const b=btoa(JSON.stringify(p)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return `${b}.${await hmac(secret,b)}`}
async function verify(secret,t){try{const [b,s]=String(t||'').split('.');if(!b||!s||await hmac(secret,b)!==s)return null;const p=JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/')));return p.exp>now()?p:null}catch{return null}}
async function authed(req,env){const c=cookies(req);return !!(await verify(env.JARVIS_SECRET||'CHANGE_ME',c.jarvis_session))}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64u(s){s=String(s||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function masterKey(env){const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();if(raw.length<24)throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');let bytes=null;try{const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));if([16,24,32].includes(x.length))bytes=x}catch{}if(!bytes)bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function enc(env,v){const iv=crypto.getRandomValues(new Uint8Array(12)),k=await masterKey(env),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(String(v))));return b64u(iv)+'.'+b64u(ct)}
async function dec(env,v){const [a,b]=String(v||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b));return td.decode(pt)}
async function kvGet(env,key,fb=null){const r=await q1(env,'SELECT value FROM kv WHERE key=?',key);if(!r)return fb;try{return JSON.parse(r.value)}catch{return r.value}}
async function kvSet(env,key,val){await run(env,'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,JSON.stringify(val),now())}
async function body(req){try{return await req.json()}catch{return{}}}

async function metaApp(env){const x=await kvGet(env,'meta_oauth_app',null);if(!x?.blob)return null;try{return JSON.parse(await dec(env,x.blob))}catch{return null}}
async function metaSetup(req,env){const b=await body(req),appId=String(b.app_id||'').trim(),appSecret=String(b.app_secret||'').trim();if(!appId||!appSecret)return json({error:'META_APP_ID_AND_SECRET_REQUIRED'},400);await kvSet(env,'meta_oauth_app',{blob:await enc(env,JSON.stringify({appId,appSecret})),updated_at:now()});return json({ok:true,redirect:new URL(req.url).origin+'/api/meta/callback'})}
async function metaConnect(req,env){const app=await metaApp(env);const origin=new URL(req.url).origin,redirect=origin+'/api/meta/callback';if(!app)return json({error:'META_APP_SETUP_REQUIRED',setupRequired:true,redirect},400);const state=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'meta-oauth',exp:now()+600000});const url=FB_DIALOG+'?'+new URLSearchParams({client_id:app.appId,redirect_uri:redirect,response_type:'code',scope:META_SCOPES.join(','),state});return json({url,redirect})}
async function saveMetaCredential(env,page){const t=now(),existing=await q1(env,"SELECT id FROM credentials WHERE provider='meta' ORDER BY created_at DESC LIMIT 1"),blob=await enc(env,page.access_token),ig=page.instagram_business_account?.id||null,meta=JSON.stringify({page_name:page.name||'',facebook_page_id:page.id,instagram_business_id:ig});if(existing){await run(env,"UPDATE credentials SET label=?,kind=?,encrypted_secret=?,capabilities=?,endpoint=?,model=?,priority=?,enabled=1,meta=?,last_status='ok',last_error=NULL,last_test_at=?,updated_at=? WHERE id=?",'Meta / Facebook / Instagram','oauth',blob,JSON.stringify(['facebook','instagram']),page.id,ig,15,meta,t,t,existing.id);return existing.id}const id=uid();await run(env,'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,last_test_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,'meta','Meta / Facebook / Instagram','oauth',blob,JSON.stringify(['facebook','instagram']),page.id,ig,15,1,meta,'ok',t,t,t);return id}
async function metaCallback(req,env){const u=new URL(req.url),st=await verify(env.JARVIS_SECRET||'CHANGE_ME',u.searchParams.get('state'));if(!st||st.sub!=='meta-oauth')return txt('Invalid Meta OAuth state',400);const app=await metaApp(env);if(!app)return txt('Meta app setup missing',400);const redirect=u.origin+'/api/meta/callback';const code=String(u.searchParams.get('code')||'');if(!code)return txt('Meta authorization code missing',400);let r=await fetch(GRAPH+'/oauth/access_token?'+new URLSearchParams({client_id:app.appId,client_secret:app.appSecret,redirect_uri:redirect,code}));if(!r.ok)return txt('Meta token exchange failed '+r.status,400);let token=await r.json();let userToken=token.access_token;r=await fetch(GRAPH+'/oauth/access_token?'+new URLSearchParams({grant_type:'fb_exchange_token',client_id:app.appId,client_secret:app.appSecret,fb_exchange_token:userToken}));if(r.ok){const long=await r.json();if(long.access_token)userToken=long.access_token}r=await fetch(GRAPH+'/me/accounts?'+new URLSearchParams({fields:'id,name,access_token,instagram_business_account',access_token:userToken}));if(!r.ok)return txt('Meta pages request failed '+r.status,400);const pages=(await r.json()).data||[];await kvSet(env,'meta_pages',{pages:pages.map(p=>({id:p.id,name:p.name,access_token:p.access_token,instagram_business_account:p.instagram_business_account||null})),updated_at:now()});if(!pages.length)return Response.redirect(u.origin+'/?meta=no_page',302);const chosen=pages.find(p=>p.instagram_business_account?.id)||pages[0];await saveMetaCredential(env,chosen);return Response.redirect(u.origin+'/?meta=connected',302)}
async function metaPages(env){const x=await kvGet(env,'meta_pages',{pages:[]});return (x.pages||[]).map(p=>({id:p.id,name:p.name,instagram_business_id:p.instagram_business_account?.id||null}))}
async function selectMetaPage(req,env){const b=await body(req),id=String(b.page_id||'').trim(),x=await kvGet(env,'meta_pages',{pages:[]}),page=(x.pages||[]).find(p=>String(p.id)===id);if(!page)return json({error:'META_PAGE_NOT_FOUND'},404);await saveMetaCredential(env,page);return json({ok:true,page:{id:page.id,name:page.name,instagram_business_id:page.instagram_business_account?.id||null}})}

async function integrationStatus(req,env){const google=await kvGet(env,'google_oauth',null),gScope=String(google?.scope||''),meta=await q1(env,"SELECT endpoint,model,meta,last_status,enabled FROM credentials WHERE provider='meta' ORDER BY created_at DESC LIMIT 1"),app=await metaApp(env),pages=await metaPages(env);let mmeta={};try{mmeta=JSON.parse(meta?.meta||'{}')}catch{}return json({google:{configured:!!(await q1(env,"SELECT id FROM credentials WHERE provider='google' AND enabled=1 LIMIT 1")),connected:!!google,email:google?.email||'',youtube:gScope.includes('youtube')},youtube:{connected:!!google&&gScope.includes('youtube')},meta:{configured:!!app,connected:!!meta&&Number(meta.enabled)===1,status:meta?.last_status||null,page_id:meta?.endpoint||null,page_name:mmeta.page_name||'',instagram_business_id:meta?.model||null,pages},facebook:{connected:!!meta&&Number(meta.enabled)===1,page_id:meta?.endpoint||null,page_name:mmeta.page_name||''},instagram:{connected:!!meta&&Number(meta.enabled)===1&&!!meta.model,business_id:meta?.model||null}})}

async function googleConnectWithYouTube(req,env,ctx){const base=await core.fetch(req,env,ctx);if(!base.ok)return base;let x;try{x=await base.clone().json()}catch{return base}if(!x?.url)return base;try{const u=new URL(x.url),scopes=new Set(String(u.searchParams.get('scope')||'').split(' ').filter(Boolean));for(const s of YT_SCOPES)scopes.add(s);u.searchParams.set('scope',[...scopes].join(' '));x.url=u.toString();x.youtube=true;return json(x)}catch{return base}}

export default {
  async fetch(req,env,ctx){
    try{
      const u=new URL(req.url),p=u.pathname,m=req.method;
      if(p==='/api/meta/callback'&&m==='GET')return metaCallback(req,env);
      if(p==='/api/google/connect'&&m==='GET')return googleConnectWithYouTube(req,env,ctx);
      if(p.startsWith('/api/integrations/')||p.startsWith('/api/meta/')){
        if(!(await authed(req,env)))return core.fetch(req,env,ctx);
        if(p==='/api/integrations/status'&&m==='GET')return integrationStatus(req,env);
        if(p==='/api/meta/setup'&&m==='POST')return metaSetup(req,env);
        if(p==='/api/meta/connect'&&m==='GET')return metaConnect(req,env);
        if(p==='/api/meta/pages'&&m==='GET')return json({pages:await metaPages(env)});
        if(p==='/api/meta/select-page'&&m==='POST')return selectMetaPage(req,env);
      }
      return core.fetch(req,env,ctx);
    }catch(e){console.error(e);return json({error:'INTEGRATION_HUB_ERROR',detail:e.message},500)}
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};
