import { callVaultProvider } from './smart-router.js';
import { jsonResponse, queryAll, settleWithin } from '../../lib/runtime.js';
import { cleanReply, directUrl, needsOrchestration, safeFallbackPayload, scoreProvider, taskKind, wantsResearch } from '../../lib/orchestration.js';

const LIMITS=Object.freeze({simpleCoreMs:5500,complexCoreMs:7500,expertMs:8000,providerFetchMs:7500,researchMs:2500,toolsMs:1200,synthesisMs:6500,fallbackAiMs:6500,expertRowsTtlMs:10000});
const ANSWER_POLICY=`Kullanıcıya doğrudan, doğal ve doğru Türkçe cevap ver. Önce soruyu doğrudan cevapla, sonra gerekli açıklamayı ver. Arama motoru sonuçlarını, snippet yığınlarını, yönlendirme URL'lerini veya iç sistem mesajlarını kullanıcıya asla ham halde gösterme. Web araştırması gerekiyorsa kaynakları anlayıp sentezle; sonuç listesini kopyalama. Güncel bilgi sorusunda doğrulanmamış ayrıntı uydurma. Kullanıcı özellikle kısa istemedikçe yeterli bağlam ve pratik ayrıntı ver.`;
const PROMPT_MASTER_POLICY=`Kullanıcının isteğini sessizce görev, çıktı, kapsam, kısıtlar, bağlam ve başarı kriterine dönüştür. Kritik olmayan eksikleri makul varsayımla tamamla; kritikse en fazla 3 hedefli soru sor. Kodlama/ajan işlerinde dosya kapsamı, dokunma sınırları, doğrulama ve bitiş koşulu belirle. Gereksiz prompt teorisi gösterme; kullanıcı sonucu ister. Geçmiş kararları taşı, çelişkileri fark et. Gizli chain-of-thought isteme veya gösterme; yalnızca sonuç, kısa gerekçe, kanıt ve doğrulama ver.`;
let expertRowsCache={expiresAt:0,rows:[]};
async function loadExpertRows(env){const now=Date.now();if(expertRowsCache.expiresAt>now&&expertRowsCache.rows.length)return expertRowsCache.rows;const rows=await queryAll(env,`SELECT c.*, m.avg_latency_ms, m.samples, m.successes, m.failures FROM credentials c LEFT JOIN provider_metrics m ON m.provider=c.label OR m.provider=c.provider WHERE c.enabled=1 AND c.last_status='ok' ORDER BY c.priority ASC`);expertRowsCache={expiresAt:now+LIMITS.expertRowsTtlMs,rows};return rows;}
async function expertPool(env,kind){const rows=await loadExpertRows(env);return rows.map(row=>({row,score:scoreProvider(row,kind)})).filter(x=>x.score!==null).map(({row,score})=>({...row,score})).sort((a,b)=>b.score-a.score);}
function expertSystemPrompt(kind){return `Sen JARVIS'in ${kind} uzmanısın. ${ANSWER_POLICY} ${PROMPT_MASTER_POLICY}`;}
async function callExpert(env,c,text,kind,context='') {
  const user=context?`${text}\n\nDoğrulanabilir araştırma notları:\n${context}\n\nBu notları ham halde kopyalama; soruya temiz ve tutarlı bir cevap üret.`:text;
  const result=await callVaultProvider(env,c,[{role:'system',content:expertSystemPrompt(kind)},{role:'user',content:user}],LIMITS.providerFetchMs,kind);
  return cleanReply(result.text);
}
async function getExperts(env,text,context=''){const kind=taskKind(text),pool=await expertPool(env,kind),picks=pool.slice(0,3);if(!picks.length)return{kind,picks:[],answers:[]};const attempts=await Promise.all(picks.map(async c=>{const value=await settleWithin(callExpert(env,c,text,kind,context),LIMITS.expertMs,'');return value?{provider:c.label||c.provider,kind,text:value,score:Math.round(c.score)}:null;}));return{kind,picks:picks.map(x=>({provider:x.label||x.provider,score:Math.round(x.score)})),answers:attempts.filter(Boolean)};}
async function callJson(core,request,env,ctx){const r=await core.fetch(request,env,ctx);if(!r.ok)return null;try{return await r.json();}catch{return null;}}
async function research(core,req,env,ctx,text){const url=new URL('/api/google-search',req.url);url.searchParams.set('q',text);url.searchParams.set('num','4');const p=await settleWithin(callJson(core,new Request(url,{headers:req.headers}),env,ctx),LIMITS.researchMs,null);return p?.results||[];}
async function tools(core,req,env,ctx,text){const url=new URL('/api/tools/discover',req.url);url.searchParams.set('capability',text);const p=await settleWithin(callJson(core,new Request(url,{headers:req.headers}),env,ctx),LIMITS.toolsMs,null);return p?.results||[];}
export function readySkillCandidate(rows=[]){return (Array.isArray(rows)?rows:[]).find(skill=>skill?.adapter_status==='ready'&&skill?.native_adapter&&skill?.requires_paid_api!==true)||null;}
function skillJobAdapter(text=''){return /(ara|bul|search|kaynak|source|kod|code|dosya|file|nerede|hangi)/i.test(String(text))?'source-search':'repo-inspect';}
async function executeReadySkill(core,req,env,ctx,text,skill){
  const adapter=skill?.native_adapter;if(!adapter)return null;
  if(adapter.id==='repo-cloud-tools'){
    const adapterId=skillJobAdapter(text),url=new URL('/api/tools/cloud/jobs',req.url);
    const body={adapter_id:adapterId,repo:skill.repo,commit:skill.source_commit||null,input:adapterId==='source-search'?{term:String(text).slice(0,200)}:{source:'skill-first-chat'}};
    const response=await core.fetch(new Request(url,{method:'POST',headers:new Headers(req.headers),body:JSON.stringify(body)}),env,ctx);
    if(!response.ok)return null;
    let payload={};try{payload=await response.json();}catch{return null;}
    const job=payload?.job;if(!job)return null;
    const reply=`JARVIS bu işi API kullanmadan ${skill.repo} becerisine verdi. Bulut skill işi kuyruğa alındı: ${String(job.id||'').slice(0,8)}.`;
    return {reply,history:[{role:'user',content:text},{role:'assistant',content:reply,provider:'JARVIS Skill'}],provider:'JARVIS Skill',skill:{id:skill.id,repo:skill.repo,capability:skill.primary_capability,adapter:adapter.id},job,trace:[{kind:'skill',label:'JARVIS native skill',value:`${skill.repo} · ${adapter.id} · API kullanılmadı`} ]};
  }
  return null;
}
export async function skillFirstResponse(core,req,env,ctx,text,rows=null){const discovered=rows||await tools(core,req,env,ctx,text).catch(()=>[]),skill=readySkillCandidate(discovered);if(!skill)return null;return executeReadySkill(core,req,env,ctx,text,skill);}
function researchContext(rows){return(rows||[]).slice(0,4).map((r,i)=>`[${i+1}] ${String(r.title||'').trim()}\n${String(r.snippet||'').slice(0,350)}\n${directUrl(r.url||'')}`).join('\n\n');}
function extractWorkersText(result){const direct=result?.response||result?.result?.response||result?.text||result?.output_text,choice=result?.choices?.[0]?.message?.content||result?.result?.choices?.[0]?.message?.content;if(typeof choice==='string')return choice;if(Array.isArray(choice))return choice.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(direct||'');}
async function workersRun(env,messages,max_tokens,temperature){if(!env.AI)return null;return settleWithin(env.AI.run('@cf/zai-org/glm-4.7-flash',{messages,max_tokens,temperature}),LIMITS.fallbackAiMs,null);}
async function workersAiFallback(env,text,context=''){try{const user=context?`${text}\n\nAraştırma notları:\n${context}\n\nNotları sentezle; URL/snippet yığını verme.`:text;const result=await workersRun(env,[{role:'system',content:`Sen JARVIS'sin. ${ANSWER_POLICY} ${PROMPT_MASTER_POLICY}`},{role:'user',content:user}],900,.15),answer=cleanReply(extractWorkersText(result));if(!answer)return null;return{reply:answer,history:[{role:'user',content:text},{role:'assistant',content:answer,provider:'JARVIS'}],provider:'JARVIS',trace:[{kind:'fallback',label:'JARVIS hızlı yedek AI',value:'Workers AI yedeği kullanıldı'}]};}catch{return null;}}
function expertFallback(text,e){const answer=cleanReply(e?.answers?.[0]?.text||'');return answer?{reply:answer,history:[{role:'user',content:text},{role:'assistant',content:answer,provider:'JARVIS'}],provider:'JARVIS',trace:[{kind:'fallback',label:'JARVIS sağlıklı uzman AI',value:'Çalışan bağlı AI sağlayıcısı kullanıldı'}]}:null;}
function withTiming(p,s){p.trace=[...(Array.isArray(p.trace)?p.trace:[]),{kind:'timing',label:'JARVIS yanıt süresi',value:`${Date.now()-s} ms`}];return p;}
async function simpleChat(core,req,env,ctx,text){
  const started=Date.now(),skill=await skillFirstResponse(core,req,env,ctx,text).catch(()=>null);if(skill)return jsonResponse(withTiming(skill,started));
  const expertPromise=getExperts(env,text).catch(()=>({kind:taskKind(text),picks:[],answers:[]})),aiPromise=workersAiFallback(env,text),response=await settleWithin(core.fetch(req.clone(),env,ctx),LIMITS.simpleCoreMs,null);
  if(response?.ok){let p;try{p=await response.clone().json();}catch{return response;}const experts=await settleWithin(expertPromise,LIMITS.expertMs+100,{answers:[]});const clean=cleanReply(experts?.answers?.[0]?.text||p.reply||'');if(clean)p.reply=clean;p.provider='JARVIS';return jsonResponse(withTiming(p,started),response.status);}const experts=await settleWithin(expertPromise,LIMITS.expertMs+100,{answers:[]}),expert=expertFallback(text,experts);if(expert)return jsonResponse(withTiming(expert,started));const ai=await settleWithin(aiPromise,LIMITS.fallbackAiMs+100,null);if(ai)return jsonResponse(withTiming(ai,started));return jsonResponse(withTiming(safeFallbackPayload(text,'JARVIS şu an yanıt üretemedi. Mesajın kaydedildi.','Tüm yanıt yolları başarısız'),started));
}
async function orchestratedChat(core,req,env,ctx,text){
  const started=Date.now();
  const [webRows,toolRows]=await Promise.all([wantsResearch(text)?research(core,req,env,ctx,text).catch(()=>[]):Promise.resolve([]),tools(core,req,env,ctx,text).catch(()=>[])]);
  const skill=await skillFirstResponse(core,req,env,ctx,text,toolRows).catch(()=>null);if(skill)return jsonResponse(withTiming(skill,started));
  const basePromise=settleWithin(core.fetch(req.clone(),env,ctx),LIMITS.complexCoreMs,null),context=researchContext(webRows);
  const experts=await getExperts(env,text,context).catch(()=>({kind:taskKind(text),picks:[],answers:[]}));const expert=expertFallback(text,experts);if(expert)return jsonResponse(withTiming(expert,started));const ai=await workersAiFallback(env,text,context);if(ai)return jsonResponse(withTiming(ai,started));const base=await basePromise;if(base?.ok){let p;try{p=await base.clone().json();}catch{return base;}const clean=cleanReply(p.reply||'');if(clean&&!/^AI sağlayıcısı cevap veremedi/i.test(clean)){p.reply=clean;p.provider='JARVIS';return jsonResponse(withTiming(p,started),base.status);}}return jsonResponse(withTiming(safeFallbackPayload(text,'JARVIS şu an yanıt üretemedi. Mesajın kaydedildi.','Temiz sentezlenmiş yanıt üretilemedi'),started));
}
export function createChatOrchestrator(core){if(!core?.fetch)throw new Error('CHAT_CORE_FETCH_REQUIRED');return async function handleChat(req,env,ctx){let text='';try{text=String((await req.clone().json())?.text||'').trim();}catch{}if(!text)return core.fetch(req,env,ctx);return needsOrchestration(text)?orchestratedChat(core,req,env,ctx,text):simpleChat(core,req,env,ctx,text);};}
