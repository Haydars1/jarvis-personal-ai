import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skillExecutionState, summarizeExecutionStates } from '../src/application/capabilities/cloud-execution.js';

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

test('repository skills expose truthful execution states',()=>{
  assert.deepEqual(skillExecutionState({}),{
    execution_state:'catalog-only',execution_reason:'NOT_LEARNED'
  });
  assert.deepEqual(skillExecutionState({status:'learned',adapter_status:'unverified'}),{
    execution_state:'learned',execution_reason:'RUNNABLE_ADAPTER_MISSING'
  });
  assert.deepEqual(skillExecutionState({status:'learned',adapter_status:'ready',native_adapter:{id:'device-bridge',lane:'device-bridge'},requires_paid_api:false}),{
    execution_state:'adapter-ready',execution_reason:'RUNTIME_DEVICE_REQUIRED'
  });
  assert.deepEqual(skillExecutionState({status:'learned',adapter_status:'ready',native_adapter:{id:'repo-cloud-tools',lane:'cloud-runner'},requires_paid_api:false}),{
    execution_state:'executable',execution_reason:'VERIFIED_RUNNABLE_ADAPTER'
  });
  assert.deepEqual(skillExecutionState({status:'learned',adapter_status:'ready',native_adapter:null,requires_paid_api:false}),{
    execution_state:'degraded',execution_reason:'READY_ADAPTER_UNRESOLVED'
  });
});

test('execution summary separates catalog, learned, ready, executable and degraded skills',()=>{
  const skills=[
    {status:'learned',adapter_status:'unverified'},
    {status:'learned',adapter_status:'ready',native_adapter:{id:'device-bridge',lane:'device-bridge'}},
    {status:'learned',adapter_status:'ready',native_adapter:{id:'repo-cloud-tools',lane:'cloud-runner'}},
    {status:'learned',adapter_status:'ready',native_adapter:null}
  ];
  assert.deepEqual(summarizeExecutionStates(skills,6,3),{
    curated_repositories:6,
    learned_skills:4,
    catalog_only:2,
    adapter_ready:1,
    executable:1,
    degraded:1,
    recently_successful_executions:3
  });
});

test('worker exposes authenticated execution summary endpoint',()=>{
  const source=read('src/application/capabilities/cloud-execution.js');
  assert.match(source,/\/api\/tools\/skills\/execution-summary/);
  assert.match(source,/summarizeExecutionStates/);
});
