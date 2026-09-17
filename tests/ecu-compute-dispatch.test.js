import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

function job(overrides = {}) {
  return {
    id: 'job-1',
    runFingerprint: 'f'.repeat(64),
    artifactUri: 'r2://ecu-artifacts/originals/abc',
    artifactSha256: 'a'.repeat(64),
    operation: 'analyze',
    modelVersion: 'baseline',
    rulepackVersion: 'baseline',
    ...overrides,
  };
}

test('prefers an available local worker over cloud compute', async () => {
  const calls = [];
  const dispatch = createComputeDispatch({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_URL: 'https://local-worker.example/jobs',
    ECU_LOCAL_WORKER_ONLINE: '1',
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'local');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://local-worker.example/jobs');
  assert.equal(calls[0].init.headers['idempotency-key'], 'f'.repeat(64));
});

test('falls back to cloud worker when local worker is unavailable', async () => {
  const calls = [];
  const dispatch = createComputeDispatch({
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_URL: 'https://local-worker.example/jobs',
    ECU_LOCAL_WORKER_ONLINE: '0',
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'cloud');
  assert.deepEqual(calls, ['https://cloud-worker.example/jobs']);
});

test('keeps the job recoverable when no worker is configured or dispatch fails', async () => {
  const noEndpoint = createComputeDispatch({ fetchImpl: async () => { throw new Error('should not run'); } });
  assert.deepEqual(await noEndpoint(job(), {}), {
    accepted: false,
    state: 'QUEUED',
    workerKind: null,
    reason: 'NO_COMPUTE_ENDPOINT',
  });

  const broken = createComputeDispatch({ fetchImpl: async () => { throw new Error('offline'); } });
  const result = await broken(job(), { ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs' });
  assert.equal(result.accepted, false);
  assert.equal(result.state, 'QUEUED');
  assert.equal(result.workerKind, 'cloud');
  assert.equal(result.reason, 'DISPATCH_FAILED');
});
