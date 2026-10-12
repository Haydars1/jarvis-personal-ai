import { suggestSkillsForTask } from './agent-hub-skill-matcher.js';
import { recommendAutomotiveTools } from './agent-hub-automotive-tools.js';
// Bounded, read-only Cloudflare Agent Hub workflow.
export const HUB_ADAPTERS=['repo-inspect','source-search','source-read','source-audit','ecu-bin-inspect','skill-analyze'];
export function validateHubSteps(steps,curated){
  if(!Array.isArray(steps)||!steps.length||steps.length>8)throw Error('STEPS_MUST_BE_1_TO_8');
  return steps.map((s,i)=>{
    const adapter_id=String(s?.adapter_id||''),repo=String(s?.repo||'').trim();
    if(!HUB_ADAPTERS.includes(adapter_id))throw Error('ADAPTER_NOT_ALLOWED_'+i);
    if(!curated.has(repo.toLowerCase()))throw Error('REPOSITORY_NOT_CURATED_'+i);
    const input=s.input&&typeof s.input==='object'&&!Array.isArray(s.input)?s.input:{};
    if(JSON.stringify(input).length>6000||Object.hasOwn(input,'__agent_hub'))throw Error('INVALID_INPUT_'+i);
    return {adapter_id,repo,input};
  });
}
export function nextHubStep(meta,ok){
  if(!meta||!Array.isArray(meta.steps))return null;
  const position=Number(meta.position);
  if(!Number.isInteger(position)||position<0||position>=meta.steps.length)return null;
  if(!ok)return Number(meta.attempts||0)<1?{...meta.steps[position],meta:{...meta,attempts:1}}:null;
  return position+1<meta.steps.length?{...meta.steps[position+1],meta:{...meta,position:position+1,attempts:0}}:null;
}

/** Deterministic task-to-agent planner: no paid LLM call, no arbitrary execution. */
export function createAgentPlan({task,repo},curated){
 const goal=String(task||'').trim().slice(0,1000);
 const name=String(repo||'').trim();
 if(!goal)throw Error('TASK_REQUIRED');
 if(!curated.has(name.toLowerCase()))throw Error('REPOSITORY_NOT_CURATED');
 // Route Turkish/English problem descriptions to actual repository symbols.
 // No AI/API calls, and no uncontrolled shell commands.
 const topicRules=[
  {pattern:/\b(seo|arama motoru|google search)\b/i,term:'seo'},
  {pattern:/\b(ecu|motor beyni|beyin dosya|tuning)\b/i,term:'ecu'},
  {pattern:/(araç seç|araba seç|vehicle select|vehicle finder|marka model)/i,term:'vehicle'},
  {pattern:/(dosya yükle|file upload|upload|yükleme)/i,term:'upload'},
  {pattern:/(giriş|oturum|login|authentication|şifre)/i,term:'auth'},
  {pattern:/(bildirim|notification|push)/i,term:'notification'},
  {pattern:/(veritaban|database|d1|sql)/i,term:'database'},
  {pattern:/(görev|ajan|agent|workflow|otomasyon)/i,term:'job'},
  {pattern:/(hata kod|fault code|diagnostic|dtc)/i,term:'dtc'}
 ];
 const detected=topicRules.find(rule=>rule.pattern.test(goal));
 const terms=goal.toLowerCase().normalize('NFKD').match(/[a-z0-9_-]{3,}/g)||[];
 const ignored=new Set(['please','check','inspect','repository','github','project','jarvis','kontrol','incele','hatayi','hatasi','sistem','kodlari','bulun','bakar','ariza','error','issue','problem','fix','debug','düzelt','sorunu','geliştir','inceleyin','hataları','sitesindeki','dosyasını']);
 const search=detected?.term||terms.find(t=>!ignored.has(t))||'TODO';
 const recommendedSkills=suggestSkillsForTask(goal);
 const steps=[
 {adapter_id:'repo-inspect',repo:name,input:{source:'agent-hub',goal}},
 {adapter_id:'source-search',repo:name,input:{term:search,source:'agent-hub',goal}},
 {adapter_id:'skill-analyze',repo:name,input:{source:'agent-hub',goal}}
 ];
 if(/\b(ecu|firmware|edc15|edc16|edc17|bin|hex|kt200)\b/i.test(goal))steps.push({adapter_id:'ecu-bin-inspect',repo:name,input:{source:'agent-hub',goal}});
 if(recommendedSkills.some(skill=>skill.path==='skills/web-design-guidelines/SKILL.md'))steps.push({adapter_id:'source-audit',repo:name,input:{source:'agent-hub',skill_references:recommendedSkills.map(skill=>skill.path).slice(0,5)}});
 return {goal,repo:name,steps:validateHubSteps(steps,curated),recommended_skills:recommendedSkills,automotive_tools:recommendAutomotiveTools(goal).map(tool=>({repo:tool.repo,area:tool.area,title:tool.title,installed:false,auto_execute:false,device_required:tool.device_required})),roles:['araştırmacı','kod inceleyici','beceri analisti']};
}
