import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('schema persists learned repository skills',()=>{
  const schema=read('schema.sql');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS repo_skills/);
  assert.match(schema,/capabilities_json TEXT NOT NULL/);
  assert.match(schema,/source_commit TEXT/);
  assert.match(schema,/adapter_status TEXT NOT NULL/);
  assert.match(schema,/CREATE INDEX IF NOT EXISTS idx_repo_skills_status/);
});

test('cloud runner has a skill-analyze adapter and never executes repo install scripts to learn a skill',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.match(runner,/'skill-analyze'/);
  assert.match(runner,/compileRepositorySkill/);
  assert.doesNotMatch(runner,/npm install.*job|pip install.*job|setup\.py.*install/);
});

test('cloud execution exposes compile, list and discovery endpoints',()=>{
  const runtime=read('src/application/capabilities/cloud-execution.js');
  assert.match(runtime,/\/api\/tools\/skills\/compile/);
  assert.match(runtime,/\/api\/tools\/skills/);
  assert.match(runtime,/\/api\/tools\/discover/);
  assert.match(runtime,/INSERT INTO repo_skills/);
});

test('skill compilation result is persisted only after a successful cloud job',()=>{
  const runtime=read('src/application/capabilities/cloud-execution.js');
  assert.match(runtime,/skill-analyze/);
  assert.match(runtime,/ok\?'completed':'failed'/);
  assert.match(runtime,/upsertRepositorySkill/);
});
