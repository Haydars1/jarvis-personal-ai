import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';

const execFileAsync=promisify(execFile);
const README_CANDIDATES=['README.md','README.rst','README.txt','README','readme.md','Readme.md'];
const SOURCE_MANIFESTS=new Set(['package.json','pyproject.toml','setup.py','setup.cfg','cargo.toml','go.mod','pom.xml','build.gradle','build.gradle.kts','cmakelists.txt','makefile','requirements.txt','configure','configure.py']);
const SOURCE_EXTENSIONS=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.rs','.go','.java','.kt','.kts','.c','.cc','.cpp','.h','.hpp','.cs','.php','.rb','.swift','.sh','.ps1']);
const SKIP_SOURCE_PARTS=/(^|\/)(?:node_modules|vendor|dist|build|target|third_party|third-party|external|deps|generated)(?:\/|$)/i;

function assertRepoName(repo){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repo||''))) throw new Error('INVALID_REPOSITORY_NAME');
  return repo;
}

async function defaultGitProbe(repo){
  const safeRepo=assertRepoName(repo);
  try{
    const {stdout}=await execFileAsync('git',['ls-remote','--symref',`https://github.com/${safeRepo}.git`,'HEAD'],{
      cwd:process.env.RUNNER_TEMP||tmpdir(),
      encoding:'utf8',
      timeout:15000,
      maxBuffer:1024*1024,
      env:{...process.env,GIT_TERMINAL_PROMPT:'0'}
    });
    const lines=String(stdout||'').split(/\r?\n/).filter(Boolean);
    const refLine=lines.find(line=>line.startsWith('ref: refs/heads/')&&line.endsWith('\tHEAD'));
    const shaLine=lines.find(line=>/^[0-9a-f]{40,64}\s+HEAD$/i.test(line));
    const sourceCommit=shaLine?.split(/\s+/,1)[0];
    const defaultBranch=refLine?.match(/^ref: refs\/heads\/(.+)\tHEAD$/)?.[1]||null;
    if(!sourceCommit) throw new Error('HEAD_NOT_FOUND');
    return {canonical_repo:safeRepo,default_branch:defaultBranch,source_commit:sourceCommit};
  }catch(error){
    throw new Error(`GIT_SOURCE_UNAVAILABLE: ${String(error?.message||error).split('\n')[0]}`);
  }
}

function sourcePriority(file){
  const normalized=String(file||'').replace(/\\/g,'/');
  const name=basename(normalized).toLowerCase();
  const extension=name.includes('.')?'.'+name.split('.').pop():'';
  if(SOURCE_MANIFESTS.has(name))return normalized.includes('/')?5:0;
  if(SOURCE_EXTENSIONS.has(extension))return normalized.includes('/')?20:10;
  return 100;
}

async function defaultGitSourceProbe(repo,sha){
  const safeRepo=assertRepoName(repo);
  if(!/^[0-9a-f]{40,64}$/i.test(String(sha||'')))throw new Error('INVALID_SOURCE_COMMIT');
  const root=await mkdtemp(resolve(process.env.RUNNER_TEMP||tmpdir(),'jarvis-pdf-source-'));
  const gitOptions={cwd:root,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}};
  try{
    await execFileAsync('git',['init','--quiet'],gitOptions);
    await execFileAsync('git',['remote','add','origin',`https://github.com/${safeRepo}.git`],gitOptions);
    await execFileAsync('git',['fetch','--quiet','--depth','1','--filter=blob:none','--no-tags','origin',String(sha)],gitOptions);
    const {stdout}=await execFileAsync('git',['ls-tree','-r','--name-only','FETCH_HEAD'],gitOptions);
    const candidates=String(stdout||'').split(/\r?\n/).map(file=>file.trim()).filter(file=>{
      if(!file||SKIP_SOURCE_PARTS.test(file))return false;
      const name=basename(file).toLowerCase();
      const extension=name.includes('.')?'.'+name.split('.').pop():'';
      return SOURCE_MANIFESTS.has(name)||SOURCE_EXTENSIONS.has(extension);
    }).sort((a,b)=>sourcePriority(a)-sourcePriority(b)||a.localeCompare(b));
    for(const file of candidates.slice(0,40)){
      try{
        const {stdout:text}=await execFileAsync('git',['show',`FETCH_HEAD:${file}`],{...gitOptions,maxBuffer:1024*1024});
        if(String(text||'').trim())return {path:file,text:String(text)};
      }catch{}
    }
    return null;
  }finally{
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}

async function fetchRawReadme(repo,sha,fetchImpl){
  for(const candidate of README_CANDIDATES){
    const url=`https://raw.githubusercontent.com/${repo}/${sha}/${candidate}`;
    const response=await fetchImpl(url,{
      headers:{accept:'text/plain','user-agent':'jarvis-pdf-source-audit'},
      signal:AbortSignal.timeout(15000)
    });
    if(response.ok){
      const text=await response.text();
      return {path:candidate,text};
    }
    if(response.status!==404) throw new Error(`RAW_${response.status}`);
  }
  return null;
}

async function applyPublicFallback(repo,result,{gitProbe,sourceProbe,fetchImpl},apiError){
  const evidence=await gitProbe(repo);
  const canonical=assertRepoName(evidence.canonical_repo||repo);
  const sha=String(evidence.source_commit||'').trim();
  if(!/^[0-9a-f]{40,64}$/i.test(sha)) throw new Error('GIT_SOURCE_UNAVAILABLE: invalid source commit');
  result.canonical_repo=canonical;
  result.default_branch=evidence.default_branch||null;
  result.source_commit=sha;
  result.evidence_source='git-raw-fallback';
  result.api_error=apiError;
  const readme=await fetchRawReadme(canonical,sha,fetchImpl);
  if(readme){
    result.readme_sha256=createHash('sha256').update(readme.text).digest('hex');
    result.readme_path=readme.path;
    result.readme_bytes=Buffer.byteLength(readme.text);
    result.status='source-verified';
    return;
  }
  result.readme_error='README_NOT_FOUND';
  try{
    const source=await sourceProbe(canonical,sha);
    if(source?.path&&String(source.text||'').length){
      result.evidence_source='git-source-fallback';
      result.source_evidence_path=source.path;
      result.source_evidence_sha256=createHash('sha256').update(source.text).digest('hex');
      result.source_evidence_bytes=Buffer.byteLength(source.text);
      result.status='source-verified';
      return;
    }
  }catch(error){
    result.source_evidence_error=String(error?.message||error);
  }
  result.status='metadata-only';
}

export async function auditPdfRepositories(provenance,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN,concurrency=4,gitProbe=defaultGitProbe,sourceProbe=defaultGitSourceProbe}={}){
  const repos=Object.keys(provenance).sort();
  const results=[];
  let next=0;
  async function request(path){
    const response=await fetchImpl('https://api.github.com'+path,{
      headers:{accept:'application/vnd.github+json','user-agent':'jarvis-pdf-source-audit',...(token?{authorization:'Bearer '+token}:{})},
      signal:AbortSignal.timeout(15000)
    });
    if(!response.ok){
      const error=new Error('GITHUB_'+response.status);
      error.status=response.status;
      throw error;
    }
    return response.json();
  }
  async function worker(){
    while(next<repos.length){
      const repo=repos[next++];
      const result={repo,pdf:provenance[repo],checked_at:new Date().toISOString(),status:'unavailable',executed_upstream_code:false};
      try{
        const metadata=await request('/repos/'+repo);
        result.canonical_repo=metadata.full_name;
        result.license=metadata.license?.spdx_id||null;
        result.archived=metadata.archived;
        result.language=metadata.language;
        const commit=await request('/repos/'+repo+'/commits/'+encodeURIComponent(metadata.default_branch));
        result.source_commit=commit.sha;
        try{
          const readme=await request('/repos/'+repo+'/readme?ref='+commit.sha);
          const text=Buffer.from(readme.content,'base64').toString('utf8');
          result.readme_sha256=createHash('sha256').update(text).digest('hex');
          result.readme_path=readme.path;
          result.readme_bytes=Buffer.byteLength(text);
          result.evidence_source='github-api';
          result.status='source-verified';
        }catch(error){
          if(error.status===403){
            await applyPublicFallback(repo,result,{gitProbe,sourceProbe,fetchImpl},error.message);
          }else{
            result.status='metadata-only';
            result.readme_error=error.message;
          }
        }
      }catch(error){
        if(error.status===403){
          try{
            await applyPublicFallback(repo,result,{gitProbe,sourceProbe,fetchImpl},error.message);
          }catch(fallbackError){
            result.api_error=error.message;
            result.error=String(fallbackError?.message||fallbackError);
          }
        }else{
          result.error=error.message;
        }
      }
      results.push(result);
      console.log(repo+': '+result.status);
    }
  }
  await Promise.all(Array.from({length:Math.max(1,Math.min(8,concurrency))},worker));
  return {schema_version:1,total:repos.length,results:results.sort((a,b)=>a.repo.localeCompare(b.repo)),counts:results.reduce((out,row)=>({...out,[row.status]:(out[row.status]||0)+1}),{})};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const provenance=JSON.parse(await readFile(new URL('../../data/pdf-repository-provenance.json',import.meta.url),'utf8'));
  const report=await auditPdfRepositories(provenance);
  await mkdir('.wrangler',{recursive:true});
  await writeFile('.wrangler/pdf-repository-audit.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.counts));
  if(process.env.GITHUB_REPOSITORY&&process.env.GITHUB_SHA&&process.env.GITHUB_TOKEN){
    let sourceSha=process.env.GITHUB_SHA;
    if(process.env.GITHUB_EVENT_PATH){
      const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
      sourceSha=event.pull_request?.head?.sha||sourceSha;
    }
    const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?per_page=30`,{
      headers:{authorization:'Bearer '+process.env.GITHUB_TOKEN,accept:'application/vnd.github+json'},
      signal:AbortSignal.timeout(15000)
    });
    if(response.ok){
      const data=await response.json();
      console.log('RELATED_WORKFLOWS '+JSON.stringify((data.workflow_runs||[]).map(run=>({id:run.id,name:run.name,sha:run.head_sha,status:run.status,conclusion:run.conclusion}))));
    }
  }
  // Missing repositories are explicit per-row outcomes. Rate/network failure must not masquerade as a successful audit.
  if(!report.results.some(row=>row.status==='source-verified')) process.exitCode=1;
}
