import core from './capability-runtime-entry.js';

const now=()=>Date.now();
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function q1(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).first()}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}

function mediaIntent(text=''){
  const s=String(text||'').toLowerCase();
  const action=/(göster|bul|ara|getir|oluştur|çiz|üret|hazırla|istiyorum|isterim|görmek|izlemek)/i.test(s);
  return {
    image: action&&/(foto|fotoğraf|resim|görsel|şema|diagram|image|logo|amblem|emblem|teknik çizim|exploded)/i.test(s),
    video: action&&/(video|youtube|klip|reels?|animasyon)/i.test(s),
    generateImage: /(oluştur|çiz|üret|hazırla)/i.test(s)&&/(foto|fotoğraf|resim|görsel|şema|diagram|image|logo|amblem|emblem)/i.test(s)
  };
}
function limitation(text=''){
  return /(yapamıyorum|yapamam|üretemiyorum|üretemem|gösteremiyorum|gösteremem|doğrudan .* yapamam|doğrudan .* üretemiyorum|görsel .* yok|video .* yok|cannot (generate|create|show|produce)|i can.?t (generate|create|show|produce)|bu özelliğe sahip değilim)/i.test(String(text||''));
}
function stripRefusal(text=''){
  return String(text||'').replace(/(^|\n)[^\n]*(?:yapamıyorum|yapamam|üretemiyorum|üretemem|gösteremiyorum|gösteremem|cannot generate|i can.?t generate)[^\n]*/gi,'').replace(/\n{3,}/g,'\n\n').trim();
}
async function google(req,env,ctx,query,type=''){
  const u=new URL('/api/google-search',req.url);u.searchParams.set('q',query);u.searchParams.set('num','6');if(type)u.searchParams.set('type',type);
  const r=await core.fetch(new Request(u,{headers:req.headers}),env,ctx);if(!r.ok)return[];try{return (await r.json()).results||[]}catch{return[]}
}
async function illustrativeImage(env,text){
  if(!env.AI)return null;
  try{
    const prompt=`Educational technical illustration for the user's request: ${String(text).slice(0,1400)}. Clear labeled schematic style, realistic mechanical context, no misleading claim of being an OEM service-manual drawing.`;
    const x=await env.AI.run('@cf/black-forest-labs/flux-1-schnell',{prompt,steps:4});
    const b64=String(x?.image||x?.result?.image||'').trim();if(!b64)return null;
    return {type:'image',src:'data:image/jpeg;base64,'+b64,alt:'JARVIS tarafından oluşturulan temsili teknik şema',label:'Temsili AI şeması'};
  }catch{return null}
}
async function replaceLatestAssistant(env,text,provider){
  try{const row=await q1(env,"SELECT id FROM chat_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1");if(row?.id)await run(env,'UPDATE chat_messages SET content=?,provider=? WHERE id=?',text,provider,row.id)}catch{}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname!=='/api/chat/send'||req.method!=='POST')return core.fetch(req,env,ctx);
    let text='';try{text=String((await req.clone().json())?.text||'')}catch{}
    const wanted=mediaIntent(text);
    const r=await core.fetch(req,env,ctx);if(!r.ok)return r;
    let x;try{x=await r.clone().json()}catch{return r}
    const limited=limitation(x?.reply||'');
    if(!wanted.image&&!wanted.video&&!limited)return r;

    const resources=[];const media=Array.isArray(x.media)?[...x.media]:[];const trace=Array.isArray(x.trace)?[...x.trace]:[];
    if(wanted.image||limited){
      const imgs=await google(req,env,ctx,`${text} teknik şema fotoğraf`, 'image');
      for(const i of imgs.slice(0,5))resources.push({type:'image-resource',title:i.title,url:i.contextUrl||i.url,image:i.thumbnail||i.url,snippet:i.snippet||'',source:'Google Images'});
      if((wanted.generateImage||!imgs.length)&&wanted.image){const generated=await illustrativeImage(env,text);if(generated)media.push(generated)}
      if(imgs.length)trace.push({kind:'capability',label:'Görsel desteği',value:`Google Görseller'den ${Math.min(5,imgs.length)} sonuç getirildi`});
    }
    if(wanted.video){
      const vids=await google(req,env,ctx,`site:youtube.com ${text} teknik video`);
      for(const v of vids.slice(0,5))resources.push({type:'video-resource',title:v.title,url:v.url,snippet:v.snippet||'',source:'Google / YouTube'});
      if(vids.length)trace.push({kind:'capability',label:'Video desteği',value:`${Math.min(5,vids.length)} ilgili video bulundu`});
    }

    let useful=stripRefusal(x.reply||'');
    const got=resources.length+media.length;
    if(got){
      const prefix='Tek bir modelin “yapamıyorum” cevabında durmadım; diğer yetenekleri otomatik devreye aldım.';
      useful=prefix+(useful?'\n\n'+useful:'')+'\n\nAşağıda bulduğum görsel/video kaynaklarını gösteriyorum.';
      x.reply=useful;x.provider=(x.provider?String(x.provider)+' · ':'')+'Capability Rescue';x.resources=resources;x.media=media;x.trace=trace;
      await replaceLatestAssistant(env,x.reply,x.provider);
      return json(x,r.status);
    }

    if(limited){
      x.reply=(useful?useful+'\n\n':'')+'Bu yetenek için bağlı sağlayıcı bulunamadı. JARVIS bunu başarısızlık olarak işaretledi; uygun medya sağlayıcısı bağlandığında otomatik devreye girecek.';
      x.provider=(x.provider?String(x.provider)+' · ':'')+'Capability Rescue';x.trace=trace;await replaceLatestAssistant(env,x.reply,x.provider);return json(x,r.status);
    }
    return r;
  },
  async scheduled(event,env,ctx){if(core.scheduled)return core.scheduled(event,env,ctx)}
};