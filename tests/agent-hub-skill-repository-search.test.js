import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverSkillRepositories} from '../src/lib/agent-hub-skill-repository-search.js';

test('GitHub-wide search discovers repos without claiming installation or verification',async()=>{
 const mock=async(url,options)=>{
  const parsed=new URL(url);
  assert.equal(parsed.hostname,'api.github.com');
  assert.equal(parsed.pathname,'/search/repositories');
  assert.match(parsed.searchParams.get('q'),/agent skills in:name,description,readme archived:false/);
  assert.equal(parsed.searchParams.get('page'),'2');
  assert.equal(options.headers['User-Agent'],'JARVIS-Agent-Hub');
  return {ok:true,json:async()=>({
   total_count:201,incomplete_results:false,
   items:[
    {full_name:'openai/skills',name:'skills',description:'Official skills',stargazers_count:5000},
    {full_name:'random/repo',name:'repo',description:'Unknown community code',stargazers_count:3},
    {full_name:'bad/repo/extra',name:'invalid'}
   ]
  })};
 };
 const result=await discoverSkillRepositories('agent skills',mock,{page:2,limit:2});
 assert.equal(result.results.length,2);
 assert.equal(result.total_reported,201);
 assert.equal(result.results[0].approved_source,true);
 assert.equal(result.results[1].approved_source,false);
 assert.ok(result.results.every(x=>x.installed===false&&x.executable===false&&x.skill_manifest_verified===false));
 assert.equal(result.next_page,3);
 assert.equal(result.auto_install,false);
});
test('invalid repository searches cannot use advanced query operators',async()=>{
 const noNetwork=()=>{throw Error('should not call network')};
 for(const invalid of ['','a','repo:private','a'.repeat(81),'foo\nbar']){
  await assert.rejects(discoverSkillRepositories(invalid,noNetwork),/INVALID_REPOSITORY_SEARCH/);
 }
 await assert.rejects(discoverSkillRepositories('skills',noNetwork,{page:11}),/INVALID_REPOSITORY_PAGE/);
 await assert.rejects(discoverSkillRepositories('skills',noNetwork,{limit:100}),/INVALID_REPOSITORY_PAGE/);
});
test('read-only search is authenticated and available in Cloudflare Agent Hub',()=>{
 const api=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 assert.match(api,/\/api\/tools\/agent-hub\/skill-repository-search/);
 assert.match(ui,/hubSkillRepoSearch/);
 assert.match(ui,/hubSkillRepoMore/);
});
