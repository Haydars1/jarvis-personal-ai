import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RECOMMENDED_SKILLS,suggestSkillsForTask} from '../src/lib/agent-hub-skill-matcher.js';
test('6006 SEO task suggests web review without execution',()=>{
 const skills=suggestSkillsForTask('6006 web sitesinin SEO ve erişilebilirlik sorununu düzelt');
 assert.equal(skills[0].path,'skills/web-design-guidelines/SKILL.md');
 assert.ok(skills.every(s=>s.auto_install===false&&s.execution==='preview-only'));
});
test('React and PDF tasks suggest matching actual skill paths',()=>{
 assert.ok(suggestSkillsForTask('React performans problemi').some(s=>s.path==='skills/react-best-practices/SKILL.md'));
 assert.ok(suggestSkillsForTask('PDF rapor incele').some(s=>s.path==='skills/pdf/SKILL.md'));
 assert.deepEqual(suggestSkillsForTask(''),[]);
 assert.ok(RECOMMENDED_SKILLS.every(s=>s.repo&&s.path.endsWith('SKILL.md')));
});
test('Cloudflare and security tasks match verified upstream agent skills',()=>{
 const cloud=suggestSkillsForTask('Cloudflare Workers D1 görevleri için agent hub geliştir',{limit:8});
 assert.ok(cloud.some(s=>s.repo==='cloudflare/skills'&&s.path==='skills/workers-best-practices/SKILL.md'));
 const security=suggestSkillsForTask('MCP plugin güvenlik kod incele',{limit:8});
 assert.ok(security.some(s=>s.path==='skills/mcp-implementation-security-review/SKILL.md'));
 assert.ok(security.every(s=>s.execution==='preview-only'&&!s.auto_install));
});
test('authenticated API and Turkish UI expose task-based recommendations',()=>{
 const api=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 assert.match(api,/\/api\/tools\/agent-hub\/skill-suggest/);
 assert.match(api,/suggestSkillsForTask\(task\)/);
 assert.match(ui,/hubSuggestSkills/);
 assert.match(ui,/hubSuggestedSkills/);
});
