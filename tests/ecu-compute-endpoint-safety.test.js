import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

function dbWithLocal(endpoint) {
  return {
    prepare() {
      return {
        async first() {
          return { endpoint, last_seen_at: Date.now(), expires_at: Date.now() + 60_000 };
        },
      };
    },
  };
}

test('dispatch never fetches an unsafe local endpoint from worker registry', async () => {
  let fetched = false;
  const dispatch = createComputeDispatch({
    fetchImpl: async () => {
      fetched = true;
      return new Response('{}', { status: 200 });
    },
  });

  const result = await dispatch(
    { id: 'job-1', runFingerprint: 'fp', artifactSha256: 'a'.repeat(64), artifactUri: 'r2://ecu-artifacts/ori.bin' },
    { DB: dbWithLocal('https://127.0.0.1/jobs'), ECU_COMPUTE_TOKEN: 'configured' },
  );

  assert.equal(fetched, false);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT');
});

test('routing status treats an unsafe registered local endpoint as unavailable', async () => {
  const dispatch = createComputeDispatch();
  const status = await dispatch.getRoutingStatus({
    DB: dbWithLocal('https://localhost/jobs'),
    ECU_COMPUTE_TOKEN: 'configured',
  });

  assert.equal(status.local.state, 'unavailable');
  assert.equal(status.computeAvailable, false);
  assert.equal(status.preferredWorkerKind, null);
});

test('dispatch rejects worker endpoints containing URL credentials', async () => {
  let fetched = false;
  const dispatch = createComputeDispatch({
    fetchImpl: async () => {
      fetched = true;
      return new Response('{}', { status: 200 });
    },
  });

  const result = await dispatch(
    { id: 'job-2', runFingerprint: 'fp-2', artifactSha256: 'b'.repeat(64), artifactUri: 'r2://ecu-artifacts/ori.bin' },
    { DB: dbWithLocal('https://attacker:password@worker.example.com/jobs'), ECU_COMPUTE_TOKEN: 'configured' },
  );

  assert.equal(fetched, false);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT');
});

test('dispatch rejects ambiguous worker endpoints with query or fragment data', async () => {
  for (const endpoint of ['https://worker.example.com/jobs?next=https://127.0.0.1/jobs', 'https://worker.example.com/jobs#internal']) {
    let fetched = false;
    const dispatch = createComputeDispatch({
      fetchImpl: async () => {
        fetched = true;
        return new Response('{}', { status: 200 });
      },
    });

    const result = await dispatch(
      { id: 'job-3', runFingerprint: 'fp-3', artifactSha256: 'c'.repeat(64), artifactUri: 'r2://ecu-artifacts/ori.bin' },
      { DB: dbWithLocal(endpoint), ECU_COMPUTE_TOKEN: 'configured' },
    );

    assert.equal(fetched, false, endpoint);
    assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT', endpoint);
  }
});
