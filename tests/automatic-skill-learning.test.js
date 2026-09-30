import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectSkillLearningRepos } from '../src/lib/skill-learning.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('automatic learner selects only repos not already learned or pending',()=>{
  const curated=['a/one','b/two','c/three','d/four'];
  const selected=selectSkillLearningRepos(curated,new Set(['b/two']),new Set(['c/three']),3);
  assert.deepEqual(selected,['a/one','d/four']);
});

test('automatic learner is deterministic and bounded',()=>{
  const selected=selectSkillLearningRepos(['z/z','a/a','m/m','b/b'],new Set(),new Set(),2);
  assert.deepEqual(selected,['a/a','b/b']);
});

test('cloud capability scheduled handler queues repository skill learning',()=>{
  const source=read('src/application/capabilities/cloud-execution.js');
  assert.match(source,/queueSkillLearningBatch/);
  assert.match(source,/scheduled\(event,env,ctx\)/);
  assert.match(source,/skill-analyze/);
});

test('cloud runner processes more than one queued skill job per run',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.match(runner,/MAX_JOBS/);
  assert.match(runner,/for\s*\(/);
  assert.match(runner,/No more queued cloud tool jobs/);
});

test('automatic repository learning needs no third-party AI credential',()=>{
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  assert.doesNotMatch(workflow,/OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY/);
  assert.match(workflow,/id-token: write/);
});
