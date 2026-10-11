// Read-only SKILL.md discovery for vetted public sources. Never installs or executes remote code.
export const APPROVED_SKILL_REPOS = Object.freeze(['anthropics/skills','vercel-labs/skills']);
const allowed=new Set(APPROVED_SKILL_REPOS);
export function validSkillManifestPath(path) {
  const value=String(path||'');
  return value.length>0 && value.length<=240 && /(^|\/)SKILL\.md$/.test(value) &&
    value.split('/').every(part=>part && part!=='.' && part!=='..' && /^[a-zA-Z0-9._-]+$/.test(part));
}
export async function discoverSkillManifests(repo,fetcher=fetch) {
  if(!allowed.has(repo))throw new Error('SOURCE_NOT_APPROVED');
  const url=`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`;
  const response=await fetcher(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'JARVIS-Agent-Hub'}});
  if(!response.ok)throw new Error(`GITHUB_SKILL_INDEX_${response.status}`);
  const data=await response.json();
  const skills=(Array.isArray(data.tree)?data.tree:[])
    .filter(item=>item.type==='blob' && validSkillManifestPath(item.path))
    .slice(0,150).map(item=>({path:item.path,name:item.path.split('/').slice(-2,-1)[0]||item.path,repo}));
  return {repo,skills,total:skills.length,truncated:!!data.truncated,mode:'read-only',auto_install:false};
}
export async function previewSkillManifest(repo,path,fetcher=fetch) {
  if(!allowed.has(repo))throw new Error('SOURCE_NOT_APPROVED');
  if(!validSkillManifestPath(path))throw new Error('INVALID_SKILL_PATH');
  const url=`https://raw.githubusercontent.com/${repo}/main/${path}`;
  const response=await fetcher(url,{headers:{Accept:'text/plain','User-Agent':'JARVIS-Agent-Hub'}});
  if(!response.ok)throw new Error(`GITHUB_SKILL_FILE_${response.status}`);
  const declaredSize=Number(response.headers?.get?.('content-length')||0);
  if(declaredSize>65536)throw new Error('SKILL_FILE_TOO_LARGE');
  const content=await response.text();
  if(content.length>65536)throw new Error('SKILL_FILE_TOO_LARGE');
  return {repo,path,content,verified_executable:false,auto_execute:false};
}
