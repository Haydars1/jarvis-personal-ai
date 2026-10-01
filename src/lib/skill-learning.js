export function selectSkillLearningRepos(curatedRepos=[],learnedRepos=new Set(),pendingRepos=new Set(),limit=6,currentCompilerVersion=null){
  const learnedSet=learnedRepos instanceof Set?learnedRepos:new Set();
  const learnedVersions=learnedRepos instanceof Map?learnedRepos:null;
  const pending=pendingRepos instanceof Set?pendingRepos:new Set(pendingRepos||[]);
  const max=Math.max(0,Math.min(25,Number(limit)||0));
  return [...new Set((curatedRepos||[]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean))]
    .filter(repo=>{
      if(pending.has(repo))return false;
      if(learnedVersions){
        if(!learnedVersions.has(repo))return true;
        return currentCompilerVersion?learnedVersions.get(repo)!==currentCompilerVersion:false;
      }
      return !learnedSet.has(repo);
    })
    .sort((a,b)=>a.localeCompare(b))
    .slice(0,max);
}
