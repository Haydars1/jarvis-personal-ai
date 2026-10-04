import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditPdfRepositories } from '../.github/scripts/audit-pdf-repositories.mjs';

const SHA='b'.repeat(40);

test('falls back from cross-repository API 403 to immutable git/raw source evidence', async()=>{
  const requests=[];
  const fetchImpl=async(url,options={})=>{
    requests.push({url:String(url),headers:options.headers||{}});
    if(String(url).startsWith('https://api.github.com/')) return {ok:false,status:403};
    if(String(url)===`https://raw.githubusercontent.com/example/tool/${SHA}/README.md`){
      return {ok:true,status:200,text:async()=> 'Pinned documentation'};
    }
    return {ok:false,status:404,text:async()=>''};
  };
  const gitProbe=async repo=>({canonical_repo:repo,default_branch:'main',source_commit:SHA});
  const report=await auditPdfRepositories({'example/tool':['guide.pdf']},{fetchImpl,token:'repo-scoped-token',gitProbe,concurrency:1});
  const row=report.results[0];
  assert.equal(row.status,'source-verified');
  assert.equal(row.evidence_source,'git-raw-fallback');
  assert.equal(row.source_commit,SHA);
  assert.equal(row.readme_path,'README.md');
  assert.equal(row.readme_sha256,createHash('sha256').update('Pinned documentation').digest('hex'));
  assert.equal(requests.some(item=>item.url.includes('raw.githubusercontent.com')&&String(item.headers.authorization||'').length>0),false);
});

test('uses a pinned tracked source file when a repository has no README', async()=>{
  const fetchImpl=async url=>{
    if(String(url).startsWith('https://api.github.com/')) return {ok:false,status:403};
    return {ok:false,status:404,text:async()=>''};
  };
  const gitProbe=async repo=>({canonical_repo:repo,default_branch:'main',source_commit:SHA});
  const sourceProbe=async(repo,sha)=>({path:'src/main.c',text:'int main(void){return 0;}'});
  const report=await auditPdfRepositories({'example/no-readme':['guide.pdf']},{fetchImpl,token:'repo-scoped-token',gitProbe,sourceProbe,concurrency:1});
  const row=report.results[0];
  assert.equal(row.status,'source-verified');
  assert.equal(row.evidence_source,'git-source-fallback');
  assert.equal(row.source_commit,SHA);
  assert.equal(row.source_evidence_path,'src/main.c');
  assert.equal(row.source_evidence_sha256,createHash('sha256').update('int main(void){return 0;}').digest('hex'));
  assert.equal(row.readme_error,'README_NOT_FOUND');
});

test('falls back to pinned source evidence when GitHub metadata works but README is 404', async()=>{
  const fetchImpl=async url=>{
    const value=String(url);
    if(value==='https://api.github.com/repos/example/no-readme')return {ok:true,status:200,json:async()=>({full_name:'example/no-readme',default_branch:'main',license:{spdx_id:'MIT'},archived:false,language:'C'})};
    if(value==='https://api.github.com/repos/example/no-readme/commits/main')return {ok:true,status:200,json:async()=>({sha:SHA})};
    if(value===`https://api.github.com/repos/example/no-readme/readme?ref=${SHA}`)return {ok:false,status:404};
    if(value.startsWith('https://raw.githubusercontent.com/'))return {ok:false,status:404,text:async()=>''};
    throw new Error('UNEXPECTED_URL '+value);
  };
  const gitProbe=async repo=>({canonical_repo:repo,default_branch:'main',source_commit:SHA});
  const sourceProbe=async()=>({path:'app.py',text:'print("verified")'});
  const report=await auditPdfRepositories({'example/no-readme':['guide.pdf']},{fetchImpl,token:'repo-scoped-token',gitProbe,sourceProbe,concurrency:1});
  const row=report.results[0];
  assert.equal(row.status,'source-verified');
  assert.equal(row.evidence_source,'git-source-fallback');
  assert.equal(row.source_evidence_path,'app.py');
  assert.equal(row.source_commit,SHA);
});

test('does not masquerade failed API and git fallback as successful audit', async()=>{
  const fetchImpl=async()=>({ok:false,status:403});
  const gitProbe=async()=>{throw new Error('GIT_SOURCE_UNAVAILABLE');};
  const report=await auditPdfRepositories({'missing/repo':['guide.pdf']},{fetchImpl,token:'repo-scoped-token',gitProbe,concurrency:1});
  const row=report.results[0];
  assert.equal(row.status,'unavailable');
  assert.match(row.error,/GIT_SOURCE_UNAVAILABLE/);
  assert.equal(report.counts['source-verified']||0,0);
});
