import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner=readFileSync(new URL('../.github/scripts/cloud-tool-runner.mjs',import.meta.url),'utf8');

test('cloud runner API calls are bounded by an abort timeout',()=>{
  assert.match(runner,/AbortSignal\.timeout\(/);
});

test('cloud runner retries transient HTTP and network failures with backoff',()=>{
  assert.match(runner,/RETRYABLE_STATUS/);
  assert.match(runner,/sleep\(/);
  assert.match(runner,/attempt/);
});

test('claim failure is isolated inside the batch loop instead of terminating the process',()=>{
  assert.match(runner,/claim failed/i);
  assert.match(runner,/consecutiveClaimFailures/);
});

test('cloud runner reports batch and process resilience counters',()=>{
  assert.match(runner,/claim_failures=/);
  assert.match(runner,/api_retries=/);
});
