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
    if(p==='gemini'){const model=c.model||'gemini-2.5-flash';const r=await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(sec)}`);if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(p==='groq'){const r=await fetchT('https://api.groq.com/openai/v1/models',{headers:{authorization:'Bearer '+sec}});if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(p==='openrouter'){const r=await fetchT('https://openrouter.ai/api/v1/models',{headers:{authorization:'Bearer '+sec}});if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(p==='nvidia'){const r=await fetchT('https://integrate.api.nvidia.com/v1/models',{headers:{authorization:'Bearer '+sec}});if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(p==='google'){if(!String(c.endpoint||'').includes('.apps.googleusercontent.com'))throw Error('GOOGLE_CLIENT_ID_INVALID')}
    else if(p==='meta'){const r=await fetchT('https://graph.facebook.com/v24.0/me?access_token='+encodeURIComponent(sec));if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(p==='github'){const r=await fetchT('https://api.github.com/user',{headers:{authorization:'Bearer '+sec,accept:'application/vnd.github+json','user-agent':'JARVIS-SelfUpdate'}});if(!r.ok)throw Error('HTTP_'+r.status)}
    else if(c.endpoint){const h={'authorization':'Bearer '+sec};const r=await fetchT(c.endpoint.replace(/\/$/,'')+'/models',{headers:h});if(!r.ok&&r.status!==404)throw Error('HTTP_'+r.status)}
    await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),c.id);return {ok:true}
  }catch(e){await run(env,'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?','error',e.message,now(),now(),c.id);return {ok:false,error:e.message}}
}
async function callVaultAI(env,c,messages){
  const p=String(c.provider||'').toLowerCase(),sec=c.secret;
  if(p==='gemini'){
    const model=c.model||'gemini-2.5-flash';const r=await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(sec)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),systemInstruction:{parts:[{text:messages.find(x=>x.role==='system')?.content||''}]}})});if(!r.ok)throw Error('GEMINI_'+r.status);return (await r.json()).candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||''
  }
  const base=p==='groq'?'https://api.groq.com/openai/v1':p==='openrouter'?'https://openrouter.ai/api/v1':p==='nvidia'?'https://integrate.api.nvidia.com/v1':String(c.endpoint||'').replace(/\/$/,'');
  if(!base)throw Error('NO_ENDPOINT');
  const model=c.model||(p==='groq'?'llama-3.3-70b-versatile':p==='openrouter'?'openrouter/auto':p==='nvidia'?'nvidia/nemotron-3.5-lightning-30b-a3b':'');
  const r=await fetchT(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+sec,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'},body:JSON.stringify({model,messages,temperature:.25})});if(!r.ok)throw Error((p||'AI').toUpperCase()+'_'+r.status);return (await r.json()).choices?.[0]?.message?.content||''
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
  if(env.GEMINI_API_KEY)envProviders.push('Gemini'); if(env.GROQ_API_KEY)envProviders.push('Groq'); if(env.OPENROUTER_API_KEY)envProviders.push('OpenRouter'); if(env.AI)envProviders.push('Cloudflare AI');
  const names=[...new Set([...enabled.filter(x=>['gemini','groq','openrouter','nvidia','openai-compatible'].includes(String(x.provider).toLowerCase())).map(x=>x.label||x.provider),...envProviders])];
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
async function ddg(q){const r=await fetchT('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 JARVIS/4.0'}},5000);if(!r.ok)throw Error('SEARCH_'+r.status);const h=await r.text(),out=[],re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;const clean=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();let m;while((m=re.exec(h))&&out.length<8)out.push({title:clean(m[2]),url:m[1].replace(/&amp;/g,'&'),snippet:clean(m[3])});return out}
function aiProviderKey(p){return String(p||'').toLowerCase().replace(/[^a-z0-9_.@/-]+/g,'_').slice(0,120)}
function aiFailureCooldownMs(msg){
 msg=String(msg||'');
 if(/404|not found|deprecated|deprecation|model.*unavailable|5028/i.test(msg))return 86400000;
 if(/timeout|abort|network|fetch/i.test(msg))return 180000;
 if(/401|403|invalid.*key|unauthorized|permission/i.test(msg))return 3600000;
 if(/429|rate/i.test(msg))return 600000;
 return 300000;
}
async function aiRouterGet(env,key){
 return await kvGet(env,'ai_router:'+aiProviderKey(key),{failures:0,disabled_until:0,last_error:null,last_ok:0,last_try:0});
}
async function aiRouterMark(env,key,ok,error=''){
 const k=aiProviderKey(key),st=await aiRouterGet(env,k);
 if(ok){
  await kvSet(env,'ai_router:'+k,{...st,failures:0,disabled_until:0,last_error:null,last_ok:now(),last_try:now()});
  return;
 }
 const failures=Number(st.failures||0)+1,cooldown=aiFailureCooldownMs(error),disabled_until=now()+Math.min(cooldown*Math.min(failures,4),86400000);
 await kvSet(env,'ai_router:'+k,{...st,failures,disabled_until,last_error:String(error||'UNKNOWN').slice(0,500),last_try:now()});
}
async function aiRouterAllowed(env,key){
 const st=await aiRouterGet(env,key);
 return !st.disabled_until||Number(st.disabled_until)<now();
}
function aiModeForText(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/kod|program|debug|hata|analiz|uzun|detay|rapor|karşılaştır|karsilastir|strateji|plan|araştır|arastir/.test(l))return 'strong';
 return 'fast';
}
async function aiRouterStatus(env){
 const keys=['vault','Gemini','Groq','OpenRouter','Cloudflare AI'];
 const rows=[];
 for(const k of keys){const st=await aiRouterGet(env,k);rows.push({provider:k,disabled_until:st.disabled_until||0,failures:st.failures||0,last_error:st.last_error||null,last_ok:st.last_ok||0})}
 return rows;
}
async function callGeminiEnv(env,messages,ms){
 const model=env.GEMINI_MODEL||'gemini-2.5-flash';
 const r=await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]})),systemInstruction:{parts:[{text:messages.find(x=>x.role==='system')?.content||''}]}})},ms);
 if(!r.ok)throw Error('GEMINI_'+r.status);
 const text=(await r.json()).candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
 if(!String(text||'').trim())throw Error('GEMINI_EMPTY');
 return text;
}
async function callOpenAICompat(base,key,model,messages,ms,provider){
 const r=await fetchT(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key,'HTTP-Referer':'https://jarvis-personal-ai.haydojarvis.workers.dev','X-Title':'JARVIS'},body:JSON.stringify({model,messages,temperature:.25})},ms);
 if(!r.ok)throw Error(provider.toUpperCase()+'_'+r.status);
 const text=(await r.json()).choices?.[0]?.message?.content||'';
 if(!String(text||'').trim())throw Error(provider.toUpperCase()+'_EMPTY');
 return text;
}
async function callCloudflareModel(env,model,messages,ms){
 const out=await withTimeout(env.AI.run(model,{messages,temperature:0.25,max_tokens:900}),ms,'CF_AI_TIMEOUT');
 const text=out?.response||out?.result?.response||out?.choices?.[0]?.message?.content||out?.text||'';
 if(!String(text||'').trim())throw Error('CF_AI_EMPTY');
 return text;
}
async function aiFallback(env,messages,opts={}){
 const userText=opts.userText||messages.slice().reverse().find(x=>x.role==='user')?.content||'';
 const mode=opts.mode||aiModeForText(userText);
 const errs=[],deadline=now()+(mode==='strong'?14000:8000);
 const left=()=>Math.max(450,Math.min(mode==='strong'?3500:1800,deadline-now()));
 const expired=()=>now()>=deadline;
 const tryOne=async(key,label,fn)=>{
  if(expired())throw Error('AI_ROUTER_DEADLINE');
  if(!(await aiRouterAllowed(env,key))){errs.push(label+':SKIPPED_COOLDOWN');return null}
  try{
   const text=await withTimeout(fn(left()),left()+250,label+'_TIMEOUT');
   if(!String(text||'').trim())throw Error('EMPTY_RESPONSE');
   await aiRouterMark(env,key,true);
   return {provider:label,text};
  }catch(e){
   const msg=String(e?.message||e||'UNKNOWN');
   errs.push(label+':'+msg);
   await aiRouterMark(env,key,false,msg);
   return null;
  }
 };
 const vault=(await credentialSecrets(env,'chat')).slice(0,3);
 for(const c of vault){
  const key='vault:'+c.id;
  const got=await tryOne(key,c.label||c.provider,async(ms)=>callVaultAI(env,c,messages));
  if(got){await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),c.id);return got}
  await run(env,'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?','error',errs.at(-1)||'AI_FAILED',now(),now(),c.id);
 }
 const providers=mode==='fast'
  ? ['groq','gemini','openrouter','cf']
  : ['gemini','openrouter','groq','cf'];
 for(const p of providers){
  if(p==='groq'&&env.GROQ_API_KEY){
   const got=await tryOne('env:groq','Groq',ms=>callOpenAICompat('https://api.groq.com/openai/v1',env.GROQ_API_KEY,env.GROQ_MODEL||'llama-3.3-70b-versatile',messages,ms,'groq'));
   if(got)return got;
  }
  if(p==='gemini'&&env.GEMINI_API_KEY){
   const got=await tryOne('env:gemini:'+(env.GEMINI_MODEL||'gemini-2.5-flash'),'Gemini',ms=>callGeminiEnv(env,messages,ms));
   if(got)return got;
  }
  if(p==='openrouter'&&env.OPENROUTER_API_KEY){
   const got=await tryOne('env:openrouter','OpenRouter',ms=>callOpenAICompat('https://openrouter.ai/api/v1',env.OPENROUTER_API_KEY,env.OPENROUTER_MODEL||'openrouter/auto',messages,ms,'openrouter'));
   if(got)return got;
  }
  if(p==='cf'&&env.AI){
   const cfModels=mode==='fast'
    ? ['@cf/meta/llama-3.1-8b-instruct-fast','@cf/meta/llama-3.1-8b-instruct-fp8','@cf/google/gemma-3-12b-it']
    : ['@cf/meta/llama-3.1-8b-instruct-fp8','@cf/google/gemma-3-12b-it','@cf/qwen/qwen1.5-14b-chat-awq'];
   for(const model of cfModels){
    const got=await tryOne('cf:'+model,'Cloudflare AI ('+model+')',ms=>callCloudflareModel(env,model,messages,ms));
    if(got)return got;
   }
  }
 }
 throw Error(errs.length?'ALL_AI_FAILED:'+errs.slice(-10).join('|'):'NO_AI_PROVIDER');
}
function localFallbackAnswer(text,error=''){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
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
async function command(env,text){await log(env,'user',text);const l=text.toLocaleLowerCase('tr-TR');const remembered=await rememberExplicit(env,text);if(remembered){const reply=`Bunu hafızama kaydettim: ${remembered}`;await log(env,'jarvis',reply);return{reply,action:'memory'}}
 if(/görev.*ekle|hatırlat/.test(l)){const title=text.replace(/^(jarvis[, ]*)?/i,'').replace(/görev.*ekle[: ]*/i,'').replace(/bana hatırlat[: ]*/i,'').trim()||text;const t=now();await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id(),title,'Orta','open','genel',t,t);const reply=`Görevi ekledim: ${title}`;await log(env,'jarvis',reply);return{reply,action:'task'}}
 if((l.includes('bugün')&&(l.includes('ne yapt')||l.includes('özet')||l.includes('neler oldu')))||l.includes('günlük brief')){const b=await brief(env);const reply=`Bugünkü durum: ${b.text}${b.top?` Sıradaki iş: ${b.top}.`:''}`;await log(env,'jarvis',reply);return{reply,action:'brief'}}
 if(l.startsWith('araştır ')||l.includes('internette araştır')){const q=text.replace(/^araştır\s*/i,'').replace(/internette araştır/ig,'').trim()||text;const results=await ddg(q),reply=`Araştırmayı yaptım. ${results.length} sonuç buldum${results[0]?`: ${results[0].title}`:''}.`;await log(env,'jarvis',reply,{q,count:results.length});return{reply,action:'research',results}}
 if(/(?:jarvis[, ]*)?(?:şunu|sunu|bu|şu)?\s*(?:özelliği|özellik|modül|modulu|panel|fonksiyon).*ekle|kendini.*(?:düzelt|güncelle|iyileştir)|(?:hata|bug).*?(?:bul|düzelt)|(?:ekle|değiştir|düzelt).*?(?:jarvis|uygulama)/i.test(text)){const r=await createSelfChange(env,text,'user');const reply=r.ok?`İsteği kendi koduma uygulamak için değişikliği hazırladım: ${r.summary}. Otomatik test/deploy hattına gönderdim.`:r.message;await log(env,'jarvis',reply,r);return{reply,action:'self_update',selfUpdate:r}}
 if(/reels|video oluştur|görsel oluştur|şarkı.*üret|seslendir|altyazı/.test(l)){let cap='content-generation';if(/reels|video/.test(l))cap='reels-video';else if(/görsel/.test(l))cap='image-generation';else if(/şarkı|müzik/.test(l))cap='music-generation';else if(/seslendir/.test(l))cap='tts';else if(/altyazı/.test(l))cap='transcription';const tools=await qall(env,'SELECT * FROM tool_registry WHERE capability=? AND enabled=1 ORDER BY priority ASC',cap);if(!tools.length){const found=await discoverTools(env,cap);const reply=`Bu iş için henüz bağlı bir araç yok. ${found.length} uygun AI aracı buldum; Araç Keşfi bölümünde göstereceğim.`;await log(env,'jarvis',reply,{cap});return{reply,action:'tool_discovery',cap,tools:found}}}
 const needsLiveResearch=/(güncel|guncel|bugün|bugun|şimdi|simdi|son durum|sonuç|sonuc|fiyat|kaç para|kac para|ne kadar|satılıyor|satiliyor|nerede|yakınımda|yakinimda|açık mı|acik mi|uçuş|ucus|tren|kargo|rezervasyon|seçim|secim|hava durumu|kur|borsa|sigara|market|amazon|ebay|link|araştır|arastir|bakabilir|bakıp|bakip)/.test(l);
 let researchContext='';
 if(needsLiveResearch){
  try{
   const results=await ddg(text);
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA SONUÇLARI (kullanıcıya sitelere kendin bak deme; bu sonuçları değerlendir, yeterli değilse erişemediğini açık söyle): '+JSON.stringify(results.slice(0,8));
   await log(env,'research','Otomatik araştırma: '+text,{count:results.length});
  }catch(e){
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA DENEMESİ BAŞARISIZ: '+e.message+'. Kullanıcıya rastgele siteye bak demek yerine, erişemediğini açık söyle ve hangi resmi kaynağın gerektiğini belirt.';
   await log(env,'research','Otomatik araştırma başarısız: '+text,{error:e.message});
  }
 }
 const s=await state(env),history=await chatHistory(env,30),mem=await qall(env,'SELECT text,tags FROM memories ORDER BY created_at DESC LIMIT 30');const system=`Sen JARVIS adlı Türkçe kişisel asistansın. ChatGPT gibi doğal sohbet et ama aynı zamanda aksiyon alan kişisel asistansın. Güncel bilgi, fiyat, ürün, yer, uçuş, kargo, rezervasyon, yasa, seçim, hava durumu veya değişebilir bilgi sorulursa kullanıcıya \\\"siteye gir bak\\\" deme; önce sen web/canlı araştırma sonuçlarını kullanarak netleştir. Erişim yoksa bunu açık söyle, ama kullanıcıyı baştan savma. Kullanıcının önceki sohbetlerini ve hafızasını bağlam olarak kullan. Kısa gerektiğinde kısa, detay gerektiğinde detaylı ol. Bağlı olmayan entegrasyonları uydurma. Kullanıcı işi bitirmeni ister; gerektiğinde araştır, planla ve bağlı araçlar arasında geçiş yap. Geri döndürülemez işlemlerde onay iste. Kalıcı hafıza: ${JSON.stringify(mem)} Sistem bağlamı: ${JSON.stringify({brief:s.brief,tasks:s.tasks.slice(0,20),projects:s.projects.slice(0,20),integrations:s.integrations})}${researchContext}`;let a;try{a=await aiFallback(env,[{role:'system',content:system},...history.slice(-20,-1).map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content})),{role:'user',content:text}],{userText:text})}catch(e){const msg=String(e?.message||e||'UNKNOWN').slice(0,500),fallback=localFallbackAnswer(text,msg),reply=fallback||'Şu an bağlı AI servisleri cevap vermedi ama isteğini kaybettirmedim. Hata arka planda kaydedildi; servis anahtarlarını ve sağlayıcıları kontrol edeceğim.';await recordRuntimeError(env,e,'chat.ai');await log(env,'jarvis',reply,{provider:'system',error:msg});return{reply,action:fallback?'local_fallback':'ai_error',provider:fallback?'JARVIS Local':'system'}}if(!String(a.text||'').trim()){const reply='AI sağlayıcısı boş cevap döndürdü. Bunu hata olarak kaydettim; başka sağlayıcı veya ayar kontrolü gerekiyor.';await recordRuntimeError(env,Error('EMPTY_AI_REPLY:'+a.provider),'chat.ai');await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai_error',provider:a.provider}}const reply=a.text;await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai',provider:a.provider}}
async function router(req,env){const u=new URL(req.url),p=u.pathname,m=req.method;
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
 if(p==='/api/chat/send'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);await addChat(env,'user',text,null);try{const r=await withTimeout(command(env,text),12000,'COMMAND_TIMEOUT');await addChat(env,'assistant',r.reply,r.provider||null);return j({...r,state:await state(env),history:await chatHistory(env,120)})}catch(e){const msg=String(e?.message||e||'UNKNOWN'),reply=localFallbackAnswer(text,msg)||'Şu an cevap motoru zamanında dönemedi. İsteğini kaybettirmedim; hata arka planda kaydedildi.';await recordRuntimeError(env,e,'chat.send');await addChat(env,'assistant',reply,'JARVIS Local');return j({reply,action:'local_fallback',provider:'JARVIS Local',state:await state(env),history:await chatHistory(env,120)})}}
 if(p==='/api/chat/clear'&&m==='POST'){await run(env,'DELETE FROM chat_messages');return j({ok:true})}
 if(p==='/api/ai/router/status')return j({router:await aiRouterStatus(env)});
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
 return j({error:'NOT_FOUND'},404)}
export default {async fetch(req,env){try{const u=new URL(req.url);if(u.pathname.startsWith('/api/')){if(!env.DB)return j({error:'D1_NOT_BOUND',detail:'Cloudflare D1 binding DB is missing.'},500);return await router(req,env)}return env.ASSETS.fetch(req)}catch(e){console.error(e);if(env.DB)await recordRuntimeError(env,e,new URL(req.url).pathname);return j({error:'SERVER_ERROR',detail:e.message},500)}},async scheduled(event,env,ctx){ctx.waitUntil(selfHeal(env))}};
