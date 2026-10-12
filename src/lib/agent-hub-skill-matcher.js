// Deterministic, read-only Agent Skills suggestions, without running external instructions.
export const RECOMMENDED_SKILLS=Object.freeze([
 {repo:'vercel-labs/agent-skills',path:'skills/web-design-guidelines/SKILL.md',name:'Web tasarımı ve erişilebilirlik',terms:['website','web','site','tasarım','design','accessibility','erişilebilirlik','seo','6006']},
 {repo:'vercel-labs/agent-skills',path:'skills/react-best-practices/SKILL.md',name:'React performansı',terms:['react','next.js','nextjs','performans','performance','bundle','yavaş']},
 {repo:'vercel-labs/agent-skills',path:'skills/composition-patterns/SKILL.md',name:'React bileşen mimarisi',terms:['react','bileşen','component','architecture','mimari','refactor']},
 {repo:'anthropics/skills',path:'skills/pdf/SKILL.md',name:'PDF dosyaları',terms:['pdf','belge','document','rapor','report']}
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
