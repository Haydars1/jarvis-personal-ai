import { fetchWithTimeout } from '../../lib/runtime.js';

const API='https://api.github.com';
const PERMISSIVE=new Set(['mit','apache-2.0','bsd-2-clause','bsd-3-clause','isc','0bsd','unlicense']);
const COPYLEFT=new Set(['gpl-2.0','gpl-3.0','agpl-3.0','lgpl-2.1','lgpl-3.0','mpl-2.0']);

export const DEFAULT_GITHUB_ECU_QUERIES=Object.freeze([
  'ECU binary tuning map checksum language:Python',
  'EDC17 MED17 checksum ECU',
  'ECU binary map detection calibration',
  'A2L XDF ECU calibration parser',
]);

export const DEFAULT_GITHUB_ECU_SEEDS=Object.freeze([
  'v-arapidis/openremap-core',
  'ConnorHowell/medc17-checksum-tool',
  'LeZed97/ZedSuite',
  'CAATZ/bimmerstein-bin-analyzer',
]);

function headers(env={}){
  const out={
    accept:'application/vnd.github+json',
    'user-agent':'JARVIS-ECU-Research/1.0',
    'x-github-api-version':'2022-11-28',
  };
  const token=String(env.GITHUB_TOKEN||env.GH_TOKEN||'').trim();
  if(token)out.authorization=`Bearer ${token}`;
  return out;
}

async function gh(env,path,timeout=7000){
  const response=await fetchWithTimeout(`${API}${path}`,{headers:headers(env)},timeout);
  if(!response.ok)throw new Error(`GITHUB_${response.status}`);
  return response.json();
}

function licensePolicy(spdx=''){
  const id=String(spdx||'').trim().toLowerCase();
  if(PERMISSIVE.has(id))return {license:id||'unknown',reuse:'ADAPT_WITH_ATTRIBUTION',trust:0.9};
  if(COPYLEFT.has(id))return {license:id,reuse:'ARCHITECTURE_ONLY',trust:0.82};
  return {license:id||'unknown',reuse:'REVIEW_REQUIRED',trust:0.72};
}

function decodeBase64(value=''){
  try{
    const raw=atob(String(value||'').replace(/\s+/g,''));
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }catch{return '';}
}

function relevantPath(path=''){
  const p=String(path).toLowerCase();
  if(!p||/\.(png|jpe?g|gif|ico|bin|hex|zip|7z|rar|exe|dll|so|dylib|pdf)$/i.test(p))return false;
  if(/(^|\/)(node_modules|target|dist|build|vendor)\//.test(p))return false;
  return /readme|checksum|map|patch|diff|tune|recipe|identify|fingerprint|extract|a2l|asap2|xdf|damos|winols|calibr|ecu|dtc|edc|med17|md1|mg1/.test(p);
}

function sourceRow(repo,path,text,policy){
  const title=`${repo.full_name}: ${path}`;
  const branch=repo.default_branch||'main';
  const url=`https://github.com/${repo.full_name}/blob/${branch}/${path}`;
  const header=[
    `Repository: ${repo.full_name}`,
    `License: ${policy.license}`,
    `Reuse policy: ${policy.reuse}`,
    `Stars: ${Number(repo.stargazers_count||0)}`,
    `File: ${path}`,
  ].join(' | ');
  return {
    title,
    url,
    snippet:`${header}\n\n${String(text||'').slice(0,12000)}`,
    source:'GitHub',
    sourceKind:'code',
    trustScore:policy.trust,
    github:{
      repository:repo.full_name,
      path,
      license:policy.license,
      reuse:policy.reuse,
      stars:Number(repo.stargazers_count||0),
    },
  };
}

async function repoMeta(env,fullName){
  return gh(env,`/repos/${encodeURIComponent(fullName)}`);
}

async function repoReadme(env,repo){
  try{
    const body=await gh(env,`/repos/${repo.full_name}/readme`);
    const text=decodeBase64(body.content||'');
    return text?sourceRow(repo,body.path||'README.md',text,licensePolicy(repo.license?.spdx_id)):null;
  }catch{return null;}
}

async function repoTreeRows(env,repo,{maxFiles=2}={}){
  const branch=encodeURIComponent(repo.default_branch||'main');
  let tree;
  try{tree=await gh(env,`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`,8000);}catch{return [];}
  const candidates=(tree.tree||[])
    .filter(item=>item.type==='blob'&&Number(item.size||0)>0&&Number(item.size||0)<=160000&&relevantPath(item.path))
    .filter(item=>!/readme/i.test(item.path))
    .sort((a,b)=>{
      const score=p=>/checksum|patch|diff|recipe|tune|identify|fingerprint|map/.test(String(p).toLowerCase())?0:1;
      return score(a.path)-score(b.path)||Number(a.size||0)-Number(b.size||0);
    })
    .slice(0,maxFiles);
  const rows=[];
  for(const item of candidates){
    try{
      const body=await gh(env,`/repos/${repo.full_name}/contents/${item.path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`);
      const text=decodeBase64(body.content||'');
      if(text)rows.push(sourceRow(repo,item.path,text,licensePolicy(repo.license?.spdx_id)));
    }catch{}
  }
  return rows;
}

async function searchRepos(env,query,perPage=2){
  const q=encodeURIComponent(String(query||''));
  const payload=await gh(env,`/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.max(1,Math.min(5,perPage))}`);
  return Array.isArray(payload.items)?payload.items:[];
}

export async function discoverGitHubEcuSources(env,{
  queries=DEFAULT_GITHUB_ECU_QUERIES,
  seeds=DEFAULT_GITHUB_ECU_SEEDS,
  reposPerQuery=2,
  filesPerRepo=2,
  maxRepos=10,
}={}){
  const repos=new Map();
  for(const seed of seeds){
    if(repos.size>=maxRepos)break;
    try{
      const repo=await repoMeta(env,seed);
      if(repo?.full_name&&!repo.archived)repos.set(repo.full_name,repo);
    }catch{}
  }
  for(const query of queries){
    if(repos.size>=maxRepos)break;
    try{
      for(const repo of await searchRepos(env,query,reposPerQuery)){
        if(repos.size>=maxRepos)break;
        if(repo?.full_name&&!repo.archived)repos.set(repo.full_name,repo);
      }
    }catch{}
  }

  const rows=[];
  for(const repo of repos.values()){
    const readme=await repoReadme(env,repo);
    if(readme)rows.push(readme);
    rows.push(...await repoTreeRows(env,repo,{maxFiles:filesPerRepo}));
  }
  return rows;
}
