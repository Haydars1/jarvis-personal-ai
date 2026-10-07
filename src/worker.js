const te=new TextEncoder(), td=new TextDecoder();
const nativeFetch=fetch;
async function fetchT(input,init={},ms=12000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await nativeFetch(input,{...init,signal:init.signal||c.signal})}finally{clearTimeout(t)}}
async function withTimeout(promise,ms,label='TIMEOUT'){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label)),ms)})])}finally{clearTimeout(t)}}
const now=()=>Date.now(), id=()=>crypto.randomUUID();
const j=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const txt=(s,status=200)=>new Response(s,{status,headers:{'content-type':'text/plain; charset=utf-8'}});
const parseCookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').filter(Boolean).map(x=>{const [k,...v]=x.trim().split('=');return[k,decodeURIComponent(v.join('='))]}));
async function hmac(secret,data){const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',k,te.encode(data))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function sign(secret,p){const b=btoa(JSON.stringify(p)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return `${b}.${await hmac(secret,b)}`}
async function verify(secret,t){try{const [b,s]=String(t||'').split('.');if(!b||!s||await hmac(secret,b)!==s)return null;const p=JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/')));return p.exp>now()?p:null}catch{return null}}
async function hashPassword(p,s){const key=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:te.encode(s),iterations:100000},key,256);return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function q1(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).first()}
async function qall(env,sql,...bind){return (await env.DB.prepare(sql).bind(...bind).all()).results||[]}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}
async function kvGet(env,key,fb=null){const r=await q1(env,'SELECT value FROM kv WHERE key=?',key);if(!r)return fb;try{return JSON.parse(r.value)}catch{return r.value}}
async function kvSet(env,key,val){await run(env,'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,JSON.stringify(val),now())}
async function log(env,kind,text,meta={}){await run(env,'INSERT INTO logs(id,ts,kind,text,meta) VALUES(?,?,?,?,?)',id(),now(),kind,text,JSON.stringify(meta));await run(env,'DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY ts DESC LIMIT -1 OFFSET 1000)')}
async function isAuthed(req,env){const c=parseCookies(req);return !!(await verify(env.JARVIS_SECRET||'CHANGE_ME',c.jarvis_session))}
function cookie(v,max=2592000){return `jarvis_session=${encodeURIComponent(v)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${max}`}
async function body(req){try{return await req.json()}catch{return{}}}
async function masterKey(env){
  const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();
  if(raw.length<24) throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');
  let keyBytes=null;
  // New installs store a 32-byte random key as base64. Older installs may
  // contain a 48-byte/64-char value; normalize those deterministically.
  try{
    const decoded=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));
    if(decoded.length===16||decoded.length===24||decoded.length===32) keyBytes=decoded;
  }catch{}
  if(!keyBytes) keyBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));
  return crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64u(s){s=s.replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function encSecret(env,plain){const iv=crypto.getRandomValues(new Uint8Array(12)),k=await masterKey(env),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(String(plain))));return b64u(iv)+'.'+b64u(ct)}
async function decSecret(env,blob){const [a,b]=String(blob||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b));return td.decode(pt)}

function randB64u(n=32){return b64u(crypto.getRandomValues(new Uint8Array(n)))}
function bytesEq(a,b){a=new Uint8Array(a);b=new Uint8Array(b);if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0}
function readCbor(data,off=0){const a=data instanceof Uint8Array?data:new Uint8Array(data);const h=a[off++],major=h>>5,add=h&31;let len;if(add<24)len=add;else if(add===24)len=a[off++];else if(add===25){len=(a[off]<<8)|a[off+1];off+=2}else if(add===26){len=(a[off]*2**24)+(a[off+1]<<16)+(a[off+2]<<8)+a[off+3];off+=4}else throw Error('CBOR_UNSUPPORTED');if(major===0)return [len,off];if(major===1)return [-1-len,off];if(major===2){const v=a.slice(off,off+len);return[v,off+len]}if(major===3){const v=td.decode(a.slice(off,off+len));return[v,off+len]}if(major===4){const arr=[];for(let i=0;i<len;i++){const [v,n]=readCbor(a,off);arr.push(v);off=n}return[arr,off]}if(major===5){const m=new Map();for(let i=0;i<len;i++){let k,v;[k,off]=readCbor(a,off);[v,off]=readCbor(a,off);m.set(k,v)}return[m,off]}if(major===7&&len===20)return[false,off];if(major===7&&len===21)return[true,off];if(major===7&&len===22)return[null,off];throw Error('CBOR_TYPE_UNSUPPORTED')}
async function sha256(x){return new Uint8Array(await crypto.subtle.digest('SHA-256',x instanceof Uint8Array?x:te.encode(String(x))))}
async function passkeyCount(env){const r=await q1(env,'SELECT COUNT(*) n FROM passkeys');return Number(r?.n||0)}
async function passkeys(env){return qall(env,'SELECT id,counter,transports,device_type,backed_up,created_at,last_used_at FROM passkeys ORDER BY created_at DESC')}
function rpFrom(req){const u=new URL(req.url);return {rpID:u.hostname,origin:u.origin,rpName:'JARVIS Personal AI'}}
async function registrationOptions(req,env){const rp=rpFrom(req),challenge=randB64u(),existing=await passkeys(env);await kvSet(env,'passkey_reg_challenge',{challenge,ts:now()});return {challenge,rp:{name:rp.rpName,id:rp.rpID},user:{id:b64u(te.encode('jarvis-owner')),name:'jarvis-owner',displayName:'JARVIS Owner'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],timeout:60000,attestation:'none',excludeCredentials:existing.map(x=>({type:'public-key',id:x.id,transports:safeJsonParse(x.transports,[])})),authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required',authenticatorAttachment:'platform'}}}
function coseToJwk(cose){const [m]=readCbor(cose,0);if(!(m instanceof Map))throw Error('COSE_INVALID');const kty=m.get(1),alg=m.get(3);if(kty===2&&m.get(-1)===1){return {jwk:{kty:'EC',crv:'P-256',x:b64u(m.get(-2)),y:b64u(m.get(-3)),ext:true},alg:alg||-7}}if(kty===3){return {jwk:{kty:'RSA',n:b64u(m.get(-1)),e:b64u(m.get(-2)),ext:true},alg:alg||-257}}throw Error('COSE_KEY_UNSUPPORTED')}
async function verifyClient(clientDataB64,expectedChallenge,expectedOrigin,type){const raw=fromB64u(clientDataB64),d=JSON.parse(td.decode(raw));if(d.type!==type||d.challenge!==expectedChallenge||d.origin!==expectedOrigin)throw Error('PASSKEY_CLIENT_DATA_INVALID');return {raw,hash:await sha256(raw)}}
async function parseAuthData(authData,rpID){const a=authData instanceof Uint8Array?authData:new Uint8Array(authData);if(a.length<37)throw Error('AUTH_DATA_SHORT');const expected=await sha256(rpID);if(!bytesEq(a.slice(0,32),expected))throw Error('RPID_HASH_MISMATCH');const flags=a[32],counter=(a[33]*2**24)+(a[34]<<16)+(a[35]<<8)+a[36];if(!(flags&0x04))throw Error('USER_VERIFICATION_REQUIRED');return {a,flags,counter}}
async function verifyRegistration(req,env){const b=await body(req),rp=rpFrom(req),ch=await kvGet(env,'passkey_reg_challenge',null);if(!ch?.challenge||now()-ch.ts>120000)return {ok:false,error:'PASSKEY_CHALLENGE_EXPIRED'};try{await verifyClient(b.response.clientDataJSON,ch.challenge,rp.origin,'webauthn.create');const [att]=readCbor(fromB64u(b.response.attestationObject),0);const authData=att.get('authData');const parsed=await parseAuthData(authData,rp.rpID);if(!(parsed.flags&0x40))throw Error('ATTESTED_CREDENTIAL_MISSING');let o=37+16;const idLen=(parsed.a[o]<<8)|parsed.a[o+1];o+=2;const credId=b64u(parsed.a.slice(o,o+idLen));o+=idLen;const {jwk,alg}=coseToJwk(parsed.a.slice(o));if(credId!==b.id)throw Error('CREDENTIAL_ID_MISMATCH');await run(env,'INSERT OR REPLACE INTO passkeys(id,public_key,counter,transports,device_type,backed_up,created_at,last_used_at) VALUES(?,?,?,?,?,?,?,?)',credId,JSON.stringify({jwk,alg}),parsed.counter,JSON.stringify(b.response.transports||[]),b.authenticatorAttachment||'platform',1,now(),null);await kvSet(env,'passkey_reg_challenge',null);await log(env,'auth','Face ID / Passkey kaydedildi',{credential:credId.slice(0,10)});return {ok:true,verified:true}}catch(e){return {ok:false,error:e.message}}}
async function authenticationOptions(req,env){const rp=rpFrom(req),keys=await passkeys(env);if(!keys.length)return {error:'NO_PASSKEY',status:404};const challenge=randB64u();await kvSet(env,'passkey_auth_challenge',{challenge,ts:now()});return {challenge,rpId:rp.rpID,timeout:60000,userVerification:'required',allowCredentials:keys.map(x=>({type:'public-key',id:x.id,transports:safeJsonParse(x.transports,[])}))}}
function derToRawEcdsa(sig,size=32){const a=sig instanceof Uint8Array?sig:new Uint8Array(sig);if(a[0]!==0x30) return a;let o=1;let seq=a[o++];if(seq&0x80){const n=seq&0x7f;o+=n}if(a[o++]!==0x02)throw Error('ECDSA_DER_R');let rl=a[o++];let r=a.slice(o,o+rl);o+=rl;if(a[o++]!==0x02)throw Error('ECDSA_DER_S');let sl=a[o++];let ss=a.slice(o,o+sl);while(r.length>size&&r[0]===0)r=r.slice(1);while(ss.length>size&&ss[0]===0)ss=ss.slice(1);const out=new Uint8Array(size*2);out.set(r.slice(-size),size-r.slice(-size).length);out.set(ss.slice(-size),size*2-ss.slice(-size).length);return out}
async function verifyAuthentication(req,env){const b=await body(req),rp=rpFrom(req),ch=await kvGet(env,'passkey_auth_challenge',null);if(!ch?.challenge||now()-ch.ts>120000)return {ok:false,error:'PASSKEY_CHALLENGE_EXPIRED'};const pk=await q1(env,'SELECT * FROM passkeys WHERE id=?',b.id);if(!pk)return {ok:false,error:'PASSKEY_NOT_FOUND'};try{const client=await verifyClient(b.response.clientDataJSON,ch.challenge,rp.origin,'webauthn.get'),authData=fromB64u(b.response.authenticatorData),parsed=await parseAuthData(authData,rp.rpID),sig=fromB64u(b.response.signature),stored=safeJsonParse(pk.public_key,{}),signed=new Uint8Array(authData.length+client.hash.length);signed.set(authData);signed.set(client.hash,authData.length);let key,ok;if(stored.jwk?.kty==='EC'){key=await crypto.subtle.importKey('jwk',stored.jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,derToRawEcdsa(sig),signed)}else if(stored.jwk?.kty==='RSA'){key=await crypto.subtle.importKey('jwk',stored.jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,sig,signed)}else throw Error('PASSKEY_KEY_UNSUPPORTED');if(!ok)throw Error('PASSKEY_SIGNATURE_INVALID');if(Number(pk.counter||0)>0&&parsed.counter>0&&parsed.counter<=Number(pk.counter))throw Error('PASSKEY_COUNTER_INVALID');await run(env,'UPDATE passkeys SET counter=?,last_used_at=? WHERE id=?',parsed.counter,now(),pk.id);await kvSet(env,'passkey_auth_challenge',null);const tok=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'owner',exp:now()+2592e6});await log(env,'auth','Face ID / Passkey ile giriş yapıldı');return {ok:true,verified:true,cookie:cookie(tok)}}catch(e){return {ok:false,error:e.message}}}

async function credentialRows(env){return qall(env,"SELECT id,provider,label,kind,capabilities,endpoint,model,priority,enabled,meta,last_status,last_error,last_test_at,created_at,updated_at FROM credentials ORDER BY enabled DESC,priority ASC,created_at DESC")}
async function credentialSecrets(env,capability=null){let rows=await qall(env,"SELECT * FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC");if(capability)rows=rows.filter(r=>{try{const c=JSON.parse(r.capabilities||'[]');return !c.length||c.includes(capability)||c.includes('chat')}catch{return true}});const out=[];for(const r of rows){try{out.push({...r,secret:await decSecret(env,r.encrypted_secret),capabilities:JSON.parse(r.capabilities||'[]'),meta:JSON.parse(r.meta||'{}')})}catch(e){await run(env,'UPDATE credentials SET last_status=?,last_error=?,updated_at=? WHERE id=?','decrypt_error',e.message,now(),r.id)}}return out}
async function testCredential(env,c){
  const p=String(c.provider||'').toLowerCase(),sec=c.secret||await decSecret(env,c.encrypted_secret);
  try{
    if(!sec)throw Error('NO_API_KEY');
    if(p==='gemini'){
      const model=c.model||'gemini-2.5-flash';
      const r=await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(sec)}`);
      if(!r.ok)throw Error('HTTP_'+r.status);
    }else if(p==='google'){
      if(!String(c.endpoint||'').includes('.apps.googleusercontent.com'))throw Error('GOOGLE_CLIENT_ID_INVALID');
    }else if(p==='meta'){
      const r=await fetchT('https://graph.facebook.com/v24.0/me?access_token='+encodeURIComponent(sec));if(!r.ok)throw Error('HTTP_'+r.status);
    }else if(p==='github'){
      const r=await fetchT('https://api.github.com/user',{headers:{authorization:'Bearer '+sec,accept:'application/vnd.github+json','user-agent':'JARVIS-SelfUpdate'}});if(!r.ok)throw Error('HTTP_'+r.status);
    }else if(p==='anthropic'){
      const r=await fetchT('https://api.anthropic.com/v1/models',{headers:{'x-api-key':sec,'anthropic-version':'2023-06-01'}});if(!r.ok)throw Error('HTTP_'+r.status);
    }else{
      const base=providerBase(p,c.endpoint);
      if(!base)throw Error('NO_ENDPOINT');
      const r=await fetchT(base+'/models',{headers:{authorization:'Bearer '+sec}});if(!r.ok&&r.status!==404)throw Error('HTTP_'+r.status);
    }
    await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),c.id);return {ok:true}
  }catch(e){await run(env,'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?','error',e.message,now(),now(),c.id);return {ok:false,error:e.message}}
}
function providerBase(p,endpoint=''){
  const map={openai:'https://api.openai.com/v1',groq:'https://api.groq.com/openai/v1',openrouter:'https://openrouter.ai/api/v1',nvidia:'https://integrate.api.nvidia.com/v1',mistral:'https://api.mistral.ai/v1',deepseek:'https://api.deepseek.com/v1',together:'https://api.together.xyz/v1',cerebras:'https://api.cerebras.ai/v1',perplexity:'https://api.perplexity.ai',xai:'https://api.x.ai/v1'};
  return (map[p]||String(endpoint||'')).replace(/\/$/,'');
}
function providerModel(p,model=''){
  const map={openai:'gpt-4o-mini',groq:'llama-3.3-70b-versatile',openrouter:'openrouter/auto',nvidia:'nvidia/nemotron-3.5-lightning-30b-a3b',mistral:'mistral-small-latest',deepseek:'deepseek-chat',together:'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',cerebras:'llama3.1-8b',perplexity:'sonar-pro',xai:'grok-3-mini'};
  return model||map[p]||'';
}
async function callVaultAI(env,c,messages,ms=9000){
  const p=String(c.provider||'').toLowerCase(),sec=c.secret;
  if(p==='gemini'){
    return callGeminiKey(sec,c.model||'gemini-2.0-flash',messages,ms);
  }
  if(p==='anthropic'){
    const system=messages.find(x=>x.role==='system')?.content||'';
    const body={model:providerModel(p,c.model),max_tokens:1200,messages:messages.filter(x=>x.role!=='system')};
    if(system)body.system=system;
    const r=await fetchT('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':sec,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)},ms);
    if(!r.ok)throw Error('ANTHROPIC_'+r.status);
    return (await r.json()).content?.map(x=>x.text||'').join('')||''
  }
  const base=providerBase(p,c.endpoint);if(!base)throw Error('NO_ENDPOINT');
  const model=providerModel(p,c.model);
  const r=await fetchT(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+sec,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'},body:JSON.stringify({model,messages,temperature:.25})},ms);
  if(!r.ok)throw Error((p||'AI').toUpperCase()+'_'+r.status);
  return (await r.json()).choices?.[0]?.message?.content||''
}

function safeJsonParse(s,fb=null){try{return JSON.parse(s)}catch{return fb}}
async function githubCredential(env){
  const rows=await credentialSecrets(env,null);
  return rows.find(c=>String(c.provider||'').toLowerCase()==='github' && c.enabled);
}
function repoCfg(c){
  const repo=String(c?.endpoint||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/^\/+|\/+$/g,'');
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error('GITHUB_REPO_REQUIRED: endpoint alanına owner/repo yaz');
  return {repo,branch:String(c.model||'main').trim()||'main'};
}
async function gh(c,path,opts={}){
  const r=await fetchT('https://api.github.com'+path,{...opts,headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'JARVIS-SelfUpdate',authorization:'Bearer '+c.secret,...(opts.headers||{})}});
  const text=await r.text();let data;try{data=text?JSON.parse(text):{}}catch{data={text}};
  if(!r.ok)throw Error('GITHUB_'+r.status+':'+(data.message||text).slice(0,240));return data;
}
function b64Utf8(s){const bytes=te.encode(String(s));let x='';for(const b of bytes)x+=String.fromCharCode(b);return btoa(x)}
async function repoFile(c,repo,path,ref){const d=await gh(c,`/repos/${repo}/contents/${encodeURIComponent(path).replaceAll('%2F','/')}?ref=${encodeURIComponent(ref)}`);return {sha:d.sha,content:td.decode(Uint8Array.from(atob((d.content||'').replace(/\n/g,'')),x=>x.charCodeAt(0)))}}
const SELF_EDIT_ALLOW=new Set(['src/worker.js','public/app.js','public/index.html','public/app.css','schema.sql','README-v6.txt','ios/JARVIS/JarvisAPI.swift','ios/JARVIS/AppState.swift','ios/JARVIS/ContentView.swift','ios/JARVIS/SettingsView.swift','ios/project.yml','.github/workflows/deploy-cloudflare.yml','.github/workflows/ios-native-check.yml']);
function cleanAiJson(t){t=String(t||'').trim();const m=t.match(/```(?:json)?\s*([\s\S]*?)```/i);if(m)t=m[1].trim();const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)t=t.slice(a,b+1);return JSON.parse(t)}
async function createSelfChange(env,request,origin='user'){
  const c=await githubCredential(env);if(!c)return {ok:false,need:'github',message:'Self Update için GitHub bağlantısı gerekiyor. Credential Manager’da GitHub token + owner/repo ekle.'};
  const {repo,branch}=repoCfg(c), files={};
  for(const path of ['src/worker.js','public/app.js','public/index.html','public/app.css','schema.sql','ios/JARVIS/JarvisAPI.swift','ios/JARVIS/AppState.swift','ios/JARVIS/ContentView.swift','ios/JARVIS/SettingsView.swift','ios/project.yml','.github/workflows/deploy-cloudflare.yml','.github/workflows/ios-native-check.yml']){try{files[path]=(await repoFile(c,repo,path,branch)).content}catch(e){files[path]='/* unavailable: '+e.message+' */'}}
  const system=`Sen JARVIS'in kıdemli yazılım ajanısın. Kullanıcının istediği özelliği mevcut Cloudflare Workers uygulamasına uygula. Yalnızca gerekli dosyaları değiştir. Mevcut özellikleri bozma. Secret/API key yazma. Cloudflare Workers Web APIs kullan; Node-only API kullanma. Geriye uyumlu D1 migration kullan (CREATE TABLE IF NOT EXISTS / additive changes). ÇIKTI SADECE JSON: {"summary":"...","files":[{"path":"src/worker.js","content":"tam dosya içeriği"}],"tests":["..."]}. İzinli yollar: ${[...SELF_EDIT_ALLOW].join(', ')}.`;
  const prompt=`İSTEK: ${request}\n\nMEVCUT DOSYALAR:\n`+Object.entries(files).map(([k,v])=>`\n--- ${k} ---\n${v}`).join('\n');
  const a=await aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}]);let patch;
  try{patch=cleanAiJson(a.text)}catch(e){throw Error('SELF_UPDATE_BAD_AI_JSON:'+e.message)}
  if(!Array.isArray(patch.files)||!patch.files.length)throw Error('SELF_UPDATE_NO_FILES');if(patch.files.length>8)throw Error('SELF_UPDATE_TOO_MANY_FILES');
  for(const f of patch.files){if(!SELF_EDIT_ALLOW.has(f.path))throw Error('SELF_UPDATE_PATH_NOT_ALLOWED:'+f.path);if(typeof f.content!=='string'||f.content.length>350000)throw Error('SELF_UPDATE_INVALID_CONTENT:'+f.path);if(/(?:AIza|sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,})/.test(f.content))throw Error('SELF_UPDATE_SECRET_DETECTED:'+f.path)}
  const baseRef=await gh(c,`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),sha=baseRef.object.sha,changeId=id(),short=changeId.slice(0,8),newBranch=`jarvis/${short}`;
  await gh(c,`/repos/${repo}/git/refs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:`refs/heads/${newBranch}`,sha})});
  for(const f of patch.files){let old=null;try{old=await repoFile(c,repo,f.path,branch)}catch{};await gh(c,`/repos/${repo}/contents/${encodeURIComponent(f.path).replaceAll('%2F','/')}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:`JARVIS: ${String(patch.summary||request).slice(0,120)}`,content:b64Utf8(f.content),branch:newBranch,...(old?.sha?{sha:old.sha}:{})})})}
  const pr=await gh(c,`/repos/${repo}/pulls`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:`JARVIS self-update: ${String(patch.summary||request).slice(0,100)}`,head:newBranch,base:branch,body:`Otomatik JARVIS değişikliği.\n\nİstek: ${request}\n\nAI provider: ${a.provider}\n\nTest planı:\n${(patch.tests||[]).map(x=>'- '+x).join('\n')}`})});
  try{await gh(c,`/repos/${repo}/issues/${pr.number}/labels`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({labels:['jarvis-auto']})})}catch{}
  await run(env,'INSERT INTO change_requests(id,request,origin,status,provider,repo,branch,pr_url,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',changeId,request,origin,'pr_open',a.provider,repo,newBranch,pr.html_url,String(patch.summary||''),now(),now());
  await log(env,'self-update',`Kod değişikliği hazırlandı: ${patch.summary||request}`,{pr:pr.html_url,provider:a.provider});
  return {ok:true,id:changeId,summary:patch.summary||request,pr:pr.html_url,status:'pr_open',provider:a.provider};
}
async function recordRuntimeError(env,e,ctx='fetch'){
  try{const msg=String(e?.stack||e?.message||e).slice(0,3000),fingerprint=await hmac(env.JARVIS_SECRET||'jarvis',ctx+'|'+msg.slice(0,800));await run(env,'INSERT INTO runtime_errors(id,ts,context,message,fingerprint,resolved) VALUES(?,?,?,?,?,0)',id(),now(),ctx,msg,fingerprint)}catch{}
}
async function selfHeal(env,force=false){
  try{
    const minCount=force?1:3, windowMs=force?3600000:86400000;
    const recent=await q1(env,`SELECT fingerprint,COUNT(*) n,MAX(message) message,MAX(context) context FROM runtime_errors WHERE resolved=0 AND ts>? GROUP BY fingerprint HAVING COUNT(*)>=${minCount} ORDER BY n DESC LIMIT 1`,now()-windowMs);
    if(!recent)return;
    const last=await q1(env,"SELECT created_at FROM change_requests WHERE origin='self-heal' ORDER BY created_at DESC LIMIT 1");
    if(last&&now()-last.created_at<(force?1800000:21600000))return;
    const r=await createSelfChange(env,`Tekrarlanan runtime hatasını düzelt. Context: ${recent.context}. Hata: ${recent.message}. Bu hata kullanıcıya uygulama içinde göründüyse kullanıcıdan manuel teşhis bekleme; repo kodundan sebebi bul ve düzelt.`,'self-heal');
    if(r.ok)await run(env,'UPDATE runtime_errors SET resolved=1 WHERE fingerprint=?',recent.fingerprint)
  }catch(e){await log(env,'self-heal','Self-heal çalışmadı',{error:e.message})}
}


async function googleCredential(env){const rows=await credentialSecrets(env,null);return rows.find(c=>String(c.provider||'').toLowerCase()==='google'&&c.enabled)}
async function metaCredential(env){const rows=await credentialSecrets(env,null);return rows.find(c=>String(c.provider||'').toLowerCase()==='meta'&&c.enabled)}
async function googleStored(env){const x=await kvGet(env,'google_oauth',null);if(!x?.blob)return null;try{return {...x,tokens:JSON.parse(await decSecret(env,x.blob))}}catch{return null}}
async function googleAccessToken(env){const c=await googleCredential(env),g=await googleStored(env);if(!c||!g)throw Error('GOOGLE_NOT_CONNECTED');let t=g.tokens;if(t.expires_at&&t.expires_at>now()+60000)return t.access_token;if(!t.refresh_token)throw Error('GOOGLE_REFRESH_TOKEN_MISSING');const form=new URLSearchParams({client_id:String(c.endpoint||''),client_secret:c.secret,refresh_token:t.refresh_token,grant_type:'refresh_token'});const r=await fetchT('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});if(!r.ok)throw Error('GOOGLE_REFRESH_'+r.status);const n=await r.json();t={...t,...n,expires_at:now()+Number(n.expires_in||3600)*1000};await kvSet(env,'google_oauth',{email:g.email,scope:g.scope,blob:await encSecret(env,JSON.stringify(t))});return t.access_token}
function mailRaw({to,subject,body}){const raw=`To: ${to}\r\nSubject: ${subject||''}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body||''}`;const bytes=te.encode(raw);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function gmailList(env,max=10){const token=await googleAccessToken(env),r=await fetchT(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(max,20)}&q=${encodeURIComponent('newer_than:7d')}`,{headers:{authorization:'Bearer '+token}});if(!r.ok)throw Error('GMAIL_LIST_'+r.status);const ids=(await r.json()).messages||[],out=[];for(const x of ids.slice(0,max)){const q=await fetchT(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${x.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{headers:{authorization:'Bearer '+token}});if(q.ok){const d=await q.json(),h=Object.fromEntries((d.payload?.headers||[]).map(z=>[z.name.toLowerCase(),z.value]));out.push({id:x.id,subject:h.subject||'',from:h.from||'',date:h.date||'',snippet:d.snippet||''})}}return out}
async function gmailSend(env,payload){const token=await googleAccessToken(env),r=await fetchT('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({raw:mailRaw(payload)})});if(!r.ok)throw Error('GMAIL_SEND_'+r.status);return r.json()}
async function driveFiles(env){const token=await googleAccessToken(env),params=new URLSearchParams({pageSize:'30',fields:'files(id,name,mimeType,modifiedTime,webViewLink,size)',orderBy:'modifiedTime desc'}),r=await fetchT('https://www.googleapis.com/drive/v3/files?'+params,{headers:{authorization:'Bearer '+token}});if(!r.ok)throw Error('DRIVE_'+r.status);return r.json()}
async function metaFacebookPost(env,p){const c=await metaCredential(env);if(!c)throw Error('META_NOT_CONNECTED');const page=String(c.endpoint||'').trim();if(!page)throw Error('META_PAGE_ID_REQUIRED');const form=new URLSearchParams({message:p.message||'',access_token:c.secret}),r=await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(page)}/feed`,{method:'POST',body:form});if(!r.ok)throw Error('FACEBOOK_'+r.status+':'+(await r.text()).slice(0,200));return r.json()}
async function metaInstagramPost(env,p){const c=await metaCredential(env);if(!c)throw Error('META_NOT_CONNECTED');const ig=String(c.model||'').trim();if(!ig)throw Error('INSTAGRAM_BUSINESS_ID_REQUIRED');let form=new URLSearchParams({image_url:p.imageUrl||'',caption:p.caption||'',access_token:c.secret}),r=await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(ig)}/media`,{method:'POST',body:form});if(!r.ok)throw Error('INSTAGRAM_MEDIA_'+r.status+':'+(await r.text()).slice(0,200));const creation=(await r.json()).id;form=new URLSearchParams({creation_id:creation,access_token:c.secret});r=await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(ig)}/media_publish`,{method:'POST',body:form});if(!r.ok)throw Error('INSTAGRAM_PUBLISH_'+r.status+':'+(await r.text()).slice(0,200));return r.json()}
async function pendingAction(env,type,payload,summary,risk='medium'){const x={id:id(),type,payload,summary,risk,status:'pending',created_at:now()};await run(env,'INSERT INTO actions(id,type,payload,summary,risk,status,created_at) VALUES(?,?,?,?,?,?,?)',x.id,type,JSON.stringify(payload),summary,risk,'pending',x.created_at);await log(env,'action','Onay bekliyor: '+summary,{type});return x}
async function executeAction(env,a){const p=safeJsonParse(a.payload,{});if(a.type==='gmail_send')return gmailSend(env,p);if(a.type==='facebook_post')return metaFacebookPost(env,p);if(a.type==='instagram_post')return metaInstagramPost(env,p);throw Error('UNSUPPORTED_ACTION')}
function privateHost(host){host=host.toLowerCase();return host==='localhost'||host==='127.0.0.1'||host==='::1'||host.endsWith('.local')||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)}


async function addChat(env,role,content,provider=null){
  const text=String(content||'').trim(); if(!text)return;
  await run(env,'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)',id(),role,text,provider,now());
  await run(env,'DELETE FROM chat_messages WHERE id IN (SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT -1 OFFSET 2000)');
}
async function chatHistory(env,limit=100){
  const rows=await qall(env,'SELECT id,role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?',Math.min(Math.max(Number(limit)||100,1),300));
  return rows.reverse();
}
async function rememberExplicit(env,text){
  const raw=String(text||'').trim();
  const l=raw.toLocaleLowerCase('tr-TR');
  const explicit=/^(jarvis[, ]*)?(bunu|şunu|sunu|bu bilgiyi)?\s*(hafızana|belleğine|bellegine)\s+kaydet[: ]+/i.test(l)
    || /^(jarvis[, ]*)?(bunu|şunu|sunu|bu bilgiyi)\s+hatırla[: ]+/i.test(l)
    || /^(jarvis[, ]*)?kaydet[: ]+/i.test(l);
  if(!explicit)return null;
  const clean=raw
    .replace(/^(jarvis[, ]*)?/i,'')
    .replace(/^(bunu|şunu|sunu|bu bilgiyi)?\s*(hafızana|belleğine|bellegine)\s+kaydet[: ]*/i,'')
    .replace(/^(bunu|şunu|sunu|bu bilgiyi)\s+hatırla[: ]*/i,'')
    .replace(/^kaydet[: ]*/i,'')
    .trim();
  if(clean.length<3)return null;
  const mid=id();await run(env,'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)',mid,clean,JSON.stringify(['chat','explicit']),now());
  await log(env,'memory','Hafızaya kaydedildi: '+clean,{id:mid});return clean;
}
async function liveStatus(env){
  const rows=await credentialRows(env),enabled=rows.filter(x=>Number(x.enabled)===1),ok=enabled.filter(x=>x.last_status==='ok');
  const envProviders=[];
  if(env.OPENAI_API_KEY)envProviders.push('OpenAI'); if(env.ANTHROPIC_API_KEY)envProviders.push('Anthropic'); if(env.GEMINI_API_KEY)envProviders.push('Gemini'); if(env.GROQ_API_KEY)envProviders.push('Groq'); if(env.OPENROUTER_API_KEY)envProviders.push('OpenRouter'); if(env.MISTRAL_API_KEY)envProviders.push('Mistral'); if(env.DEEPSEEK_API_KEY)envProviders.push('DeepSeek'); if(env.TOGETHER_API_KEY)envProviders.push('Together'); if(env.CEREBRAS_API_KEY)envProviders.push('Cerebras'); if(env.PERPLEXITY_API_KEY)envProviders.push('Perplexity'); if(env.XAI_API_KEY)envProviders.push('xAI'); if(env.AI)envProviders.push('Cloudflare AI');
  const names=[...new Set([...enabled.filter(x=>['gemini','groq','openrouter','nvidia','openai','anthropic','mistral','deepseek','together','cerebras','perplexity','xai','openai-compatible'].includes(String(x.provider).toLowerCase())).map(x=>x.label||x.provider),...envProviders])];
  const google=!!(await googleStored(env));
  const meta=enabled.some(x=>String(x.provider).toLowerCase()==='meta');
  const github=enabled.some(x=>String(x.provider).toLowerCase()==='github');
  return {ai:{connected:names.length>0,count:names.length,healthy:ok.length+envProviders.length,providers:names,router:await aiRouterStatus(env)},d1:{connected:!!env.DB},r2:{connected:!!env.FILES},google:{connected:google},social:{connected:meta},selfUpdate:{connected:github},passkeys:{count:await passkeyCount(env)}};
}

async function brief(env){const open=await q1(env,"SELECT COUNT(*) n FROM tasks WHERE status!='done'"), urgent=await q1(env,"SELECT COUNT(*) n FROM tasks WHERE status!='done' AND priority='Yüksek'"), pending=await q1(env,"SELECT COUNT(*) n FROM actions WHERE status='pending'"), top=await q1(env,"SELECT title FROM tasks WHERE status!='done' ORDER BY CASE priority WHEN 'Yüksek' THEN 0 WHEN 'Orta' THEN 1 ELSE 2 END, created_at ASC LIMIT 1");return{open:open?.n||0,urgent:urgent?.n||0,pending:pending?.n||0,top:top?.title||null,text:`${open?.n||0} açık görev var${urgent?.n?`, ${urgent.n} tanesi yüksek öncelikli`:''}. ${pending?.n?`${pending.n} işlem onayını bekliyor.`:'Onay bekleyen işlem yok.'}`}}
async function state(env){
  const [tasks,projects,memories,logs,actions,b,status]=await Promise.all([
    qall(env,'SELECT id,title,priority,status,area,created_at createdAt,updated_at updatedAt FROM tasks ORDER BY created_at DESC LIMIT 200'),
    qall(env,'SELECT id,title,type,status,notes,created_at createdAt,updated_at updatedAt FROM projects ORDER BY updated_at DESC LIMIT 200'),
    qall(env,'SELECT id,text,tags,created_at createdAt FROM memories ORDER BY created_at DESC LIMIT 100'),
    qall(env,'SELECT id,ts,kind,text,meta FROM logs ORDER BY ts DESC LIMIT 100'),
    qall(env,"SELECT id,type,payload,summary,risk,status,created_at createdAt FROM actions WHERE status='pending' ORDER BY created_at DESC LIMIT 100"),brief(env),liveStatus(env)]);
  return{tasks,projects,memories:memories.map(x=>({...x,tags:JSON.parse(x.tags||'[]')})),logs,actions,brief:b,status,
    integrations:{
      ai:{connected:status.ai.connected,provider:status.ai.providers.join(', ')||'AI sağlayıcısı yok',count:status.ai.count,healthy:status.ai.healthy},
      research:{connected:true,provider:'Web Search'},
      google:{connected:status.google.connected,provider:'Google OAuth'},
      credentials:{connected:(await q1(env,'SELECT COUNT(*) n FROM credentials'))?.n>0,provider:'Encrypted Vault'},
      cloud:{connected:true,provider:'Cloudflare Workers + D1'},
      files:{connected:status.r2.connected,provider:'Cloudflare R2'},
      social:{connected:status.social.connected,provider:'Meta Graph API'},
      selfUpdate:{connected:status.selfUpdate.connected,provider:'GitHub + Cloudflare CI'}},
    settings:await kvGet(env,'settings',{name:'Heido',language:'tr-TR',assistantName:'JARVIS'})}
}
async function ddg(q,ms=3500){const r=await fetchT('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 JARVIS/4.0'}},ms);if(!r.ok)throw Error('SEARCH_'+r.status);const h=await r.text(),out=[],re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;const clean=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();let m;while((m=re.exec(h))&&out.length<8)out.push({title:clean(m[2]),url:m[1].replace(/&amp;/g,'&'),snippet:clean(m[3])});return out}
async function sportsDbLookup(text,ms=2800){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 let team=null;if(/galatasaray|\bgs\b/.test(l))team='Galatasaray';else if(/fenerbahçe|fenerbahce|\bfb\b/.test(l))team='Fenerbahce';else if(/beşiktaş|besiktas|\bbjk\b/.test(l))team='Besiktas';else if(/trabzonspor/.test(l))team='Trabzonspor';
 if(!team)return [];
 const s=await fetchT('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t='+encodeURIComponent(team),{},ms);
 if(!s.ok)return [];
 const sj=await s.json(),id=sj?.teams?.[0]?.idTeam;if(!id)return [];
 const [last,next]=await Promise.allSettled([
  fetchT('https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id='+encodeURIComponent(id),{},ms).then(r=>r.ok?r.json():null),
  fetchT('https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id='+encodeURIComponent(id),{},ms).then(r=>r.ok?r.json():null)
 ]);
 const events=[...(last.value?.results||[]),...(next.value?.events||[])].filter(Boolean).slice(0,8);
 return events.map(e=>({title:[e.dateEvent,e.strEvent,e.intHomeScore!=null&&e.intAwayScore!=null?e.intHomeScore+'-'+e.intAwayScore:null].filter(Boolean).join(' | '),url:'https://www.thesportsdb.com/event/'+(e.idEvent||''),snippet:[e.strLeague,e.strSeason,e.strVenue,e.strStatus,e.strTime].filter(Boolean).join(' - '),source:'TheSportsDB'}));
}
async function liveResearch(text,ms=3000){
 const queries=[liveSearchQuery(text)],mediaQueries=mediaSearchQueries(text);
 if(isSportsQuestion(text)){
  const d=todayTR(),team=sportsTeamName(text);
  queries.push(String(text||'')+' '+d+' maç sonucu özet goller');
  queries.push((team||String(text||''))+' '+d+' gol atanlar kaçıncı dakika');
  queries.push((team||String(text||''))+' '+d+' maç özeti önemli anlar');
  queries.push((team||String(text||''))+' '+d+' TFF maç sonucu');
  queries.push((team||String(text||''))+' '+d+' Mackolik Sofascore maç sonucu');
 }
 const seen=new Set(),out=[],per=Math.max(1200,Math.min(ms,2200));
 const jobs=queries.map(q=>ddg(q,per).catch(()=>[])).concat(mediaQueries.map(q=>ddg(q,per).then(xs=>xs.map(x=>({...x,kind:'media'}))).catch(()=>[])));
 if(isSportsQuestion(text))jobs.unshift(sportsDbLookup(text,per).catch(()=>[]));
 const settled=await withTimeout(Promise.allSettled(jobs),Math.max(2200,ms+500),'LIVE_RESEARCH_TIMEOUT').catch(()=>[]);
 for(const r of settled){for(const x of (r.value||[])){const k=(String(x.title||'')+'|'+String(x.url||'')).toLowerCase();if(x?.title&&!seen.has(k)){seen.add(k);out.push(isMediaResult(x)?{...x,kind:x.kind||'media'}:x)}}}
 const media=out.filter(x=>x.kind==='media'),regular=out.filter(x=>x.kind!=='media');
 return regular.concat(media).slice(0,isSportsQuestion(text)?14:10);
}
function aiProviderKey(p){return String(p||'').toLowerCase().replace(/[^a-z0-9_.@/-]+/g,'_').slice(0,120)}
function aiFailureCooldownMs(msg){
 msg=String(msg||'');
 if(/404|not found|deprecated|deprecation|model.*unavailable|5028/i.test(msg))return 86400000;
 if(/timeout|abort|network|fetch/i.test(msg))return 180000;
 if(/401|403|invalid.*key|unauthorized|permission/i.test(msg))return 3600000;
 if(/429|rate/i.test(msg))return 600000;
 return 300000;
}
async function aiRouterGet(env,key){return await kvGet(env,'ai_router:'+aiProviderKey(key),{failures:0,disabled_until:0,last_error:null,last_ok:0,last_try:0})}
async function aiRouterMark(env,key,ok,error=''){
 const k=aiProviderKey(key),st=await aiRouterGet(env,k);
 if(ok){await kvSet(env,'ai_router:'+k,{...st,failures:0,disabled_until:0,last_error:null,last_ok:now(),last_try:now()});return}
 const failures=Number(st.failures||0)+1,cooldown=aiFailureCooldownMs(error),disabled_until=now()+Math.min(cooldown*Math.min(failures,4),86400000);
 await kvSet(env,'ai_router:'+k,{...st,failures,disabled_until,last_error:String(error||'UNKNOWN').slice(0,500),last_try:now()});
}
async function aiRouterAllowed(env,key){const st=await aiRouterGet(env,key);return !st.disabled_until||Number(st.disabled_until)<now()}
async function workingProviderHints(env){
 const rows=await credentialRows(env);
 return rows.filter(x=>Number(x.enabled)===1&&x.last_status==='ok').map(x=>String(x.provider||x.label||'').toLowerCase()).filter(Boolean);
}
function aiModeForText(text){const l=String(text||'').toLocaleLowerCase('tr-TR');return /kod|program|debug|hata|analiz|uzun|detay|rapor|karşılaştır|karsilastir|strateji|plan|araştır|arastir|hukuk|finans|resmi/.test(l)?'strong':'fast'}
async function aiRouterStatus(env){const keys=['vault','OpenAI','Anthropic','Gemini','Groq','OpenRouter','Mistral','DeepSeek','Together','Cerebras','Perplexity','xAI','Cloudflare AI'],rows=[];for(const k of keys){const st=await aiRouterGet(env,k);rows.push({provider:k,disabled_until:st.disabled_until||0,failures:st.failures||0,last_error:st.last_error||null,last_ok:st.last_ok||0})}return rows}
async function callGeminiKey(apiKey,model,messages,ms){
 const preferred=String(model||'').trim();
 const models=[preferred,'gemini-2.0-flash','gemini-1.5-flash','gemini-1.5-flash-8b'].filter(Boolean);
 const uniq=[...new Set(models)];
 let last='GEMINI_NO_MODEL';
 for(const m of uniq){
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(m)+':generateContent?key='+encodeURIComponent(apiKey);
  const r=await fetchT(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),systemInstruction:{parts:[{text:messages.find(x=>x.role==='system')?.content||''}]}})},Math.max(1200,Math.floor(ms/uniq.length)));
  if(!r.ok){last='GEMINI_'+r.status+':'+m;if(r.status===404||r.status===400)continue;throw Error(last)}
  const text=(await r.json()).candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
  if(String(text||'').trim())return text;
  last='GEMINI_EMPTY:'+m;
 }
 throw Error(last);
}
async function callGeminiEnv(env,messages,ms){
 return callGeminiKey(env.GEMINI_API_KEY,env.GEMINI_MODEL||'gemini-2.0-flash',messages,ms);
}
async function callOpenAICompat(base,key,model,messages,ms,provider){
 const r=await fetchT(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'},body:JSON.stringify({model,messages,temperature:.25})},ms);
 if(!r.ok)throw Error(provider.toUpperCase()+'_'+r.status);
 const text=(await r.json()).choices?.[0]?.message?.content||'';
 if(!String(text||'').trim())throw Error(provider.toUpperCase()+'_EMPTY');
 return text;
}
async function callAnthropic(env,messages,ms){
 const system=messages.find(x=>x.role==='system')?.content||'';
 const payload={model:env.ANTHROPIC_MODEL||'claude-3-5-haiku-latest',max_tokens:900,temperature:.25,system,messages:messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content}))};
 const r=await fetchT('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify(payload)},ms);
 if(!r.ok)throw Error('ANTHROPIC_'+r.status);
 const text=(await r.json()).content?.map(x=>x.text||'').join('')||'';
 if(!String(text||'').trim())throw Error('ANTHROPIC_EMPTY');
 return text;
}
async function callCloudflareModel(env,model,messages,ms){
 const out=await withTimeout(env.AI.run(model,{messages,temperature:0.25,max_tokens:900}),ms,'CF_AI_TIMEOUT');
 const text=out?.response||out?.result?.response||out?.choices?.[0]?.message?.content||out?.text||'';
 if(!String(text||'').trim())throw Error('CF_AI_EMPTY');
 return text;
}
function envProviderTasks(env,messages,mode,preferred=[]){
 const tasks=[],add=(id,label,fn)=>tasks.push({id,label,fn});
 if(env.GROQ_API_KEY)add('env:groq','Groq',ms=>callOpenAICompat('https://api.groq.com/openai/v1',env.GROQ_API_KEY,env.GROQ_MODEL||'llama-3.3-70b-versatile',messages,ms,'groq'));
 if(env.CEREBRAS_API_KEY)add('env:cerebras','Cerebras',ms=>callOpenAICompat('https://api.cerebras.ai/v1',env.CEREBRAS_API_KEY,env.CEREBRAS_MODEL||'llama3.1-8b',messages,ms,'cerebras'));
 if(env.OPENAI_API_KEY)add('env:openai','OpenAI',ms=>callOpenAICompat('https://api.openai.com/v1',env.OPENAI_API_KEY,env.OPENAI_MODEL||'gpt-4o-mini',messages,ms,'openai'));
 if(env.ANTHROPIC_API_KEY)add('env:anthropic','Anthropic',ms=>callAnthropic(env,messages,ms));
 if(env.GEMINI_API_KEY)add('env:gemini:'+(env.GEMINI_MODEL||'gemini-2.5-flash'),'Gemini',ms=>callGeminiEnv(env,messages,ms));
 if(env.OPENROUTER_API_KEY)add('env:openrouter','OpenRouter',ms=>callOpenAICompat('https://openrouter.ai/api/v1',env.OPENROUTER_API_KEY,env.OPENROUTER_MODEL||'openrouter/auto',messages,ms,'openrouter'));
 if(env.MISTRAL_API_KEY)add('env:mistral','Mistral',ms=>callOpenAICompat('https://api.mistral.ai/v1',env.MISTRAL_API_KEY,env.MISTRAL_MODEL||'mistral-small-latest',messages,ms,'mistral'));
 if(env.DEEPSEEK_API_KEY)add('env:deepseek','DeepSeek',ms=>callOpenAICompat('https://api.deepseek.com/v1',env.DEEPSEEK_API_KEY,env.DEEPSEEK_MODEL||'deepseek-chat',messages,ms,'deepseek'));
 if(env.TOGETHER_API_KEY)add('env:together','Together',ms=>callOpenAICompat('https://api.together.xyz/v1',env.TOGETHER_API_KEY,env.TOGETHER_MODEL||'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',messages,ms,'together'));
 if(env.PERPLEXITY_API_KEY)add('env:perplexity','Perplexity',ms=>callOpenAICompat('https://api.perplexity.ai',env.PERPLEXITY_API_KEY,env.PERPLEXITY_MODEL||'sonar-pro',messages,ms,'perplexity'));
 if(env.XAI_API_KEY)add('env:xai','xAI',ms=>callOpenAICompat('https://api.x.ai/v1',env.XAI_API_KEY,env.XAI_MODEL||'grok-3-mini',messages,ms,'xai'));
 if(env.AI){const cf=mode==='fast'?['@cf/meta/llama-3.1-8b-instruct-fp8','@cf/google/gemma-3-12b-it']:['@cf/meta/llama-3.1-8b-instruct-fp8','@cf/qwen/qwen1.5-14b-chat-awq','@cf/google/gemma-3-12b-it'];for(const model of cf)add('cf:'+model,'Cloudflare AI ('+model+')',ms=>callCloudflareModel(env,model,messages,ms))}
 const fast=['OpenRouter','Groq','Cerebras','OpenAI','Anthropic','Gemini','Mistral','DeepSeek','Together','Perplexity','xAI','Cloudflare'],strong=['OpenRouter','OpenAI','Anthropic','Gemini','Groq','DeepSeek','Mistral','Together','Perplexity','xAI','Cerebras','Cloudflare'];
 const rank=(x,arr)=>{const label=String(x.label||'').toLowerCase(),id=String(x.id||'').toLowerCase();const pref=preferred.findIndex(p=>label.includes(p)||id.includes(p));if(pref>=0)return pref;const i=arr.findIndex(p=>x.label.includes(p));return i<0?99:i+preferred.length};
 return tasks.sort((a,b)=>rank(a,mode==='fast'?fast:strong)-rank(b,mode==='fast'?fast:strong));
}
async function raceAiWave(env,tasks,ms,errs){
 const runnable=[];for(const t of tasks){if(await aiRouterAllowed(env,t.id))runnable.push(t);else errs.push(t.label+':SKIPPED_COOLDOWN')}
 if(!runnable.length)return null;
 let pending=runnable.length,settled=false;
 return await new Promise(resolve=>{
  const done=v=>{if(!settled){settled=true;resolve(v)}};
  const timer=setTimeout(()=>done(null),ms+350);
  for(const t of runnable){withTimeout(t.fn(ms),ms,t.label+'_TIMEOUT').then(async text=>{if(settled)return;if(!String(text||'').trim())throw Error('EMPTY_RESPONSE');await aiRouterMark(env,t.id,true);clearTimeout(timer);done({provider:t.label,text})}).catch(async e=>{const msg=String(e?.message||e||'UNKNOWN');errs.push(t.label+':'+msg);await aiRouterMark(env,t.id,false,msg);pending--;if(pending<=0){clearTimeout(timer);done(null)}})}
 });
}
async function aiFallback(env,messages,opts={}){
 const userText=opts.userText||messages.slice().reverse().find(x=>x.role==='user')?.content||'',mode=opts.mode||aiModeForText(userText),errs=[];
 const vault=opts.noVault?[]:(await credentialSecrets(env,'chat')).slice(0,4).map(c=>({id:'vault:'+c.id,label:c.label||c.provider,credential:c,fn:ms=>callVaultAI(env,c,messages,ms)}));
 const hints=await workingProviderHints(env);
 const envTasks=envProviderTasks(env,messages,mode,hints);
 const okVault=vault.filter(x=>String(x.credential?.last_status||'')==='ok');
 const restVault=vault.filter(x=>String(x.credential?.last_status||'')!=='ok');
 const waves=mode==='fast'?[okVault.slice(0,2).concat(envTasks.slice(0,3)),envTasks.slice(3,7).concat(restVault.slice(0,2)),envTasks.slice(7).concat(restVault.slice(2))]:[okVault.slice(0,3).concat(envTasks.slice(0,3)),envTasks.slice(3,7).concat(restVault),envTasks.slice(7)];
 for(const wave of waves){const clean=wave.filter(Boolean);if(!clean.length)continue;const got=await raceAiWave(env,clean,mode==='fast'?3500:6000,errs);if(got){for(const t of clean.filter(x=>x.credential&&x.label===got.provider))await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),t.credential.id);return got}}
 throw Error(errs.length?'ALL_AI_FAILED:'+errs.slice(-12).join('|'):'NO_AI_PROVIDER');
}
async function aiDiagnostics(env){
 const messages=[{role:'system',content:'Tek kelime cevap ver.'},{role:'user',content:'ping'}];
 const rows=await credentialSecrets(env,'chat'),items=[],started=now();
 for(const c of rows){
  const label=c.label||c.provider, t0=now();
  try{
   const text=await withTimeout(callVaultAI(env,c,messages,3500),4200,'DIAG_TIMEOUT');
   items.push({source:'vault',id:c.id,provider:c.provider,label,ok:!!String(text||'').trim(),latency_ms:now()-t0,model:c.model||null,error:null});
   await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),c.id);
  }catch(e){
   const error=String(e?.message||e||'UNKNOWN');
   items.push({source:'vault',id:c.id,provider:c.provider,label,ok:false,latency_ms:now()-t0,model:c.model||null,error});
   await run(env,'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?','error',error,now(),now(),c.id);
  }
 }
 const envTasks=envProviderTasks(env,messages,'fast');
 for(const t of envTasks.slice(0,12)){
  const t0=now();
  try{
   const text=await withTimeout(t.fn(3000),3600,'DIAG_TIMEOUT');
   items.push({source:'env',id:t.id,provider:t.label,label:t.label,ok:!!String(text||'').trim(),latency_ms:now()-t0,model:null,error:null});
  }catch(e){
   items.push({source:'env',id:t.id,provider:t.label,label:t.label,ok:false,latency_ms:now()-t0,model:null,error:String(e?.message||e||'UNKNOWN')});
  }
 }
 const working=items.filter(x=>x.ok);
 const fatal=!working.length;
 const recommendation=fatal
  ? 'Hiç çalışan AI sağlayıcısı yok. En az bir geçerli OpenAI, Groq, OpenRouter, Anthropic veya Gemini anahtarı eklenip testten geçmeli; aksi halde JARVIS gerçek AI gibi cevap veremez.'
  : 'Çalışan sağlayıcı var: '+working.map(x=>x.label).join(', ')+'. Router bunları önce kullanmalı.';
 return {ok:!fatal,working:working.length,total:items.length,duration_ms:now()-started,recommendation,items};
}
async function behaviorSkills(env){
 const saved=await kvGet(env,'behavior_skills',[]);
 const base=[
  'Kullanıcı bir sorunu test amaçlı sorabilir; tek soruya özel yama yapma, genel davranış problemini düzelt.',
  'Kullanıcı senden işini yaptırmak istiyor; gereksiz izin istemeden araştır, kontrol et, bağlamı toparla ve uygulanabilir cevap ver.',
  'Canlı bilgi gerekiyorsa kullanıcıya siteye bak deme; önce bağlı arama/kaynak/entegrasyonları kendin dene, kaynak yetersizse net söyle.',
  'AI veya entegrasyon hata verirse teknik hata dökmek yerine kısa anlaşılır durum ver, logla, çalışan sağlayıcıya geç ve mümkünse yerel/arama yedeğiyle cevapla.',
  'Cevaplar ChatGPT gibi doğal, hızlı ve işe yarar olsun; kullanıcı detay istiyorsa kim/ne/ne zaman/nerede/neden/nasıl/rakam/sonuç/sonraki adım bilgisini doldur, tek cümleyle geçiştirme.',
  'Ayar, bağlantı, Google servisleri, konum, takvim, dosya ve otomasyon isteklerinde eksik bağlantıyı tespit et; kullanıcıya hangi ekranda ne yapacağını net göster.',
  'Kullanıcı kızgınsa savunmaya geçme; önce hatayı sahiplen, sonra somut düzeltmeyi uygula ve sonucu doğrula.',
  'Demo/video/PDF ile gelen davranışları kalıcı çalışma kuralına çevir; aynı şikayet tekrar ederse sistemi yeniden teşhis et.',
  'PROMPT MASTER: Kullanıcının kaba veya kısa isteğini doğrudan çalıştırmadan önce sessizce netleştir: görev, hedef araç/model, çıktı biçimi, kapsam, kısıtlar, mevcut bağlam, başarı kriteri ve gerekirse örnekleri çıkar.',
  'PROMPT MASTER: Kritik bilgi eksikse en fazla 3 hedefli soru sor; eksik bilgi kritik değilse kullanıcıyı prompt yazmaya zorlamadan makul varsayımla devam et.',
  'PROMPT MASTER: Kodlama ve ajan görevlerinde hedef durum, izinli dosya/kapsam, dokunulmaması gereken alanlar, onay sınırları, doğrulama/test ve bitiş koşulunu belirle. Geri döndürülemez veya kapsam dışı işlemde onay iste.',
  'PROMPT MASTER: Uzun veya dağınık talimatları gereksiz kelimelerden arındır; aynı kuralı tekrar etme. Kullanıcı sonucu ister, prompt teorisini değil. İç yönlendirmeyi kullanıcıya göstermeden doğru AI sağlayıcısına uygun biçimde uygula.',
  'PROMPT MASTER: Geçmiş kararlar varsa context carry-forward kullan; yeni talimat geçmiş mimariyle çelişirse bunu fark et ve çelişkiyi çözmeden eski kararı sessizce ezme.',
  'PROMPT MASTER: Gizli chain-of-thought isteme veya gösterme; sonuç, varsayım, kanıt, kısa gerekçe ve doğrulama çıktısı gibi denetlenebilir sonuçlar üret.'
 ];
 const extra=Array.isArray(saved)?saved:[];
 return [...base,...extra].filter(Boolean);
}
async function behaviorSkillText(env){
 const list=await behaviorSkills(env);
 return list.map((x,i)=>(i+1)+'. '+x).join('\n');
}
function answerDetailMode(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/detay|ayrıntı|ayrinti|özetle|ozetle|anlat|açıkla|acikla|nasıl|nasil|neden|niye|kim|hangi|kaç|kac|ne zaman|dakika|fiyat|karşılaştır|karsilastir|listele|adım adım|adim adim|crt|cart|curt/.test(l))return 'detailed';
 if(l.length<28&&/(nedir|ne demek|ne işe yarar|ne ise yarar)/.test(l))return 'compact_but_useful';
 return 'normal';
}
function responsePolicy(text){
 const mode=answerDetailMode(text);
 const base='Genel cevap politikası: Kullanıcı test sorusu soruyor olabilir; konuya özel ezber cevap verme, sorunun niyetine göre kaliteli cevap üret. Sadece spor değil; yemek, ürün, araba, hukuk, sağlık dışı genel bilgi, canlı bilgi, teknik ayar, fiyat, rota ve entegrasyon sorularında aynı kaliteyi uygula. Cevabı güçlendirecek video, görsel, resmi kaynak, ürün sayfası, klip, inceleme veya kanıt linki varsa bulup cevaba ekle; telifli medyayı kopyalama, resmi/erişilebilir bağlantı ver.';
 if(mode==='detailed')return base+' Bu soru detay istiyor: kim/ne/ne zaman/nerede/neden/nasıl/kaç/sonuç/rakam/önemli olaylar/sonraki adım bilgilerini mümkün olduğunca doldur. Tek cümleyle geçiştirme. İlgili medya/kanıt varsa “İlgili video/kaynak” bölümü ekle. Kaynakta veri yoksa uydurma; “bu detay kaynakta görünmedi” diye ayır.';
 if(mode==='compact_but_useful')return base+' Soru kısa ama faydalı cevap ister: 2-4 cümleyle tanım, ne işe yarar, önemli içerik/örnek ve pratik not ver. Sadece “X şudur” deyip bırakma; uygun link/video varsa sona ekle.';
 return base+' Cevap ne çok kısa ne gereksiz uzun olsun; kullanıcının işini görecek kadar bilgi, gerekirse madde madde pratik sonuç ve ilgili link/video ver.';
}
function isBadAssistantAnswer(s){
 s=String(s||'').toLocaleLowerCase('tr-TR');
 return /google aramasını dene|google'da ara|googleda ara|siteye bak|sitelerine bak|kendin kontrol et|göz atabilirsiniz|goz atabilirsiniz|arama motorunda ara|bilemem|bilgim yok/.test(s);
}
function mediaSearchQueries(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR'),q=String(text||'').trim(),d=todayTR?.()||new Date().toISOString().slice(0,10),team=typeof sportsTeamName==='function'?sportsTeamName(text):'';
 const out=[];
 if(/maç|mac|gol|özet|ozet|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig/.test(l)){
  const base=(team||q)+' '+d;
  out.push(base+' gol videosu resmi');
  out.push(base+' maç özeti video beIN SPORTS');
  out.push(base+' highlights video');
 }else if(/ürün|urun|inceleme|review|nasıl yapılır|nasil yapilir|tamir|arıza|ariza|montaj|kurulum|ayar|bağla|bagla|kullanım|kullanim/.test(l)){
  out.push(q+' video inceleme');
  out.push(q+' nasıl yapılır video');
  out.push(q+' YouTube resmi anlatım');
 }else if(/görsel|gorsel|foto|resim|video|klip|kanıt|kanit|örnek|ornek/.test(l)){
  out.push(q+' video');
  out.push(q+' görsel kaynak');
 }
 return out.slice(0,3);
}
function isMediaResult(x){
 const u=String(x?.url||'').toLowerCase(),t=String(x?.title||'').toLowerCase();
 return /youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|beinsports|bein sports|video|highlights|özet|ozet|gol/.test(u+' '+t);
}
function isSportsQuestion(text){
 return /maç|mac|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig|spor|lig|hangi kanalda|fikstür|fikstur/.test(String(text||'').toLocaleLowerCase('tr-TR'));
}
function todayTR(){try{return new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'long',year:'numeric'}).format(new Date())}catch{return new Date().toISOString().slice(0,10)}}
function sportsDetailNeed(text){return /özet|ozet|gol|kim attı|kim atti|kaçıncı dakika|kacinci dakika|dakika|kart|penaltı|penalti|asist|maçını|macini/.test(String(text||'').toLocaleLowerCase('tr-TR'))}
function sportsTeamName(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/galatasaray|\bgs\b/.test(l))return 'Galatasaray';
 if(/fenerbahçe|fenerbahce|\bfb\b/.test(l))return 'Fenerbahçe';
 if(/beşiktaş|besiktas|\bbjk\b/.test(l))return 'Beşiktaş';
 if(/trabzonspor/.test(l))return 'Trabzonspor';
 return '';
}
function liveSearchQuery(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR'),d=todayTR(),team=sportsTeamName(text);
 if(team)return team+' '+d+' maç sonucu gol atanlar kaçıncı dakika maç özeti';
 if(/maç|mac|süper lig|super lig|spor|lig/.test(l))return text+' '+d+' maç sonucu gol atanlar özet';
 return text;
}
function compactResearchAnswer(text,results=[]){
 const clean=(results||[]).filter(x=>x&&x.title).slice(0,4);
 if(!clean.length)return null;
 const lines=clean.map(x=>`- ${x.title}${x.snippet?' — '+x.snippet:''}`);
 return `AI sağlayıcısı cevap veremedi ama ben aramayı yaptım. Bulduğum bilgiye göre:

${lines.join('\n')}`;
}
function researchFallbackAnswer(text,results=[]){
 const clean=(results||[]).filter(x=>x&&x.title).slice(0,5);
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(!clean.length){
  if(isSportsQuestion(text))return 'Canlı maç kaynağı şu an boş döndü. Kesin skor uydurmuyorum; ama sorunu kaybettirmedim ve çalışan AI sağlayıcısına kısa özet/yorum için geçiyorum.';
  return 'Canlı kaynak şu an boş döndü. Kesin bilgi uydurmuyorum; çalışan AI sağlayıcısı ve yerel yedekle cevaplamaya devam ediyorum.';
 }
 const lines=clean.map((x,i)=>`${i+1}. ${x.title}${x.snippet?' - '+x.snippet:''}${x.url?' ('+x.url+')':''}`);
 if(isSportsQuestion(text)){
  return `Baktım. Canlı kaynaklardan netleştirebildiğim maç bilgisi şu:

${lines.join('\n')}

Saat/kanal değişebildiği için resmi kulüp, TFF veya yayıncı bilgisini esas aldım; sonuçlar yetersizse bunu açıkça söylerim, seni Google'a göndermem.`;
 }
 return `Baktım. Ulaşabildiğim canlı sonuçların özeti:

${lines.join('\n')}

Kaynaklar yetersizse bunu açıkça söylerim; seni aramaya göndermem.`;
}
function localFallbackAnswer(text,error=''){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/kola|cola|coca.?cola|pepsi/.test(l)&&/(nedir|ne demek|içinde|icinde|içindeki|icindeki|element|madde|neler var|ne var|bileşen|bilesen|içerik|icerik)/.test(l)){
  if(/nedir|ne demek/.test(l)&&!/(içinde|icinde|element|madde|içerik|icerik)/.test(l))return 'Kola; su, şeker veya tatlandırıcı, karbondioksit, kafein, asitlik düzenleyici ve aroma karışımıyla yapılan gazlı bir içecektir. Yani temel olarak gazlı, tatlı ve kafeinli bir meşrubattır.';
  return `Kolanın temel içeriği genelde şunlardır:

- Su
- Şeker veya tatlandırıcı
- Karbondioksit: gazlı yapan madde
- Karamel renklendirici
- Fosforik asit veya sitrik asit: ekşi/sert tadı verir
- Kafein: uyarıcı etki
- Aroma karışımı: markaya göre gizli formül
- Bazı çeşitlerde koruyucu/asitlik düzenleyici maddeler

Kimyasal element olarak bakarsan en çok karbon, hidrojen ve oksijen vardır; karbondioksitten karbon/oksijen, fosforik asitten fosfor da gelir. Yani “element” değil “içindekiler” diye sorarsak cevap daha çok su, şeker, CO2, asit, kafein ve aroma olur.`;
 }
 if(/fırında|firinda/.test(l)&&/tavuk/.test(l)){
  return `Fırında tavuk için pratik ayar:

- Fanlı fırın: 190°C
- Alt-üst: 200°C
- Kanat/pirzola küçük parçalar: 35-45 dakika
- But/kalın parça: 45-60 dakika
- Son 8-10 dakika 220°C yaparsan üstü güzel kızarır.

Tepsiye çok üst üste koyma. Soslu tavukta ilk 25-30 dakika pişir, sonra çevir. İçinin güvenli olması için en kalın yerde suyu berrak akmalı; termometre varsa iç sıcaklık 74°C üstü olsun.`;
 }
 if(/anzeige|şikayet|sikayet|polise|polis/.test(l)){
  return `Almanya'da polise Anzeige yapmak için kısa yol:

1. Acil tehlike varsa 110 ara.
2. Acil değilse eyaletinin Onlinewache/Internetwache sitesinden online Anzeige yapabilirsin.
3. Olay yeri, tarih-saat, karşı taraf bilgisi, ekran görüntüsü/fotoğraf/video ve tanık varsa hazırla.
4. Yakındaki Polizeidienststelle'ye gidip sözlü Anzeige de verebilirsin.
5. İşlem sonunda Vorgangsnummer/Aktenzeichen iste ve sakla.

Bana şehir/eyaletini yazarsan sana doğru Onlinewache linkini net veriririm.`;
 }
 if(/google|gmail|calendar|drive|docs|maps|youtube|search/.test(l)&&/(bağla|bagla|servis|ayar|izin|oauth)/.test(l)){
  return `Google servisleri için gereken akış şu olmalı:

1. Ayarlar > Google servisleri bölümünden bağlantı ekranı açılır.
2. Backend'de Google OAuth Client ID ve Client Secret tanımlı olmalı.
3. Redirect URL Google Cloud Console'a birebir eklenmeli.
4. Kullanıcı Safari'de Google hesabıyla izin verir.
5. Dönen token güvenli kasaya kaydedilir; Gmail, Calendar, Drive, Docs, Maps/Search/YouTube istekleri oradan çalışır.

Şu an bağlantı cevap vermiyorsa sorun genelde OAuth ayarı veya backend timeout tarafında. JARVIS bunu kullanıcıya sadece \"siteye bak\" diye bırakmamalı; bağlantı durumunu kendisi test edip eksik alanı söylemeli.`;
 }
 if(/nasıl|nasil|ne yap|anlat|tarif|kaç|kac|neden|niye|olur mu|olurmu/.test(l)){
  return `Bağlı AI servisleri şu an cevap vermedi ama isteğini kaybettirmedim. Bu soru için hızlı cevap verebilmem gerekiyor; servisler düşse bile JARVIS'in yerel yedek cevabı devreye girdi. Teknik ayrıntıyı sana dökmek yerine arka planda logladım. Soruyu biraz daha net yazarsan kısa pratik cevapla devam ederim.`;
 }
 return null;
}
async function discoverTools(env,cap){const q=`best AI tool ${cap} API automation`;const results=await ddg(q);return results.slice(0,6)}
function needsLiveLookupText(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 return /(güncel|guncel|bugün|bugun|şimdi|simdi|son durum|sonuç|sonuc|fiyat|kaç para|kac para|ne kadar|satılıyor|satiliyor|nerede|nerden|nereden|yakınımda|yakinimda|açık mı|acik mi|uçuş|ucus|tren|kargo|rezervasyon|seçim|secim|hava durumu|kur|borsa|sigara|market|amazon|ebay|link|araştır|arastir|bakabilir|bakıp|bakip|kontrol et|bak|maç|mac|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig|spor|lig)/.test(l);
}
async function quickCommand(env,text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');

 // YouTube URL otomatik öğrenme
 const ytMatch=text.match(/https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/watch\?[^\s]*v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)/i);
 if(ytMatch&&/öğren|learn|izle|watch|kaydet|öğret|analiz/i.test(l)){
   try{
     const{parseYouTubeResourceUrl,fetchYouTubeTranscript}=await import('./lib/youtube-teaching-runtime.js');
     const{persistYouTubeLearning}=await import('./lib/youtube-learning-memory.js');
     const parsed=parseYouTubeResourceUrl(ytMatch[0]);
     if(parsed?.videoId){
       const result=await fetchYouTubeTranscript(ytMatch[0]);
       if(result?.transcript){
         const lr=await persistYouTubeLearning(env,{kind:'video',source_url:ytMatch[0],video_id:parsed.videoId,title:result.title||'',language:result.language||'',transcript:result.transcript},{});
         return{reply:`✓ Video öğrenildi: "${result.title||'Video'}"\n\n${lr.learning_chunks} parça hafızaya kaydedildi (${result.transcript.length} karakter). Artık bu konuda sorduğun sorularda bu videodan öğrendiğim bilgiyi kullanacağım.`,action:'youtube_learn',provider:'JARVIS Skill'};
       }
     }
   }catch(e){
     return{reply:`YouTube transcript çekilemedi: ${e.message}. Video'da altyazı kapalı olabilir.`,action:'youtube_learn_error',provider:'JARVIS Skill'};
   }
 }

 // Sadece DTC kodu sorulmuşsa direkt veritabanından cevapla (AI çağırmadan)
 const dtcOnly=text.match(/^\s*([PBCU][0-3]\d{3})\s*$/i);
 if(dtcOnly){
   try{
     const code=dtcOnly[1].toUpperCase();
     const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);
     if(row){
       const causes=(safeJsonParse(row.causes,[])||[]).map((c,i)=>`${i+1}. [${c.p||'?'}] ${c.de||c.en||c.id}`).join('\n');
       const repair=safeJsonParse(row.repair,{});
       let reply=`**${code}** — ${row.title_de||row.title_en}\n\n${row.desc_de||row.desc_en}`;
       if(causes)reply+=`\n\nOlası sebepler:\n${causes}`;
       if(repair.difficulty)reply+=`\n\nTamir: ${repair.difficulty}${repair.diy_possible?' · DIY mümkün':''}${repair.estimated_cost_eur?` · €${repair.estimated_cost_eur[0]}–${repair.estimated_cost_eur[1]}`:''}`;
       return{reply,action:'dtc_lookup',provider:'JARVIS DTC Database'};
     }
   }catch{}
 }

 if(needsLiveLookupText(text)){
  let results=[];try{results=await withTimeout(liveResearch(text,isSportsQuestion(text)?2300:2800),3000,'LIVE_RESEARCH_TOTAL_TIMEOUT')}catch{}
  const system='Sen JARVIS adlı Türkçe asistansın. Kullanıcıya doğrudan ve işe yarar cevap ver. Google’a yönlendirme, “kendin bak” deme. '+responsePolicy(text)+' Canlı/web sonuçları varsa değerlendir; tek cümleyle geçiştirme. Sonuçlarda video/klip/ürün/resmi kaynak bağlantısı varsa cevabın sonuna “İlgili video/kaynak” diye ekle. Bugünkü/şimdiki sorularda eski/sonraki sonuçları karıştırma. Detay kaynakta yoksa bunu açık yaz, uydurma.';
  const prompt='Bugünün tarihi: '+todayTR()+'\nKullanıcı sorusu: '+text+'\n\nCanlı/web sonuçları: '+JSON.stringify(results.slice(0,12));
  try{const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}],{userText:text,mode:'fast'}),3800,'LIVE_AI_TIMEOUT');if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:results.length?'live_ai_research':'live_ai_no_results',provider:a.provider,results:results.slice(0,6)}}catch{}
  const local=localFallbackAnswer(text,'');
  if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'JARVIS Local'};
  return{reply:researchFallbackAnswer(text,results),action:'live_research',provider:results.length?'JARVIS Live Search':'JARVIS Live Search: empty',results:results.slice(0,5)};
 }
 const local=localFallbackAnswer(text,'');
 if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'JARVIS Local'};
 const system='Sen JARVIS adlı Türkçe kişisel asistansın. Kullanıcıya ChatGPT gibi doğal, net ve işe yarar cevap ver. Kullanıcıya Google’da ara, siteye bak, kendin kontrol et deme. Bilmediğin canlı/değişebilir bilgiyi kesinmiş gibi uydurma. '+responsePolicy(text)+' JARVIS DAVRANIŞ BECERİLERİ:\n'+await behaviorSkillText(env);
 try{
  const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:text}],{userText:text,mode:'fast'}),8500,'QUICK_AI_TIMEOUT');
  if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:'ai',provider:a.provider};
 }catch{}
 try{
  const results=await ddg(text+' nedir açıklama',2800);
  const answer=compactResearchAnswer(text,results);
  if(answer)return{reply:answer,action:'search_fallback',provider:'JARVIS Search',results:results.slice(0,4)};
 }catch{}
 return{reply:local||'Şu an bağlı cevap motoru zamanında dönemedi. Sorunu kaydettim; kısa cevap için tekrar deniyorum ve çalışan sağlayıcıları öne alıyorum.',action:'local_fallback',provider:'JARVIS Local'};
}
async function command(env,text){await log(env,'user',text);const l=text.toLocaleLowerCase('tr-TR');const remembered=await rememberExplicit(env,text);if(remembered){const reply=`Bunu hafızama kaydettim: ${remembered}`;await log(env,'jarvis',reply);return{reply,action:'memory'}}
 if(/davranış becerileri|davranis becerileri|çalışma kuralları|calisma kurallari|skills cloud|claude\.md|jarvis kuralları|jarvis kurallari/.test(l)){const reply='JARVIS davranış becerileri aktif:\n'+await behaviorSkillText(env);await log(env,'jarvis',reply,{provider:'JARVIS Behavior Skills'});return{reply,action:'behavior_skills',provider:'JARVIS Behavior Skills'}}
 if(/görev.*ekle|hatırlat/.test(l)){const title=text.replace(/^(jarvis[, ]*)?/i,'').replace(/görev.*ekle[: ]*/i,'').replace(/bana hatırlat[: ]*/i,'').trim()||text;const t=now();await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id(),title,'Orta','open','genel',t,t);const reply=`Görevi ekledim: ${title}`;await log(env,'jarvis',reply);return{reply,action:'task'}}
 if((l.includes('bugün')&&(l.includes('ne yapt')||l.includes('özet')||l.includes('neler oldu')))||l.includes('günlük brief')){const b=await brief(env);const reply=`Bugünkü durum: ${b.text}${b.top?` Sıradaki iş: ${b.top}.`:''}`;await log(env,'jarvis',reply);return{reply,action:'brief'}}
 if(l.startsWith('araştır ')||l.includes('internette araştır')){const q=text.replace(/^araştır\s*/i,'').replace(/internette araştır/ig,'').trim()||text;const results=await ddg(q),reply=`Araştırmayı yaptım. ${results.length} sonuç buldum${results[0]?`: ${results[0].title}`:''}.`;await log(env,'jarvis',reply,{q,count:results.length});return{reply,action:'research',results}}
 if(/(?:jarvis[, ]*)?(?:şunu|sunu|bu|şu)?\s*(?:özelliği|özellik|modül|modulu|panel|fonksiyon).*ekle|kendini.*(?:düzelt|güncelle|iyileştir)|(?:hata|bug).*?(?:bul|düzelt)|(?:ekle|değiştir|düzelt).*?(?:jarvis|uygulama)/i.test(text)){const r=await createSelfChange(env,text,'user');const reply=r.ok?`İsteği kendi koduma uygulamak için değişikliği hazırladım: ${r.summary}. Otomatik test/deploy hattına gönderdim.`:r.message;await log(env,'jarvis',reply,r);return{reply,action:'self_update',selfUpdate:r}}
 if(/reels|video oluştur|görsel oluştur|şarkı.*üret|seslendir|altyazı/.test(l)){let cap='content-generation';if(/reels|video/.test(l))cap='reels-video';else if(/görsel/.test(l))cap='image-generation';else if(/şarkı|müzik/.test(l))cap='music-generation';else if(/seslendir/.test(l))cap='tts';else if(/altyazı/.test(l))cap='transcription';const tools=await qall(env,'SELECT * FROM tool_registry WHERE capability=? AND enabled=1 ORDER BY priority ASC',cap);if(!tools.length){const found=await discoverTools(env,cap);const reply=`Bu iş için henüz bağlı bir araç yok. ${found.length} uygun AI aracı buldum; Araç Keşfi bölümünde göstereceğim.`;await log(env,'jarvis',reply,{cap});return{reply,action:'tool_discovery',cap,tools:found}}}
 const needsLiveResearch=needsLiveLookupText(text)||/(nedir|ne demek|ne işe yarar|ne ise yarar|içinde|icinde|içindeki|icindeki|neler var|ne var|kimdir|hangisi|nasıl|nasil)/.test(l);
 let researchContext='',researchResults=[];
 if(needsLiveResearch){
  try{
   researchResults=await liveResearch(text,isSportsQuestion(text)?2400:3200);
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA SONUÇLARI (kullanıcıya sitelere kendin bak deme; bu sonuçları değerlendir, yeterli değilse erişemediğini açık söyle; detay sorulduysa kim/ne/ne zaman/nerede/neden/nasıl/rakam/sonuç bilgilerini doldur; video/klip/resmi kaynak/ürün linki varsa “İlgili video/kaynak” olarak ekle): '+JSON.stringify(researchResults.slice(0,10));
   await log(env,'research','Otomatik araştırma: '+text,{count:researchResults.length});
  }catch(e){
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA DENEMESİ BAŞARISIZ: '+e.message+'. Kullanıcıya rastgele siteye bak demek yerine, erişemediğini açık söyle ve hangi resmi kaynağın gerektiğini belirt.';
   await log(env,'research','Otomatik araştırma başarısız: '+text,{error:e.message});
  }
 }
 if(needsLiveResearch&&researchResults.length){
  const system='Sen JARVIS adlı Türkçe asistansın. Canlı/web sonuçlarını kullanarak doğrudan cevap ver. Kullanıcıyı aramaya yönlendirme. '+responsePolicy(text)+' Sonuçlarda video/klip/resmi kaynak/ürün linki varsa cevabın sonuna “İlgili video/kaynak” bölümü ekle. Bugünkü/şimdiki sorularda eski/sonraki verileri karıştırma.';
  const prompt='Bugünün tarihi: '+todayTR()+'\nKullanıcı sorusu: '+text+'\n\nCanlı/web sonuçları: '+JSON.stringify(researchResults.slice(0,12));
  try{const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}],{userText:text,mode:'fast'}),3800,'LIVE_AI_TIMEOUT');if(a?.text&&!isBadAssistantAnswer(a.text)){await log(env,'jarvis',a.text,{provider:a.provider,direct:true});return{reply:a.text,action:'live_ai_research',provider:a.provider,results:researchResults.slice(0,6)}}}catch(e){await recordRuntimeError(env,e,'command.live_ai')}
 }
 const s=await state(env),history=await chatHistory(env,30),mem=await qall(env,'SELECT text,tags FROM memories ORDER BY created_at DESC LIMIT 30'),skills=await behaviorSkillText(env),policy=responsePolicy(text);
 // YouTube öğrenme hafızasını ara — ücretsiz, AI çağrısı değil
 let learningContext='';
 try{const{searchLearningMemory,learningContextText}=await import('./lib/youtube-learning-memory.js');const lRows=await searchLearningMemory(env,text,{limit:4});if(lRows.length)learningContext='\n\nÖĞRENİLMİŞ VİDEO NOTLARI (YouTube\'dan öğrenilen içerik — bu bilgileri cevabında kullan):\n'+learningContextText(lRows)}catch{}
 // DTC kodu tespit — P0xxx, B0xxx, C0xxx, U0xxx formatında
 let dtcContext='';
 try{const dtcMatches=text.match(/\b[PBCU][0-3]\d{3}\b/gi);if(dtcMatches){const unique=[...new Set(dtcMatches.map(c=>c.toUpperCase()))].slice(0,5);const results=[];for(const code of unique){const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);if(row)results.push({code,title_en:row.title_en,title_de:row.title_de,desc_en:row.desc_en,parts:safeJsonParse(row.parts,[]),causes:safeJsonParse(row.causes,[]),repair:safeJsonParse(row.repair,{})})}if(results.length)dtcContext='\n\nDTC VERİTABANI SONUÇLARI (9204 kodluk OBDex veritabanından — bu bilgileri cevabında kullan, tek DTC\'ye körü körüne bağlanma, bütün hata ağını değerlendir):\n'+JSON.stringify(results)}}catch{}
 const system=`Sen JARVIS adlı Türkçe kişisel asistansın. ChatGPT gibi doğal sohbet et ama aynı zamanda aksiyon alan kişisel asistansın. ${policy} Güncel bilgi, fiyat, ürün, yer, uçuş, kargo, rezervasyon, yasa, seçim, hava durumu veya değişebilir bilgi sorulursa kullanıcıya \\\"siteye gir bak\\\" deme; önce sen web/canlı araştırma sonuçlarını kullanarak netleştir. Erişim yoksa bunu açık söyle, ama kullanıcıyı baştan savma. Kullanıcının önceki sohbetlerini ve hafızasını bağlam olarak kullan. Kısa gerektiğinde kısa, detay gerektiğinde detaylı ol. Bağlı olmayan entegrasyonları uydurma. Kullanıcı işi bitirmeni ister; gerektiğinde araştır, planla ve bağlı araçlar arasında geçiş yap. Geri döndürülemez işlemlerde onay iste. JARVIS DAVRANIŞ BECERİLERİ:\n${skills}\nKalıcı hafıza: ${JSON.stringify(mem)} Sistem bağlamı: ${JSON.stringify({brief:s.brief,tasks:s.tasks.slice(0,20),projects:s.projects.slice(0,20),integrations:s.integrations})}${researchContext}${learningContext}${dtcContext}`;let a;try{a=await aiFallback(env,[{role:'system',content:system},...history.slice(-20,-1).map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content})),{role:'user',content:text}],{userText:text})}catch(e){const msg=String(e?.message||e||'UNKNOWN').slice(0,500),fallback=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,researchResults),reply=fallback||'Şu an bağlı AI servisleri zamanında cevap vermedi. Teknik hatayı kaydettim; ayarlardaki AI sağlayıcısı/model anahtarlarını yenilemek gerekiyor.';await recordRuntimeError(env,e,'chat.ai');await log(env,'jarvis',reply,{provider:'system',error:msg});return{reply,action:fallback?'local_fallback':'ai_error',provider:fallback?'JARVIS Local':'system'}}if(!String(a.text||'').trim()){const reply='AI sağlayıcısı boş cevap döndürdü. Bunu hata olarak kaydettim; başka sağlayıcı veya ayar kontrolü gerekiyor.';await recordRuntimeError(env,Error('EMPTY_AI_REPLY:'+a.provider),'chat.ai');await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai_error',provider:a.provider}}
 let reply=a.text;
 if(isBadAssistantAnswer(reply)){
  await aiRouterMark(env,a.provider,false,'BAD_ASSISTANT_ANSWER');
  const fixed=researchFallbackAnswer(text,researchResults)||localFallbackAnswer(text,'BAD_ASSISTANT_ANSWER');
  if(fixed){reply=fixed;await log(env,'jarvis',reply,{provider:'JARVIS Guard',blockedProvider:a.provider});return{reply,action:'guarded_fallback',provider:'JARVIS Guard',results:researchResults.slice(0,5)}}
 }
 await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai',provider:a.provider}}
async function router(req,env,ctx=null){const u=new URL(req.url),p=u.pathname,m=req.method;
 if(p==='/api/health')return j({ok:true,cloud:true,ts:now()});
 if(p==='/api/auth/passkey/auth/options'&&m==='POST'){const x=await authenticationOptions(req,env);return x?.error?j({error:x.error},x.status||400):j(x)}
 if(p==='/api/auth/passkey/auth/verify'&&m==='POST'){const x=await verifyAuthentication(req,env);return x.ok?j({ok:true,verified:true},200,{'set-cookie':x.cookie}):j({error:x.error||'PASSKEY_VERIFY_FAILED'},400)}
 if(p==='/api/auth/status'){const cfg=!!(await kvGet(env,'auth',null));return j({configured:cfg,authenticated:await isAuthed(req,env),passkeys:await passkeyCount(env)})}
 if(p==='/api/auth/setup'&&m==='POST'){if(await kvGet(env,'auth',null))return j({error:'ALREADY_CONFIGURED'},409);const b=await body(req),pw=String(b.password||'');if(pw.length<8)return j({error:'PASSWORD_MIN_8'},400);const salt=id(),auth={salt,hash:await hashPassword(pw,salt)};await kvSet(env,'auth',auth);const tok=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'owner',exp:now()+2592e6});return j({ok:true},200,{'set-cookie':cookie(tok)})}
 if(p==='/api/auth/login'&&m==='POST'){const auth=await kvGet(env,'auth',null),b=await body(req);if(!auth)return j({error:'NOT_CONFIGURED'},400);if(await hashPassword(String(b.password||''),auth.salt)!==auth.hash)return j({error:'INVALID_PASSWORD'},403);const tok=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'owner',exp:now()+2592e6});return j({ok:true},200,{'set-cookie':cookie(tok)})}
 if(p==='/api/auth/logout'&&m==='POST')return j({ok:true},200,{'set-cookie':cookie('',0)});
 if(p==='/api/runtime/report'&&m==='POST'){const b=await body(req),message=String(b.message||b.error||'UNKNOWN').slice(0,3000),context=String(b.context||'ios').slice(0,200),userText=String(b.userText||'').slice(0,1000);await recordRuntimeError(env,Error(message),context+(userText?' | user: '+userText:''));await log(env,'runtime','Uygulama hatası raporlandı',{context,message:message.slice(0,500),userText});return j({ok:true,queued:true})}
  if(p.startsWith('/api/')&&!(await isAuthed(req,env)))return j({error:'AUTH_REQUIRED'},401);
 if(p==='/api/auth/passkey/register/options'&&m==='POST')return j(await registrationOptions(req,env));
 if(p==='/api/auth/passkey/register/verify'&&m==='POST'){const x=await verifyRegistration(req,env);return x.ok?j(x):j({error:x.error||'PASSKEY_VERIFY_FAILED'},400)}
 if(p==='/api/auth/passkeys'&&m==='GET')return j(await passkeys(env));
 let pkm=p.match(/^\/api\/auth\/passkeys\/([^/]+)$/);if(pkm&&m==='DELETE'){await run(env,'DELETE FROM passkeys WHERE id=?',decodeURIComponent(pkm[1]));await log(env,'auth','Passkey silindi');return j({ok:true})}
 if(p==='/api/credentials'&&m==='GET')return j(await credentialRows(env));
 if(p==='/api/credentials'&&m==='POST'){
   const b=await body(req),provider=String(b.provider||'').trim(),label=String(b.label||provider).trim(),secret=String(b.secret||'').trim();
   if(!provider||!secret)return j({error:'PROVIDER_AND_SECRET_REQUIRED'},400);
   const x={id:id(),provider,label,kind:b.kind||'api_key',encrypted:await encSecret(env,secret),caps:Array.isArray(b.capabilities)?b.capabilities:['chat'],endpoint:b.endpoint||null,model:b.model||null,priority:Number(b.priority||100),meta:b.meta||{},t:now()};
   await run(env,'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',x.id,x.provider,x.label,x.kind,x.encrypted,JSON.stringify(x.caps),x.endpoint,x.model,x.priority,1,JSON.stringify(x.meta),'untested',x.t,x.t);
   await log(env,'credential','Yeni sağlayıcı eklendi: '+x.label,{provider:x.provider,capabilities:x.caps});return j({ok:true,id:x.id})
 }
 let cm=p.match(/^\/api\/credentials\/([^/]+)$/);if(cm&&m==='DELETE'){await run(env,'DELETE FROM credentials WHERE id=?',cm[1]);return j({ok:true})}
 cm=p.match(/^\/api\/credentials\/([^/]+)\/toggle$/);if(cm&&m==='POST'){const c=await q1(env,'SELECT enabled FROM credentials WHERE id=?',cm[1]);if(!c)return j({error:'NOT_FOUND'},404);await run(env,'UPDATE credentials SET enabled=?,updated_at=? WHERE id=?',c.enabled?0:1,now(),cm[1]);return j({ok:true})}
 cm=p.match(/^\/api\/credentials\/([^/]+)\/test$/);if(cm&&m==='POST'){const c=await q1(env,'SELECT * FROM credentials WHERE id=?',cm[1]);if(!c)return j({error:'NOT_FOUND'},404);c.secret=await decSecret(env,c.encrypted_secret);return j(await testCredential(env,c))}
 if(p==='/api/self-update/status'){const c=await githubCredential(env),changes=await qall(env,'SELECT id,request,origin,status,provider,repo,branch,pr_url,summary,created_at,updated_at FROM change_requests ORDER BY created_at DESC LIMIT 50');return j({connected:!!c,repo:c?repoCfg(c).repo:null,changes})}
 if(p==='/api/self-update/request'&&m==='POST'){const b=await body(req),request=String(b.request||'').trim();if(!request)return j({error:'REQUEST_REQUIRED'},400);return j(await createSelfChange(env,request,'user'))}

 if(p==='/api/google/setup-info'&&m==='GET'){const c=await googleCredential(env),rp=rpFrom(req);return j({configured:!!c,connected:!!(await googleStored(env)),redirect:rp.origin+'/api/google/callback',client_id:c?.endpoint||null})}
 if(p==='/api/google/setup'&&m==='POST'){const b=await body(req),clientId=String(b.client_id||'').trim(),clientSecret=String(b.client_secret||'').trim();if(!clientId||!clientSecret)return j({error:'GOOGLE_CLIENT_ID_AND_SECRET_REQUIRED'},400);if(!clientId.includes('.apps.googleusercontent.com'))return j({error:'GOOGLE_CLIENT_ID_INVALID',detail:'Client ID .apps.googleusercontent.com ile bitmeli'},400);const t=now(),existing=await q1(env,"SELECT id FROM credentials WHERE provider='google' ORDER BY created_at DESC LIMIT 1"),enc=await encSecret(env,clientSecret);if(existing){await run(env,"UPDATE credentials SET label=?,kind=?,encrypted_secret=?,capabilities=?,endpoint=?,model=?,priority=?,enabled=1,last_status='ok',last_error=NULL,updated_at=? WHERE id=?",'Google OAuth','oauth_client',enc,JSON.stringify(['gmail','drive']),clientId,null,10,t,existing.id)}else{await run(env,'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id(),'google','Google OAuth','oauth_client',enc,JSON.stringify(['gmail','drive']),clientId,null,10,1,JSON.stringify({}),'ok',t,t)}await log(env,'credential','Google OAuth istemcisi kaydedildi');return j({ok:true,redirect:rpFrom(req).origin+'/api/google/callback'})}
 if(p==='/api/google/connect'&&m==='GET'){const c=await googleCredential(env),rp=rpFrom(req),redirect=rp.origin+'/api/google/callback';if(!c)return j({error:'GOOGLE_CREDENTIAL_REQUIRED',setupRequired:true,redirect,detail:'Google OAuth Client ID ve Client Secret gerekli'},400);const state=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'google-oauth',exp:now()+600000}),scopes=['openid','email','profile','https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/drive'].join(' '),url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:String(c.endpoint||''),redirect_uri:redirect,response_type:'code',scope:scopes,access_type:'offline',prompt:'consent',state});return j({url,redirect})}
 if(p==='/api/google/callback'&&m==='GET'){const st=await verify(env.JARVIS_SECRET||'CHANGE_ME',u.searchParams.get('state'));if(!st||st.sub!=='google-oauth')return txt('Invalid OAuth state',400);const c=await googleCredential(env);if(!c)return txt('Google credential missing',400);const redirect=u.origin+'/api/google/callback',form=new URLSearchParams({code:String(u.searchParams.get('code')||''),client_id:String(c.endpoint||''),client_secret:c.secret,redirect_uri:redirect,grant_type:'authorization_code'}),r=await fetchT('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});if(!r.ok)return txt('Google token exchange failed '+r.status,400);const t=await r.json();t.expires_at=now()+Number(t.expires_in||3600)*1000;const pr=await fetchT('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{authorization:'Bearer '+t.access_token}}),profile=pr.ok?await pr.json():{};await kvSet(env,'google_oauth',{email:profile.email||'',scope:t.scope||'',blob:await encSecret(env,JSON.stringify(t))});await log(env,'integration','Google hesabı bağlandı: '+(profile.email||''));return Response.redirect(u.origin+'/?google=connected',302)}
 if(p==='/api/gmail/messages'&&m==='GET')return j(await gmailList(env,10));
 if(p==='/api/gmail/prepare-send'&&m==='POST'){const b=await body(req),to=String(b.to||'').trim(),subject=String(b.subject||''),bd=String(b.body||'').trim();if(!to||!bd)return j({error:'TO_AND_BODY_REQUIRED'},400);return j(await pendingAction(env,'gmail_send',{to,subject,body:bd},`${to} adresine e-posta gönder: ${subject||'(konusuz)'}`))}
 if(p==='/api/drive/files'&&m==='GET')return j(await driveFiles(env));
 if(p==='/api/social/prepare-facebook'&&m==='POST'){const b=await body(req);if(!String(b.message||'').trim())return j({error:'MESSAGE_REQUIRED'},400);return j(await pendingAction(env,'facebook_post',{message:String(b.message)},'Facebook paylaşımı yap'))}
 if(p==='/api/social/prepare-instagram'&&m==='POST'){const b=await body(req);if(!String(b.imageUrl||'').trim())return j({error:'IMAGE_URL_REQUIRED'},400);return j(await pendingAction(env,'instagram_post',{imageUrl:String(b.imageUrl),caption:String(b.caption||'')},'Instagram paylaşımı yap'))}
 let am=p.match(/^\/api\/actions\/([^/]+)\/(approve|reject)$/);if(am&&m==='POST'){const a=await q1(env,'SELECT * FROM actions WHERE id=?',am[1]);if(!a)return j({error:'NOT_FOUND'},404);if(am[2]==='reject'){await run(env,'UPDATE actions SET status=?,completed_at=? WHERE id=?','rejected',now(),a.id);return j({ok:true})}const result=await executeAction(env,a);await run(env,'UPDATE actions SET status=?,completed_at=? WHERE id=?','done',now(),a.id);await log(env,'action','İşlem gerçekleştirildi: '+a.summary,{result});return j({ok:true,result})}

 if(p==='/api/chat/history'&&m==='GET')return j(await chatHistory(env,Number(u.searchParams.get('limit')||120)));
 if(p==='/api/chat/send'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);const ts=now();try{if(/ai.*(durum|test|kontrol|diag)|sağlayıcı.*(durum|test|kontrol)|saglayici.*(durum|test|kontrol)/i.test(text)){const d=await aiDiagnostics(env);const reply=d.ok?('AI sistemi çalışıyor. Çalışan sağlayıcı sayısı: '+d.working+'/'+d.total+'. '+d.recommendation):('AI sistemi çalışmıyor. '+d.recommendation);return j({reply,action:'ai_diagnostics',provider:'JARVIS Diagnostics',diagnostics:d,history:[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'JARVIS Diagnostics',created_at:now()}]})}const r=await withTimeout(quickCommand(env,text),9500,'QUICK_COMMAND_TIMEOUT');const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:r.reply,provider:r.provider||null,created_at:now()}];const persist=async()=>{try{await addChat(env,'user',text,null);await addChat(env,'assistant',r.reply,r.provider||null);await log(env,'jarvis-fast',r.reply,{provider:r.provider,action:r.action})}catch(e){await recordRuntimeError(env,e,'chat.persist')}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({...r,history})}catch(e){const msg=String(e?.message||e||'UNKNOWN'),reply=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,[])||'Cevap motoru zamanında dönemedi. İsteğini kaydettim; teknik hata detayını sana dökmüyorum.';const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'JARVIS Local',created_at:now()}];const persist=async()=>{try{await recordRuntimeError(env,e,'chat.send');await addChat(env,'user',text,null);await addChat(env,'assistant',reply,'JARVIS Local')}catch{}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({reply,action:'local_fallback',provider:'JARVIS Local',history})}}
 if(p==='/api/chat/clear'&&m==='POST'){await run(env,'DELETE FROM chat_messages');return j({ok:true})}

 // ECU Tuning v2 — R2 + scan-based regions + AI compare
 if(p==='/api/ecu/upload'&&m==='POST'){try{
   if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);
   const b=await body(req);
   const fileData=typeof b.fileData==='string'?Uint8Array.from(atob(b.fileData),c=>c.charCodeAt(0)):new Uint8Array(b.fileData||[]);
   if(!fileData.length)return j({error:'EMPTY_FILE'},400);
   if(fileData.length>25*1024*1024)return j({error:'FILE_TOO_LARGE'},413);
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(fileData);
   const stats=mod.fileStats(fileData);
   const regions=await mod.scanRegions(fileData);
   const upload_id=id();
   const file_hash=await mod.sha256Hex(fileData);
   const key='ecu/'+upload_id+'/'+String(b.filename||'file.bin').replace(/[\\/]/g,'_');
   await env.FILES.put(key,fileData,{httpMetadata:{contentType:'application/octet-stream'}});
   await run(env,'INSERT INTO ecu_uploads(id,user_id,filename,format,vehicle_type,file_hash,file_size,binary_data,created_at) VALUES(?,?,?,?,?,?,?,?,?)',upload_id,'owner',String(b.filename||'file.bin'),fmt.format,JSON.stringify({systems:[...new Set(regions.map(r=>r.system))]}),file_hash,fileData.length,key,now());
   return j({ok:true,upload_id,uploadId:upload_id,format:fmt.format,size:fileData.length,stats,regions,systems:[...new Set(regions.map(r=>r.system))],rulepackMatches:regions._rulepackMatches||[]});
 }catch(e){return j({error:e.message||'UPLOAD_FAILED',stack:e.stack?.split('\n').slice(0,3).join(' | ')},500)}}

 if(p==='/api/ecu/rulepacks'&&m==='GET'){try{
   const {RULEPACKS,allSources}=await import('./lib/ecu-rulepacks.js');
   return j({ok:true,packs:RULEPACKS.map(p=>({family:p.family,familyName:p.familyName,description:p.description,sourceCount:(p.sources||[]).length,firmwareCount:Object.keys(p.firmwares||{}).length,mapCount:(p.familyMaps||[]).length,notes:p.notes})),sources:allSources()});
 }catch(e){return j({error:e.message||'RULEPACKS_FAILED'},500)}}

 if(p==='/api/ecu/related-repos'&&m==='GET'){try{
   const data=(await import('../data/ecu-registry-filtered.json',{with:{type:'json'}})).default;
   return j({ok:true,total:data.total,accepted:data.accepted||[],quarantine:data.quarantine||[]});
 }catch(e){return j({ok:true,total:0,accepted:[],quarantine:[],error:e.message},200)}}

 if(p==='/api/ecu/ai-suggest'&&m==='POST'){try{
   const b=await body(req);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId||b.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);
   const obj=await env.FILES.get(upload.binary_data);
   if(!obj)return j({error:'R2_OBJECT_MISSING'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const regions=await mod.scanRegions(bytes);
   const summary=mod.summarizeForAI(bytes,regions);
   const sys='Sen bir ECU tuning uzmanısın. Verilen dosya özetine bakarak her sistem için SOMUT bir öneri yaz. SADECE JSON array döndür, başka metin yok. Format: [{"system":"EGR","offset":"0x4A20","currentByte":"0x01","newByte":"0x00","action":"EGR bayrağını sıfırla","result":"EGR devre dışı","risk":"low"}]. En fazla 8 öneri.';
   const userMsg='DOSYA ÖZETİ:\n'+JSON.stringify(summary,null,2);
   let aiSuggestions=[],provider='unknown',rawText='';
   try{
     const a=await withTimeout(aiFallback(env,[{role:'system',content:sys},{role:'user',content:userMsg}],{userText:userMsg,mode:'fast'}),15000,'AI_SUGGEST_TIMEOUT');
     rawText=a?.text||'';
     provider=a?.provider||'unknown';
     const jsonMatch=rawText.match(/\[[\s\S]*\]/);
     if(jsonMatch){try{aiSuggestions=JSON.parse(jsonMatch[0])}catch(err){aiSuggestions=[{system:'AI',action:'JSON parse hatası',result:rawText.slice(0,400),risk:'unknown'}]}}
     else if(rawText){aiSuggestions=[{system:'AI',action:'JSON formatı yok',result:rawText.slice(0,400),risk:'unknown'}]}
   }catch(err){return j({ok:false,error:'AI_UNAVAILABLE',detail:err.message,suggestions:[]},200)}
   return j({ok:true,suggestions:aiSuggestions,provider,raw:rawText.slice(0,2000)});
 }catch(e){return j({error:e.message||'AI_SUGGEST_FAILED'},500)}}

 if(p==='/api/ecu/generate'&&m==='POST'){try{
   const b=await body(req);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId||b.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);
   const obj=await env.FILES.get(upload.binary_data);
   if(!obj)return j({error:'R2_OBJECT_MISSING'},404);
   const original=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const regions=await mod.scanRegions(original);
   const allActions=regions.flatMap(r=>r.actions.map(a=>({...a,system:r.system})));
   const selectedIds=Array.isArray(b.actionIds||b.proposals)?(b.actionIds||b.proposals):[];
   const toApply=allActions.filter(a=>selectedIds.includes(a.id));
   if(!toApply.length)return j({error:'NO_ACTIONS_SELECTED'},400);
   const result=await mod.applyActions(original,toApply);
   const tuned_id=id();
   const outKey='ecu/'+tuned_id+'/tuned-'+String(upload.filename||'file.bin').replace(/[\\/]/g,'_');
   await env.FILES.put(outKey,result.tuned,{httpMetadata:{contentType:'application/octet-stream'}});
   await run(env,'INSERT INTO ecu_tuned_outputs(id,upload_id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,tuned_binary_data,created_at) VALUES(?,?,?,?,?,?,?,?)',tuned_id,upload.id,'scan-v2',JSON.stringify(result.applied),result.hash,result.size,outKey,now());
   return j({ok:true,tunedId:tuned_id,tuned_id,size:result.size,hash:result.hash,applied:result.applied,appliedPatches:result.applied});
 }catch(e){return j({error:e.message||'GENERATE_FAILED'},500)}}

 if(p.startsWith('/api/ecu/download')){try{
   const u=new URL(req.url);
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);
   const obj=await env.FILES.get(tuned.tuned_binary_data);
   if(!obj)return j({error:'R2_OBJECT_MISSING'},404);
   const upload=await q1(env,'SELECT filename FROM ecu_uploads WHERE id=?',tuned.upload_id);
   const name=(upload?.filename||'tuned.bin').replace(/(\.[^.]+)$/,'_tuned$1');
   return new Response(obj.body,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+name+'"'}});
 }catch(e){return j({error:e.message||'DOWNLOAD_FAILED'},500)}}

 // === GÖRSEL ÜRETME (Cloudflare AI — ücretsiz) ===
 if(p==='/api/ai/image'&&m==='POST'){try{
   if(!env.AI)return j({error:'CLOUDFLARE_AI_NOT_BOUND'},400);
   const b=await body(req);
   const prompt=String(b.prompt||'').trim();
   if(!prompt)return j({error:'EMPTY_PROMPT'},400);
   const model=b.model||'@cf/black-forest-labs/FLUX.1-schnell';
   const result=await env.AI.run(model,{prompt,num_steps:b.steps||4});
   if(!result?.image)return j({error:'AI_NO_IMAGE'},500);
   // R2'ye kaydet
   const imgId=id();
   const key='images/'+imgId+'.png';
   const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
   if(env.FILES)await env.FILES.put(key,imgBytes,{httpMetadata:{contentType:'image/png'}});
   return j({ok:true,id:imgId,size:imgBytes.length,model,key,base64:result.image.slice(0,100)+'...(truncated)'});
 }catch(e){return j({error:e.message||'IMAGE_FAILED'},500)}}

 if(p==='/api/ai/image/serve'){try{
   const imgId=new URL(req.url).searchParams.get('id');
   if(!imgId||!env.FILES)return j({error:'MISSING'},400);
   const obj=await env.FILES.get('images/'+imgId+'.png');
   if(!obj)return j({error:'NOT_FOUND'},404);
   return new Response(obj.body,{headers:{'content-type':'image/png','cache-control':'public, max-age=86400'}});
 }catch(e){return j({error:e.message},500)}}

 // === YOUTUBE ÖĞRENME — link at, transcript çek, hafızaya kaydet ===
 if(p==='/api/learn/youtube'&&m==='POST'){try{
   const b=await body(req);
   const url=String(b.url||'').trim();
   if(!url)return j({error:'EMPTY_URL'},400);
   const{parseYouTubeResourceUrl,fetchYouTubeTranscript}=await import('./lib/youtube-teaching-runtime.js');
   const parsed=parseYouTubeResourceUrl(url);
   if(!parsed?.videoId)return j({error:'INVALID_YOUTUBE_URL',detail:'Video ID bulunamadı'},400);
   // Transcript çek (ücretsiz — HTML scrape)
   let transcript='',title='',language='';
   try{
     const result=await fetchYouTubeTranscript(parsed.videoId);
     transcript=result?.transcript||'';
     title=result?.title||'';
     language=result?.language||'';
   }catch(e){
     // Whisper fallback olabilir ama şimdilik transcript çekilemezse hata ver
     return j({error:'TRANSCRIPT_FAILED',detail:e.message},400);
   }
   if(!transcript)return j({error:'NO_TRANSCRIPT',detail:'Bu videoda altyazı/transcript bulunamadı.'},400);
   // Hafızaya kaydet
   const{persistYouTubeLearning}=await import('./lib/youtube-learning-memory.js');
   const lr=await persistYouTubeLearning(env,{kind:'video',source_url:url,video_id:parsed.videoId,title,language,transcript},{});
   return j({ok:true,...lr,title,language,transcriptLength:transcript.length,preview:transcript.slice(0,500)});
 }catch(e){return j({error:e.message||'LEARN_FAILED'},500)}}

 // === ÖĞRENİLMİŞ İÇERİK LİSTESİ ===
 if(p==='/api/learn/list'&&m==='GET'){try{
   const{listYouTubeLearningSources}=await import('./lib/youtube-learning-memory.js');
   const sources=await listYouTubeLearningSources(env,100);
   return j({ok:true,count:sources.length,sources});
 }catch(e){return j({error:e.message},500)}}

 // === ÖĞRENİLMİŞ İÇERİK ARA ===
 if(p==='/api/learn/search'&&m==='POST'){try{
   const b=await body(req);
   const q=String(b.query||b.q||'').trim();
   if(!q)return j({error:'EMPTY_QUERY'},400);
   const{searchLearningMemory,learningContextText}=await import('./lib/youtube-learning-memory.js');
   const rows=await searchLearningMemory(env,q,{limit:8});
   return j({ok:true,count:rows.length,context:learningContextText(rows),results:rows});
 }catch(e){return j({error:e.message},500)}}

 // === SOSYAL MEDYA OTOMASYON — zamanlanmış görev oluştur ===
 if(p==='/api/social/schedule'&&m==='POST'){try{
   const b=await body(req);
   const platform=String(b.platform||'instagram').toLowerCase();
   const cadence=String(b.cadence||'weekly').toLowerCase();
   const topic=String(b.topic||b.prompt||'').trim();
   if(!topic)return j({error:'EMPTY_TOPIC'},400);
   // D1'e scheduled_jobs tablosu
   await run(env,`CREATE TABLE IF NOT EXISTS scheduled_jobs(id TEXT PRIMARY KEY,type TEXT,platform TEXT,cadence TEXT,topic TEXT,status TEXT DEFAULT 'active',last_run INTEGER,next_run INTEGER,created_at INTEGER)`);
   const jobId=id();
   const intervals={daily:86400000,weekly:604800000,biweekly:1209600000,monthly:2592000000};
   const interval=intervals[cadence]||604800000;
   const nextRun=now()+interval;
   await run(env,'INSERT INTO scheduled_jobs(id,type,platform,cadence,topic,status,next_run,created_at) VALUES(?,?,?,?,?,?,?,?)',jobId,'social_post',platform,cadence,topic,'active',nextRun,now());
   return j({ok:true,jobId,platform,cadence,topic,nextRun:new Date(nextRun).toISOString()});
 }catch(e){return j({error:e.message||'SCHEDULE_FAILED'},500)}}

 if(p==='/api/social/jobs'&&m==='GET'){try{
   await run(env,`CREATE TABLE IF NOT EXISTS scheduled_jobs(id TEXT PRIMARY KEY,type TEXT,platform TEXT,cadence TEXT,topic TEXT,status TEXT DEFAULT 'active',last_run INTEGER,next_run INTEGER,created_at INTEGER)`);
   const jobs=await qall(env,'SELECT * FROM scheduled_jobs WHERE status=? ORDER BY next_run ASC','active');
   return j({ok:true,count:jobs.length,jobs});
 }catch(e){return j({error:e.message},500)}}

 // === DTC LOOKUP — 9204 kod, ücretsiz, AI çağrısı yok ===
 if(p==='/api/dtc/lookup'){try{
   const u2=new URL(req.url);
   const code=String(u2.searchParams.get('code')||'').toUpperCase().trim();
   if(!code)return j({error:'EMPTY_CODE'},400);
   const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);
   if(!row)return j({error:'CODE_NOT_FOUND',code,detail:`${code} veritabanında bulunamadı.`},404);
   return j({ok:true,code:row.code,category:row.category,title:{en:row.title_en,de:row.title_de},description:{en:row.desc_en,de:row.desc_de},parts:safeJsonParse(row.parts,[]),causes:safeJsonParse(row.causes,[]),repair:safeJsonParse(row.repair,{}),mil:!!row.mil});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/dtc/search'&&m==='POST'){try{
   const b=await body(req);
   const q=String(b.query||b.q||'').trim();
   if(!q)return j({error:'EMPTY_QUERY'},400);
   const term='%'+q.toLowerCase()+'%';
   const rows=await qall(env,'SELECT code,category,title_en,title_de,desc_en FROM dtc_codes WHERE lower(code) LIKE ? OR lower(title_en) LIKE ? OR lower(title_de) LIKE ? OR lower(desc_en) LIKE ? LIMIT 20',term,term,term,term);
   return j({ok:true,count:rows.length,results:rows.map(r=>({code:r.code,category:r.category,title_en:r.title_en,title_de:r.title_de,desc_en:(r.desc_en||'').slice(0,150)}))});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/dtc/stats'){try{
   const total=await q1(env,'SELECT COUNT(*) n FROM dtc_codes');
   const byCat=await qall(env,'SELECT category,COUNT(*) n FROM dtc_codes GROUP BY category ORDER BY n DESC');
   return j({ok:true,total:total?.n||0,byCategory:byCat});
 }catch(e){return j({error:e.message},500)}}

 // === VİDEO PİPELINE v2 — çoklu model, seslendirme, altyazı, metin overlay, stok video ===
 if(p==='/api/video/create'&&m==='POST'){try{
   const b=await body(req);
   const{generateVideoJobSpec,IMAGE_STYLES,enrichPrompt}=await import('./lib/video-pipeline.js');
   const{IMAGE_MODELS,generateHashtags,generateContentCalendar,TTS_VOICES}=await import('./lib/creative-tools.js');
   const spec=generateVideoJobSpec({platform:b.platform||'instagram_reels',imageCount:b.imageCount||5,perImageSec:b.perImageSec||3,topic:b.topic||'',style:b.style||'automotive'});
   
   // 1) AI ile slayt planı yaz (başlık + açıklama + metin overlay + seslendirme)
   let slidePlan=[];
   let narration='';
   try{
     const planPrompt=`${spec.imageCount} slaytlık bir ${spec.platform} videosu planla. Konu: "${spec.topic}".\nHer slayt için:\n1. Görsel açıklaması (İngilizce, AI image prompt)\n2. Üzerine yazılacak kısa metin (Türkçe, max 6 kelime)\n3. Seslendirme metni (Türkçe, o slayt süresince okunacak, max 20 kelime)\n\nJSON array döndür: [{"imagePrompt":"...","overlayText":"...","narrationText":"..."}]. Sadece JSON, başka metin yok.`;
     const a=await withTimeout(aiFallback(env,[{role:'user',content:planPrompt}],{mode:'fast'}),12000,'PLAN_TIMEOUT');
     const jsonMatch=(a?.text||'').match(/\[[\s\S]*\]/);
     if(jsonMatch)slidePlan=JSON.parse(jsonMatch[0]);
   }catch{}
   // Seslendirme metnini birleştir
   if(slidePlan.length)narration=slidePlan.map(s=>s.narrationText||'').filter(Boolean).join('. ');
   if(b.narration)narration=b.narration; // kullanıcı override

   // 2) Görselleri üret
   const modelKey=b.model||'flux-schnell';
   const model=IMAGE_MODELS[modelKey]||IMAGE_MODELS['flux-schnell'];
   const imageUrls=[];
   const textOverlays=[];
   if(env.AI&&env.FILES){
     for(let i=0;i<spec.imageCount;i++){
       try{
         const slideInfo=slidePlan[i]||{};
         const rawPrompt=slideInfo.imagePrompt||`${spec.style}. Slide ${i+1}/${spec.imageCount}: ${spec.topic}`;
         const enriched=enrichPrompt?enrichPrompt(rawPrompt,b.style||'automotive',spec.platform):rawPrompt;
         const result=await env.AI.run(model.id,{prompt:enriched,num_steps:model.steps||4});
         if(result?.image){
           const imgId=id();
           const key='video-frames/'+imgId+'.png';
           const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
           await env.FILES.put(key,imgBytes,{httpMetadata:{contentType:'image/png'}});
           imageUrls.push('/api/ai/image/serve?id='+imgId);
           textOverlays.push(slideInfo.overlayText?{text:slideInfo.overlayText,position:i===0?'center':'bottom'}:null);
         }
       }catch{}
     }
   }

   // 3) Hashtag üret
   const hashtags=generateHashtags?generateHashtags(spec.topic,spec.platform.split('_')[0],15):'';

   // 4) Job kaydet
   await run(env,'CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,platform TEXT,topic TEXT,spec TEXT,image_urls TEXT,video_key TEXT,status TEXT DEFAULT "pending",created_at INTEGER,narration TEXT,voice TEXT,subtitles INTEGER,text_overlays TEXT,hashtags TEXT,music TEXT)');
   const jobId=id();
   const voice=b.voice||'tr-TR-AhmetNeural';
   const subtitles=b.subtitles!==false;
   await run(env,'INSERT INTO video_jobs(id,platform,topic,spec,image_urls,status,created_at,narration,voice,subtitles,text_overlays,hashtags,music) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
     jobId,spec.platform,spec.topic,JSON.stringify(spec),JSON.stringify(imageUrls),'images_ready',now(),
     narration,voice,subtitles?1:0,JSON.stringify(textOverlays),hashtags,b.music||'none');
   
   return j({ok:true,jobId,platform:spec.platform,imageCount:imageUrls.length,imageUrls,textOverlays,narration:narration.slice(0,500),voice,subtitles,hashtags,model:model.name,slidePlan:slidePlan.slice(0,spec.imageCount),note:'Görseller üretildi. Video render için GitHub Actions → video-render workflow çalıştır.'});
 }catch(e){return j({error:e.message||'VIDEO_CREATE_FAILED'},500)}}

 if(p==='/api/video/job'){try{
   const jobId=new URL(req.url).searchParams.get('id');
   if(!jobId)return j({error:'MISSING_ID'},400);
   await run(env,'CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,platform TEXT,topic TEXT,spec TEXT,image_urls TEXT,video_key TEXT,status TEXT DEFAULT "pending",created_at INTEGER,narration TEXT,voice TEXT,subtitles INTEGER,text_overlays TEXT,hashtags TEXT,music TEXT)');
   const job=await q1(env,'SELECT * FROM video_jobs WHERE id=?',jobId);
   if(!job)return j({error:'JOB_NOT_FOUND'},404);
   return j({ok:true,...job,spec:safeJsonParse(job.spec,{}),imageUrls:safeJsonParse(job.image_urls,[]),textOverlays:safeJsonParse(job.text_overlays,[]),perImageSec:safeJsonParse(job.spec,{}).perImageSec||3});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/video/complete'&&m==='POST'){try{
   const b=await body(req);
   if(!b.jobId||!b.videoBase64)return j({error:'MISSING_FIELDS'},400);
   const videoBytes=Uint8Array.from(atob(b.videoBase64),c=>c.charCodeAt(0));
   const key='videos/'+b.jobId+'.mp4';
   if(env.FILES)await env.FILES.put(key,videoBytes,{httpMetadata:{contentType:'video/mp4'}});
   await run(env,'UPDATE video_jobs SET video_key=?,status=? WHERE id=?',key,'ready',b.jobId);
   return j({ok:true,jobId:b.jobId,videoKey:key,size:videoBytes.length});
 }catch(e){return j({error:e.message},500)}}

 // === STOK VİDEO / GÖRSEL ARAMA (Pexels — ücretsiz) ===
 if(p==='/api/stock/search'&&m==='POST'){try{
   const b=await body(req);
   const query=String(b.query||'').trim();
   if(!query)return j({error:'EMPTY_QUERY'},400);
   const type=b.type||'videos'; // videos or photos
   // Pexels API key — credential store'dan al
   let pexelsKey='';
   try{const creds=await qall(env,'SELECT * FROM credentials WHERE provider IN (?,?) AND status=?','pexels','stock','active');if(creds.length)pexelsKey=creds[0].secret}catch{}
   if(!pexelsKey)return j({error:'PEXELS_KEY_NEEDED',detail:'Ayarlar → AI Sağlayıcı → Pexels (ücretsiz: https://www.pexels.com/api/new/ ) ekle'},400);
   const endpoint=type==='photos'?'https://api.pexels.com/v1/search':'https://api.pexels.com/videos/search';
   const res2=await fetchT(`${endpoint}?query=${encodeURIComponent(query)}&per_page=${b.count||6}&orientation=${b.orientation||'portrait'}`,{headers:{authorization:pexelsKey}});
   if(!res2.ok)throw Error('PEXELS_'+res2.status);
   const data=await res2.json();
   const results=type==='photos'
     ?(data.photos||[]).map(p=>({id:p.id,url:p.src?.large||p.src?.medium,thumb:p.src?.tiny,alt:p.alt,photographer:p.photographer}))
     :(data.videos||[]).map(v=>({id:v.id,url:(v.video_files||[]).find(f=>f.quality==='hd')?.link||(v.video_files||[])[0]?.link,thumb:v.image,duration:v.duration,user:v.user?.name}));
   return j({ok:true,type,count:results.length,results});
 }catch(e){return j({error:e.message},500)}}

 // === GÖRSEL ANLAMA (Cloudflare AI Vision — ücretsiz) ===
 if(p==='/api/ai/vision'&&m==='POST'){try{
   if(!env.AI)return j({error:'AI_NOT_BOUND'},400);
   const b=await body(req);
   const imageB64=b.image||b.imageBase64||'';
   const question=b.question||b.prompt||'Bu görselde ne var? Detaylı açıkla.';
   if(!imageB64)return j({error:'NO_IMAGE'},400);
   const result=await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct',{messages:[{role:'user',content:[{type:'text',text:question},{type:'image',image:imageB64}]}]});
   return j({ok:true,answer:result?.response||result?.text||'',model:'llama-3.2-11b-vision'});
 }catch(e){return j({error:e.message},500)}}

 // === ÇOKLU MODEL GÖRSEL ÜRETME ===
 if(p==='/api/ai/image/models'&&m==='GET'){try{
   const{IMAGE_MODELS}=await import('./lib/creative-tools.js');
   return j({ok:true,models:Object.entries(IMAGE_MODELS).map(([k,v])=>({id:k,...v}))});
 }catch(e){return j({error:e.message},500)}}

 // === İÇERİK TAKVİMİ ÜRETİCİ ===
 if(p==='/api/content/calendar'&&m==='POST'){try{
   const b=await body(req);
   const{generateContentCalendar,generateHashtags}=await import('./lib/creative-tools.js');
   const topic=String(b.topic||'').trim();
   if(!topic)return j({error:'EMPTY_TOPIC'},400);
   const weeks=b.weeks||4;
   const postsPerWeek=b.postsPerWeek||3;
   const calendar=generateContentCalendar(topic,weeks,postsPerWeek);
   // AI ile her post için kısa açıklama
   let enriched=calendar;
   try{
     const prompt=`İçerik takvimi için ${calendar.length} post. Her biri için 1 cümle açıklama ve 1 emoji yaz. Konu: "${topic}". JSON array: [{"caption":"...","emoji":"..."}]. Sadece JSON.`;
     const a=await withTimeout(aiFallback(env,[{role:'user',content:prompt}],{mode:'fast'}),8000,'CAL_TIMEOUT');
     const match=(a?.text||'').match(/\[[\s\S]*\]/);
     if(match){
       const captions=JSON.parse(match[0]);
       enriched=calendar.map((post,i)=>({...post,caption:captions[i]?.caption||'',emoji:captions[i]?.emoji||''}));
     }
   }catch{}
   return j({ok:true,topic,weeks,postsPerWeek,totalPosts:enriched.length,calendar:enriched,hashtags:generateHashtags(topic)});
 }catch(e){return j({error:e.message},500)}}

 // === SES MODELLARI LİSTESİ ===
 if(p==='/api/tts/voices'&&m==='GET'){try{
   const{TTS_VOICES}=await import('./lib/creative-tools.js');
   return j({ok:true,voices:Object.entries(TTS_VOICES).map(([id,v])=>({id,...v}))});
 }catch(e){return j({error:e.message},500)}}

 // === YOUTUBE UPLOAD ===
 if(p==='/api/youtube/upload'&&m==='POST'){try{
   const b=await body(req);
   const videoJobId=b.videoJobId||b.jobId;
   if(!videoJobId)return j({error:'MISSING_JOB_ID'},400);
   const job=await q1(env,'SELECT * FROM video_jobs WHERE id=?',videoJobId);
   if(!job||job.status!=='ready')return j({error:'VIDEO_NOT_READY'},400);
   if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);
   const videoObj=await env.FILES.get(job.video_key);
   if(!videoObj)return j({error:'VIDEO_FILE_MISSING'},404);
   // Google OAuth token al
   const token=await googleAccessToken(env);
   // YouTube Data API — resumable upload
   const title=b.title||job.topic||'JARVIS Video';
   const description=b.description||`${job.topic} — JARVIS tarafından otomatik üretildi.`;
   const tags=b.tags||['jarvis','automotive','tuning'];
   const categoryId=b.categoryId||'22'; // People & Blogs
   // 1) Resumable upload başlat
   const initRes=await fetchT('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
     method:'POST',
     headers:{authorization:'Bearer '+token,'content-type':'application/json'},
     body:JSON.stringify({snippet:{title,description,tags,categoryId},status:{privacyStatus:b.privacy||'unlisted',selfDeclaredMadeForKids:false}})
   });
   if(!initRes.ok)throw Error('YOUTUBE_INIT_'+initRes.status+':'+(await initRes.text()).slice(0,200));
   const uploadUrl=initRes.headers.get('location');
   if(!uploadUrl)throw Error('YOUTUBE_NO_UPLOAD_URL');
   // 2) Video yükle
   const videoBytes=new Uint8Array(await videoObj.arrayBuffer());
   const uploadRes=await fetchT(uploadUrl,{method:'PUT',headers:{'content-type':'video/mp4','content-length':String(videoBytes.length)},body:videoBytes});
   if(!uploadRes.ok)throw Error('YOUTUBE_UPLOAD_'+uploadRes.status+':'+(await uploadRes.text()).slice(0,200));
   const ytResult=await uploadRes.json();
   await run(env,'UPDATE video_jobs SET status=? WHERE id=?','published:youtube:'+ytResult.id,videoJobId);
   await log(env,'youtube','Video yüklendi: '+title,{videoId:ytResult.id,platform:'youtube'});
   return j({ok:true,videoId:ytResult.id,url:'https://youtube.com/watch?v='+ytResult.id,title});
 }catch(e){return j({error:e.message||'YOUTUBE_UPLOAD_FAILED'},500)}}

 // === INSTAGRAM REELS UPLOAD ===
 if(p==='/api/instagram/reels'&&m==='POST'){try{
   const b=await body(req);
   const c=await metaCredential(env);
   if(!c)return j({error:'META_NOT_CONNECTED'},400);
   const ig=String(c.model||'').trim();
   if(!ig)return j({error:'INSTAGRAM_BUSINESS_ID_REQUIRED'},400);
   // Instagram Reels: video URL lazım (R2'den public serve)
   const videoUrl=b.videoUrl||'';
   if(!videoUrl)return j({error:'VIDEO_URL_REQUIRED'},400);
   const caption=b.caption||'';
   // 1) Container oluştur
   const form1=new URLSearchParams({media_type:'REELS',video_url:videoUrl,caption,access_token:c.secret});
   const r1=await fetchT(`https://graph.facebook.com/v24.0/${ig}/media`,{method:'POST',body:form1});
   if(!r1.ok)throw Error('IG_CONTAINER_'+r1.status+':'+(await r1.text()).slice(0,200));
   const containerId=(await r1.json()).id;
   // 2) Yayınla
   const form2=new URLSearchParams({creation_id:containerId,access_token:c.secret});
   const r2=await fetchT(`https://graph.facebook.com/v24.0/${ig}/media_publish`,{method:'POST',body:form2});
   if(!r2.ok)throw Error('IG_PUBLISH_'+r2.status+':'+(await r2.text()).slice(0,200));
   const result=await r2.json();
   await log(env,'instagram','Reels yüklendi: '+caption.slice(0,80),{mediaId:result.id});
   return j({ok:true,mediaId:result.id,platform:'instagram_reels'});
 }catch(e){return j({error:e.message||'INSTAGRAM_REELS_FAILED'},500)}}

 if(p==='/api/ai/router/status')return j({router:await aiRouterStatus(env)});
 if(p==='/api/ai/diagnose')return j(await aiDiagnostics(env));
 if(p==='/api/status')return j(await liveStatus(env));
 if(p==='/api/state')return j(await state(env));
 if(p==='/api/tasks'&&m==='POST'){const b=await body(req),title=String(b.title||'').trim();if(!title)return j({error:'TITLE_REQUIRED'},400);const t=now(),x={id:id(),title,priority:b.priority||'Orta',status:'open',area:b.area||'genel',createdAt:t,updatedAt:t};await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',x.id,x.title,x.priority,x.status,x.area,t,t);await log(env,'task','Görev eklendi: '+title);return j(x)}
 let mm=p.match(/^\/api\/tasks\/([^/]+)$/);if(mm&&m==='PATCH'){const b=await body(req);if('status'in b)await run(env,'UPDATE tasks SET status=?,updated_at=? WHERE id=?',b.status,now(),mm[1]);return j({ok:true})}
 if(p==='/api/projects'&&m==='POST'){const b=await body(req),title=String(b.title||'').trim();if(!title)return j({error:'TITLE_REQUIRED'},400);const t=now(),x={id:id(),title,type:b.type||'genel',status:'active',notes:b.notes||'',createdAt:t,updatedAt:t};await run(env,'INSERT INTO projects(id,title,type,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',x.id,x.title,x.type,x.status,x.notes,t,t);return j(x)}
 if(p==='/api/memory'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'TEXT_REQUIRED'},400);await run(env,'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)',id(),text,JSON.stringify(b.tags||[]),now());return j({ok:true})}
 if(p==='/api/research'){const q=u.searchParams.get('q')||'';if(!q)return j({error:'QUERY_REQUIRED'},400);const results=await ddg(q);await log(env,'research','Araştırıldı: '+q,{count:results.length});return j({q,results})}
 if(p==='/api/tools/discover'){const cap=u.searchParams.get('capability')||'ai-tool';return j({capability:cap,results:await discoverTools(env,cap)})}

 if(p==='/api/files/download-url'&&m==='POST'){if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);const b=await body(req),url=String(b.url||'').trim();let u2;try{u2=new URL(url)}catch{return j({error:'INVALID_URL'},400)}if(!/^https?:$/.test(u2.protocol)||privateHost(u2.hostname))return j({error:'URL_NOT_ALLOWED'},400);const r=await fetchT(u2.toString(),{redirect:'follow'});if(!r.ok)return j({error:'DOWNLOAD_HTTP_'+r.status},400);const len=Number(r.headers.get('content-length')||0);if(len>50*1024*1024)return j({error:'FILE_TOO_LARGE'},413);const buf=new Uint8Array(await r.arrayBuffer());if(buf.byteLength>50*1024*1024)return j({error:'FILE_TOO_LARGE'},413);let name=String(b.name||'').trim()||u2.pathname.split('/').filter(Boolean).pop()||'download.bin';name=name.replace(/[\\/]/g,'_');const key=`${now()}-${id()}-${name}`;await env.FILES.put(key,buf,{httpMetadata:{contentType:r.headers.get('content-type')||'application/octet-stream'}});await log(env,'file','URL dosyası indirildi: '+name,{url:u2.origin});return j({ok:true,key,name,size:buf.byteLength})}
 if(p==='/api/files'&&m==='POST'){if(!env.FILES)return j({error:'R2_NOT_CONFIGURED'},400);const b=await body(req),name=String(b.name||'file').replace(/[\\/]/g,'_'),raw=Uint8Array.from(atob(String(b.base64||'')),c=>c.charCodeAt(0));if(raw.byteLength>25*1024*1024)return j({error:'FILE_TOO_LARGE'},413);const key=`${now()}-${id()}-${name}`;await env.FILES.put(key,raw,{httpMetadata:{contentType:b.type||'application/octet-stream'}});await log(env,'file','Dosya yüklendi: '+name);return j({ok:true,key,name,size:raw.byteLength})}
 if(p==='/api/files'&&m==='GET'){if(!env.FILES)return j([]);const x=await env.FILES.list({limit:100});return j(x.objects.map(o=>({file:o.key,size:o.size,mtime:o.uploaded?.getTime?.()||0})))}
 mm=p.match(/^\/api\/files\/(.+)$/);if(mm&&m==='GET'){if(!env.FILES)return txt('R2 yok',404);const key=decodeURIComponent(mm[1]),o=await env.FILES.get(key);if(!o)return txt('Not found',404);return new Response(o.body,{headers:{'content-type':o.httpMetadata?.contentType||'application/octet-stream','content-disposition':`attachment; filename="${key.split('-').slice(3).join('-')}"`}})}
 if(p==='/api/command'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);await addChat(env,'user',text,null);const r=await command(env,text);await addChat(env,'assistant',r.reply,r.provider||null);return j({...r,state:await state(env),history:await chatHistory(env,120)})}

 // ===== FATURA / INVOICE =====
 if(p==='/api/invoice/create'&&m==='POST'){try{
   const b=await body(req);
   const items=b.items||[];
   const cur=b.currency||'€';const taxR=b.taxRate||19;const lang=b.lang||'de';
   const sub=items.reduce((s,i)=>s+(i.qty||1)*(i.price||0),0);const tax=sub*taxR/100;const total=sub+tax;
   const fmt=n=>n.toFixed(2).replace('.',',');
   const invId=id();const invNum=b.number||('INV-'+Date.now().toString(36).toUpperCase());const invDate=b.date||new Date().toISOString().slice(0,10);
   const from=b.from||{};const to=b.to||{};
   const e=s=>String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
   const L=lang==='tr'?{inv:'FATURA',date:'Tarih',from:'Gönderen',to:'Alıcı',desc:'Açıklama',qty:'Adet',price:'Fiyat',sum:'Toplam',sub:'Ara Toplam',tax:`KDV (${taxR}%)`,total:'TOPLAM',notes:'Notlar'}:{inv:'RECHNUNG',date:'Datum',from:'Absender',to:'Empfänger',desc:'Beschreibung',qty:'Menge',price:'Preis',sum:'Summe',sub:'Zwischensumme',tax:`MwSt. (${taxR}%)`,total:'GESAMT',notes:'Hinweise'};
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.inv} ${e(invNum)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#1a1a2e;font-size:14px;line-height:1.5}.head{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0a0a1a}.head h1{font-size:24px;letter-spacing:2px}.parties{display:flex;gap:32px;margin-bottom:24px}.parties div{flex:1}.parties h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#0a0a1a;color:#fff;padding:8px 10px;text-align:left;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #e0e0e0}.right{text-align:right}.totals{margin-left:auto;width:260px;margin-bottom:20px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:700;border-top:2px solid #0a0a1a;padding-top:8px;margin-top:4px}.notes{background:#f5f5f8;padding:12px;border-radius:8px;font-size:12px;color:#555}@media print{body{padding:12px}}</style></head><body><div class="head"><div><h1>${L.inv}</h1><div style="margin-top:4px;font-size:13px;color:#555">${e(invNum)}</div></div><div style="text-align:right;font-size:13px;color:#555">${L.date}: <b>${e(invDate)}</b></div></div><div class="parties"><div><h3>${L.from}</h3><b>${e(from.name||'')}</b><br>${e(from.address||'')}<br>${e(from.tax_id||'')}<br>${e(from.phone||'')}<br>${e(from.email||'')}</div><div><h3>${L.to}</h3><b>${e(to.name||'')}</b><br>${e(to.address||'')}<br>${e(to.tax_id||'')}<br>${e(to.phone||'')}</div></div><table><tr><th>#</th><th>${L.desc}</th><th class="right">${L.qty}</th><th class="right">${L.price}</th><th class="right">${L.sum}</th></tr>${items.map((it,i)=>`<tr><td>${i+1}</td><td>${e(it.desc||'')}</td><td class="right">${it.qty||1}</td><td class="right">${cur}${fmt(it.price||0)}</td><td class="right">${cur}${fmt((it.qty||1)*(it.price||0))}</td></tr>`).join('')}</table><div class="totals"><div><span>${L.sub}</span><span>${cur}${fmt(sub)}</span></div><div><span>${L.tax}</span><span>${cur}${fmt(tax)}</span></div><div class="grand"><span>${L.total}</span><span>${cur}${fmt(total)}</span></div></div>${b.notes?`<div class="notes"><b>${L.notes}:</b> ${e(b.notes)}</div>`:''}<div style="margin-top:32px;text-align:center;font-size:11px;color:#aaa">JARVIS · ${new Date().toISOString().slice(0,16)}</div></body></html>`;
   await run(env,'INSERT INTO invoices(id,customer_id,job_id,number,html,total,currency,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',invId,b.customer_id||null,b.job_id||null,invNum,html,total,cur,'draft',now(),now());
   await log(env,'invoice','Fatura oluşturuldu: '+invNum,{total,currency:cur});
   return j({ok:true,id:invId,number:invNum,total,html});
 }catch(e){return j({error:e.message||'INVOICE_FAILED'},500)}}

 if(p==='/api/invoice/list')return j({ok:true,invoices:await qall(env,'SELECT id,customer_id,job_id,number,total,currency,status,created_at FROM invoices ORDER BY created_at DESC LIMIT 50')});
 mm=p.match(/^\/api\/invoice\/([^/]+)$/);if(mm&&m==='GET'){const inv=await q1(env,'SELECT * FROM invoices WHERE id=?',mm[1]);if(!inv)return j({error:'NOT_FOUND'},404);return new Response(inv.html||'<p>Boş fatura</p>',{headers:{'content-type':'text/html; charset=utf-8'}})}

 // ===== CRM — MÜŞTERİ DEFTERİ =====
 if(p==='/api/crm/customers'&&m==='GET'){return j({ok:true,customers:await qall(env,'SELECT * FROM customers ORDER BY updated_at DESC LIMIT 100')})}
 if(p==='/api/crm/customers'&&m==='POST'){try{
   const b=await body(req);const cId=id();const t=now();
   await run(env,'INSERT INTO customers(id,name,phone,email,vehicle,plate,notes,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',cId,String(b.name||'').trim(),b.phone||'',b.email||'',b.vehicle||'',b.plate||'',b.notes||'',JSON.stringify(b.tags||[]),t,t);
   await log(env,'crm','Müşteri eklendi: '+(b.name||''),{id:cId});
   return j({ok:true,id:cId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/crm\/customers\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['name','phone','email','vehicle','plate','notes']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(b.tags){sets.push('tags=?');vals.push(JSON.stringify(b.tags))}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE customers SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM customers WHERE id=?',mm[1]);return j({ok:true})}

 if(p==='/api/crm/jobs'&&m==='GET'){const cid=u.searchParams.get('customer_id');const q=cid?await qall(env,'SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC LIMIT 50',cid):await qall(env,'SELECT j.*,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id ORDER BY j.created_at DESC LIMIT 100');return j({ok:true,jobs:q})}
 if(p==='/api/crm/jobs'&&m==='POST'){try{
   const b=await body(req);const jId=id();const t=now();
   await run(env,'INSERT INTO jobs(id,customer_id,type,title,description,status,price,currency,files,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',jId,b.customer_id||'',b.type||'tuning',String(b.title||'').trim(),b.description||'','open',b.price||0,b.currency||'EUR','[]',b.notes||'',t,t);
   await log(env,'crm','İş eklendi: '+(b.title||''),{id:jId,customer_id:b.customer_id});
   return j({ok:true,id:jId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/crm\/jobs\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['type','title','description','status','price','currency','notes']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE jobs SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}

 // ===== HAVA DURUMU (Open-Meteo — ücretsiz, API key yok) =====
 if(p==='/api/weather'){try{
   const lat=u.searchParams.get('lat')||'51.23',lon=u.searchParams.get('lon')||'6.78',days=u.searchParams.get('days')||'3';
   const wr=await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&current=temperature_2m,weathercode,wind_speed_10m,relative_humidity_2m&timezone=Europe%2FBerlin&forecast_days=${days}`);
   if(!wr.ok)return j({error:'WEATHER_HTTP_'+wr.status},500);
   const wd=await wr.json();
   const wc={0:'☀️ Açık',1:'🌤 Az bulutlu',2:'⛅ Parçalı',3:'☁️ Bulutlu',45:'🌫 Sis',48:'🌫 Kırağı',51:'🌦 Çise',53:'🌧 Çise',55:'🌧 Yoğun çise',61:'🌧 Hafif yağmur',63:'🌧 Yağmur',65:'🌧 Şiddetli',71:'🌨 Hafif kar',73:'🌨 Kar',75:'🌨 Yoğun kar',80:'🌦 Sağanak',81:'🌧 Yoğun sağanak',82:'⛈ Şiddetli',95:'⛈ Fırtına',96:'⛈ Dolu',99:'⛈ Yoğun dolu'};
   return j({ok:true,current:{temp:wd.current?.temperature_2m,wind:wd.current?.wind_speed_10m,humidity:wd.current?.relative_humidity_2m,desc:wc[wd.current?.weathercode]||'?'},daily:(wd.daily?.time||[]).map((d,i)=>({date:d,max:wd.daily.temperature_2m_max[i],min:wd.daily.temperature_2m_min[i],rain:wd.daily.precipitation_sum[i],desc:wc[wd.daily.weathercode[i]]||'?'}))});
 }catch(e){return j({error:e.message},500)}}

 // ===== YAKIT FİYATLARI (Tankerkönig — ücretsiz) =====
 if(p==='/api/fuel'){try{
   const lat=u.searchParams.get('lat'),lon=u.searchParams.get('lon'),rad=u.searchParams.get('radius')||'5';
   if(!lat||!lon)return j({error:'LAT_LON_REQUIRED'},400);
   const fuelKey=await kvGet(env,'tankerkoenig_key','');
   if(!fuelKey)return j({error:'TANKERKOENIG_KEY_NOT_SET. Ayarlar > AI Sağlayıcı Anahtarları bölümünden ekle.'},400);
   const fr=await fetchT(`https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lon}&rad=${rad}&sort=price&type=all&apikey=${encodeURIComponent(fuelKey)}`);
   if(!fr.ok)return j({error:'FUEL_HTTP_'+fr.status},500);
   const fd=await fr.json();if(!fd.ok)return j({error:fd.message||'FUEL_API_ERROR'},500);
   return j({ok:true,stations:(fd.stations||[]).slice(0,10).map(s=>({name:s.name,brand:s.brand,dist:s.dist,diesel:s.diesel,e5:s.e5,e10:s.e10,open:s.isOpen,address:`${s.street} ${s.houseNumber}, ${s.postCode} ${s.place}`}))});
 }catch(e){return j({error:e.message},500)}}

 // ===== ÇEVİRİ (Cloudflare AI m2m100 — ücretsiz) =====
 if(p==='/api/translate'&&m==='POST'){try{
   const b=await body(req);const text=String(b.text||'').trim();if(!text)return j({error:'TEXT_REQUIRED'},400);
   if(!env.AI)return j({error:'AI_BINDING_MISSING'},500);
   const result=await env.AI.run('@cf/meta/m2m100-1.2b',{text,source_lang:b.source||'tr',target_lang:b.target||'de'});
   return j({ok:true,translated:result?.translated_text||'',source:b.source||'tr',target:b.target||'de'});
 }catch(e){return j({error:e.message},500)}}

 // ===== QR KOD =====
 if(p==='/api/qr'){const text=u.searchParams.get('text')||'';const size=u.searchParams.get('size')||'200';if(!text)return j({error:'TEXT_REQUIRED'},400);return j({ok:true,url:`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=svg`})}

 // ===== OCR (Cloudflare AI Vision — ücretsiz) =====
 if(p==='/api/ocr'&&m==='POST'){try{
   if(!env.AI)return j({error:'AI_BINDING_MISSING'},500);
   const b=await body(req);const b64=String(b.image||'');if(!b64)return j({error:'IMAGE_REQUIRED'},400);
   const result=await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct',{messages:[{role:'user',content:[{type:'text',text:'Bu görseldeki tüm metni oku ve yaz. Sadece metni yaz, başka bir şey ekleme.'},{type:'image',image:b64}]}],max_tokens:2000});
   return j({ok:true,text:result?.response||''});
 }catch(e){return j({error:e.message},500)}}

 // ===== VARDİYA PLANI =====
 if(p==='/api/shifts'){
   const start=u.searchParams.get('start')||new Date().toISOString().slice(0,10);const days=parseInt(u.searchParams.get('days')||'7');
   const shifts=(u.searchParams.get('shifts')||'08:00-16:00,16:00-00:00').split(',');
   const dayNames=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
   const result=[];const sd=new Date(start);
   for(let d=0;d<days;d++){const dt=new Date(sd);dt.setDate(sd.getDate()+d);const iso=dt.toISOString().slice(0,10);const wd=dt.getDay();result.push({date:iso,day:dayNames[wd],weekend:wd===0||wd===6,shifts:wd===0||wd===6?['İZİN']:shifts})}
   return j({ok:true,schedule:result});
 }

 // ===== DASHBOARD / İSTATİSTİKLER =====
 if(p==='/api/dashboard/stats'){try{
   const totalCustomers=await q1(env,'SELECT COUNT(*) n FROM customers');
   const totalJobs=await q1(env,'SELECT COUNT(*) n FROM jobs');
   const openJobs=await q1(env,'SELECT COUNT(*) n FROM jobs WHERE status=?','open');
   const completedJobs=await q1(env,'SELECT COUNT(*) n FROM jobs WHERE status=?','completed');
   const revenue=await q1(env,'SELECT COALESCE(SUM(price),0) total FROM jobs WHERE status=?','completed');
   const monthRevenue=await q1(env,'SELECT COALESCE(SUM(price),0) total FROM jobs WHERE status=? AND created_at>?','completed',now()-30*86400000);
   const totalInvoices=await q1(env,'SELECT COUNT(*) n FROM invoices');
   const recentJobs=await qall(env,'SELECT j.id,j.title,j.type,j.status,j.price,j.currency,j.created_at,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id ORDER BY j.created_at DESC LIMIT 10');
   const topCustomers=await qall(env,'SELECT c.name,COUNT(j.id) job_count,COALESCE(SUM(j.price),0) total_spent FROM customers c LEFT JOIN jobs j ON c.id=j.customer_id GROUP BY c.id ORDER BY total_spent DESC LIMIT 5');
   const totalAppointments=await q1(env,"SELECT COUNT(*) n FROM appointments WHERE status='scheduled'").catch(()=>({n:0}));
   return j({ok:true,customers:totalCustomers?.n||0,jobs:totalJobs?.n||0,openJobs:openJobs?.n||0,completedJobs:completedJobs?.n||0,revenue:revenue?.total||0,monthRevenue:monthRevenue?.total||0,invoices:totalInvoices?.n||0,upcomingAppointments:totalAppointments?.n||0,recentJobs,topCustomers});
 }catch(e){return j({error:e.message},500)}}

 // ===== RANDEVULAR =====
 if(p==='/api/appointments'&&m==='GET'){try{
   const status=u.searchParams.get('status')||'scheduled';
   const rows=await qall(env,'SELECT a.*,c.name as customer_name,c.plate as customer_plate FROM appointments a LEFT JOIN customers c ON a.customer_id=c.id WHERE a.status=? ORDER BY a.date ASC, a.time ASC LIMIT 50',status);
   return j({ok:true,appointments:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/appointments'&&m==='POST'){try{
   const b=await body(req);const title=String(b.title||'').trim();
   if(!title)return j({error:'TITLE_REQUIRED'},400);
   if(!b.date)return j({error:'DATE_REQUIRED'},400);
   const aId=id();const t=now();
   await run(env,'INSERT INTO appointments(id,customer_id,title,date,time,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',aId,b.customer_id||null,title,b.date,b.time||'10:00','scheduled',b.notes||'',t,t);
   await log(env,'appointment','Randevu eklendi: '+title+' ('+b.date+')',{id:aId});
   return j({ok:true,id:aId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/appointments\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['title','date','time','status','notes','customer_id']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE appointments SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM appointments WHERE id=?',mm[1]);return j({ok:true})}

 // ===== ARAÇ GEÇMİŞİ (Plaka bazlı arama) =====
 if(p==='/api/vehicle/history'){try{
   const plate=String(u.searchParams.get('plate')||'').trim().toUpperCase();
   if(!plate)return j({error:'PLATE_REQUIRED'},400);
   const term='%'+plate+'%';
   const customers=await qall(env,'SELECT * FROM customers WHERE UPPER(plate) LIKE ? ORDER BY updated_at DESC',term);
   const custIds=customers.map(c=>c.id);
   let jobs=[];
   if(custIds.length){const ph=custIds.map(()=>'?').join(',');jobs=await qall(env,`SELECT j.*,c.name as customer_name,c.plate as customer_plate FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id WHERE j.customer_id IN (${ph}) ORDER BY j.created_at DESC`,... custIds)}
   return j({ok:true,plate,customers,jobs});
 }catch(e){return j({error:e.message},500)}}

 // ===== NOT DEFTERİ =====
 if(p==='/api/notes'&&m==='GET'){try{
   const cat=u.searchParams.get('category')||'';
   const q=u.searchParams.get('q')||'';
   let sql='SELECT * FROM notes';const params=[];
   if(cat){sql+=' WHERE category=?';params.push(cat)}
   if(q){sql+=(cat?' AND':' WHERE')+" (UPPER(title) LIKE ? OR UPPER(content) LIKE ?)";const t='%'+q.toUpperCase()+'%';params.push(t,t)}
   sql+=' ORDER BY pinned DESC, updated_at DESC LIMIT 100';
   const rows=await qall(env,sql,...params);
   return j({ok:true,notes:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/notes'&&m==='POST'){try{
   const b=await body(req);const content=String(b.content||'').trim();
   if(!content)return j({error:'CONTENT_REQUIRED'},400);
   const nId=id();const t=now();
   await run(env,'INSERT INTO notes(id,title,content,category,pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',nId,b.title||'',content,b.category||'genel',b.pinned?1:0,t,t);
   return j({ok:true,id:nId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/notes\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['title','content','category']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if('pinned' in b){sets.push('pinned=?');vals.push(b.pinned?1:0)}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE notes SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM notes WHERE id=?',mm[1]);return j({ok:true})}

 // ===== YAPILACAKLAR (TODOS) =====
 if(p==='/api/todos'&&m==='GET'){try{
   const done=u.searchParams.get('done');
   let sql='SELECT * FROM todos';const params=[];
   if(done!==null&&done!==''){sql+=' WHERE done=?';params.push(Number(done))}
   sql+=' ORDER BY done ASC, CASE priority WHEN \'high\' THEN 0 WHEN \'normal\' THEN 1 WHEN \'low\' THEN 2 END, due_date ASC, created_at DESC LIMIT 200';
   const rows=await qall(env,sql,...params);
   return j({ok:true,todos:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/todos'&&m==='POST'){try{
   const b=await body(req);const text=String(b.text||'').trim();
   if(!text)return j({error:'TEXT_REQUIRED'},400);
   const tId=id();const t=now();
   await run(env,'INSERT INTO todos(id,text,done,priority,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',tId,text,0,b.priority||'normal',b.due_date||'',t,t);
   return j({ok:true,id:tId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/todos\/([^/]+)$/);
 if(mm&&m==='POST'){try{
   const b=await body(req);const sets=[];const vals=[];
   if('text' in b){sets.push('text=?');vals.push(b.text)}
   if('done' in b){sets.push('done=?');vals.push(b.done?1:0)}
   if('priority' in b){sets.push('priority=?');vals.push(b.priority)}
   if('due_date' in b){sets.push('due_date=?');vals.push(b.due_date)}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE todos SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM todos WHERE id=?',mm[1]);return j({ok:true})}

 // ===== MÜŞTERİ RAPORU =====
 if(p==='/api/customer/report'){try{
   const cid=u.searchParams.get('id')||'';
   if(!cid)return j({error:'ID_REQUIRED'},400);
   const customer=await q1(env,'SELECT * FROM customers WHERE id=?',cid);
   if(!customer)return j({error:'NOT_FOUND'},404);
   const jobs=await qall(env,'SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC',cid);
   const invoices=await qall(env,'SELECT * FROM invoices WHERE customer_id=? ORDER BY created_at DESC',cid);
   const appointments=await qall(env,'SELECT * FROM appointments WHERE customer_id=? ORDER BY date DESC',cid).catch(()=>[]);
   const contacts=await qall(env,'SELECT * FROM contact_log WHERE customer_id=? ORDER BY created_at DESC',cid).catch(()=>[]);
   const totalSpent=jobs.reduce((s,j)=>s+(j.price||0),0);
   const completedJobs=jobs.filter(j=>j.status==='completed').length;
   const openJobs=jobs.filter(j=>j.status==='open').length;
   return j({ok:true,customer,jobs,invoices,appointments,contacts,summary:{totalJobs:jobs.length,completedJobs,openJobs,totalSpent,invoiceCount:invoices.length,contactCount:contacts.length}});
 }catch(e){return j({error:e.message},500)}}

 // ===== HIZLI İŞ OLUŞTUR (tek adımda müşteri + iş + randevu) =====
 if(p==='/api/quick-job'&&m==='POST'){try{
   const b=await body(req);
   const t=now();let customerId=b.customer_id||'';
   // Müşteri yoksa oluştur
   if(!customerId&&b.customer_name){
     customerId=id();
     await run(env,'INSERT INTO customers(id,name,phone,email,vehicle,plate,notes,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',customerId,b.customer_name,b.phone||'',b.email||'',b.vehicle||'',b.plate||'','','[]',t,t);
   }
   if(!customerId)return j({error:'CUSTOMER_REQUIRED'},400);
   // İş oluştur
   const jobId=id();
   await run(env,'INSERT INTO jobs(id,customer_id,type,title,description,status,price,currency,files,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',jobId,customerId,b.type||'tuning',b.title||'ECU Tuning',b.description||'','open',Number(b.price||0),b.currency||'EUR','[]',b.notes||'',t,t);
   // Randevu oluştur (opsiyonel)
   let aptId=null;
   if(b.date){
     aptId=id();
     await run(env,'INSERT INTO appointments(id,customer_id,title,date,time,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',aptId,customerId,b.title||'ECU Tuning',b.date,b.time||'10:00','scheduled','',t,t);
   }
   // Gelir kaydı (fiyat varsa)
   if(Number(b.price)>0){
     await run(env,'INSERT INTO transactions(id,type,amount,currency,category,description,date,customer_id,job_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id(),'income',Number(b.price),b.currency||'EUR',b.type||'tuning',(b.customer_name||'')+ ' — '+(b.title||'ECU Tuning'),b.date||new Date().toISOString().slice(0,10),customerId,jobId,t,t).catch(()=>{});
   }
   await log(env,'quick-job','Hızlı iş: '+(b.customer_name||customerId)+' — '+(b.title||'ECU Tuning'),{jobId,customerId,aptId});
   return j({ok:true,customerId,jobId,aptId});
 }catch(e){return j({error:e.message},500)}}

 // ===== MÜŞTERİ İLETİŞİM KAYDI =====
 if(p==='/api/contacts'&&m==='GET'){try{
   const cid=u.searchParams.get('customer_id')||'';
   let sql='SELECT cl.*,c.name as customer_name,c.plate as customer_plate FROM contact_log cl LEFT JOIN customers c ON cl.customer_id=c.id';const params=[];
   if(cid){sql+=' WHERE cl.customer_id=?';params.push(cid)}
   sql+=' ORDER BY cl.created_at DESC LIMIT 100';
   const rows=await qall(env,sql,...params);
   return j({ok:true,contacts:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/contacts'&&m==='POST'){try{
   const b=await body(req);
   if(!b.customer_id||!b.summary)return j({error:'CUSTOMER_AND_SUMMARY_REQUIRED'},400);
   const cId=id();const t=now();
   await run(env,'INSERT INTO contact_log(id,customer_id,channel,direction,summary,created_at) VALUES(?,?,?,?,?,?)',cId,b.customer_id,b.channel||'whatsapp',b.direction||'outgoing',b.summary,t);
   return j({ok:true,id:cId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/contacts\/([^/]+)$/);
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM contact_log WHERE id=?',mm[1]);return j({ok:true})}

 // ===== VERİ YEDEKLEME / DIŞA AKTARMA =====
 if(p==='/api/export'&&m==='GET'){try{
   const tables=['customers','jobs','invoices','appointments','notes','todos','price_list','transactions','contact_log'];
   const data={exported_at:new Date().toISOString(),tables:{}};
   for(const t of tables){try{data.tables[t]=await qall(env,'SELECT * FROM '+t)}catch{data.tables[t]=[]}}
   return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="jarvis-backup-'+new Date().toISOString().slice(0,10)+'.json"','Access-Control-Allow-Origin':'*'}});
 }catch(e){return j({error:e.message},500)}}

 // ===== FİYAT LİSTESİ =====
 if(p==='/api/prices'&&m==='GET'){try{
   const cat=u.searchParams.get('category')||'';
   let sql='SELECT * FROM price_list WHERE active=1';const params=[];
   if(cat){sql+=' AND category=?';params.push(cat)}
   sql+=' ORDER BY category, price ASC';
   const rows=await qall(env,sql,...params);
   return j({ok:true,prices:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/prices'&&m==='POST'){try{
   const b=await body(req);
   if(!b.service||!b.price)return j({error:'SERVICE_AND_PRICE_REQUIRED'},400);
   const pId=id();const t=now();
   await run(env,'INSERT INTO price_list(id,service,description,price,currency,category,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',pId,b.service,b.description||'',Number(b.price),b.currency||'EUR',b.category||'tuning',1,t,t);
   return j({ok:true,id:pId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/prices\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['service','description','price','currency','category','active']){if(k in b){sets.push(k+'=?');vals.push(k==='price'?Number(b[k]):k==='active'?(b[k]?1:0):b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE price_list SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'UPDATE price_list SET active=0 WHERE id=?',mm[1]);return j({ok:true})}

 // ===== GELİR/GİDER TAKİBİ =====
 if(p==='/api/transactions'&&m==='GET'){try{
   const type=u.searchParams.get('type')||'';
   const month=u.searchParams.get('month')||'';
   let sql='SELECT * FROM transactions';const params=[];const conds=[];
   if(type){conds.push('type=?');params.push(type)}
   if(month){conds.push("date LIKE ?");params.push(month+'%')}
   if(conds.length)sql+=' WHERE '+conds.join(' AND ');
   sql+=' ORDER BY date DESC, created_at DESC LIMIT 200';
   const rows=await qall(env,sql,...params);
   // Toplamlar
   const incomeQ=await q1(env,"SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='income'"+(month?" AND date LIKE '"+month+"%'":""));
   const expenseQ=await q1(env,"SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='expense'"+(month?" AND date LIKE '"+month+"%'":""));
   return j({ok:true,transactions:rows,income:incomeQ?.total||0,expense:expenseQ?.total||0,profit:(incomeQ?.total||0)-(expenseQ?.total||0)});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/transactions'&&m==='POST'){try{
   const b=await body(req);
   if(!b.amount)return j({error:'AMOUNT_REQUIRED'},400);
   if(!b.date)return j({error:'DATE_REQUIRED'},400);
   const tId=id();const t=now();
   await run(env,'INSERT INTO transactions(id,type,amount,currency,category,description,date,customer_id,job_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',tId,b.type||'income',Number(b.amount),b.currency||'EUR',b.category||'genel',b.description||'',b.date,b.customer_id||'',b.job_id||'',t,t);
   return j({ok:true,id:tId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/transactions\/([^/]+)$/);
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM transactions WHERE id=?',mm[1]);return j({ok:true})}

 // ===== İŞ TAKVİMİ (tarih bazlı özet) =====
 if(p==='/api/calendar/day'){try{
   const date=u.searchParams.get('date')||new Date().toISOString().slice(0,10);
   const appointments=await qall(env,'SELECT a.*,c.name as customer_name,c.plate as customer_plate FROM appointments a LEFT JOIN customers c ON a.customer_id=c.id WHERE a.date=? ORDER BY a.time ASC',date).catch(()=>[]);
   const jobs=await qall(env,'SELECT j.*,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id WHERE date(j.created_at/1000,\'unixepoch\')=? ORDER BY j.created_at DESC',date).catch(()=>[]);
   const todos=await qall(env,'SELECT * FROM todos WHERE due_date=? ORDER BY done ASC, priority ASC',date).catch(()=>[]);
   return j({ok:true,date,appointments,jobs,todos});
 }catch(e){return j({error:e.message},500)}}

 return j({error:'NOT_FOUND'},404)}
async function runScheduledJobs(env){
  try{
    const jobs=await qall(env,'SELECT * FROM scheduled_jobs WHERE status=? AND next_run<=? LIMIT 5','active',now());
    for(const job of jobs){
      try{
        if(job.type==='social_post'){
          // 1) AI ile içerik üret (ücretsiz — bağlı provider)
          const contentPrompt=`Sen sosyal medya uzmanısın. Şu konu hakkında kısa, dikkat çekici bir ${job.platform} paylaşımı yaz (Türkçe, max 280 karakter, emoji kullan): ${job.topic}`;
          const a=await aiFallback(env,[{role:'user',content:contentPrompt}],{mode:'fast'});
          const text=a?.text||job.topic;
          // 2) Görsel üret (Cloudflare AI — ücretsiz)
          let imageKey=null;
          if(env.AI&&job.platform==='instagram'){
            try{
              const imgPrompt=`Professional social media post image about: ${job.topic}. Modern, clean, automotive style.`;
              const result=await env.AI.run('@cf/black-forest-labs/FLUX.1-schnell',{prompt:imgPrompt,num_steps:4});
              if(result?.image){
                const imgId=id();
                imageKey='images/'+imgId+'.png';
                const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
                if(env.FILES)await env.FILES.put(imageKey,imgBytes,{httpMetadata:{contentType:'image/png'}});
              }
            }catch{}
          }
          // 3) Onay kuyruğuna koy (otomatik paylaşma — Haydar onaylasın)
          await pendingAction(env,job.platform==='instagram'?'instagram_post':'facebook_post',{
            message:text,
            caption:text,
            imageUrl:imageKey?`/api/ai/image/serve?id=${imageKey.replace('images/','').replace('.png','')}`:'',
            scheduledJobId:job.id,
            topic:job.topic
          },`Zamanlanmış ${job.platform} paylaşımı: ${text.slice(0,80)}...`,'low');
          await log(env,'social-auto','Zamanlanmış paylaşım onay kuyruğuna eklendi: '+text.slice(0,100),{platform:job.platform,jobId:job.id});
        }
        // Sonraki çalışmayı ayarla
        const intervals={daily:86400000,weekly:604800000,biweekly:1209600000,monthly:2592000000};
        const interval=intervals[job.cadence]||604800000;
        await run(env,'UPDATE scheduled_jobs SET last_run=?,next_run=? WHERE id=?',now(),now()+interval,job.id);
      }catch(e){
        await recordRuntimeError(env,e,'scheduled.social.'+job.id);
      }
    }
  }catch{}
}

export default {async fetch(req,env,ctx){try{const u=new URL(req.url);if(u.pathname==='/api/version')return j({ok:true,version:'fast-chat-2026-09-13-2',ts:now()});if(u.pathname.startsWith('/api/')){if(!env.DB)return j({error:'D1_NOT_BOUND',detail:'Cloudflare D1 binding DB is missing.'},500);return await router(req,env,ctx)}return env.ASSETS.fetch(req)}catch(e){console.error(e);if(env.DB)await recordRuntimeError(env,e,new URL(req.url).pathname);return j({error:'SERVER_ERROR',detail:e.message},500)}},async scheduled(event,env,ctx){ctx.waitUntil(Promise.all([selfHeal(env),runScheduledJobs(env)]))}};
