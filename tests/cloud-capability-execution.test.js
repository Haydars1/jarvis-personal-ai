import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');

test('general capability pool is not auto-synced onto the user laptop',()=>{
  const bridge=read('local-bridge/ecu-bridge.mjs');
  assert.doesNotMatch(bridge,/syncSourcePool\(/);
  assert.doesNotMatch(bridge,/source_pool:/);
});

test('cloud execution queue exists in schema',()=>{
  const schema=read('schema.sql');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS cloud_tool_jobs/);
  assert.match(schema,/adapter_id TEXT NOT NULL/);
});

test('cloud runner workflow uses GitHub hosted Linux with OIDC',()=>{
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  assert.match(workflow,/runs-on: ubuntu-latest/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/id-token: write/);
  assert.doesNotMatch(workflow,/self-hosted/);
});

test('cloud runner clones only the requested curated repository',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.match(runner,/git/);
  assert.match(runner,/clone/);
  assert.match(runner,/job\.repo/);
  assert.doesNotMatch(runner,/sourcePoolSeeds/);
});

test('cloud runner never accepts raw shell command from job payload',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.doesNotMatch(runner,/job\.command/);
  assert.match(runner,/adapter_id/);
  assert.match(runner,/ALLOWED_ADAPTERS/);
});
