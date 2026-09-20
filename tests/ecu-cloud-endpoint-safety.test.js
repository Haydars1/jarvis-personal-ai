import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

test('cloud worker URL rejects unsafe or malformed endpoints', async () => {
  const unsafe = [
    'http://worker.example.com/jobs',
    'https://localhost/jobs',
    'https://127.0.0.1/jobs',
    'https://10.0.0.5/jobs',
    'https://192.168.1.10/jobs',
    'https://172.16.0.1/jobs',
    'https://169.254.169.254/jobs',
    'https://worker.example.com/not-jobs',
  ];

  for (const ECU_CLOUD_WORKER_URL of unsafe) {
    const dispatch = createComputeDispatch({ fetchImpl: async () => { throw new Error('must not fetch unsafe endpoint'); } });
    const env = { ECU_COMPUTE_TOKEN: 'test-token', ECU_CLOUD_WORKER_URL };
    const status = await dispatch.getRoutingStatus(env);
    assert.equal(status.computeAvailable, false, ECU_CLOUD_WORKER_URL);
    assert.equal(status.preferredWorkerKind, null, ECU_CLOUD_WORKER_URL);
    const result = await dispatch({ id: 'job-1', runFingerprint: 'fp-1' }, env);
    assert.equal(result.accepted, false, ECU_CLOUD_WORKER_URL);
    assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT', ECU_CLOUD_WORKER_URL);
  }
});

test('cloud worker URL accepts a public HTTPS jobs endpoint', async () => {
  let called = false;
  const dispatch = createComputeDispatch({
    fetchImpl: async url => {
      called = true;
      assert.equal(url, 'https://ecu-worker.example.com/jobs');
      return new Response(JSON.stringify({ accepted: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'test-token', ECU_CLOUD_WORKER_URL: 'https://ecu-worker.example.com/jobs' };
  const status = await dispatch.getRoutingStatus(env);
  assert.equal(status.computeAvailable, true);
  assert.equal(status.preferredWorkerKind, 'cloud');
  const result = await dispatch({ id: 'job-1', runFingerprint: 'fp-1' }, env);
  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'cloud');
  assert.equal(called, true);
});
