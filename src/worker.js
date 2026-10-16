// --- Module imports (extracted from monolith) ---
import { te, td, nativeFetch, fetchT, withTimeout, now, id, j, txt, parseCookies, safeJsonParse, body, privateHost } from './lib/core.js';
import { q1, qall, run, kvGet, kvSet, log } from './lib/d1.js';
import { hmac, sign, verify, hashPassword, masterKey, b64u, fromB64u, encSecret, decSecret, randB64u, bytesEq, sha256, readCbor } from './lib/crypto.js';
import { FILE_CHUNK, filePut, d1Bytes, fileGet, fileList, fileDelete } from './lib/file-storage.js';
import { isAuthed, cookie, passkeyCount, passkeys, rpFrom, registrationOptions, coseToJwk, verifyClient, parseAuthData, verifyRegistration, authenticationOptions, derToRawEcdsa, verifyAuthentication } from './lib/auth.js';
import { credentialRows, testCredential } from './lib/credentials.js';
import { githubCredential, repoCfg, gh, b64Utf8, repoFile, SELF_EDIT_ALLOW, cleanAiJson } from './lib/github.js';
import { googleCredential, googleStored, googleAccessToken, mailRaw, gmailList, gmailSend, driveFiles, metaCredential, metaFacebookPost, metaInstagramPost, pendingAction, executeAction } from './lib/integrations.js';
import { addChat, chatHistory, rememberExplicit } from './lib/chat.js';
import { aiFallback, aiRouterStatus, aiDiagnostics, aiRouterMark } from './lib/ai-router.js';
import { obdBridgeRouter } from './lib/obd-bridge.js';
import { thinkdiagRouter } from './lib/thinkdiag-import.js';

async function createSelfChange(env,request,origin='user'){
  const c=await githubCredential(env);if(!c)return {ok:false,need:'github',message:'Self Update için GitHub bağlantısı gerekiyor. Credential Manager’da GitHub token + owner/repo ekle.'};
  const {repo,branch}=repoCfg(c), files={};
  for(const path of ['src/worker.js','public/app.js','public/index.html','public/app.css','schema.sql','ios/JARVIS/JarvisAPI.swift','ios/JARVIS/AppState.swift','ios/JARVIS/ContentView.swift','ios/JARVIS/SettingsView.swift','ios/project.yml','.github/workflows/deploy-cloudflare.yml','.github/workflows/ios-native-check.yml']){try{files[path]=(await repoFile(c,repo,path,branch)).content}catch(e){files[path]='/* unavailable: '+e.message+' */'}}
  const system=`Sen hayırlıevlad'ın kıdemli yazılım ajanısın. Kullanıcının istediği özelliği mevcut Cloudflare Workers uygulamasına uygula. Yalnızca gerekli dosyaları değiştir. Mevcut özellikleri bozma. Secret/API key yazma. Cloudflare Workers Web APIs kullan; Node-only API kullanma. Geriye uyumlu D1 migration kullan (CREATE TABLE IF NOT EXISTS / additive changes). ÇIKTI SADECE JSON: {"summary":"...","files":[{"path":"src/worker.js","content":"tam dosya içeriği"}],"tests":["..."]}. İzinli yollar: ${[...SELF_EDIT_ALLOW].join(', ')}.`;
  const prompt=`İSTEK: ${request}\n\nMEVCUT DOSYALAR:\n`+Object.entries(files).map(([k,v])=>`\n--- ${k} ---\n${v}`).join('\n');
  const a=await aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}]);let patch;
  try{patch=cleanAiJson(a.text)}catch(e){throw Error('SELF_UPDATE_BAD_AI_JSON:'+e.message)}
  if(!Array.isArray(patch.files)||!patch.files.length)throw Error('SELF_UPDATE_NO_FILES');if(patch.files.length>8)throw Error('SELF_UPDATE_TOO_MANY_FILES');
  for(const f of patch.files){if(!SELF_EDIT_ALLOW.has(f.path))throw Error('SELF_UPDATE_PATH_NOT_ALLOWED:'+f.path);if(typeof f.content!=='string'||f.content.length>350000)throw Error('SELF_UPDATE_INVALID_CONTENT:'+f.path);if(/(?:AIza|sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,})/.test(f.content))throw Error('SELF_UPDATE_SECRET_DETECTED:'+f.path)}
  const baseRef=await gh(c,`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),sha=baseRef.object.sha,changeId=id(),short=changeId.slice(0,8),newBranch=`jarvis/${short}`;
  await gh(c,`/repos/${repo}/git/refs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:`refs/heads/${newBranch}`,sha})});
  for(const f of patch.files){let old=null;try{old=await repoFile(c,repo,f.path,branch)}catch{};await gh(c,`/repos/${repo}/contents/${encodeURIComponent(f.path).replaceAll('%2F','/')}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:`hayırlıevlad: ${String(patch.summary||request).slice(0,120)}`,content:b64Utf8(f.content),branch:newBranch,...(old?.sha?{sha:old.sha}:{})})})}
  const pr=await gh(c,`/repos/${repo}/pulls`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:`hayırlıevlad self-update: ${String(patch.summary||request).slice(0,100)}`,head:newBranch,base:branch,body:`Otomatik hayırlıevlad değişikliği.\n\nİstek: ${request}\n\nAI provider: ${a.provider}\n\nTest planı:\n${(patch.tests||[]).map(x=>'- '+x).join('\n')}`})});
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





async function liveStatus(env){
  const rows=await credentialRows(env),enabled=rows.filter(x=>Number(x.enabled)===1),ok=enabled.filter(x=>x.last_status==='ok');
  const envProviders=[];
  if(env.OPENAI_API_KEY)envProviders.push('OpenAI'); if(env.ANTHROPIC_API_KEY)envProviders.push('Anthropic'); if(env.GEMINI_API_KEY)envProviders.push('Gemini'); if(env.GROQ_API_KEY)envProviders.push('Groq'); if(env.OPENROUTER_API_KEY)envProviders.push('OpenRouter'); if(env.MISTRAL_API_KEY)envProviders.push('Mistral'); if(env.DEEPSEEK_API_KEY)envProviders.push('DeepSeek'); if(env.TOGETHER_API_KEY)envProviders.push('Together'); if(env.CEREBRAS_API_KEY)envProviders.push('Cerebras'); if(env.PERPLEXITY_API_KEY)envProviders.push('Perplexity'); if(env.XAI_API_KEY)envProviders.push('xAI'); if(env.AI)envProviders.push('Cloudflare AI');
  const names=[...new Set([...enabled.filter(x=>['gemini','groq','openrouter','nvidia','openai','anthropic','mistral','deepseek','together','cerebras','perplexity','xai','openai-compatible'].includes(String(x.provider).toLowerCase())).map(x=>x.label||x.provider),...envProviders])];
  const google=!!(await googleStored(env));
  const meta=enabled.some(x=>String(x.provider).toLowerCase()==='meta');
  const github=enabled.some(x=>String(x.provider).toLowerCase()==='github');
  return {ai:{connected:names.length>0,count:names.length,healthy:ok.length+envProviders.length,providers:names,router:await aiRouterStatus(env)},d1:{connected:!!env.DB},r2:{connected:true},google:{connected:google},social:{connected:meta},selfUpdate:{connected:github},passkeys:{count:await passkeyCount(env)}};
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
    settings:{...(await kvGet(env,'settings',{name:'Heido',language:'tr-TR',assistantName:'hayırlıevlad'})),assistantName:'hayırlıevlad'}}
}
async function ddg(q,ms=3500){const r=await fetchT('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 hayirlievlad/4.0'}},ms);if(!r.ok)throw Error('SEARCH_'+r.status);const h=await r.text(),out=[],re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;const clean=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();let m;while((m=re.exec(h))&&out.length<8)out.push({title:clean(m[2]),url:m[1].replace(/&amp;/g,'&'),snippet:clean(m[3])});return out}
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

Şu an bağlantı cevap vermiyorsa sorun genelde OAuth ayarı veya backend timeout tarafında. hayırlıevlad bunu kullanıcıya sadece \"siteye bak\" diye bırakmamalı; bağlantı durumunu kendisi test edip eksik alanı söylemeli.`;
 }
 if(/nasıl|nasil|ne yap|anlat|tarif|kaç|kac|neden|niye|olur mu|olurmu/.test(l)){
  return `Bağlı AI servisleri şu an cevap vermedi ama isteğini kaybettirmedim. Bu soru için hızlı cevap verebilmem gerekiyor; servisler düşse bile hayırlıevlad'ın yerel yedek cevabı devreye girdi. Teknik ayrıntıyı sana dökmek yerine arka planda logladım. Soruyu biraz daha net yazarsan kısa pratik cevapla devam ederim.`;
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
         return{reply:`✓ Video öğrenildi: "${result.title||'Video'}"\n\n${lr.learning_chunks} parça hafızaya kaydedildi (${result.transcript.length} karakter). Artık bu konuda sorduğun sorularda bu videodan öğrendiğim bilgiyi kullanacağım.`,action:'youtube_learn',provider:'hayırlıevlad Skill'};
       }
     }
   }catch(e){
     return{reply:`YouTube transcript çekilemedi: ${e.message}. Video'da altyazı kapalı olabilir.`,action:'youtube_learn_error',provider:'hayırlıevlad Skill'};
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
       return{reply,action:'dtc_lookup',provider:'hayırlıevlad DTC Database'};
     }
   }catch{}
 }

 if(needsLiveLookupText(text)){
  let results=[];try{results=await withTimeout(liveResearch(text,isSportsQuestion(text)?2300:2800),3000,'LIVE_RESEARCH_TOTAL_TIMEOUT')}catch{}
  const system='Sen hayırlıevlad adlı Türkçe asistansın. Kullanıcıya doğrudan ve işe yarar cevap ver. Google’a yönlendirme, “kendin bak” deme. '+responsePolicy(text)+' Canlı/web sonuçları varsa değerlendir; tek cümleyle geçiştirme. Sonuçlarda video/klip/ürün/resmi kaynak bağlantısı varsa cevabın sonuna “İlgili video/kaynak” diye ekle. Bugünkü/şimdiki sorularda eski/sonraki sonuçları karıştırma. Detay kaynakta yoksa bunu açık yaz, uydurma.';
  const prompt='Bugünün tarihi: '+todayTR()+'\nKullanıcı sorusu: '+text+'\n\nCanlı/web sonuçları: '+JSON.stringify(results.slice(0,12));
  try{const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}],{userText:text,mode:'fast'}),3800,'LIVE_AI_TIMEOUT');if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:results.length?'live_ai_research':'live_ai_no_results',provider:a.provider,results:results.slice(0,6)}}catch{}
  const local=localFallbackAnswer(text,'');
  if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'hayırlıevlad Local'};
  return{reply:researchFallbackAnswer(text,results),action:'live_research',provider:results.length?'hayırlıevlad Live Search':'hayırlıevlad Live Search: empty',results:results.slice(0,5)};
 }
 const local=localFallbackAnswer(text,'');
 if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'hayırlıevlad Local'};
 const system="Sen hayırlıevlad — Türkçe kişisel asistan. HER ZAMAN Türkçe cevap ver. Doğal, samimi ve net konuş. Kullanıcıya \"Google’da ara\" veya \"siteye bak\" deme. Bilmediğini uydurma, açıkça söyle. "+responsePolicy(text);
 try{
  const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:text}],{userText:text,mode:'fast'}),8500,'QUICK_AI_TIMEOUT');
  if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:'ai',provider:a.provider};
 }catch{}
 try{
  const results=await ddg(text+' nedir açıklama',2800);
  const answer=compactResearchAnswer(text,results);
  if(answer)return{reply:answer,action:'search_fallback',provider:'hayırlıevlad Search',results:results.slice(0,4)};
 }catch{}
 return{reply:local||'Şu an bağlı cevap motoru zamanında dönemedi. Sorunu kaydettim; kısa cevap için tekrar deniyorum ve çalışan sağlayıcıları öne alıyorum.',action:'local_fallback',provider:'hayırlıevlad Local'};
}
async function command(env,text){await log(env,'user',text);const l=text.toLocaleLowerCase('tr-TR');const remembered=await rememberExplicit(env,text);if(remembered){const reply=`Bunu hafızama kaydettim: ${remembered}`;await log(env,'jarvis',reply);return{reply,action:'memory'}}
 if(/davranış becerileri|davranis becerileri|çalışma kuralları|calisma kurallari|skills cloud|claude\.md|jarvis kuralları|jarvis kurallari/.test(l)){const reply='hayırlıevlad davranış becerileri aktif:\n'+await behaviorSkillText(env);await log(env,'jarvis',reply,{provider:'hayırlıevlad Behavior Skills'});return{reply,action:'behavior_skills',provider:'hayırlıevlad Behavior Skills'}}
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
  const system='Sen hayırlıevlad adlı Türkçe asistansın. Canlı/web sonuçlarını kullanarak doğrudan cevap ver. Kullanıcıyı aramaya yönlendirme. '+responsePolicy(text)+' Sonuçlarda video/klip/resmi kaynak/ürün linki varsa cevabın sonuna “İlgili video/kaynak” bölümü ekle. Bugünkü/şimdiki sorularda eski/sonraki verileri karıştırma.';
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
 const memShort=mem.slice(0,15).map(x=>x.text).join('; ');
 const taskShort=s.tasks.slice(0,10).map(x=>x.title).join(', ');
 const system=`Sen hayırlıevlad — Türkçe kişisel asistan ve ECU tuning uzmanı. HER ZAMAN Türkçe cevap ver. Doğal, samimi, net konuş. Kullanıcıya "Google'a bak" veya "siteye gir" deme; bilmiyorsan açıkça söyle. Kısa sorulara kısa, detaylı sorulara detaylı cevap ver. ${policy}
Hafıza: ${memShort}
Aktif görevler: ${taskShort}${researchContext}${learningContext}${dtcContext}`;let a;try{a=await aiFallback(env,[{role:'system',content:system},...history.slice(-20,-1).map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content})),{role:'user',content:text}],{userText:text})}catch(e){const msg=String(e?.message||e||'UNKNOWN').slice(0,500),fallback=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,researchResults),reply=fallback||'Şu an bağlı AI servisleri zamanında cevap vermedi. Teknik hatayı kaydettim; ayarlardaki AI sağlayıcısı/model anahtarlarını yenilemek gerekiyor.';await recordRuntimeError(env,e,'chat.ai');await log(env,'jarvis',reply,{provider:'system',error:msg});return{reply,action:fallback?'local_fallback':'ai_error',provider:fallback?'hayırlıevlad Local':'system'}}if(!String(a.text||'').trim()){const reply='AI sağlayıcısı boş cevap döndürdü. Bunu hata olarak kaydettim; başka sağlayıcı veya ayar kontrolü gerekiyor.';await recordRuntimeError(env,Error('EMPTY_AI_REPLY:'+a.provider),'chat.ai');await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai_error',provider:a.provider}}
 let reply=a.text;
 if(isBadAssistantAnswer(reply)){
  await aiRouterMark(env,a.provider,false,'BAD_ASSISTANT_ANSWER');
  const fixed=researchFallbackAnswer(text,researchResults)||localFallbackAnswer(text,'BAD_ASSISTANT_ANSWER');
  if(fixed){reply=fixed;await log(env,'jarvis',reply,{provider:'hayırlıevlad Guard',blockedProvider:a.provider});return{reply,action:'guarded_fallback',provider:'hayırlıevlad Guard',results:researchResults.slice(0,5)}}
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
 if(p==='/api/chat/send'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);const ts=now();try{if(/ai.*(durum|test|kontrol|diag)|sağlayıcı.*(durum|test|kontrol)|saglayici.*(durum|test|kontrol)/i.test(text)){const d=await aiDiagnostics(env);const reply=d.ok?('AI sistemi çalışıyor. Çalışan sağlayıcı sayısı: '+d.working+'/'+d.total+'. '+d.recommendation):('AI sistemi çalışmıyor. '+d.recommendation);return j({reply,action:'ai_diagnostics',provider:'hayırlıevlad Diagnostics',diagnostics:d,history:[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'hayırlıevlad Diagnostics',created_at:now()}]})}const r=await withTimeout(quickCommand(env,text),9500,'QUICK_COMMAND_TIMEOUT');const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:r.reply,provider:r.provider||null,created_at:now()}];const persist=async()=>{try{await addChat(env,'user',text,null);await addChat(env,'assistant',r.reply,r.provider||null);await log(env,'jarvis-fast',r.reply,{provider:r.provider,action:r.action})}catch(e){await recordRuntimeError(env,e,'chat.persist')}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({...r,history})}catch(e){const msg=String(e?.message||e||'UNKNOWN'),reply=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,[])||'Cevap motoru zamanında dönemedi. İsteğini kaydettim; teknik hata detayını sana dökmüyorum.';const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'hayırlıevlad Local',created_at:now()}];const persist=async()=>{try{await recordRuntimeError(env,e,'chat.send');await addChat(env,'user',text,null);await addChat(env,'assistant',reply,'hayırlıevlad Local')}catch{}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({reply,action:'local_fallback',provider:'hayırlıevlad Local',history})}}
 if(p==='/api/chat/clear'&&m==='POST'){await run(env,'DELETE FROM chat_messages');return j({ok:true})}

 // ECU Tuning v2 — vehicle-db + upload + scan + AI
 if(p==='/api/ecu/vehicle-db'&&m==='GET'){try{
   const mod=await import('./lib/tuning-engine.js');
   return j({ok:true,...mod.VEHICLE_DB});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/upload'&&m==='POST'){try{
   const b=await body(req);
   const fileData=typeof b.fileData==='string'?Uint8Array.from(atob(b.fileData),c=>c.charCodeAt(0)):new Uint8Array(b.fileData||[]);
   if(!fileData.length)return j({error:'EMPTY_FILE'},400);
   if(fileData.length>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(fileData);
   const stats=mod.fileStats(fileData);
   // Tier 0: Import edilmiş A2L/XDF tanımlarını D1'den çek ve scanRegions'a aktar
   let normalized=null;
   try{
     const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');
     normalized=normalizeD1Definitions(importedDefs);
   }catch(_defErr){/* tanım yükleme hatası taramayı durdurmamalı */}
   const regions=await mod.scanRegions(fileData, normalized);
   const upload_id=id();
   const file_hash=await mod.sha256Hex(fileData);
   const key='ecu/'+upload_id+'/'+String(b.filename||'file.bin').replace(/[\\/]/g,'_');
   await filePut(env,key,fileData,{contentType:'application/octet-stream'});
   const vehicleInfo={make:b.make||'',model:b.model||'',year:b.year||'',ecuType:b.ecuType||'',systems:[...new Set(regions.map(r=>r.system))]};
   const ts=Date.now();await run(env,'INSERT INTO ecu_uploads(id,user_id,filename,format,vehicle_type,file_hash,file_size,binary_data,uploaded_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',upload_id,'owner',String(b.filename||'file.bin'),fmt.format,JSON.stringify(vehicleInfo),file_hash,fileData.length,key,ts,ts);
   // Enriched response with system info and stage1 package
   const systemNames=[...new Set(regions.map(r=>r.system))];
   const systemInfos=systemNames.map(s=>mod.getSystemInfo(s)).filter(Boolean);
   const stage1=mod.buildStage1Package(systemNames);
   const ecuProfile=regions._ecuProfile||{ecuType:'unknown',fuel:'unknown'};
   // --- Dosya hafıza sistemi: hash ile tanı veya yeni kayıt oluştur ---
   let fileMemory=null,previousMods=[];
   try{
     const existing=await q1(env,'SELECT * FROM ecu_file_memory WHERE file_hash=?',file_hash);
     if(existing){
       // Bilinen dosya — güncelle
       const prevUploadIds=JSON.parse(existing.upload_ids||'[]');
       prevUploadIds.push(upload_id);
       previousMods=JSON.parse(existing.last_modifications||'[]');
       await run(env,'UPDATE ecu_file_memory SET times_uploaded=times_uploaded+1,last_seen_at=?,upload_ids=?,vehicle_make=COALESCE(NULLIF(?,\'\'),vehicle_make),vehicle_model=COALESCE(NULLIF(?,\'\'),vehicle_model),vehicle_year=COALESCE(NULLIF(?,\'\'),vehicle_year),detected_systems=?,ecu_profile_data=? WHERE file_hash=?',
         ts,JSON.stringify(prevUploadIds),b.make||'',b.model||'',b.year||'',JSON.stringify(systemNames),JSON.stringify(ecuProfile),file_hash);
       fileMemory={known:true,timesUploaded:existing.times_uploaded+1,firstSeen:existing.first_seen_at,previousMods,notes:existing.notes,tags:JSON.parse(existing.tags||'[]')};
     }else{
       // Yeni dosya — kaydet
       await run(env,'INSERT INTO ecu_file_memory(id,file_hash,filename,file_size,ecu_type,fuel_type,vehicle_make,vehicle_model,vehicle_year,detected_systems,ecu_profile_data,scan_result_summary,first_seen_at,last_seen_at,upload_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
         id(),file_hash,String(b.filename||'file.bin'),fileData.length,ecuProfile.ecuType,ecuProfile.fuel,b.make||'',b.model||'',b.year||'',JSON.stringify(systemNames),JSON.stringify(ecuProfile),JSON.stringify({format:fmt.format,regionCount:regions.length}),ts,ts,JSON.stringify([upload_id]));
       fileMemory={known:false,timesUploaded:1,firstSeen:ts,previousMods:[],notes:'',tags:[]};
     }
   }catch(memErr){fileMemory={known:false,error:memErr.message}}
   return j({ok:true,upload_id,uploadId:upload_id,format:fmt.format,size:fileData.length,stats,regions,systems:systemNames,systemInfos,stage1,vehicle:vehicleInfo,rulepackMatches:regions._rulepackMatches||[],ecuProfile,fileMemory});
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
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Tier 0: D1'den tanımları yükle ve scanRegions'a aktar
   let normalized=null;
   try{
     const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');
     normalized=normalizeD1Definitions(importedDefs);
   }catch(_defErr){/* tanım yükleme hatası taramayı durdurmamalı */}
   const regions=await mod.scanRegions(bytes, normalized);
   const summary=mod.summarizeForAI(bytes,regions);
   const vehicleCtx=upload.vehicle_type?JSON.parse(upload.vehicle_type):{};
   const vehicleStr=vehicleCtx.make?`Araç: ${vehicleCtx.make} ${vehicleCtx.model||''} ${vehicleCtx.year||''} ECU: ${vehicleCtx.ecuType||'bilinmiyor'}. `:'';
   const sys=`Sen bir ECU tuning uzmanısın. ${vehicleStr}Verilen dosya özetine bakarak her sistem için SOMUT bir öneri yaz. Her öneri için açıklama da ekle. SADECE JSON array döndür, başka metin yok.
İki format desteklenir:
1) Tek-byte: {"system":"EGR","offset":"0x4A20","currentByte":"0x01","newByte":"0x00","action":"EGR bayrağını sıfırla","result":"EGR devre dışı","explain":"...","risk":"low","hpGain":"+5 HP"}
2) Harita: {"system":"DPF","offset":"0x8000","dataSize":512,"mapAction":"zero","action":"DPF haritasını sıfırla","result":"DPF filtre basınç haritası devre dışı","explain":"...","risk":"high","hpGain":"+10 HP"}
   mapAction değerleri: "zero" (tüm byte sıfır), "scale" (scaleFactor ile çarp, ör 1.15), "fill" (fillValue ile doldur, ör 65535)
   scale için scaleFactor, fill için fillValue ekle. elementSize (1/2/4) ve elementCount gereklidir.
Özetdeki 'definitionMeta' ve 'mapAction' bilgilerini dikkate al. En fazla 8 öneri.`;
   const userMsg='DOSYA ÖZETİ:\n'+JSON.stringify(summary,null,2);
   let aiSuggestions=[],provider='unknown',rawText='';
   // Try aiFallback first, then direct Cloudflare AI as fallback
   try{
     const a=await withTimeout(aiFallback(env,[{role:'system',content:sys},{role:'user',content:userMsg}],{userText:userMsg,mode:'strong'}),25000,'AI_SUGGEST_TIMEOUT');
     rawText=typeof a?.text==='string'?a.text:a?.text?JSON.stringify(a.text):'';provider=a?.provider||'unknown';
   }catch(e1){
     // aiFallback failed — try env.AI directly (Cloudflare AI free tier)
     if(env.AI){try{
       const cfModels=['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/google/gemma-3-12b-it','@cf/meta/llama-3.1-8b-instruct-fp8'];
       for(const cfm of cfModels){try{
         const r=await withTimeout(env.AI.run(cfm,{messages:[{role:'system',content:sys},{role:'user',content:userMsg}],temperature:0.3,max_tokens:1500}),18000,'CF_AI_TIMEOUT');
         const rr=typeof r==='string'?r:(r?.response||r?.result||'');
         rawText=typeof rr==='string'?rr:rr?JSON.stringify(rr):'';
         if(rawText){provider='Cloudflare AI ('+cfm.split('/').pop()+')';break}
       }catch{continue}}
     }catch{}}
     if(!rawText)return j({ok:false,error:'AI_UNAVAILABLE',detail:e1.message,suggestions:[]},200);
   }
   if(typeof rawText!=='string')rawText=rawText?JSON.stringify(rawText):'';
   const jsonMatch=rawText.match(/\[[\s\S]*\]/);
   if(jsonMatch){try{aiSuggestions=JSON.parse(jsonMatch[0])}catch(err){aiSuggestions=[{system:'AI',action:'JSON parse hatası',result:rawText.slice(0,400),risk:'unknown'}]}}
   else if(rawText){aiSuggestions=[{system:'AI',action:'Genel öneri',result:rawText.slice(0,600),risk:'info'}]}
   return j({ok:true,suggestions:aiSuggestions,provider,raw:rawText.slice(0,2000)});
 }catch(e){return j({error:e.message||'AI_SUGGEST_FAILED'},500)}}

 if(p==='/api/ecu/generate'&&m==='POST'){try{
   const b=await body(req);
   if(!b.uploadId&&!b.upload_id)return j({error:'BODY_PARSE_FAILED',detail:'uploadId eksik — istek gövdesi okunamadı',keys:Object.keys(b)},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId||b.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const original=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Primary path: use full action objects sent from frontend (no re-scan needed)
   let toApply=[];
   const sentActions=Array.isArray(b.actions)?b.actions:[];
   if(sentActions.length){
     toApply=sentActions.filter(a=>{
       const o=Number(a.offset);
       if(!isFinite(o)||o<0||o>=original.length) return false;
       // Map aksiyonları newByte gerektirmez — mapAction varsa kabul et
       if(a.mapAction) return true;
       // Multi-byte aksiyonları newValue ile çalışır
       if(a.newValue!=null&&isFinite(Number(a.newValue))) return true;
       // Tek-byte legacy
       return isFinite(Number(a.newByte));
     }).map(a=>{
       const base={id:a.id||'action',label:a.label||'',offset:Number(a.offset),risk:a.risk||'medium',system:a.system||''};
       if(a.mapAction){
         return {...base,dataSize:Number(a.dataSize)||1,mapAction:a.mapAction,
           fillByte:a.fillByte,fillValue:a.fillValue!=null?Number(a.fillValue):null,
           scaleFactor:a.scaleFactor!=null?Number(a.scaleFactor):null,
           elementSize:Number(a.elementSize)||1,elementCount:Number(a.elementCount)||1,
           datatype:a.datatype||null};
       }
       if(a.newValue!=null) return {...base,dataSize:Number(a.dataSize)||2,datatype:a.datatype||null,newValue:Number(a.newValue)};
       return {...base,dataSize:1,currentByte:Number(a.currentByte||0),newByte:Number(a.newByte)};
     });
   }
   // Fallback: re-scan and match by ID (legacy compatibility)
   if(!toApply.length){
     const regions=await mod.scanRegions(original);
     const allActions=regions.flatMap(r=>r.actions.map(a=>({...a,system:r.system})));
     const selectedIds=Array.isArray(b.actionIds||b.proposals)?(b.actionIds||b.proposals):[];
     if(selectedIds.length)toApply=allActions.filter(a=>selectedIds.includes(a.id));
   }
   if(!toApply.length)return j({error:'NO_ACTIONS_SELECTED',debug:{sentCount:sentActions.length,bodyKeys:Object.keys(b),fileLen:original.length,sentSample:sentActions.slice(0,2).map(a=>({id:a.id,offset:a.offset,offsetType:typeof a.offset,newByte:a.newByte,newByteType:typeof a.newByte}))}},400);
   const result=await mod.applyActions(original,toApply);
   const tuned_id=id();
   const outKey='ecu/'+tuned_id+'/tuned-'+String(upload.filename||'file.bin').replace(/[\\/]/g,'_');
   await filePut(env,outKey,result.tuned,{contentType:'application/octet-stream'});
   await run(env,'INSERT INTO ecu_tuned_outputs(id,upload_id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,tuned_binary_data,created_at) VALUES(?,?,?,?,?,?,?,?)',tuned_id,upload.id,'scan-v2',JSON.stringify(result.applied),result.hash,result.size,outKey,now());
   // Dosya hafızasında son modifikasyonları güncelle
   try{
     const modEntry={date:Date.now(),tunedId:tuned_id,actions:result.applied.map(a=>a.id||a.action||'unknown')};
     const mem=await q1(env,'SELECT id,last_modifications FROM ecu_file_memory WHERE file_hash=?',upload.file_hash);
     if(mem){const mods=JSON.parse(mem.last_modifications||'[]');mods.push(modEntry);if(mods.length>20)mods.splice(0,mods.length-20);await run(env,'UPDATE ecu_file_memory SET last_modifications=?,last_seen_at=? WHERE id=?',JSON.stringify(mods),Date.now(),mem.id)}
   }catch(memErr){}
   // Build comparison data for auto-diff
   const comparison={totalBytes:original.length,changedBytes:result.applied.length,changes:result.applied.map(a=>({offset:a.offset,offsetHex:a.offsetHex,before:a.before,after:a.after,label:a.label||'',id:a.id||''})),bySystem:{}};
   for(const a of toApply){const sys=a.system||'Diğer';if(!comparison.bySystem[sys])comparison.bySystem[sys]={count:0,changes:[]};comparison.bySystem[sys].count++;comparison.bySystem[sys].changes.push({offset:a.offset,label:a.label||''})}
   return j({ok:true,tunedId:tuned_id,tuned_id,size:result.size,hash:result.hash,applied:result.applied,appliedPatches:result.applied,comparison,checksum:result.checksum||null});
 }catch(e){return j({error:e.message||'GENERATE_FAILED'},500)}}

 if(p==='/api/ecu/checksum'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const result=mod.validateChecksums(bytes);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message||'CHECKSUM_FAILED'},500)}}

 if(p.startsWith('/api/ecu/download')){try{
   const u=new URL(req.url);
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const obj=await fileGet(env,tuned.tuned_binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const upload=await q1(env,'SELECT filename FROM ecu_uploads WHERE id=?',tuned.upload_id);
   const name=(upload?.filename||'tuned.bin').replace(/(\.[^.]+)$/,'_tuned$1');
   return new Response(obj.body,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+name+'"'}});
 }catch(e){return j({error:e.message||'DOWNLOAD_FAILED'},500)}}

 // === ECU DOSYA HAFIZA SİSTEMİ ===
 if(p==='/api/ecu/file-memory/search'&&m==='POST'){try{
   const b=await body(req);
   const conditions=[];const params=[];
   if(b.query){conditions.push("(filename LIKE ? OR vehicle_make LIKE ? OR vehicle_model LIKE ? OR ecu_type LIKE ? OR tags LIKE ?)");const q='%'+b.query+'%';params.push(q,q,q,q,q)}
   if(b.make){conditions.push("vehicle_make LIKE ?");params.push('%'+b.make+'%')}
   if(b.model){conditions.push("vehicle_model LIKE ?");params.push('%'+b.model+'%')}
   if(b.ecuType){conditions.push("ecu_type LIKE ?");params.push('%'+b.ecuType+'%')}
   if(b.fuel){conditions.push("fuel_type=?");params.push(b.fuel)}
   if(b.tag){conditions.push("tags LIKE ?");params.push('%'+JSON.stringify(b.tag).slice(1,-1)+'%')}
   const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
   const limit=Math.min(parseInt(b.limit)||50,200);
   const offset=parseInt(b.offset)||0;
   const rows=await qall(env,'SELECT * FROM ecu_file_memory '+where+' ORDER BY last_seen_at DESC LIMIT ? OFFSET ?',...params,limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory '+where,...params);
   return j({ok:true,files:rows.map(r=>({...r,detected_systems:JSON.parse(r.detected_systems||'[]'),ecu_profile_data:JSON.parse(r.ecu_profile_data||'{}'),tags:JSON.parse(r.tags||'[]'),last_modifications:JSON.parse(r.last_modifications||'[]'),upload_ids:JSON.parse(r.upload_ids||'[]')})),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'SEARCH_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/list'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit'))||50,200);
   const offset=parseInt(u.searchParams.get('offset'))||0;
   const rows=await qall(env,'SELECT * FROM ecu_file_memory ORDER BY last_seen_at DESC LIMIT ? OFFSET ?',limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory');
   return j({ok:true,files:rows.map(r=>({...r,detected_systems:JSON.parse(r.detected_systems||'[]'),ecu_profile_data:JSON.parse(r.ecu_profile_data||'{}'),tags:JSON.parse(r.tags||'[]'),last_modifications:JSON.parse(r.last_modifications||'[]'),upload_ids:JSON.parse(r.upload_ids||'[]')})),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'LIST_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/update'&&m==='POST'){try{
   const b=await body(req);
   if(!b.id&&!b.file_hash)return j({error:'ID_OR_HASH_REQUIRED'},400);
   const existing=b.id?await q1(env,'SELECT * FROM ecu_file_memory WHERE id=?',b.id):await q1(env,'SELECT * FROM ecu_file_memory WHERE file_hash=?',b.file_hash);
   if(!existing)return j({error:'FILE_NOT_FOUND'},404);
   const updates=[];const params=[];
   if(b.tags!==undefined){updates.push('tags=?');params.push(JSON.stringify(b.tags))}
   if(b.notes!==undefined){updates.push('notes=?');params.push(b.notes)}
   if(b.vehicle_make!==undefined){updates.push('vehicle_make=?');params.push(b.vehicle_make)}
   if(b.vehicle_model!==undefined){updates.push('vehicle_model=?');params.push(b.vehicle_model)}
   if(b.vehicle_year!==undefined){updates.push('vehicle_year=?');params.push(b.vehicle_year)}
   if(b.last_modifications!==undefined){updates.push('last_modifications=?');params.push(JSON.stringify(b.last_modifications))}
   if(!updates.length)return j({error:'NO_FIELDS_TO_UPDATE'},400);
   params.push(existing.id);
   await run(env,'UPDATE ecu_file_memory SET '+updates.join(',')+' WHERE id=?',...params);
   return j({ok:true,updated:existing.id});
 }catch(e){return j({error:e.message||'UPDATE_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/stats'){try{
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory');
   const byEcu=await qall(env,'SELECT ecu_type,COUNT(*) as c FROM ecu_file_memory WHERE ecu_type IS NOT NULL GROUP BY ecu_type ORDER BY c DESC');
   const byFuel=await qall(env,'SELECT fuel_type,COUNT(*) as c FROM ecu_file_memory WHERE fuel_type IS NOT NULL GROUP BY fuel_type ORDER BY c DESC');
   const byMake=await qall(env,'SELECT vehicle_make,COUNT(*) as c FROM ecu_file_memory WHERE vehicle_make IS NOT NULL AND vehicle_make!=\'\' GROUP BY vehicle_make ORDER BY c DESC');
   const recentFiles=await qall(env,'SELECT id,filename,ecu_type,fuel_type,vehicle_make,vehicle_model,times_uploaded,last_seen_at FROM ecu_file_memory ORDER BY last_seen_at DESC LIMIT 10');
   return j({ok:true,totalFiles:total?.c||0,byEcuType:byEcu,byFuelType:byFuel,byMake,recentFiles});
 }catch(e){return j({error:e.message||'STATS_FAILED'},500)}}

 // === ECU DEFINITION IMPORT (A2L / XDF) ===
 if(p==='/api/ecu/import-definitions'&&m==='POST'){try{
   const b=await body(req);
   const defText=b.content||b.text||'';
   if(!defText||defText.length<50)return j({error:'EMPTY_OR_TOO_SHORT'},400);
   if(defText.length>20*1024*1024)return j({error:'FILE_TOO_LARGE',max:'20MB'},413);
   const {parseDefinitionFile}=await import('./lib/ecu-definition-parser.js');
   const result=parseDefinitionFile(defText);
   if(!result.definitions.length)return j({error:'NO_DEFINITIONS_FOUND',meta:result.meta},400);
   const setId=id();
   const ts=Date.now();
   await run(env,'INSERT INTO ecu_definition_sets(id,user_id,filename,format,ecu_family,base_offset,definition_count,meta,tags,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
     setId,'owner',String(b.filename||'definitions.'+result.meta.format),result.meta.format,b.ecuFamily||b.ecu_family||'',result.baseOffset||0,result.definitions.length,JSON.stringify(result.meta),'[]','',ts,ts);
   // Batch insert tanımlar — 50'lik gruplar halinde
   const defs=result.definitions;
   for(let i=0;i<defs.length;i+=50){
     const batch=defs.slice(i,i+50);
     const vals=[];const params=[];
     for(const d of batch){
       const did=id();
       vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
       params.push(did,setId,d.name,d.description||'',d.displayId||d.name,d.address,d.rawAddress,d.datatype||'UWORD',d.dataSize||2,d.type||'scalar',d.system||null,d.unit||'',d.math||'X',d.lowerLimit!=null?d.lowerLimit:null,d.upperLimit!=null?d.upperLimit:null,JSON.stringify(d.axes||[]),d.elementCount||1,d.totalBytes||2,d.source||result.meta.format,ts,ts);
     }
     await run(env,'INSERT INTO ecu_definitions(id,def_set_id,name,description,display_id,address,raw_address,datatype,data_size,type,system,unit,math,lower_limit,upper_limit,axes,element_count,total_bytes,source,created_at,updated_at) VALUES '+vals.join(','),...params);
   }
   // Sistem dağılım özeti
   const systemCounts={};
   for(const d of defs)if(d.system){systemCounts[d.system]=(systemCounts[d.system]||0)+1}
   return j({ok:true,setId,format:result.meta.format,definitionCount:defs.length,baseOffset:result.baseOffset||0,systems:systemCounts,meta:result.meta});
 }catch(e){return j({error:e.message||'IMPORT_FAILED',stack:e.stack?.split('\n').slice(0,3).join(' | ')},500)}}

 if(p==='/api/ecu/definition-sets'&&m==='GET'){try{
   const rows=await qall(env,'SELECT * FROM ecu_definition_sets ORDER BY created_at DESC LIMIT 100');
   return j({ok:true,sets:rows.map(r=>({...r,meta:JSON.parse(r.meta||'{}'),tags:JSON.parse(r.tags||'[]')}))});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/definition-sets/')&&m==='GET'){try{
   const setId=p.split('/api/ecu/definition-sets/')[1];
   if(!setId)return j({error:'SET_ID_REQUIRED'},400);
   const set=await q1(env,'SELECT * FROM ecu_definition_sets WHERE id=?',setId);
   if(!set)return j({error:'SET_NOT_FOUND'},404);
   const defs=await qall(env,'SELECT * FROM ecu_definitions WHERE def_set_id=? ORDER BY address ASC',setId);
   return j({ok:true,set:{...set,meta:JSON.parse(set.meta||'{}'),tags:JSON.parse(set.tags||'[]')},definitions:defs.map(d=>({...d,axes:JSON.parse(d.axes||'[]')}))});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/definition-sets/')&&m==='DELETE'){try{
   const setId=p.split('/api/ecu/definition-sets/')[1];
   if(!setId)return j({error:'SET_ID_REQUIRED'},400);
   const set=await q1(env,'SELECT id FROM ecu_definition_sets WHERE id=?',setId);
   if(!set)return j({error:'SET_NOT_FOUND'},404);
   await run(env,'DELETE FROM ecu_definitions WHERE def_set_id=?',setId);
   await run(env,'DELETE FROM ecu_definition_sets WHERE id=?',setId);
   return j({ok:true,deleted:setId});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/definitions/match'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   // Tüm import edilmiş tanımları çek
   const defs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
   if(!defs.length)return j({ok:true,matched:[],regions:[],message:'Henüz import edilmiş tanım yok'});
   const {matchDefinitions,definitionsToRegions}=await import('./lib/ecu-definition-parser.js');
   const normalized=defs.map(d=>({name:d.name,description:d.description,displayId:d.display_id,address:d.address,rawAddress:d.raw_address,datatype:d.datatype,dataSize:d.data_size,type:d.type,system:d.system,unit:d.unit,math:d.math,lowerLimit:d.lower_limit,upperLimit:d.upper_limit,axes:JSON.parse(d.axes||'[]'),elementCount:d.element_count,totalBytes:d.total_bytes,source:d.source}));
   const matched=matchDefinitions(bytes,normalized);
   const regions=definitionsToRegions(matched);
   return j({ok:true,totalDefs:defs.length,matchedCount:matched.length,regionCount:regions.length,matched:matched.slice(0,200),regions});
 }catch(e){return j({error:e.message||'MATCH_FAILED'},500)}}

 // === ECU ANALYZE — five-tier scan, ECU profil, sistem bilgisi, cached ===
 if(p==='/api/ecu/analyze'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   const forceRescan=b.force||b.rescan||false;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   // Cache kontrolü — force yoksa ve analysis_json varsa cached döndür
   if(!forceRescan&&upload.analysis_json&&upload.analyzed_at){try{
     const cachedRegions=JSON.parse(upload.analysis_json);
     const mod=await import('./lib/tuning-engine.js');
     const systemMap=new Map();
     for(const r of cachedRegions){if(!systemMap.has(r.system))systemMap.set(r.system,{system:r.system,regionCount:0,actionCount:0,confidence:0,info:mod.getSystemInfo(r.system)});const s=systemMap.get(r.system);s.regionCount++;if(r.actions)s.actionCount+=r.actions.length;if(r.confidence>s.confidence)s.confidence=r.confidence}
     return j({ok:true,cached:true,analyzedAt:upload.analyzed_at,uploadId,format:upload.format,fileSize:upload.file_size,systems:[...systemMap.values()],totalRegions:cachedRegions.length,regions:cachedRegions.slice(0,60),stage1Package:mod.buildStage1Package([...systemMap.keys()])});
   }catch(_){}}
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   // Tier 0: upload'a bağlı tanım seti
   let definitions=null;let defSource='none';
   try{
     const defRows=await qall(env,`SELECT d.name,d.description,d.display_id,d.address,d.raw_address,d.datatype,d.data_size,d.type,d.system,d.unit,d.math,d.lower_limit,d.upper_limit,d.axes,d.element_count,d.total_bytes FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address`,uploadId);
     if(defRows.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(defRows);defSource='upload-linked ('+defRows.length+' defs)'}
   }catch(_){}
   // Genel tanımlar fallback
   if(!definitions){try{
     const allDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     if(allDefs.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(allDefs);defSource='global ('+allDefs.length+' defs)'}
   }catch(_){}}
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(bytes);
   const regions=await mod.scanRegions(bytes,definitions);
   const stats=mod.fileStats(bytes);
   const summary=mod.summarizeForAI(bytes,regions);
   const checksumResult=mod.validateChecksums(bytes);
   // Tier dağılımı
   const tierCounts={0:0,1:0,2:0,3:0};
   for(const r of regions){const t=r.tier||(r.id?.startsWith('def_')?0:r.id?.startsWith('rp_')?1:2);tierCounts[t]=(tierCounts[t]||0)+1}
   // Sistem haritası + getSystemInfo ile zenginleştir
   const systemMap=new Map();
   for(const r of regions){
     if(!systemMap.has(r.system)){const info=mod.getSystemInfo(r.system);systemMap.set(r.system,{system:r.system,regionCount:0,actionCount:0,mapCount:0,confidence:0,info:info||null})}
     const s=systemMap.get(r.system);s.regionCount++;
     if(r.actions){s.actionCount+=r.actions.length;for(const a of r.actions)if(a.mapAction)s.mapCount++}
     if(r.confidence>s.confidence)s.confidence=r.confidence
   }
   const detectedSystems=[...systemMap.keys()];
   const stage1=mod.buildStage1Package(detectedSystems);
   // Araç bilgisi
   let vehicleInfo=null;try{vehicleInfo=JSON.parse(upload.vehicle_type||'{}')}catch(_){vehicleInfo={raw:upload.vehicle_type}}
   // ECU profil eşleşme
   let ecuProfile=null;
   if(fmt.format){const fmtUp=fmt.format.toUpperCase();const profiles=['EDC17','EDC16','EDC15','MED17','ME7','SID','PCR'];for(const pn of profiles)if(fmtUp.includes(pn)){ecuProfile=pn;break}}
   // Tuning history kaydı
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,upload.vehicle_type||'unknown','analysis','ok',now());
   // Analysis cache
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify(regions),now(),uploadId)}catch(_){}
   // Tanım seti sayısı
   let defSetCount=0;try{const dc=await q1(env,'SELECT COUNT(*) as c FROM ecu_definition_sets WHERE upload_id=?',uploadId);defSetCount=dc?.c||0}catch(_){}
   return j({ok:true,cached:false,uploadId,filename:upload.filename,format:fmt,fileSize:bytes.length,fileHash:upload.file_hash,vehicle:vehicleInfo,ecuProfile,stats:{entropy:stats.entropy,zeroPct:stats.zeroPct,ffPct:stats.ffPct,mapCandidates:stats.mapCandidates||0},checksums:checksumResult,definitionSource:defSource,definitionSetsLinked:defSetCount,tierBreakdown:tierCounts,systems:[...systemMap.values()],totalRegions:regions.length,regions:regions.slice(0,80).map(r=>({id:r.id,system:r.system,desc:r.desc,offsetHex:r.offsetHex,offset:r.offset,length:r.length||0,confidence:r.confidence,tier:r.tier||(r.id?.startsWith('rp_')?1:r.id?.startsWith('def_')?0:2),foundString:r.foundString?.slice(0,80),damosLabel:r.damosLabel||null,actions:(r.actions||[]).map(a=>({id:a.id,label:a.label,offset:a.offset,dataSize:a.dataSize,newValue:a.newValue,mapAction:a.mapAction||null,effect:a.effect||null,system:a.system,desc:a.desc||a.label}))})),stage1Package:stage1,aiSummary:summary});
 }catch(e){return j({error:e.message||'ANALYZE_FAILED'},500)}}

 // === ECU RE-ANALYZE — tanım yüklendikten sonra tekrar analiz ===
 if(p==='/api/ecu/re-analyze'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   // analysis cache temizle ve force rescan yap
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=NULL,analyzed_at=NULL WHERE id=?',uploadId)}catch(_){}
   // Aynı analyze handler'a yönlendir — force: true
   const fakeReq=new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({uploadId,force:true})});
   // Inline re-call analyze
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   let definitions=null;
   try{const defRows=await qall(env,`SELECT d.* FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address`,uploadId);
     if(defRows.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(defRows)}
   }catch(_){}
   if(!definitions){try{const allDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     if(allDefs.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(allDefs)}}catch(_){}}
   const mod=await import('./lib/tuning-engine.js');
   const regions=await mod.scanRegions(bytes,definitions);
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify(regions),now(),uploadId)}catch(_){}
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,upload.vehicle_type||'unknown','re-analysis','ok',now());
   return j({ok:true,uploadId,regionsFound:regions.length,definitionsUsed:definitions?.length||0,message:'Re-analysis complete with latest definitions'});
 }catch(e){return j({error:e.message||'RE_ANALYZE_FAILED'},500)}}

 // === ECU DEFINITION UPLOAD — A2L/XDF dosyası import + auto re-analyze ===
 if(p==='/api/ecu/definition'&&m==='POST'){try{
   const formData=await req.formData();
   const uploadId=formData.get('uploadId');
   const defFile=formData.get('file');
   const autoAnalyze=formData.get('autoAnalyze')!=='false'; // default true
   if(!uploadId||!defFile)return j({error:'MISSING_UPLOAD_ID_OR_FILE'},400);
   const upload=await q1(env,'SELECT id,filename,vehicle_type FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const text=await defFile.text();
   const filename=defFile.name||'';
   const isXdf=/\.xdf$/i.test(filename);
   const isOdx=/\.odx$/i.test(filename);
   const {parseA2L,parseXDF}=await import('./lib/ecu-definition-parser.js');
   let parsed;
   if(isXdf)parsed=parseXDF(text);
   else parsed=parseA2L(text); // A2L ve ODX aynı parser ile
   const defs=parsed.definitions||[];
   if(!defs.length)return j({error:'NO_DEFINITIONS_FOUND',hint:'Dosya geçerli bir A2L/XDF formatında değil veya tanım içermiyor'},400);
   const ts=now();const fmt=isXdf?'xdf':isOdx?'odx':'a2l';
   // Mevcut tanım seti var mı kontrol — aynı dosya adı varsa güncelle
   const existingSet=await q1(env,'SELECT id FROM ecu_definition_sets WHERE upload_id=? AND filename=?',uploadId,filename);
   const defSetId=existingSet?.id||id();
   if(existingSet){
     // Mevcut tanımları sil, yeni yükle
     await run(env,'DELETE FROM ecu_definitions WHERE def_set_id=?',defSetId);
     await run(env,'UPDATE ecu_definition_sets SET definition_count=?,base_offset=?,meta=?,updated_at=? WHERE id=?',defs.length,parsed.baseOffset??0,JSON.stringify(parsed.meta||{}),ts,defSetId);
   }else{
     await run(env,'INSERT INTO ecu_definition_sets(id,user_id,upload_id,filename,format,ecu_family,base_offset,definition_count,meta,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',defSetId,'system',uploadId,filename,fmt,parsed.meta?.ecuFamily||null,parsed.baseOffset??0,defs.length,JSON.stringify(parsed.meta||{}),ts,ts);
   }
   // Batch insert — D1 batch limit 100
   const BATCH=80;let inserted=0;
   const systemCounts=new Map();
   for(let i=0;i<defs.length;i+=BATCH){
     const chunk=defs.slice(i,i+BATCH);
     const stmts=chunk.map(d=>{
       const sys=d.system||'unknown';systemCounts.set(sys,(systemCounts.get(sys)||0)+1);
       return env.DB.prepare('INSERT OR REPLACE INTO ecu_definitions(id,def_set_id,name,description,display_id,address,raw_address,datatype,data_size,type,system,unit,math,lower_limit,upper_limit,axes,element_count,total_bytes,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id(),defSetId,d.name,d.description||d.name,d.displayId||'',d.address??d.offset??0,d.rawAddress??d.address??0,d.datatype||'UWORD',d.dataSize||2,d.type||'scalar',sys,d.unit||'',d.math||'X',d.lowerLimit??d.min??null,d.upperLimit??d.max??null,JSON.stringify(d.axes||[]),d.elementCount||1,d.totalBytes||d.dataSize||2,fmt,ts,ts)
     });
     await env.DB.batch(stmts);inserted+=chunk.length;
   }
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,'definition','definition_upload','ok',ts);
   // Auto re-analyze: tanım yüklendikten sonra cache temizle
   if(autoAnalyze){try{await run(env,'UPDATE ecu_uploads SET analysis_json=NULL,analyzed_at=NULL WHERE id=?',uploadId)}catch(_){}}
   // Tanım tipi dağılımı
   const typeCounts={scalar:0,map:0,curve:0,axis:0,other:0};
   for(const d of defs){const t=d.type||'scalar';typeCounts[t]=(typeCounts[t]||0)+1}
   return j({ok:true,updated:!!existingSet,uploadId,defSetId,definitionFile:filename,format:fmt.toUpperCase(),definitionsImported:inserted,baseOffset:parsed.baseOffset??0,ecuFamily:parsed.meta?.ecuFamily||null,meta:parsed.meta||{},typeBreakdown:typeCounts,systemBreakdown:Object.fromEntries(systemCounts),autoAnalyzeTriggered:autoAnalyze,hint:autoAnalyze?'Cache temizlendi — /api/ecu/analyze ile yeniden tarayın':null});
 }catch(e){return j({error:e.message||'DEFINITION_UPLOAD_FAILED'},500)}}

 // === ECU DEFINITIONS LIST — upload'a bağlı tanım setlerini listele ===
 if(p==='/api/ecu/definitions/list'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   if(uploadId){
     const sets=await qall(env,'SELECT s.*,COUNT(d.id) as actual_count FROM ecu_definition_sets s LEFT JOIN ecu_definitions d ON d.def_set_id=s.id WHERE s.upload_id=? GROUP BY s.id ORDER BY s.created_at DESC',uploadId);
     const defs=await qall(env,`SELECT d.name,d.type,d.system,d.address,d.unit,d.datatype,d.data_size,d.element_count FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address LIMIT 500`,uploadId);
     return j({ok:true,uploadId,sets,definitions:defs,totalDefinitions:defs.length});
   }
   // Tüm tanım setleri
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'50'),200);
   const sets=await qall(env,'SELECT s.*,COUNT(d.id) as actual_count FROM ecu_definition_sets s LEFT JOIN ecu_definitions d ON d.def_set_id=s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT ?',limit);
   return j({ok:true,sets,total:sets.length});
 }catch(e){return j({error:e.message||'DEFINITIONS_LIST_FAILED'},500)}}

 // === ECU COMPARE — annotated byte diff with system matching ===
 if(p==='/api/ecu/compare'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!uploadId||!tunedId)return j({error:'MISSING_IDS'},400);
   const upload=await q1(env,'SELECT binary_data,file_size,analysis_json FROM ecu_uploads WHERE id=?',uploadId);
   const tuned=await q1(env,'SELECT tuned_binary_data,tuned_file_size,proposals_applied FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!upload||!tuned)return j({error:'NOT_FOUND'},404);
   const origObj=await fileGet(env,upload.binary_data);
   if(!origObj)return j({error:'ORIGINAL_FILE_NOT_FOUND'},404);
   const orig=new Uint8Array(await origObj.arrayBuffer());
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const modBytes=new Uint8Array(await tunedObj.arrayBuffer());
   // Analiz verisi — diff'leri sisteme eşle
   let analysisRegions=[];
   try{if(upload.analysis_json)analysisRegions=JSON.parse(upload.analysis_json)}catch(_){}
   // Byte diff — daha detaylı
   const diffs=[];let idx=0;let totalChanged=0;
   while(idx<orig.length&&idx<modBytes.length){
     if(orig[idx]!==modBytes[idx]){
       const start=idx;while(idx<orig.length&&idx<modBytes.length&&orig[idx]!==modBytes[idx]&&(idx-start)<4096)idx++;
       const len=idx-start;totalChanged+=len;
       // Bu offset hangi sisteme ait?
       let matchedSystem=null;let matchedRegion=null;
       for(const r of analysisRegions){
         const rOff=r.offset||0;const rLen=r.length||r.totalBytes||0;
         if(start>=rOff&&start<rOff+rLen){matchedSystem=r.system;matchedRegion=r.desc||r.id;break}
       }
       diffs.push({offset:start,offsetHex:'0x'+start.toString(16).toUpperCase(),length:len,system:matchedSystem,regionDesc:matchedRegion,originalBytes:Array.from(orig.subarray(start,Math.min(start+48,idx))).map(b=>b.toString(16).padStart(2,'0')).join(' '),tunedBytes:Array.from(modBytes.subarray(start,Math.min(start+48,idx))).map(b=>b.toString(16).padStart(2,'0')).join(' '),truncated:len>48});
     }else{idx++}
   }
   // Ek boyut bilgisi
   const sizeDiff=modBytes.length-orig.length;
   let applied=[];try{applied=JSON.parse(tuned.proposals_applied||'[]')}catch(_){}
   // Sistem bazlı değişiklik özeti
   const systemChanges=new Map();
   for(const d of diffs){const sys=d.system||'unknown';if(!systemChanges.has(sys))systemChanges.set(sys,{system:sys,regions:0,bytesChanged:0});const sc=systemChanges.get(sys);sc.regions++;sc.bytesChanged+=d.length}
   // Checksum doğrulama — tuned dosyada
   const mod=await import('./lib/tuning-engine.js');
   const tunedChecksums=mod.validateChecksums(modBytes);
   return j({ok:true,uploadId,tunedId,originalSize:orig.length,tunedSize:modBytes.length,sizeDifference:sizeDiff,changedRegions:diffs.length,totalChangedBytes:totalChanged,changePercentage:orig.length?(totalChanged/orig.length*100).toFixed(3)+'%':'N/A',systemSummary:[...systemChanges.values()],tunedChecksums,diffs:diffs.slice(0,150),appliedActions:applied.map(a=>({id:a.id,label:a.label,system:a.system,offset:a.offset,effectType:a.effectType||a.mapAction||'byte'}))});
 }catch(e){return j({error:e.message||'COMPARE_FAILED'},500)}}

 // === ECU VALIDATE — tuned dosya checksum + integrity kontrolü ===
 if(p==='/api/ecu/validate'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   const uploadId=b.uploadId||b.upload_id;
   if(!tunedId)return j({error:'MISSING_TUNED_ID'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const tunedBytes=new Uint8Array(await tunedObj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Checksum kontrolü
   const checksums=mod.validateChecksums(tunedBytes);
   // Boyut kontrolü
   const sizeOk=tunedBytes.length===tuned.tuned_file_size;
   // Hash kontrolü
   const currentHash=await mod.sha256Hex(tunedBytes);
   const hashOk=currentHash===tuned.tuned_file_hash;
   // Orijinal ile karşılaştır
   let sizeMatch=true;
   if(uploadId){const upload=await q1(env,'SELECT file_size FROM ecu_uploads WHERE id=?',uploadId);if(upload)sizeMatch=tunedBytes.length===upload.file_size}
   // File stats
   const stats=mod.fileStats(tunedBytes);
   const valid=sizeOk&&hashOk&&sizeMatch;
   return j({ok:true,tunedId,valid,checks:{sizeOk,hashOk,sizeMatch,checksums},fileSize:tunedBytes.length,hash:currentHash,expectedHash:tuned.tuned_file_hash,stats:{entropy:stats.entropy,zeroPct:stats.zeroPct,ffPct:stats.ffPct},verdict:valid?'SAFE_TO_FLASH':'CHECK_WARNINGS',warnings:(!sizeOk?['Dosya boyutu DB kaydıyla uyuşmuyor']:[] ).concat(!hashOk?['Hash uyuşmuyor — dosya bozulmuş olabilir']:[]).concat(!sizeMatch?['Tuned boyut orijinalden farklı — ECU kabul etmeyebilir']:[])});
 }catch(e){return j({error:e.message||'VALIDATE_FAILED'},500)}}

 // === ECU STATS — genel dashboard istatistikleri ===
 if(p==='/api/ecu/stats'&&m==='GET'){try{
   const [uploads,tuned,history,defSets]=await Promise.all([
     q1(env,'SELECT COUNT(*) as total, SUM(file_size) as totalSize FROM ecu_uploads'),
     q1(env,'SELECT COUNT(*) as total FROM ecu_tuned_outputs'),
     qall(env,'SELECT tuning_type, status, COUNT(*) as count FROM ecu_tuning_history GROUP BY tuning_type, status'),
     q1(env,'SELECT COUNT(*) as total, SUM(definition_count) as totalDefs FROM ecu_definition_sets')
   ]);
   // Son 7 gün aktivite
   const weekAgo=now()-7*86400;
   const recentUploads=await q1(env,'SELECT COUNT(*) as c FROM ecu_uploads WHERE created_at>?',weekAgo);
   const recentTunes=await q1(env,'SELECT COUNT(*) as c FROM ecu_tuned_outputs WHERE created_at>?',weekAgo);
   // Araç dağılımı
   const vehicles=await qall(env,'SELECT vehicle_type, COUNT(*) as count FROM ecu_uploads WHERE vehicle_type IS NOT NULL GROUP BY vehicle_type ORDER BY count DESC LIMIT 20');
   // Format dağılımı
   const formats=await qall(env,'SELECT format, COUNT(*) as count FROM ecu_uploads GROUP BY format ORDER BY count DESC');
   // History türleri
   const historyByType={};for(const h of history){if(!historyByType[h.tuning_type])historyByType[h.tuning_type]={total:0,ok:0,error:0};historyByType[h.tuning_type].total+=h.count;if(h.status==='ok')historyByType[h.tuning_type].ok+=h.count;else historyByType[h.tuning_type].error+=h.count}
   return j({ok:true,uploads:{total:uploads?.total||0,totalSizeMB:((uploads?.totalSize||0)/1024/1024).toFixed(2)},tuned:{total:tuned?.total||0},definitions:{sets:defSets?.total||0,totalDefinitions:defSets?.totalDefs||0},activity:{last7days:{uploads:recentUploads?.c||0,tunes:recentTunes?.c||0}},historyByType,vehicles:vehicles.map(v=>{let parsed=v.vehicle_type;try{parsed=JSON.parse(v.vehicle_type)}catch(_){};return{vehicle:parsed,count:v.count}}),formats});
 }catch(e){return j({error:e.message||'STATS_FAILED'},500)}}

 // === ECU HISTORY — zenginleştirilmiş tuning geçmişi (filtreleme + istatistik) ===
 if(p==='/api/ecu/history'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const offset=parseInt(u.searchParams.get('offset')||'0');
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const tuningType=u.searchParams.get('type')||u.searchParams.get('tuning_type');
   const status=u.searchParams.get('status');
   // Dinamik WHERE
   let where='1=1';const params=[];
   if(uploadId){where+=' AND h.upload_id=?';params.push(uploadId)}
   if(tuningType){where+=' AND h.tuning_type=?';params.push(tuningType)}
   if(status){where+=' AND h.status=?';params.push(status)}
   params.push(limit,offset);
   const rows=await qall(env,`SELECT h.id,h.upload_id,h.vehicle_type,h.tuning_type,h.status,h.error_msg,h.created_at,u.filename,u.format,u.file_size FROM ecu_tuning_history h LEFT JOIN ecu_uploads u ON u.id=h.upload_id WHERE ${where} ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,...params);
   // Toplam sayı
   const countParams=params.slice(0,-2);
   const total=await q1(env,`SELECT COUNT(*) as c FROM ecu_tuning_history h WHERE ${where}`,...countParams);
   return j({ok:true,history:rows,total:total?.c||0,limit,offset,hasMore:(offset+limit)<(total?.c||0)});
 }catch(e){return j({error:e.message||'HISTORY_FAILED'},500)}}

 // === ECU UPLOADS LIST — yüklenen dosyaları listele ===
 if(p==='/api/ecu/uploads'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const offset=parseInt(u.searchParams.get('offset')||'0');
   const rows=await qall(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at,created_at,analyzed_at FROM ecu_uploads ORDER BY created_at DESC LIMIT ? OFFSET ?',limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_uploads');
   return j({ok:true,uploads:rows.map(r=>{let vehicle=r.vehicle_type;try{vehicle=JSON.parse(r.vehicle_type)}catch(_){};return{...r,vehicle_type:vehicle,hasAnalysis:!!r.analyzed_at}}),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'UPLOADS_LIST_FAILED'},500)}}

 // === ECU UPLOAD DETAIL — tek upload detayı + ilişkili tune/tanım ===
 if(p.startsWith('/api/ecu/uploads/')&&m==='GET'){try{
   const uploadId=p.split('/api/ecu/uploads/')[1];
   if(!uploadId)return j({error:'MISSING_ID'},400);
   const upload=await q1(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at,created_at,analyzed_at FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   let vehicle=upload.vehicle_type;try{vehicle=JSON.parse(upload.vehicle_type)}catch(_){}
   // İlişkili tune çıktıları
   const tunes=await qall(env,'SELECT id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,created_at FROM ecu_tuned_outputs WHERE upload_id=? ORDER BY created_at DESC',uploadId);
   // İlişkili tanım setleri
   const defSets=await qall(env,'SELECT id,filename,format,ecu_family,definition_count,created_at FROM ecu_definition_sets WHERE upload_id=? ORDER BY created_at DESC',uploadId);
   // İlişkili history
   const hist=await qall(env,'SELECT id,tuning_type,status,error_msg,created_at FROM ecu_tuning_history WHERE upload_id=? ORDER BY created_at DESC LIMIT 20',uploadId);
   return j({ok:true,upload:{...upload,vehicle_type:vehicle,hasAnalysis:!!upload.analyzed_at},tunedOutputs:tunes.map(t=>{let ap=[];try{ap=JSON.parse(t.proposals_applied||'[]')}catch(_){};return{...t,appliedCount:ap.length,systems:[...new Set(ap.map(a=>a.system).filter(Boolean))]}}),definitionSets:defSets,history:hist});
 }catch(e){return j({error:e.message||'UPLOAD_DETAIL_FAILED'},500)}}

 // === ECU TUNED OUTPUTS LIST — tüm tune edilmiş dosyalar ===
 if(p==='/api/ecu/tuned'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   let rows;
   if(uploadId){
     rows=await qall(env,'SELECT t.id,t.upload_id,t.vehicle_id,t.proposals_applied,t.tuned_file_hash,t.tuned_file_size,t.created_at,u.filename,u.format FROM ecu_tuned_outputs t LEFT JOIN ecu_uploads u ON u.id=t.upload_id WHERE t.upload_id=? ORDER BY t.created_at DESC LIMIT ?',uploadId,limit);
   }else{
     rows=await qall(env,'SELECT t.id,t.upload_id,t.vehicle_id,t.proposals_applied,t.tuned_file_hash,t.tuned_file_size,t.created_at,u.filename,u.format FROM ecu_tuned_outputs t LEFT JOIN ecu_uploads u ON u.id=t.upload_id ORDER BY t.created_at DESC LIMIT ?',limit);
   }
   return j({ok:true,tunedOutputs:rows.map(r=>{let ap=[];try{ap=JSON.parse(r.proposals_applied||'[]')}catch(_){};return{...r,appliedCount:ap.length,systems:[...new Set(ap.map(a=>a.system).filter(Boolean))]}})});
 }catch(e){return j({error:e.message||'TUNED_LIST_FAILED'},500)}}

 // === ECU SYSTEM INFO — belirli bir sistem hakkında detaylı bilgi ===
 if(p==='/api/ecu/system-info'&&m==='GET'){try{
   const u=new URL(req.url);
   const system=u.searchParams.get('system');
   if(!system)return j({error:'MISSING_SYSTEM'},400);
   const mod=await import('./lib/tuning-engine.js');
   const info=mod.getSystemInfo(system);
   if(!info)return j({error:'SYSTEM_NOT_FOUND',available:['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Hız sınırı','RPM sınırı','Checksum','DTC','Pop&Bang','Start/Stop','Flap/Swirl','Cruise Control']},404);
   return j({ok:true,...info});
 }catch(e){return j({error:e.message||'SYSTEM_INFO_FAILED'},500)}}

 // === OBD-II BRIDGE (ELM327 decode, live sessions, DTC) ===
 if(p.startsWith('/api/obd/')){const obdRes=await obdBridgeRouter(req,env,p,m);if(obdRes)return obdRes}

 // === THINKDIAG TC RECORDING IMPORT ===
 if(p.startsWith('/api/ecu/thinkdiag/')){const tdRes=await thinkdiagRouter(req,env,p,m);if(tdRes)return tdRes}

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
   await filePut(env,key,imgBytes,{contentType:'image/png'});
   return j({ok:true,id:imgId,size:imgBytes.length,model,key,base64:result.image.slice(0,100)+'...(truncated)'});
 }catch(e){return j({error:e.message||'IMAGE_FAILED'},500)}}

 if(p==='/api/ai/image/serve'){try{
   const imgId=new URL(req.url).searchParams.get('id');
   if(!imgId)return j({error:'MISSING'},400);
   const obj=await fileGet(env,'images/'+imgId+'.png');
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
   if(env.AI){
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
           await filePut(env,key,imgBytes,{contentType:'image/png'});
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
   await filePut(env,key,videoBytes,{contentType:'video/mp4'});
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
   const videoObj=await fileGet(env,job.video_key);
   if(!videoObj)return j({error:'VIDEO_FILE_MISSING'},404);
   // Google OAuth token al
   const token=await googleAccessToken(env);
   // YouTube Data API — resumable upload
   const title=b.title||job.topic||'hayırlıevlad Video';
   const description=b.description||`${job.topic} — hayırlıevlad tarafından otomatik üretildi.`;
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

 if(p==='/api/files/download-url'&&m==='POST'){const b=await body(req),url=String(b.url||'').trim();let u2;try{u2=new URL(url)}catch{return j({error:'INVALID_URL'},400)}if(!/^https?:$/.test(u2.protocol)||privateHost(u2.hostname))return j({error:'URL_NOT_ALLOWED'},400);const r=await fetchT(u2.toString(),{redirect:'follow'});if(!r.ok)return j({error:'DOWNLOAD_HTTP_'+r.status},400);const len=Number(r.headers.get('content-length')||0);if(len>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);const buf=new Uint8Array(await r.arrayBuffer());if(buf.byteLength>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);let name=String(b.name||'').trim()||u2.pathname.split('/').filter(Boolean).pop()||'download.bin';name=name.replace(/[\\/]/g,'_');const key=`${now()}-${id()}-${name}`;await filePut(env,key,buf,{contentType:r.headers.get('content-type')||'application/octet-stream'});await log(env,'file','URL dosyası indirildi: '+name,{url:u2.origin});return j({ok:true,key,name,size:buf.byteLength})}
 if(p==='/api/files'&&m==='POST'){const b=await body(req),name=String(b.name||'file').replace(/[\\/]/g,'_'),raw=Uint8Array.from(atob(String(b.base64||'')),c=>c.charCodeAt(0));if(raw.byteLength>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);const key=`${now()}-${id()}-${name}`;await filePut(env,key,raw,{contentType:b.type||'application/octet-stream'});await log(env,'file','Dosya yüklendi: '+name);return j({ok:true,key,name,size:raw.byteLength})}
 if(p==='/api/files'&&m==='GET'){const x=await fileList(env,{limit:100});return j(x.objects.map(o=>({file:o.key,size:o.size,mtime:o.uploaded||0})))}
 mm=p.match(/^\/api\/files\/(.+)$/);if(mm&&m==='GET'){const key=decodeURIComponent(mm[1]),o=await fileGet(env,key);if(!o)return txt('Not found',404);return new Response(o.body,{headers:{'content-type':o.httpMetadata?.contentType||'application/octet-stream','content-disposition':`attachment; filename="${key.split('-').slice(3).join('-')}"`}})}
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
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.inv} ${e(invNum)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#1a1a2e;font-size:14px;line-height:1.5}.head{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0a0a1a}.head h1{font-size:24px;letter-spacing:2px}.parties{display:flex;gap:32px;margin-bottom:24px}.parties div{flex:1}.parties h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#0a0a1a;color:#fff;padding:8px 10px;text-align:left;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #e0e0e0}.right{text-align:right}.totals{margin-left:auto;width:260px;margin-bottom:20px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:700;border-top:2px solid #0a0a1a;padding-top:8px;margin-top:4px}.notes{background:#f5f5f8;padding:12px;border-radius:8px;font-size:12px;color:#555}@media print{body{padding:12px}}</style></head><body><div class="head"><div><h1>${L.inv}</h1><div style="margin-top:4px;font-size:13px;color:#555">${e(invNum)}</div></div><div style="text-align:right;font-size:13px;color:#555">${L.date}: <b>${e(invDate)}</b></div></div><div class="parties"><div><h3>${L.from}</h3><b>${e(from.name||'')}</b><br>${e(from.address||'')}<br>${e(from.tax_id||'')}<br>${e(from.phone||'')}<br>${e(from.email||'')}</div><div><h3>${L.to}</h3><b>${e(to.name||'')}</b><br>${e(to.address||'')}<br>${e(to.tax_id||'')}<br>${e(to.phone||'')}</div></div><table><tr><th>#</th><th>${L.desc}</th><th class="right">${L.qty}</th><th class="right">${L.price}</th><th class="right">${L.sum}</th></tr>${items.map((it,i)=>`<tr><td>${i+1}</td><td>${e(it.desc||'')}</td><td class="right">${it.qty||1}</td><td class="right">${cur}${fmt(it.price||0)}</td><td class="right">${cur}${fmt((it.qty||1)*(it.price||0))}</td></tr>`).join('')}</table><div class="totals"><div><span>${L.sub}</span><span>${cur}${fmt(sub)}</span></div><div><span>${L.tax}</span><span>${cur}${fmt(tax)}</span></div><div class="grand"><span>${L.total}</span><span>${cur}${fmt(total)}</span></div></div>${b.notes?`<div class="notes"><b>${L.notes}:</b> ${e(b.notes)}</div>`:''}<div style="margin-top:32px;text-align:center;font-size:11px;color:#aaa">hayırlıevlad · ${new Date().toISOString().slice(0,16)}</div></body></html>`;
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
   return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="hayirlievlad-backup-'+new Date().toISOString().slice(0,10)+'.json"','Access-Control-Allow-Origin':'*'}});
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
                await filePut(env,imageKey,imgBytes,{contentType:'image/png'});
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
