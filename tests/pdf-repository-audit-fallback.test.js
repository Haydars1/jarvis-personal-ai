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

test('does not masquerade failed API and git fallback as successful audit', async()=>{
  const fetchImpl=async()=>({ok:false,status:403});
  const gitProbe=async()=>{throw new Error('GIT_SOURCE_UNAVAILABLE');};
  const report=await auditPdfRepositories({'missing/repo':['guide.pdf']},{fetchImpl,token:'repo-scoped-token',gitProbe,concurrency:1});
  const row=report.results[0];
  assert.equal(row.status,'unavailable');
  assert.match(row.error,/GIT_SOURCE_UNAVAILABLE/);
  assert.equal(report.counts['source-verified']||0,0);
});
