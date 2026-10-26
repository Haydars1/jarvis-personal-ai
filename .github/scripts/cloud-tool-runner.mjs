import { mkdtemp, readFile, stat, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { compileRepositorySkill } from '../../src/lib/repo-skill-compiler.js';
import { YOUTUBE_TEACHING_REPO, parseYouTubeResourceUrl, fetchYouTubeChannelIndex } from '../../src/lib/youtube-teaching-runtime.js';
import { executeCodeGraphJob } from './code-graph-job.mjs';

export const ALLOWED_ADAPTERS=Object.freeze({
  'repo-inspect':true,
  'source-search':true,
  'source-read':true,
  'skill-analyze':true,
  'youtube-teaching':true,
  'code-graph-query':true
});

const BASE=String(process.env.JARVIS_URL||'https://hayirlievlad.haydojarvis.workers.dev').replace(/\/$/,'');
const MAX_JOBS=Math.max(1,Math.min(8,Number(process.env.JARVIS_CLOUD_MAX_JOBS||6)));
const MAX_BATCHES=Math.max(1,Math.min(12,Number(process.env.JARVIS_CLOUD_MAX_BATCHES||1)));
const API_TIMEOUT_MS=Math.max(5000,Math.min(60000,Number(process.env.JARVIS_CLOUD_API_TIMEOUT_MS||20000)));
const MAX_CONSECUTIVE_CLAIM_FAILURES=Math.max(1,Math.min(6,Number(process.env.JARVIS_CLOUD_MAX_CLAIM_FAILURES||3)));
const RETRYABLE_STATUS=new Set([408,425,429,500,502,503,504]);
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.rs','.go','.java','.kt','.kts','.c','.cc','.cpp','.h','.hpp','.cs','.php','.rb','.swift','.sh','.ps1','.json','.yml','.yaml','.toml','.xml','.md','.txt','.ini','.cfg','.sql']);
let apiRetryCount=0;

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
  const response=await fetch(`${url}${sep}audience=jarvis-cloud-tool-runner`,{headers:{Authorization:`bearer ${token}`},signal:AbortSignal.timeout(API_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`OIDC_REQUEST_${response.status}`);
  const payload=await response.json();return payload.value;
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function api(pathname,{method='GET',body,token,retries=3,timeoutMs=API_TIMEOUT_MS}={}){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(BASE+pathname,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
      const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
      if(response.ok)return payload;
      const error=new Error(payload.error||`HTTP_${response.status}`);
      error.status=response.status;
      if(!RETRYABLE_STATUS.has(response.status))throw error;
      lastError=error;
    }catch(error){
      lastError=error;
      if(error?.status&&!RETRYABLE_STATUS.has(error.status))throw error;
    }
    if(attempt===retries)throw lastError||new Error('API_REQUEST_FAILED');
    apiRetryCount++;
    await sleep(Math.min(8000,500*(2**attempt)));
  }
  throw lastError||new Error('API_REQUEST_FAILED');
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

// YouTube videos are never downloaded or stored by JARVIS.
// Gemini reads the public video URL directly; GitHub only dispatches the URL.
async function youtubeTeaching(job,token){
  if(String(job.repo||'').toLowerCase()!==YOUTUBE_TEACHING_REPO)throw new Error('YOUTUBE_TEACHING_REPO_NOT_ALLOWED');
  const sourceUrl=String(job.input?.url||job.input?.source_url||'').trim();
  const parsed=parseYouTubeResourceUrl(sourceUrl);if(!parsed)throw new Error('YOUTUBE_URL_INVALID');
  if(parsed.type==='channel'){
    const learned=await fetchYouTubeChannelIndex(sourceUrl,{limit:50});
    return {repo:YOUTUBE_TEACHING_REPO,commit:null,engine:'jarvis-clean-room-youtube-teaching',provenance_repo:YOUTUBE_TEACHING_REPO,third_party_code_executed:false,...learned};
  }
  const canonical='https://www.youtube.com/watch?v='+parsed.videoId;
  const learned=await api('/api/learning/youtube/direct/analyze',{
    method:'POST',token,retries:0,timeoutMs:130000,body:{url:canonical}
  });
  if(!learned?.video_analyzed||learned?.learning_method!=='direct-youtube-video-understanding'||!learned?.transcript)
    throw new Error('YOUTUBE_DIRECT_ANALYSIS_INCOMPLETE');
  return {
    repo:YOUTUBE_TEACHING_REPO,commit:null,engine:'jarvis-direct-youtube-learning-v3',
    provenance_repo:YOUTUBE_TEACHING_REPO,third_party_code_executed:false,...learned
  };
}
async function executeJob(job,ctx,token){
  const adapter=String(job.adapter_id||'');if(!ALLOWED_ADAPTERS[adapter])throw new Error('ADAPTER_NOT_ALLOWED');
  if(adapter==='youtube-teaching')return youtubeTeaching(job,token);
  if(adapter==='code-graph-query')return executeCodeGraphJob(job,ctx);
  if(adapter==='repo-inspect')return repoInspect(job,ctx);
  if(adapter==='source-search')return sourceSearch(job,ctx);
  if(adapter==='source-read')return sourceRead(job,ctx);
  if(adapter==='skill-analyze')return skillAnalyze(job,ctx);
  throw new Error('ADAPTER_NOT_IMPLEMENTED');
}

async function main(){
  const token=await oidcToken();let processed=0,failed=0,claimFailures=0,consecutiveClaimFailures=0;
  batchLoop: for(let batch=0;batch<MAX_BATCHES;batch++){
    let seededCount=0,batchProcessed=0;
    try{
      const seeded=await api('/api/tools/cloud/runner/seed-learning',{method:'POST',body:{limit:MAX_JOBS},token});
      seededCount=Number(seeded.queued||0);
      console.log(`Batch ${batch+1}/${MAX_BATCHES}: seeded ${seededCount} repository skill jobs.`);
    }catch(error){
      console.warn(`Batch ${batch+1}/${MAX_BATCHES}: skill seeding failed; continuing with existing queue:`,error?.message||error);
    }
    for(let index=0;index<MAX_JOBS;index++){
      let claimed;
      try{
        claimed=await api('/api/tools/cloud/runner/claim',{method:'POST',body:{},token});
        consecutiveClaimFailures=0;
      }catch(error){
        failed++;claimFailures++;consecutiveClaimFailures++;
        console.error(`Batch ${batch+1}/${MAX_BATCHES}: claim failed after retries; isolating batch (consecutive=${consecutiveClaimFailures}):`,error?.message||error);
        if(consecutiveClaimFailures>=MAX_CONSECUTIVE_CLAIM_FAILURES){
          console.error(`Stopping cloud queue after ${consecutiveClaimFailures} consecutive claim failures.`);
          break batchLoop;
        }
        break;
      }
      const job=claimed.job;
      if(!job){console.log(`Batch ${batch+1}/${MAX_BATCHES}: no more queued cloud tool jobs.`);break;}
      processed++;batchProcessed++;
      console.log(`Claimed ${job.id} ${job.adapter_id} ${job.repo}`);
      let ctx=null;
      try{
        ctx=job.adapter_id==='youtube-teaching'?null:await cloneJob(job);
        const result=await executeJob(job,ctx,token);
        await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:true,result},token});
        console.log(`Completed ${job.id}`);
      }catch(error){
        failed++;
        console.error(`Failed ${job.id}:`,error);
        await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:false,error:String(error?.message||error)},token}).catch(()=>{});
      }finally{
        if(ctx?.root)await rm(ctx.root,{recursive:true,force:true}).catch(()=>{});
      }
    }
    console.log(`Batch ${batch+1}/${MAX_BATCHES} finished. processed=${batchProcessed} seeded=${seededCount} claim_failures=${claimFailures} api_retries=${apiRetryCount}.`);
    if(seededCount===0&&batchProcessed===0)break;
  }
  console.log(`Cloud runner finished. processed=${processed} failed=${failed} claim_failures=${claimFailures} api_retries=${apiRetryCount} max_jobs_per_batch=${MAX_JOBS} max_batches=${MAX_BATCHES}`);
  if(failed>0)process.exitCode=1;
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)main();
