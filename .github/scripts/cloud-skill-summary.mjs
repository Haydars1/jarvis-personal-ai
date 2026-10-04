const BASE=String(process.env.JARVIS_URL||'https://jarvis-personal-ai.haydojarvis.workers.dev').replace(/\/$/,'');

async function oidcToken(){
  const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!url||!token)throw new Error('GITHUB_OIDC_UNAVAILABLE');
  const sep=url.includes('?')?'&':'?';
  const response=await fetch(`${url}${sep}audience=jarvis-cloud-tool-runner`,{headers:{Authorization:`bearer ${token}`}});
  if(!response.ok)throw new Error(`OIDC_REQUEST_${response.status}`);
  const payload=await response.json();
  return payload.value;
}

async function main(){
  const token=await oidcToken();
  const response=await fetch(`${BASE}/api/tools/skills/execution-summary`,{
    headers:{authorization:`Bearer ${token}`,accept:'application/json'}
  });
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{};}catch{payload={raw:text};}
  if(!response.ok)throw new Error(payload.error||`HTTP_${response.status}`);
  console.log(`SKILL_EXECUTION_SUMMARY ${JSON.stringify(payload)}`);
}

main().catch(error=>{
  console.error('Skill execution summary failed:',error?.message||error);
  process.exitCode=1;
});
