import core from './media-rescue-entry.js';

const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function wantsResearch(text=''){
  return /(araştır|bak|bul|karşılaştır|güncel|son durum|kaynak|google|internette|webde|web'de|hangi|nereden|nasıl yapılır|video|foto|fotoğraf|şema|örnek)/i.test(String(text));
}
function wantsTools(text=''){
  return /(araç|tool|ai bul|yapay zeka bul|bunu yapacak|entegre et|sisteme ekle)/i.test(String(text));
}
async function callJson(coreReq,env,ctx){const r=await core.fetch(coreReq,env,ctx);if(!r.ok)return null;try{return await r.json()}catch{return null}}
async function research(req,env,ctx,text){
  const u=new URL('/api/google-search',req.url);u.searchParams.set('q',text);u.searchParams.set('num','6');
  return (await callJson(new Request(u,{headers:req.headers}),env,ctx))?.results||[];
}
async function tools(req,env,ctx,text){
  const u=new URL('/api/tools/discover',req.url);u.searchParams.set('capability',text);
  return (await callJson(new Request(u,{headers:req.headers}),env,ctx))?.results||[];
}
async function synthesize(env,text,base,researchRows,toolRows){
  if(!env.AI)return base;
  const web=researchRows.slice(0,6).map((r,i)=>`[${i+1}] ${r.title}\n${r.snippet||''}\n${r.url||''}`).join('\n\n');
  const toolsText=toolRows.slice(0,5).map((r,i)=>`[T${i+1}] ${r.title}\n${r.snippet||''}\n${r.url||''}`).join('\n\n');
  try{
    const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt:`Sen JARVIS'sin. Kullanıcı seninle konuşuyor; hiçbir AI sağlayıcısını kullanıcıya asistanmış gibi sunma. Gerekirse farklı AI modellerini, Google aramasını ve araçları arka planda kullan. Sonuçta tek bir birleşik Türkçe cevap ver. Kullanıcı birden çok şey istediyse alt alta, kısa başlıklarla, hızlı okunur şekilde sırala. "Yapamıyorum" deme; elindeki kaynaklarla yapabildiğini doğrudan yap ve yalnız gerçekten eksik bağlantı varsa bunu en sonda tek cümleyle belirt.\n\nKullanıcı: ${text}\n\nMevcut JARVIS cevabı:\n${String(base||'').slice(0,7000)}\n\nWeb araştırması:\n${web}\n\nAraç sonuçları:\n${toolsText}\n\nSadece nihai JARVIS cevabını yaz.`,max_tokens:1100,temperature:.2});
    return String(x?.response||x?.result?.response||x?.text||base).trim()||base;
  }catch{return base}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname!=='/api/chat/send'||req.method!=='POST')return core.fetch(req,env,ctx);
    let text='';try{text=String((await req.clone().json())?.text||'').trim()}catch{}
    const baseRes=await core.fetch(req,env,ctx);if(!baseRes.ok)return baseRes;
    let x;try{x=await baseRes.clone().json()}catch{return baseRes}
    const [webRows,toolRows]=await Promise.all([
      text&&wantsResearch(text)?research(req,env,ctx,text).catch(()=>[]):Promise.resolve([]),
      text&&wantsTools(text)?tools(req,env,ctx,text).catch(()=>[]):Promise.resolve([])
    ]);
    if(webRows.length&&!x.results)x.results=webRows;
    if(toolRows.length&&!x.tools)x.tools=toolRows;
    if(webRows.length||toolRows.length){
      x.reply=await synthesize(env,text,x.reply,webRows,toolRows);
      x.trace=[...(Array.isArray(x.trace)?x.trace:[]),...(webRows.length?[{kind:'search',label:'JARVIS araştırması',value:`${webRows.length} web sonucu incelendi`}]:[]),...(toolRows.length?[{kind:'tool',label:'JARVIS araç seçimi',value:`${toolRows.length} araç değerlendirildi`}]:[])];
    }
    x.provider='JARVIS';
    if(Array.isArray(x.history))x.history=x.history.map(m=>m?.role==='assistant'?{...m,provider:'JARVIS'}:m);
    return json(x,baseRes.status);
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};