export function selectSkillLearningRepos(curatedRepos=[],learnedRepos=new Set(),pendingRepos=new Set(),limit=6){
  const learned=learnedRepos instanceof Set?learnedRepos:new Set(learnedRepos||[]);
  const pending=pendingRepos instanceof Set?pendingRepos:new Set(pendingRepos||[]);
  const max=Math.max(0,Math.min(25,Number(limit)||0));
  return [...new Set((curatedRepos||[]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean))]
    .filter(repo=>!learned.has(repo)&&!pending.has(repo))
    .sort((a,b)=>a.localeCompare(b))
    .slice(0,max);
}
