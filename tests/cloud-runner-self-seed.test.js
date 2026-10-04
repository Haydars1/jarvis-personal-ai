import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('OIDC cloud runner can request a bounded skill-learning batch before claiming work',()=>{
  const seeding=read('src/application/capabilities/skill-seeding.js');
  assert.match(seeding,/\/api\/tools\/cloud\/runner\/seed-learning/);
  assert.match(seeding,/queueSkillLearningBatch/);
  assert.match(seeding,/Math\.min\(8/);
  assert.match(seeding,/verifyRunnerJwt/);
});

test('skill seeding middleware is composed into the Worker tool stack',()=>{
  const app=read('src/app-entry.js');
  assert.match(app,/createSkillSeeding/);
  assert.match(app,/createCloudCapabilityExecution\(capabilityCore\)/);
  assert.match(app,/createYouTubeLearningCapability\(createCloudCapabilityExecution\(capabilityCore\)\)/);
  assert.match(app,/createSkillSeeding\(cloudExecutionCore\)/);
});

test('cloud runner seeds learning queue before claiming jobs',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  const seed=runner.indexOf('/api/tools/cloud/runner/seed-learning');
  const claim=runner.indexOf('/api/tools/cloud/runner/claim');
  assert.ok(seed>=0&&claim>seed);
});

test('cloud workflow prints the exact Worker execution summary after a batch',()=>{
  const reporter=read('.github/scripts/cloud-skill-summary.mjs');
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  assert.match(reporter,/\/api\/tools\/skills\/execution-summary/);
  assert.match(reporter,/SKILL_EXECUTION_SUMMARY/);
  assert.match(workflow,/node \.github\/scripts\/cloud-skill-summary\.mjs/);
});

test('self-seeding and summary reporting use existing GitHub OIDC and no paid AI secret',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  const reporter=read('.github/scripts/cloud-skill-summary.mjs');
  assert.doesNotMatch(runner+reporter,/OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY/);
  assert.match(runner,/oidcToken/);
  assert.match(reporter,/oidcToken/);
});

test('cloud runner targets the canonical deployed Worker hostname',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  const reporter=read('.github/scripts/cloud-skill-summary.mjs');
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  const canonical='https://jarvis-personal-ai.haydojarvis.workers.dev';
  const escaped=new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  assert.match(runner,escaped);
  assert.match(reporter,escaped);
  assert.match(workflow,escaped);
  assert.doesNotMatch(runner+reporter+workflow,/https:\/\/haydojarvis\.workers\.dev/);
});
