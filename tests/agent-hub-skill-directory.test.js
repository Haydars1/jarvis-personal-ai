import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 APPROVED_SKILL_REPOS, validSkillManifestPath, discoverSkillManifests, discoverAllSkillManifests, previewSkillManifest
} from '../src/lib/agent-hub-skill-directory.js';

test('rejects paths outside read-only approved skill repositories',async()=>{
 assert.equal(APPROVED_SKILL_REPOS.length,9);
 assert.ok(APPROVED_SKILL_REPOS.includes('anthropics/skills'));
 assert.ok(APPROVED_SKILL_REPOS.includes('openai/skills'));
 assert.ok(APPROVED_SKILL_REPOS.includes('github/awesome-copilot'));
 assert.equal(new Set(APPROVED_SKILL_REPOS).size,APPROVED_SKILL_REPOS.length);
 assert.equal(validSkillManifestPath('skills/pdf/SKILL.md'),true);
 assert.equal(validSkillManifestPath('../SKILL.md'),false);
 assert.equal(validSkillManifestPath('skills/../../SKILL.md'),false);
 assert.equal(validSkillManifestPath('skills/execute.sh'),false);
 assert.equal(validSkillManifestPath('skills/hello?token=x/SKILL.md'),false);
 await assert.rejects(discoverSkillManifests('evil/repo',()=>{throw Error('must not fetch');}),/SOURCE_NOT_APPROVED/);
 await assert.rejects(previewSkillManifest('anthropics/skills','../SKILL.md',()=>{throw Error('must not fetch');}),/INVALID_SKILL_PATH/);
});
test('lists only bounded SKILL.md manifests from GitHub read-only tree',async()=>{
 const fetcher=async url=>{
  assert.equal(url,'https://api.github.com/repos/anthropics/skills/git/trees/main?recursive=1');
  return {ok:true,json:async()=>({tree:[
   {path:'skills/pdf/SKILL.md',type:'blob'},
   {path:'skills/danger/execute.sh',type:'blob'},
   {path:'README.md',type:'blob'},
   {path:'skills/html/SKILL.md',type:'blob'}
  ],truncated:false})};
 };
 const data=await discoverSkillManifests('anthropics/skills',fetcher);
 assert.deepEqual(data.skills.map(x=>x.name),['pdf','html']);
 assert.equal(data.auto_install,false);
});
test('search and paging access skills beyond the old 150-item limit',async()=>{
 const tree=Array.from({length:445},(_,i)=>({path:`skills/topic-${String(i).padStart(3,'0')}/SKILL.md`,type:'blob',sha:'a'.repeat(40)}));
 const fetcher=async()=>({ok:true,json:async()=>({tree,truncated:false})});
 const first=await discoverSkillManifests('github/awesome-copilot',fetcher,{offset:0,limit:150});
 const middle=await discoverSkillManifests('github/awesome-copilot',fetcher,{offset:150,limit:150});
 const last=await discoverSkillManifests('github/awesome-copilot',fetcher,{offset:300,limit:150});
 assert.equal(first.total,445);
 assert.equal(first.skills.length,150);
 assert.equal(first.next_offset,150);
 assert.equal(middle.skills[0].name,'topic-150');
 assert.equal(last.skills.length,145);
 assert.equal(last.has_more,false);
 assert.equal(last.skills.at(-1).name,'topic-444');
 const filtered=await discoverSkillManifests('github/awesome-copilot',fetcher,{query:'TOPIC-444',limit:20});
 assert.equal(filtered.total,1);
 assert.equal(filtered.skills[0].source_blob_sha,'a'.repeat(40));
 assert.equal(filtered.auto_install,false);
 assert.equal(filtered.source_verified,false);
});
test('rejects malformed skill directory pagination and oversized search',async()=>{
 const offline=()=>{throw Error('request must be rejected before network')};
 await assert.rejects(discoverSkillManifests('openai/skills',offline,{limit:1000}),/INVALID_SKILL_PAGE_LIMIT/);
 await assert.rejects(discoverSkillManifests('openai/skills',offline,{offset:-1}),/INVALID_SKILL_PAGE_OFFSET/);
 await assert.rejects(discoverSkillManifests('openai/skills',offline,{query:'x'.repeat(101)}),/INVALID_SKILL_QUERY/);
});
test('cross-source search paginates all approved GitHub skill indexes',async()=>{
 const fetched=[];
 const fetcher=async url=>{
  const name=url.match(/repos\/([^/]+\/[^/]+)\/git\/trees\/main/)?.[1];
  assert.ok(APPROVED_SKILL_REPOS.includes(name));
  fetched.push(name);
  return {ok:true,json:async()=>({tree:[
   {path:'skills/general/SKILL.md',type:'blob',sha:'b'.repeat(40)},
   {path:'skills/cloudflare-workers/SKILL.md',type:'blob',sha:'a'.repeat(40)}
  ],truncated:false})};
 };
 const a=await discoverAllSkillManifests(fetcher,{limit:10});
 assert.equal(a.total,APPROVED_SKILL_REPOS.length*2);
 assert.equal(a.sources_loaded,APPROVED_SKILL_REPOS.length);
 assert.equal(a.partial,false);
 assert.equal(a.auto_install,false);
 assert.equal(a.skills.length,10);
 assert.equal(a.has_more,true);
 const b=await discoverAllSkillManifests(fetcher,{limit:10,offset:10});
 assert.equal(b.skills.length,8);
 assert.equal(b.has_more,false);
 const matching=await discoverAllSkillManifests(fetcher,{query:'cloudflare-workers',limit:20});
 assert.equal(matching.total,APPROVED_SKILL_REPOS.length);
 assert.ok(matching.skills.every(x=>x.path.includes('cloudflare-workers')&&APPROVED_SKILL_REPOS.includes(x.repo)));
 assert.equal(new Set(fetched).size,APPROVED_SKILL_REPOS.length);
});

test('cross-source scan reports GitHub failures rather than claiming missing skills',async()=>{
 const blockedRepo=APPROVED_SKILL_REPOS[2];
 const fetcher=async url=>{
  if(url.includes('/'+blockedRepo+'/'))return {ok:false,status:429};
  return {ok:true,json:async()=>({tree:[{path:'skills/safe/SKILL.md',type:'blob'}],truncated:false})};
 };
 const result=await discoverAllSkillManifests(fetcher);
 assert.equal(result.partial,true);
 assert.equal(result.index_complete,false);
 assert.equal(result.sources_loaded,APPROVED_SKILL_REPOS.length-1);
 assert.deepEqual(result.source_errors.map(x=>x.repo),[blockedRepo]);
 assert.equal(result.total,APPROVED_SKILL_REPOS.length-1);
 await assert.rejects(discoverAllSkillManifests(async()=>({ok:false,status:403})),/SKILL_SOURCES_UNAVAILABLE/);
});

test('Agent Hub UI previews skills from their original repo in all-source search',()=>{
 const src=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 assert.match(src,/allSources\.value='all'/);
 assert.match(src,/encodeURIComponent\(skill\.repo\).*encodeURIComponent\(skill\.path\)/);
 assert.match(src,/hubSkillLearn'\)\.disabled=skillSource\.value==='all'/);
});

test('can preview but never execute approved SKILL.md text',async()=>{
 const preview=await previewSkillManifest('anthropics/skills','skills/pdf/SKILL.md',async url=>{
  assert.equal(url,'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md');
  return {ok:true,headers:{get:()=>null},text:async()=> '# PDF skill\nInstructions are untrusted content'};
 });
 assert.equal(preview.auto_execute,false);
 assert.match(preview.content,/PDF skill/);
});
test('exposes authenticated skills endpoints to existing Cloudflare Worker',()=>{
 const src=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 for (const route of ['/api/tools/agent-hub/catalog','/api/tools/agent-hub/skills-directory','/api/tools/agent-hub/skill-preview']) assert.ok(src.includes(route));
 assert.match(src,/appAuthed\(core,req,env,ctx\)/);
});
