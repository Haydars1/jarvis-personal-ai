import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

const unsafe = [
  'https://localhost/jobs',
  'https://127.0.0.1/jobs',
  'https://0.0.0.0/jobs',
  'https://10.0.0.5/jobs',
  'https://100.64.0.1/jobs',
  'https://100.127.255.254/jobs',
  'https://192.168.1.5/jobs',
  'https://172.16.0.5/jobs',
  'https://169.254.169.254/jobs',
  'https://224.0.0.1/jobs',
  'https://255.255.255.255/jobs',
  'https://worker.local/jobs',
];

test('configured local worker URL cannot route to private, link-local, shared, multicast, or reserved hosts', async () => {
  for (const url of unsafe) {
    let called = false;
    const dispatch = createComputeDispatch({ fetchImpl: async () => { called = true; return new Response('{}', { status: 202 }); } });
    const env = { ECU_COMPUTE_TOKEN: 'secret', ECU_LOCAL_WORKER_ONLINE: '1', ECU_LOCAL_WORKER_URL: url };
    const status = await dispatch.getRoutingStatus(env);
    assert.equal(status.local.state, 'unavailable', url);
    assert.equal(status.computeAvailable, false, url);
    const result = await dispatch({ id: 'job-1', runFingerprint: 'fp', operation: 'analyze' }, env);
    assert.equal(result.accepted, false, url);
    assert.equal(result.reason, 'NO_COMPUTE_ENDPOINT', url);
    assert.equal(called, false, url);
  }
});

test('configured local worker URL must be https and end in /jobs', async () => {
  for (const url of ['http://worker.example.com/jobs', 'https://worker.example.com/health']) {
    const dispatch = createComputeDispatch({ fetchImpl: async () => new Response('{}', { status: 202 }) });
    const status = await dispatch.getRoutingStatus({ ECU_COMPUTE_TOKEN: 'secret', ECU_LOCAL_WORKER_ONLINE: '1', ECU_LOCAL_WORKER_URL: url });
    assert.equal(status.local.state, 'unavailable', url);
    assert.equal(status.computeAvailable, false, url);
  }
});
