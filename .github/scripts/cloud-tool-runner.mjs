import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { compileRepositorySkill } from '../../src/lib/repo-skill-compiler.js';

export const ALLOWED_ADAPTERS=Object.freeze({
  'repo-inspect':true,
  'source-search':true,
  'source-read':true,
  'skill-analyze':true
});

const BASE=String(process.env.JARVIS_URL||'https://haydojarvis.workers.dev').replace(/\/$/,'');
const MAX_JOBS=Math.max(1,Math.min(8,Number(process.env.JARVIS_CLOUD_MAX_JOBS||6)));
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.rs','.go','.java','.kt','.kts','.c','.cc','.cpp','.h','.hpp','.cs','.php','.rb','.swift','.sh','.ps1','.json','.yml','.yaml','.toml','.xml','.md','.txt','.ini','.cfg','.sql']);

function run(command,args,{cwd,quiet=true}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'},stdio:quiet?['ignore','pipe','pipe']:'inherit',windowsHide:true});
    let stdout='',stderr='';
    child.stdout?.on('data',c=>stdout+=c);child.stderr?.on('data',c=>stderr+=c);
    child.on('error',reject);child.on('close',code=>code===0?resolve({stdout:stdout.trim(),stderr:stderr.trim()}):reject(new Error(`${command} ${args.join(' ')} exited ${code}: ${stderr.slice(-800)}`)));
  });
}
async function oidcToken(){
  const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!url||!token)throw new Error('GITHUB_OIDC_UNAVAILABLE');
  const sep=url.includes('?')?'&':'?';
  const response=await fetch(`${url}${sep}audience=jarvis-cloud-tool-runner`,{headers:{Authorization:`bearer ${token}`}});
  if(!response.ok)throw new Error(`OIDC_REQUEST_${response.status}`);
  const payload=await response.json();return payload.value;
}
async function api(pathname,{method='GET',body,token}={}){
  const response=await fetch(BASE+pathname,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  if(!response.ok)throw new Error(payload.error||`HTTP_${response.status}`);return payload;
}
function safeRepo(repo){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repo||'')))throw new Error('INVALID_REPOSITORY');return String(repo);
}
function safeRelative(value){
  const p=String(value||'').replace(/\\/g,'/');
  if(!p||p.startsWith('/')||p.includes('../')||p==='..')throw new Error('INVALID_PATH');return p;
}
async function cloneJob(job){
  const repo=safeRepo(job.repo),root=await mkdtemp(path.join(tmpdir(),'jarvis-cloud-tool-')),dest=path.join(root,'repo');
  await run('git',['clone','--depth','1','--filter=blob:none','--single-branch','--no-tags',`https://github.com/${repo}.git`,dest],{quiet:false});
  if(job.commit){
    await run('git',['fetch','--depth','1','origin',job.commit],{cwd:dest});
    await run('git',['checkout','--detach',job.commit],{cwd:dest});
  }
  const {stdout:commit}=await run('git',['rev-parse','HEAD'],{cwd:dest});
  return {root,dest,commit};
}
async function trackedFiles(dest){
  const {stdout}=await run('git',['ls-files'],{cwd:dest});
  return stdout.split('\n').map(x=>x.trim()).filter(Boolean);
}
async function repoInspect(job,ctx){
  const files=await trackedFiles(ctx.dest),top=files.slice(0,250);
  const candidates=['README.md','README.MD','readme.md','package.json','pyproject.toml','requirements.txt','Cargo.toml','go.mod','Dockerfile'];
  const snippets={};
  for(const file of candidates){
    if(!files.includes(file))continue;
    try{snippets[file]=(await readFile(path.join(ctx.dest,file),'utf8')).slice(0,12000)}catch{}
  }
  const extensions={};for(const file of files){const ext=path.extname(file).toLowerCase()||'(none)';extensions[ext]=(extensions[ext]||0)+1;}
  return {repo:job.repo,commit:ctx.commit,file_count:files.length,files:top,extensions,snippets};
}
async function skillAnalyze(job,ctx){
  const inspection=await repoInspect(job,ctx);
  return compileRepositorySkill(inspection,{repo:job.repo});
}
async function sourceSearch(job,ctx){
  const term=String(job.input?.term||'').trim();if(!term||term.length>200)throw new Error('INVALID_SEARCH_TERM');
  const lower=term.toLowerCase(),files=await trackedFiles(ctx.dest),matches=[];
  for(const file of files.slice(0,4000)){
    if(matches.length>=50)break;
    const ext=path.extname(file).toLowerCase();if(ext&&!TEXT_EXT.has(ext))continue;
    const full=path.join(ctx.dest,file);let info;try{info=await stat(full)}catch{continue}if(info.size>512*1024)continue;
    let text;try{text=await readFile(full,'utf8')}catch{continue}
    const lines=text.split(/\r?\n/);for(let i=0;i<lines.length&&matches.length<50;i++){if(lines[i].toLowerCase().includes(lower))matches.push({file,line:i+1,text:lines[i].slice(0,500)});}
  }
  return {repo:job.repo,commit:ctx.commit,term,matches};
}
async function sourceRead(job,ctx){
  const file=safeRelative(job.input?.path),files=await trackedFiles(ctx.dest);if(!files.includes(file))throw new Error('FILE_NOT_TRACKED');
  const full=path.join(ctx.dest,file),info=await stat(full);if(info.size>250*1024)throw new Error('FILE_TOO_LARGE');
  return {repo:job.repo,commit:ctx.commit,path:file,content:await readFile(full,'utf8')};
}
async function executeJob(job,ctx){
  const adapter=String(job.adapter_id||'');if(!ALLOWED_ADAPTERS[adapter])throw new Error('ADAPTER_NOT_ALLOWED');
  if(adapter==='repo-inspect')return repoInspect(job,ctx);
  if(adapter==='source-search')return sourceSearch(job,ctx);
  if(adapter==='source-read')return sourceRead(job,ctx);
  if(adapter==='skill-analyze')return skillAnalyze(job,ctx);
  throw new Error('ADAPTER_NOT_IMPLEMENTED');
}

async function main(){
  const token=await oidcToken();let processed=0,failed=0;
  try{
    const seeded=await api('/api/tools/cloud/runner/seed-learning',{method:'POST',body:{limit:MAX_JOBS},token});
    console.log(`Seeded ${Number(seeded.queued||0)} repository skill jobs.`);
  }catch(error){
    console.warn('Skill seeding failed; continuing with existing queue:',error?.message||error);
  }
  for(let index=0;index<MAX_JOBS;index++){
    const claimed=await api('/api/tools/cloud/runner/claim',{method:'POST',body:{},token}),job=claimed.job;
    if(!job){console.log('No more queued cloud tool jobs.');break;}
    processed++;
    console.log(`Claimed ${job.id} ${job.adapter_id} ${job.repo}`);
    try{
      const ctx=await cloneJob(job),result=await executeJob(job,ctx);
      await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:true,result},token});
      console.log(`Completed ${job.id}`);
    }catch(error){
      failed++;
      console.error(`Failed ${job.id}:`,error);
      await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:false,error:String(error?.message||error)},token}).catch(()=>{});
    }
  }
  console.log(`Cloud runner batch finished. processed=${processed} failed=${failed} max=${MAX_JOBS}`);
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)main();
