import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { retryDelay, runCloudRunnerAttempt } from '../.github/scripts/cloud-tool-runner-supervisor.mjs';

const supervisor=readFileSync(new URL('../.github/scripts/cloud-tool-runner-supervisor.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/cloud-tool-runner.yml',import.meta.url),'utf8');

test('cloud runner attempts are bounded by a hard timeout',()=>{
  assert.match(supervisor,/AbortSignal\.timeout\(ATTEMPT_TIMEOUT_MS\)/);
});

test('cloud runner restarts use bounded exponential backoff',()=>{
  assert.equal(retryDelay(1),2000);
  assert.equal(retryDelay(2),4000);
  assert.equal(retryDelay(3),8000);
  assert.equal(retryDelay(10),30000);
});

test('a failed runner process is returned as a retryable supervisor result',async()=>{
  const result=await runCloudRunnerAttempt({spawnImpl:()=>{
    const child=new EventEmitter();
    queueMicrotask(()=>child.emit('exit',1,null));
    return child;
  }});
  assert.deepEqual(result,{ok:false,code:1,signal:null,error:null});
});

test('a runner spawn failure is isolated instead of crashing the supervisor',async()=>{
  const result=await runCloudRunnerAttempt({spawnImpl:()=>{throw new Error('temporary spawn failure');}});
  assert.equal(result.ok,false);
  assert.match(result.error,/temporary spawn failure/);
});

test('workflow executes the resilience supervisor with restart controls',()=>{
  assert.match(workflow,/cloud-tool-runner-supervisor\.mjs/);
  assert.match(workflow,/JARVIS_CLOUD_RUNNER_RESTARTS:\s*'3'/);
  assert.match(workflow,/JARVIS_CLOUD_ATTEMPT_TIMEOUT_MS:\s*'1200000'/);
  assert.doesNotMatch(workflow,/run:\s*node \.github\/scripts\/cloud-tool-runner\.mjs/);
});
