// Deterministic, read-only Agent Skills suggestions, without running external instructions.
export const RECOMMENDED_SKILLS=Object.freeze([
 {repo:'vercel-labs/agent-skills',path:'skills/web-design-guidelines/SKILL.md',name:'Web tasarımı ve erişilebilirlik',terms:['website','web','site','tasarım','design','accessibility','erişilebilirlik','seo','6006']},
 {repo:'vercel-labs/agent-skills',path:'skills/react-best-practices/SKILL.md',name:'React performansı',terms:['react','next.js','nextjs','performans','performance','bundle','yavaş']},
 {repo:'vercel-labs/agent-skills',path:'skills/composition-patterns/SKILL.md',name:'React bileşen mimarisi',terms:['react','bileşen','component','architecture','mimari','refactor']},
 {repo:'anthropics/skills',path:'skills/pdf/SKILL.md',name:'PDF dosyaları',terms:['pdf','belge','document','rapor','report']},
 {repo:'cloudflare/skills',path:'skills/workers-best-practices/SKILL.md',name:'Cloudflare Workers geliştirme',terms:['cloudflare','workers','d1','kv','edge','worker']},
 {repo:'cloudflare/skills',path:'skills/agents-sdk/SKILL.md',name:'Cloudflare Agents SDK',terms:['agents sdk','cloudflare ajan','durable agent','agent hub']},
 {repo:'cloudflare/skills',path:'skills/workers-profiling/SKILL.md',name:'Workers performans analizi',terms:['profiling','workers performance','workers optimizasyon']},
 {repo:'openai/skills',path:'skills/.curated/security-best-practices/SKILL.md',name:'Uygulama güvenliği',terms:['güvenlik','security','vulnerability','zafiyet','owasp']},
 {repo:'openai/skills',path:'skills/.curated/security-threat-model/SKILL.md',name:'Tehdit modelleme',terms:['threat model','tehdit','güvenlik modeli']},
 {repo:'github/awesome-copilot',path:'skills/code-review/SKILL.md',name:'Kod inceleme',terms:['review','kod incele','code review','pull request','pr']},
 {repo:'github/awesome-copilot',path:'skills/github-actions-hardening/SKILL.md',name:'GitHub Actions güvenliği',terms:['actions','github actions','workflow security','ci security']},
 {repo:'github/awesome-copilot',path:'skills/github-actions-efficiency/SKILL.md',name:'GitHub Actions optimizasyonu',terms:['actions','ci','pipeline','workflow']},
 {repo:'github/awesome-copilot',path:'skills/mcp-implementation-security-review/SKILL.md',name:'MCP entegrasyon güvenliği',terms:['mcp','plugin','eklenti','connector']},
 {repo:'github/awesome-copilot',path:'skills/javascript-typescript-jest/SKILL.md',name:'JavaScript/TypeScript testleri',terms:['javascript','typescript','jest','unit test','node.js']},
 {repo:'github/awesome-copilot',path:'skills/playwright-generate-test/SKILL.md',name:'Web otomasyon testi',terms:['playwright','e2e','browser test','tarayıcı test']},
 {repo:'obra/superpowers',path:'skills/systematic-debugging/SKILL.md',name:'Sistematik hata ayıklama',terms:['debug','hata ayıkla','bug','ariza','sorun giderme']},
 {repo:'obra/superpowers',path:'skills/dispatching-parallel-agents/SKILL.md',name:'Paralel ajan koordinasyonu',terms:['multi agent','paralel ajan','agent koordinasyon','ajan']},
 {repo:'huggingface/skills',path:'skills/huggingface-tool-builder/SKILL.md',name:'AI araç geliştirme',terms:['huggingface','ai tool','model araç','ai model']},
 {repo:'expo/skills',path:'plugins/expo/skills/expo-native-ui/SKILL.md',name:'Mobil uygulama arayüzü',terms:['expo','react native','mobil uygulama','ios','android']}
]);
export function suggestSkillsForTask(task,{limit=4}={}){
 const text=String(task||'').normalize('NFKD').toLowerCase().trim().slice(0,1000);
 if(!text)return [];
 const words=new Set(text.split(/[^a-z0-9_.-]+/).filter(Boolean));
 const matches=RECOMMENDED_SKILLS.map(skill=>({
  repo:skill.repo,path:skill.path,name:skill.name,
  matched_terms:skill.terms.filter(term=>term.includes(' ')?text.includes(term):words.has(term)),
  execution:'preview-only',auto_install:false
 })).filter(skill=>skill.matched_terms.length)
 .sort((a,b)=>b.matched_terms.length-a.matched_terms.length||a.name.localeCompare(b.name,'tr'));
 return matches.slice(0,Math.max(1,Math.min(8,Number(limit)||4)));
}
