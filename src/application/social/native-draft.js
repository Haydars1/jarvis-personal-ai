import { execute, jsonResponse, readJson } from '../../lib/runtime.js';
import { cadencePlan } from './growth.js';

const now=()=>Date.now();
const uid=()=>crypto.randomUUID();

export function socialDraftIntent(text=''){
  return /(instagram|reels?|facebook|sosyal medya|takipçi|follower|içerik planı|content plan|kampanya).*(yap|hazırla|planla|oluştur|büyüt)|(?:içerik|reels?|kampanya).*(instagram|facebook)/i.test(String(text));
}

function platformsFrom(text=''){
  const platforms=[];
  if(/instagram|reels?/i.test(text))platforms.push('instagram');
  if(/facebook|\bfb\b/i.test(text))platforms.push('facebook');
  return platforms.length?[...new Set(platforms)]:['instagram'];
}

function tagsFor(topic=''){
  const words=String(topic).toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean).slice(0,3);
  return [...new Set(['#reels','#içerik','#keşfet',...words.map(word=>`#${word}`)])].slice(0,7);
}

export function deterministicContentPlan(topic='',platforms=['instagram']){
  const clean=String(topic||'İçerik').replace(/\s+/g,' ').trim().slice(0,500)||'İçerik';
  const platformLabel=(Array.isArray(platforms)&&platforms.length?platforms:['instagram']).join(' + ');
  const hashtags=tagsFor(clean);
  return [
    {
      topic:`${clean} — hızlı ipucu`,
      hook:`${clean}: çoğu kişinin atladığı 1 nokta`,
      caption:`${clean} konusunda kısa ve uygulanabilir bir ipucu. Kaydet ve gerektiğinde tekrar bak.`,
      hashtags,
      media_prompt:`9:16 dikey kısa video; konu ${clean}; ${platformLabel}; ilk 2 saniyede net başlık, üç kısa sahne, okunabilir altyazı.`
    },
    {
      topic:`${clean} — kontrol listesi`,
      hook:`${clean} için 3 maddelik kontrol listesi`,
      caption:`${clean} için üç adımlık pratik kontrol listesi. Her adımı kısa ve somut göster.`,
      hashtags,
      media_prompt:`9:16 dikey kontrol-listesi videosu; konu ${clean}; 3 numaralı adım; sade kurgu ve büyük altyazılar.`
    },
    {
      topic:`${clean} — sık hata`,
      hook:`${clean} yaparken bu hataya dikkat`,
      caption:`${clean} konusunda sık yapılan bir hatayı ve daha güvenli/doğru yaklaşımı kısa şekilde göster.`,
      hashtags,
      media_prompt:`9:16 dikey önce/sonra formatı; konu ${clean}; yaygın hata ve doğru yaklaşım; temiz görsel karşılaştırma.`
    }
  ];
}

async function appAuthed(core,req,env,ctx){
  const response=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  try{return !!(await response.json()).authenticated;}catch{return false;}
}

async function createDraft(req,env){
  const body=await readJson(req),text=String(body.topic||body.request||'').trim();
  if(!text)return jsonResponse({error:'SOCIAL_TOPIC_REQUIRED'},400);
  const platforms=Array.isArray(body.platforms)&&body.platforms.length?body.platforms.map(String):platformsFrom(text);
  const topic=text.replace(/\s+/g,' ').slice(0,700),timestamp=now(),id=uid(),cadence=body.cadence||cadencePlan(text,timestamp);
  const objective=/para kazan|satış|müşteri|reklam|gelir/i.test(text)?'monetization':'growth';
  const plan=deterministicContentPlan(topic,platforms);
  const config={source:'native-skill',plan_mode:'deterministic',execution_mode:'draft',cadence,group_policy:'authorized_targets_only'};

  await execute(env,'INSERT INTO social_campaigns(id,name,objective,platforms,topic,audience,cadence,enabled,approval_mode,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    id,String(body.name||topic).slice(0,100),objective,JSON.stringify(platforms),topic,String(body.audience||''),cadence.id,0,'manual',JSON.stringify(config),timestamp,timestamp);

  for(let index=0;index<plan.length;index++){
    for(const platform of platforms){
      const item=plan[index],queueId=uid(),scheduled=cadence.first_at+(index*cadence.interval_ms);
      await execute(env,'INSERT INTO social_content_queue(id,campaign_id,platform,content_type,topic,hook,caption,hashtags,media_prompt,status,scheduled_at,meta,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        queueId,id,platform,'reel',item.topic,item.hook,item.caption,JSON.stringify(item.hashtags),item.media_prompt,'draft',scheduled,JSON.stringify({plan_mode:'deterministic',execution_mode:'draft'}),timestamp,timestamp);
    }
  }

  return jsonResponse({id,platforms,topic,cadence,items:plan.length*platforms.length,execution_mode:'draft',plan_mode:'deterministic',plan});
}

export function createSocialNativeDraft(core){
  if(!core?.fetch)throw new Error('SOCIAL_NATIVE_DRAFT_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url);
      if(url.pathname==='/api/social-growth/native-draft'&&req.method==='POST'){
        if(!(await appAuthed(core,req,env,ctx)))return jsonResponse({error:'AUTH_REQUIRED'},401);
        return createDraft(req,env);
      }
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
