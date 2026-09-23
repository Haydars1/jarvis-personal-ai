import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

test('compute dispatch rejects private and link-local IPv6 worker endpoints', async () => {
  let fetchCalls = 0;
  const dispatch = createComputeDispatch({
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}', { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });

  for (const unsafeUrl of [
    'https://[fd00::1]/jobs',
    'https://[fc00::1234]/jobs',
    'https://[fe80::1]/jobs',
  ]) {
    const env = { ECU_COMPUTE_TOKEN: 'test-token', ECU_CLOUD_WORKER_URL: unsafeUrl };
    const status = await dispatch.getRoutingStatus(env);
    assert.equal(status.computeAvailable, false, unsafeUrl);
    assert.equal(status.preferredWorkerKind, null, unsafeUrl);

    const result = await dispatch({ id: 'job-1', runFingerprint: 'fp-1' }, env);
    assert.equal(result.accepted, false, unsafeUrl);
    assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT', unsafeUrl);
  }

  assert.equal(fetchCalls, 0);
});
