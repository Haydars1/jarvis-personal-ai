import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

const unsafeMappedEndpoints = [
  'https://[::ffff:127.0.0.1]/jobs',
  'https://[::ffff:10.0.0.1]/jobs',
  'https://[::ffff:192.168.1.10]/jobs',
  'https://[::ffff:169.254.169.254]/jobs',
  'https://[::ffff:172.16.0.1]/jobs',
];

test('compute routing rejects IPv4-mapped IPv6 private and link-local endpoints', async () => {
  for (const endpoint of unsafeMappedEndpoints) {
    let fetchCalls = 0;
    const dispatch = createComputeDispatch({
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      },
    });
    const env = {
      ECU_COMPUTE_TOKEN: 'test-token',
      ECU_LOCAL_WORKER_ONLINE: '1',
      ECU_LOCAL_WORKER_URL: endpoint,
    };

    const status = await dispatch.getRoutingStatus(env);
    assert.equal(status.local.state, 'unavailable', endpoint);
    assert.equal(status.computeAvailable, false, endpoint);

    const result = await dispatch({ id: 'job-1', runFingerprint: 'fp-1' }, env);
    assert.equal(result.accepted, false, endpoint);
    assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT', endpoint);
    assert.equal(fetchCalls, 0, endpoint);
  }
});
