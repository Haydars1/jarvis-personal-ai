import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('OIDC cloud runner can request a bounded skill-learning batch before claiming work',()=>{
  const runtime=read('src/application/capabilities/cloud-execution.js');
  assert.match(runtime,/\/api\/tools\/cloud\/runner\/seed-learning/);
  assert.match(runtime,/queueSkillLearningBatch/);
  assert.match(runtime,/Math\.min\(8/);
});

test('cloud runner seeds learning queue before claiming jobs',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  const seed=runner.indexOf('/api/tools/cloud/runner/seed-learning');
  const claim=runner.indexOf('/api/tools/cloud/runner/claim');
  assert.ok(seed>=0&&claim>seed);
});

test('self-seeding uses existing GitHub OIDC and no paid AI secret',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.doesNotMatch(runner,/OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY/);
  assert.match(runner,/oidcToken/);
});
