import core from './video-failover-entry.js';

const now=()=>Date.now();
const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
async function q1(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).first()}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}

function reasoningLeak(text=''){
  const s=String(text||'');
  return /here'?s a thinking process|analyze user input|identify the core request|formulate response strategy|chain of thought|step-by-step reasoning|internal reasoning|\*\*Analyze User Input|\*\*Identify the Core Request/i.test(s)||/<think>[\s\S]*?<\/think>/i.test(s);
}
function stripThink(text=''){
  let s=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  const final=s.match(/(?:final answer|final response|cevap)\s*[:：]\s*([\s\S]+)/i);
  if(final&&final[1]?.trim())s=final[1].trim();
  if(reasoningLeak(s))return '';
  return s;
}
function looksMostlyEnglish(text=''){
  const s=String(text||'').toLowerCase();
  const en=(s.match(/\b(the|and|user|request|response|should|explain|with|this|that|will|can|about|provide|steps?)\b/g)||[]).length;
  const tr=(s.match(/\b(ve|bir|bu|için|nasıl|olan|ile|şunu|bunu|cevap|göster|yap|olarak|gerekir)\b/g)||[]).length;
  return en>=6&&en>tr*2;
}
async function repair(env,userText,draft){
  if(!env.AI)return stripThink(draft)||'Yanıt oluşturulamadı.';
  try{
    const prompt=`Sen JARVIS'sin. Kullanıcının gerçek isteğine doğrudan Türkçe cevap ver. İç düşünce, analiz planı, chain-of-thought, "thinking process", meta açıklama veya kullanıcı isteğini yeniden analiz eden bölüm ASLA yazma. Taslak yanlış yorumladıysa taslağı yok say. Kullanıcı görsel/video/şema istiyorsa bunu açıkça belirt ve mevcut sistemin uygun araç akışına yönlendirecek şekilde kısa cevap ver.\n\nKULLANICI İSTEĞİ:\n${String(userText||'').slice(0,7000)}\n\nHATALI/TASLAK MODEL ÇIKTISI:\n${String(draft||'').slice(0,9000)}\n\nYalnız kullanıcıya gösterilecek nihai cevabı yaz.`;
    const x=await env.AI.run('@cf/zai-org/glm-4.7-flash',{prompt,max_tokens:900,temperature:.2});
    const out=String(x?.response||x?.result?.response||x?.text||'').trim();
    return stripThink(out)||out||'Yanıt oluşturulamadı.';
  }catch{return stripThink(draft)||'Yanıt oluşturulamadı.'}
}
async function replaceLatestAssistant(env,text,provider){
  try{
    const row=await q1(env,"SELECT id FROM chat_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1");
    if(row?.id)await run(env,'UPDATE chat_messages SET content=?,provider=? WHERE id=?',text,provider||'JARVIS',row.id);
  }catch{}
}
function cleanHistory(rows=[]){
  return (Array.isArray(rows)?rows:[]).map(m=>{
    if(m?.role!=='assistant')return m;
    const clean=stripThink(m.content||'');
    if(clean)return {...m,content:clean};
    if(reasoningLeak(m.content||''))return {...m,content:'Eski hatalı model düşünce çıktısı gizlendi.',provider:'JARVIS'};
    return m;
  });
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/api/chat/history'&&req.method==='GET'){
      const r=await core.fetch(req,env,ctx);if(!r.ok)return r;
      try{const x=await r.clone().json();return json(cleanHistory(x),r.status)}catch{return r}
    }
    if(u.pathname==='/api/chat/send'&&req.method==='POST'){
      let userText='';try{const b=await req.clone().json();userText=String(b?.text||'')}catch{}
      const r=await core.fetch(req,env,ctx);if(!r.ok)return r;
      try{
        const x=await r.clone().json();const draft=String(x?.reply||'');
        let clean=stripThink(draft);
        if(reasoningLeak(draft)||looksMostlyEnglish(draft)||!clean)clean=await repair(env,userText,draft);
        if(clean&&clean!==draft){x.reply=clean;x.provider=(x.provider?String(x.provider)+' · ':'')+'JARVIS Clean';await replaceLatestAssistant(env,clean,x.provider)}
        if(Array.isArray(x.history))x.history=cleanHistory(x.history);
        return json(x,r.status);
      }catch{return r}
    }
    return core.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};