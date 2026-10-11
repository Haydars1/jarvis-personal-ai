import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 APPROVED_SKILL_REPOS, validSkillManifestPath, discoverSkillManifests, previewSkillManifest
} from '../src/lib/agent-hub-skill-directory.js';

test('rejects paths outside read-only approved skill repositories',async()=>{
 assert.deepEqual(APPROVED_SKILL_REPOS,['anthropics/skills','vercel-labs/skills']);
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
