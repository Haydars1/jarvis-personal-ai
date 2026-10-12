import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewSourceFile } from '../src/lib/agent-hub-source-audit.js';
import { createAgentPlan } from '../src/lib/agent-hub-workflow.js';
test('website audit emits actionable bounded file-and-line findings',()=>{
 const html='<html><head></head><body>\n<img src="hero.png">\n<a target="_blank" href="https://example.com">Open</a>\n</body></html>';
 const result=reviewSourceFile('public/index.html',html);
 assert.ok(result.some(f=>f.rule==='img-alt'&&f.line===2));
 assert.ok(result.some(f=>f.rule==='blank-target'&&f.line===3));
 assert.ok(result.some(f=>f.rule==='document-title'));
 assert.ok(result.every(f=>f.file==='public/index.html'&&f.line>=1));
});
test('audit never evaluates source code, secrets or unknown formats',()=>{
 assert.deepEqual(reviewSourceFile('file.sh','<img src="x">'),[]);
 assert.deepEqual(reviewSourceFile('large.html','a'.repeat(250001)),[]);
 assert.equal(reviewSourceFile('public/main.js','debugger;', {limit:1}).length,1);
});
test('web tasks automatically include safe audit after skill inspection',()=>{
 const curated=new Set(['owner/site']);
 const plan=createAgentPlan({repo:'owner/site',task:'6006 web sitesi SEO ve tasarım sorunları'},curated);
 assert.deepEqual(plan.steps.map(s=>s.adapter_id),['repo-inspect','source-search','skill-analyze','source-audit']);
 assert.ok(plan.steps[3].input.skill_references.includes('skills/web-design-guidelines/SKILL.md'));
 assert.deepEqual(createAgentPlan({repo:'owner/site',task:'ECU upload'},curated).steps.map(s=>s.adapter_id),['repo-inspect','source-search','skill-analyze']);
});
