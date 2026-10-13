import { APPROVED_SKILL_REPOS } from './agent-hub-skill-directory.js';

// GitHub repository search is discovery-only. Search results are NEVER plugins or trusted instructions.
export async function discoverSkillRepositories(query,fetcher=fetch,options={}){
  const term=String(query??'').trim();
  const page=Number(options.page??1),limit=Number(options.limit??20);
  if(term.length<2||term.length>80||!/^[-. \p{L}\p{N}_]+$/u.test(term))throw new Error('INVALID_REPOSITORY_SEARCH');
  if(!Number.isInteger(page)||page<1||page>10||!Number.isInteger(limit)||limit<1||limit>30)
    throw new Error('INVALID_REPOSITORY_PAGE');
  const q=`${term} in:name,description,readme archived:false`;
  const url=`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}&page=${page}`;
  const response=await fetcher(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'JARVIS-Agent-Hub'}});
  if(!response.ok)throw new Error(`GITHUB_REPOSITORY_SEARCH_${response.status}`);
  const data=await response.json();
  const approved=new Set(APPROVED_SKILL_REPOS.map(x=>x.toLowerCase()));
  const results=(Array.isArray(data.items)?data.items:[])
    .filter(row=>/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(row.full_name||'')))
    .map(row=>{
      const repo=String(row.full_name),trusted=approved.has(repo.toLowerCase());
      return {
        repo,title:String(row.name||repo).slice(0,100),
        description:String(row.description||'').slice(0,300),
        url:`https://github.com/${repo}`,
        stars:Math.max(0,Number(row.stargazers_count)||0),
        updated_at:row.updated_at||null,
        approved_source:trusted,
        skill_manifest_verified:false,installed:false,executable:false,
        review_required:true
      };
    });
  return {
    query:term,results,total_reported:Math.max(0,Number(data.total_count)||0),
    incomplete_results:!!data.incomplete_results,page,limit,
    next_page:results.length===limit&&page<10?page+1:null,
    discovery_only:true,auto_install:false
  };
}
