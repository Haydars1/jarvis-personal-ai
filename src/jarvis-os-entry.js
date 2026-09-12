import core from './chat-enhancements-entry.js';

const te=new TextEncoder(),td=new TextDecoder();
const now=()=>Date.now(),uid=()=>crypto.randomUUID();
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function body(req){try{return await req.json()}catch{return{}}}
async function q(env,sql,...bind){return (await env.DB.prepare(sql).bind(...bind).all()).results||[]}
async function q1(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).first()}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64u(s){s=String(s||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function masterKey(env){const raw=String(env.CREDENTIAL_MASTER_KEY||'').trim();if(raw.length<24)throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');let bytes=null;try{const x=Uint8Array.from(atob(raw.replace(/\s+/g,'')),c=>c.charCodeAt(0));if([16,24,32].includes(x.length))bytes=x}catch{}if(!bytes)bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(raw)));return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt'])}
async function dec(env,v){const [a,b]=String(v||'').split('.');if(!a||!b)throw Error('INVALID_CREDENTIAL_BLOB');const k=await masterKey(env),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)},k,fromB64u(b));return td.decode(pt)}
async function authed(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);try{return !!(await r.json()).authenticated}catch{return false}}
async function state(req,env,ctx){const r=await core.fetch(new Request(new URL('/api/state',req.url),{headers:req.headers}),env,ctx);return r.json()}
async function history(env,limit=160){const rows=await q(env,'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?',limit);return rows.reverse()}
async function saveMsg(env,role,content,provider=null){await run(env,'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)',uid(),role,String(content||''),provider,now())}
async function notify(env,kind,title,bodyText='',meta={}){await run(env,'INSERT INTO notifications(id,kind,title,body,read,meta,created_at) VALUES(?,?,?,?,0,?,?)',uid(),kind,title,String(bodyText||''),JSON.stringify(meta||{}),now())}
function fingerprint(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}

async function recordMetric(env,provider,latencyMs,ok=true,error=''){
  provider=String(provider||'JARVIS').slice(0,140);
  const r=await q1(env,'SELECT * FROM provider_metrics WHERE provider=?',provider);
  if(!r){await run(env,'INSERT INTO provider_metrics(provider,samples,successes,failures,avg_latency_ms,last_latency_ms,last_error,updated_at) VALUES(?,?,?,?,?,?,?,?)',provider,1,ok?1:0,ok?0:1,latencyMs,latencyMs,error||null,now());return}
  const samples=Number(r.samples||0)+1,avg=((Number(r.avg_latency_ms||0)*Number(r.samples||0))+latencyMs)/samples;
  await run(env,'UPDATE provider_metrics SET samples=?,successes=?,failures=?,avg_latency_ms=?,last_latency_ms=?,last_error=?,updated_at=? WHERE provider=?',samples,Number(r.successes||0)+(ok?1:0),Number(r.failures||0)+(ok?0:1),avg,latencyMs,error||null,now(),provider);
}

function freshIntent(text=''){return /(bugün|şu an|şimdi|güncel|son durum|son dakika|latest|today|current|haber|fiyatı|kaç euro|stokta|satılıyor mu|ne zaman açık|hava durumu|trafik)/i.test(String(text))}
function agentIntent(text=''){const s=String(text);return /(agent mod|baştan sona|hepsini yap|bunu hallet|tamamını yap|araştır.*(ve|sonra).*(hazırla|yap|ekle)|bul.*(ve|sonra).*(ekle|kur|hazırla)|planla.*uygula)/i.test(s)}
function watchIntent(text=''){return /(takip et|haber ver|bildir|düşerse|çıkarsa|olursa|değişirse|bulunca)/i.test(String(text))}
function taskIntent(text=''){return /(görev ekle|yapılacaklara ekle|todo ekle)/i.test(String(text))}

async function googleSearch(req,env,ctx,query){
  const r=await core.fetch(new Request(new URL('/api/google-search?q='+encodeURIComponent(query)+'&num=8',req.url),{headers:req.headers}),env,ctx);
  if(!r.ok)throw Error('GOOGLE_SEARCH_'+r.status);
  const x=await r.json();return x.results||[];
}
async function synthesizeSearch(env,text,results){
  const compact=results.slice(0,6).map((r,i)=>`[${i+1}] ${r.title}\n${r.snippet}\n${r.url}`).join('\n\n');
  if(env.AI){try{const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`Kullanıcı sorusu: ${text}\n\nGüncel web sonuçları:\n${compact}\n\nTürkçe, doğrudan cevap ver. Yalnız sonuçlarda olan bilgiyi kullan. Kaynakları [1], [2] diye işaretle.`,max_tokens:800,temperature:0.15});const t=String(x?.response||x?.result?.response||x?.text||'').trim();if(t)return t}catch{}}
  return compact;
}
async function liveWeb(req,env,ctx,text){const results=await googleSearch(req,env,ctx,text);const reply=await synthesizeSearch(env,text,results);await saveMsg(env,'user',text);await saveMsg(env,'assistant',reply,'Google Search');return json({reply,provider:'Google Search',results,state:await state(req,env,ctx),history:await history(env)})}

function cleanAnyAttachments(items){return (Array.isArray(items)?items:[]).filter(x=>x&&String(x.base64||'').length>20).slice(0,4).map(x=>({name:String(x.name||'file').slice(0,180),type:String(x.type||'application/octet-stream'),base64:String(x.base64||'')}))}
function imageOnly(a){return a.length&&a.every(x=>/^image\//i.test(x.type))}
function textLike(type,name){return /^text\//i.test(type)||/(json|csv|xml|javascript)/i.test(type)||/\.(txt|md|csv|json|log|xml|js|ts|py|sql)$/i.test(name)}
function decodeTextAttachment(a){try{return td.decode(Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0))).slice(0,50000)}catch{return''}}
async function geminiDoc(env,text,files){
  const c=await q1(env,"SELECT * FROM credentials WHERE provider='gemini' AND enabled=1 AND last_status='ok' ORDER BY priority ASC LIMIT 1");
  if(!c)throw Error('GEMINI_MULTIMODAL_NOT_CONNECTED');
  const secret=await dec(env,c.encrypted_secret),model=c.model||'gemini-2.5-flash';
  const parts=[{text:text||'Bu dosyaları incele, önemli bilgileri çıkar ve Türkçe cevap ver.'}];
  for(const f of files){if(textLike(f.type,f.name)){const content=decodeTextAttachment(f);parts.push({text:`\nDOSYA: ${f.name}\n${content}`})}else{parts.push({inline_data:{mime_type:f.type,data:f.base64}})}}
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),18000);
  try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}]})});if(!r.ok)throw Error('GEMINI_FILE_'+r.status);const x=await r.json(),out=x.candidates?.[0]?.content?.parts?.map(p=>p.text).filter(Boolean).join('')||'';if(!out)throw Error('GEMINI_FILE_EMPTY');return {provider:'Gemini Multimodal',text:out}}finally{clearTimeout(tm)}}
async function multimodal(req,env,ctx,text,files){
  // Let the existing image router use Gemini/NVIDIA for pure image requests.
  if(imageOnly(files)) return core.fetch(new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({text,attachments:files})}),env,ctx);
  const a=await geminiDoc(env,text,files);await saveMsg(env,'user',(text||'Dosyayı incele')+'\n'+files.map(f=>'[Dosya: '+f.name+']').join(' '));await saveMsg(env,'assistant',a.text,a.provider);return json({reply:a.text,provider:a.provider,state:await state(req,env,ctx),history:await history(env)})
}

async function rememberAsync(env,userText,assistantText){
  if(!env.AI||!userText)return;
  try{
    const prompt=`Aşağıdaki kullanıcı mesajından gelecekte faydalı olacak kalıcı, açık ve kısa kullanıcı gerçeklerini çıkar. Şifre/API key/token, sağlık, din, siyaset, cinsellik gibi hassas bilgileri ASLA kaydetme. Geçici istekleri kaydetme. Sadece JSON dizi döndür, en fazla 3 kısa Türkçe cümle. Hiç yoksa [].\n\nKullanıcı: ${String(userText).slice(0,5000)}\nAsistan cevabı bağlamı: ${String(assistantText||'').slice(0,2500)}`;
    const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt,max_tokens:260,temperature:0});let t=String(x?.response||x?.result?.response||x?.text||'').trim();t=t.replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();const arr=JSON.parse(t);if(!Array.isArray(arr))return;
    for(const fact of arr.slice(0,3)){const s=String(fact||'').trim();if(s.length<8||s.length>300)continue;const exists=await q1(env,'SELECT id FROM memories WHERE text=? LIMIT 1',s);if(!exists)await run(env,'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)',uid(),s,JSON.stringify(['auto']),now())}
  }catch{}
}

async function createWatch(env,text){const id=uid();await run(env,'INSERT INTO watches(id,title,query,condition_text,enabled,interval_minutes,last_checked_at,last_fingerprint,last_result,created_at,updated_at) VALUES(?,?,?,?,1,30,NULL,NULL,NULL,?,?)',id,text.slice(0,120),text,text,now(),now());await notify(env,'watch','Takip başlatıldı',text,{watch_id:id});return id}
async function createTask(env,text){const title=text.replace(/^(görev ekle|yapılacaklara ekle|todo ekle)\s*[:,-]?\s*/i,'').trim()||text;const id=uid();await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,title,'Orta','open','genel',now(),now());return id}

async function planAgent(env,text){
  const allowed='search,tool,task,watch,self_update,answer';
  if(env.AI){try{const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`İstek: ${text}\nBunu JARVIS agent işi olarak 2-6 adıma ayır. Sadece şu tipleri kullan: ${allowed}. JSON dizi döndür: [{"type":"search","instruction":"..."}]. Riskli dış işlemleri doğrudan yapma; self_update yalnız kullanıcı sisteme özellik eklenmesini istiyorsa kullan. Son adım answer olsun.`,max_tokens:550,temperature:0.1});let t=String(x?.response||x?.result?.response||x?.text||'').trim().replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();const a=JSON.parse(t);if(Array.isArray(a)&&a.length)return a.slice(0,6)}catch{}}
  return [{type:'search',instruction:text},{type:'answer',instruction:'Sonuçları özetle'}];
}
async function runAgent(req,env,ctx,text){
  const id=uid(),plan=await planAgent(env,text);await run(env,'INSERT INTO agent_jobs(id,request,plan,status,current_step,result,error,created_at,updated_at) VALUES(?,?,?,?,0,NULL,NULL,?,?)',id,text,JSON.stringify(plan),'running',now(),now());
  const outputs=[];
  try{
    for(let i=0;i<plan.length;i++){
      const step=plan[i]||{},type=String(step.type||'answer'),instruction=String(step.instruction||text);await run(env,'UPDATE agent_jobs SET current_step=?,updated_at=? WHERE id=?',i+1,now(),id);
      if(type==='search'){try{const rs=await googleSearch(req,env,ctx,instruction);outputs.push({type,results:rs.slice(0,5)})}catch(e){outputs.push({type,error:e.message})}}
      else if(type==='tool'){try{const r=await core.fetch(new Request(new URL('/api/tools/discover?capability='+encodeURIComponent(instruction),req.url),{headers:req.headers}),env,ctx);outputs.push({type,data:r.ok?await r.json():{error:'HTTP_'+r.status}})}catch(e){outputs.push({type,error:e.message})}}
      else if(type==='task'){const tid=await createTask(env,instruction);outputs.push({type,id:tid,title:instruction})}
      else if(type==='watch'){const wid=await createWatch(env,instruction);outputs.push({type,id:wid,title:instruction})}
      else if(type==='self_update'){try{const r=await core.fetch(new Request(new URL('/api/self-update/request',req.url),{method:'POST',headers:req.headers,body:JSON.stringify({request:instruction})}),env,ctx);outputs.push({type,data:r.ok?await r.json():{error:'HTTP_'+r.status}})}catch(e){outputs.push({type,error:e.message})}}
      else if(type==='answer'){}
    }
    let reply='İşi tamamladım.';
    if(env.AI){try{const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`Kullanıcı isteği: ${text}\nAgent çıktıları: ${JSON.stringify(outputs).slice(0,14000)}\nTürkçe kısa sonuç raporu ver. Yapılmayan şeyi yapılmış gibi söyleme.`,max_tokens:900,temperature:0.2});reply=String(x?.response||x?.result?.response||x?.text||reply).trim()}catch{}}
    await run(env,'UPDATE agent_jobs SET status=?,result=?,updated_at=? WHERE id=?','completed',reply,now(),id);await notify(env,'agent','Agent işi tamamlandı',text,{agent_id:id});await saveMsg(env,'user',text);await saveMsg(env,'assistant',reply,'JARVIS Agent');return json({reply,provider:'JARVIS Agent',agent:{id,plan,outputs},state:await state(req,env,ctx),history:await history(env)});
  }catch(e){await run(env,'UPDATE agent_jobs SET status=?,error=?,updated_at=? WHERE id=?','failed',e.message,now(),id);await notify(env,'error','Agent işi başarısız',e.message,{agent_id:id});throw e}
}

async function logRuntimeError(env,context,message){const fp=fingerprint(context+'|'+message);await run(env,'INSERT INTO runtime_errors(id,ts,context,message,fingerprint,resolved) VALUES(?,?,?,?,?,0)',uid(),now(),context,message,fp);const r=await q1(env,'SELECT COUNT(*) n FROM runtime_errors WHERE fingerprint=? AND resolved=0 AND ts>?',fp,now()-86400000);if(Number(r?.n||0)>=3){const existing=await q1(env,"SELECT id FROM change_requests WHERE status IN ('queued','running') AND request LIKE ? LIMIT 1",'%'+fp+'%');if(!existing){await run(env,'INSERT INTO change_requests(id,request,origin,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',uid(),`[auto-heal:${fp}] Tekrarlanan runtime hatasını incele ve güvenli düzeltme hazırla. Context: ${context}. Hata: ${message}`,'auto-heal','queued','Tekrarlanan hata için self-heal',now(),now());await notify(env,'error','Self-heal tetiklendi',message,{fingerprint:fp})}}}

async function osApi(req,env){const u=new URL(req.url),p=u.pathname,m=req.method;
  if(p==='/api/os/notifications'&&m==='GET'){return json(await q(env,'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'))}
  if(p==='/api/os/notifications/read'&&m==='POST'){await run(env,'UPDATE notifications SET read=1 WHERE read=0');return json({ok:true})}
  if(p==='/api/os/performance'&&m==='GET'){return json(await q(env,'SELECT * FROM provider_metrics ORDER BY failures ASC,avg_latency_ms ASC'))}
  if(p==='/api/os/watches'&&m==='GET'){return json(await q(env,'SELECT * FROM watches ORDER BY enabled DESC,created_at DESC'))}
  if(p==='/api/os/watches'&&m==='POST'){const b=await body(req),text=String(b.query||b.title||'').trim();if(!text)return json({error:'QUERY_REQUIRED'},400);const id=await createWatch(env,text);return json({ok:true,id})}
  if(p.startsWith('/api/os/watches/')&&m==='DELETE'){const id=decodeURIComponent(p.split('/').pop());await run(env,'UPDATE watches SET enabled=0,updated_at=? WHERE id=?',now(),id);return json({ok:true})}
  if(p==='/api/os/agents'&&m==='GET'){return json(await q(env,'SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT 50'))}
  if(p==='/api/os/memories'&&m==='GET'){return json(await q(env,'SELECT * FROM memories ORDER BY created_at DESC LIMIT 100'))}
  return null;
}

async function googleCfg(env){const r=await q1(env,"SELECT value FROM kv WHERE key='google_search_cfg'");if(!r)return null;try{const x=JSON.parse(r.value);if(!x?.blob)return null;return JSON.parse(await dec(env,x.blob))}catch{return null}}
async function directGoogle(env,cfg,query){const u=new URL('https://customsearch.googleapis.com/customsearch/v1');u.searchParams.set('key',cfg.key);u.searchParams.set('cx',cfg.cx);u.searchParams.set('q',query);u.searchParams.set('num','5');const r=await fetch(u);if(!r.ok)throw Error('GOOGLE_SEARCH_'+r.status);const x=await r.json();return (x.items||[]).map(i=>({title:i.title||'',url:i.link||'',snippet:i.snippet||''}))}
async function evaluateWatches(env){const cfg=await googleCfg(env);if(!cfg)return;const t=now(),rows=await q(env,'SELECT * FROM watches WHERE enabled=1 AND (last_checked_at IS NULL OR last_checked_at < ?)',t-30*60000);for(const w of rows.slice(0,8)){try{const results=await directGoogle(env,cfg,w.query),text=results.map(r=>r.title+' '+r.snippet+' '+r.url).join('\n'),fp=fingerprint(text);let matched=fp!==w.last_fingerprint;if(env.AI&&w.condition_text){try{const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`Takip koşulu: ${w.condition_text}\nYeni arama sonuçları:\n${text.slice(0,9000)}\nKoşul gerçekleşmişse sadece YES, değilse NO yaz.`,max_tokens:8,temperature:0});matched=/YES/i.test(String(x?.response||x?.result?.response||''))}catch{}}if(matched&&w.last_fingerprint){await notify(env,'watch',w.title,results[0]?.title||'Takip koşulunda değişiklik var',{watch_id:w.id,results:results.slice(0,3)})}await run(env,'UPDATE watches SET last_checked_at=?,last_fingerprint=?,last_result=?,updated_at=? WHERE id=?',t,fp,JSON.stringify(results.slice(0,3)),t,w.id)}catch(e){await run(env,'UPDATE watches SET last_checked_at=?,last_result=?,updated_at=? WHERE id=?',t,JSON.stringify({error:e.message}),t,w.id)}}}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname.startsWith('/api/os/')){if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);const r=await osApi(req,env);if(r)return r}
    if(u.pathname==='/api/chat/send'&&req.method==='POST'){
      if(!(await authed(req,env,ctx)))return core.fetch(req,env,ctx);
      const b=await body(req.clone()),text=String(b.text||'').trim(),attachments=cleanAnyAttachments(b.attachments);
      const started=now();
      try{
        let r;
        if(attachments.length&&!imageOnly(attachments))r=await multimodal(req,env,ctx,text,attachments);
        else if(text&&agentIntent(text))r=await runAgent(req,env,ctx,text);
        else if(text&&watchIntent(text)){const id=await createWatch(env,text);const reply='Takibi başlattım. Değişiklik veya koşul gerçekleştiğinde Bildirim Merkezi’ne düşecek.';await saveMsg(env,'user',text);await saveMsg(env,'assistant',reply,'JARVIS Watch');r=json({reply,provider:'JARVIS Watch',watch:{id},state:await state(req,env,ctx),history:await history(env)})}
        else if(text&&taskIntent(text)){const id=await createTask(env,text);const reply='Görevi ekledim.';await saveMsg(env,'user',text);await saveMsg(env,'assistant',reply,'JARVIS Tasks');r=json({reply,provider:'JARVIS Tasks',task:{id},state:await state(req,env,ctx),history:await history(env)})}
        else if(text&&freshIntent(text)){try{r=await liveWeb(req,env,ctx,text)}catch{r=await core.fetch(req,env,ctx)}}
        else r=await core.fetch(req,env,ctx);
        const ms=now()-started;
        if(r.ok){try{const x=await r.clone().json();ctx.waitUntil(recordMetric(env,x.provider||'JARVIS',ms,true,''));if(text)ctx.waitUntil(rememberAsync(env,text,x.reply||''))}catch{}}
        else ctx.waitUntil(recordMetric(env,'JARVIS',ms,false,'HTTP_'+r.status));
        return r;
      }catch(e){const ms=now()-started;ctx.waitUntil(recordMetric(env,'JARVIS',ms,false,e.message));ctx.waitUntil(logRuntimeError(env,'chat',e.message));return json({error:e.message},500)}
    }
    return core.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){ctx.waitUntil(evaluateWatches(env));if(core.scheduled)return core.scheduled(event,env,ctx)}
};
