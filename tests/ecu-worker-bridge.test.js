import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function request(path, init = {}) { return new Request(`https://jarvis.test${path}`, init); }
function coreFallback() { return { async fetch(){ return new Response('core',{status:299}); } }; }

test('compute worker can pull immutable artifact only with bearer token', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async readOriginal(_env, sha) {
      assert.equal(sha, 'a'.repeat(64));
      return Uint8Array.from([1,2,3,4]);
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };

  let response = await runtime.fetch(request('/api/ecu/internal/artifacts/' + 'a'.repeat(64)), env, {});
  assert.equal(response.status, 401);

  response = await runtime.fetch(request('/api/ecu/internal/artifacts/' + 'a'.repeat(64), {
    headers: { authorization: 'Bearer secret-token' },
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3,4]);
});

test('compute worker callback persists analysis result through injected result writer', async () => {
  const writes = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async applyWorkerResult(_env, jobId, body) {
      writes.push([jobId, body]);
      return { id: jobId, state: body.status };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const body = {
    status: 'NEEDS_REVIEW',
    run_fingerprint: 'f'.repeat(64),
    ecu_family: 'EDC17C46',
    confidence: 0.95,
    supported: true,
    hw_candidates: [{ value: '0281012345' }],
    sw_candidates: [{ value: '1037512345' }],
    evidence: [{ kind: 'fingerprint', text: 'explicit marker: EDC17C46' }],
    map_candidates: [{ offset: 128, rows: 8, cols: 8, data_type: 'u16', endian: 'big', score: 0.91 }],
  };

  let response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
    body: JSON.stringify(body),
  }), env, {});
  assert.equal(response.status, 401);

  response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' },
    body: JSON.stringify(body),
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'job-1');
  assert.equal(writes[0][1].ecu_family, 'EDC17C46');
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'NEEDS_REVIEW' } });
});

test('compute worker can mark a dispatched job running before analysis', async () => {
  const writes = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async applyWorkerState(_env, jobId, body) {
      writes.push([jobId, body]);
      return { id: jobId, state: body.state };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' },
    body: JSON.stringify({ state: 'RUNNING', workerKind: 'cloud' }),
  }), env, {});

  assert.equal(response.status, 200);
  assert.deepEqual(writes, [['job-1', { state: 'RUNNING', workerKind: 'cloud' }]]);
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'RUNNING' } });
});
