import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

function localDb(endpoint = 'https://local-worker.example/jobs') {
  return {
    prepare() {
      return {
        async first() {
          return { endpoint, last_seen_at: 1_000, expires_at: 120_000 };
        },
      };
    },
  };
}

test('routing health never advertises usable compute when compute auth is missing', async () => {
  const dispatch = createComputeDispatch({ now: () => 60_000 });
  const status = await dispatch.getRoutingStatus({
    DB: localDb(),
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
  });

  assert.equal(status.computeTokenConfigured, false);
  assert.equal(status.computeAvailable, false);
  assert.equal(status.preferredWorkerKind, null);
  assert.equal(status.local.state, 'unavailable');
});

test('routing health advertises local compute only when auth and a live route are both present', async () => {
  const dispatch = createComputeDispatch({ now: () => 60_000 });
  const status = await dispatch.getRoutingStatus({
    DB: localDb(),
    ECU_COMPUTE_TOKEN: 'configured-secret',
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
  });

  assert.equal(status.computeTokenConfigured, true);
  assert.equal(status.computeAvailable, true);
  assert.equal(status.preferredWorkerKind, 'local');
  assert.equal(status.local.state, 'healthy');
  assert.equal(JSON.stringify(status).includes('configured-secret'), false);
  assert.equal(JSON.stringify(status).includes('local-worker.example'), false);
});

test('routing health is safe to expose through JARVIS status without endpoint or credential leakage', async () => {
  const dispatch = createComputeDispatch({ now: () => 60_000 });
  const status = await dispatch.getRoutingStatus({
    DB: localDb('https://private-laptop-tunnel.example/jobs'),
    ECU_COMPUTE_TOKEN: 'super-secret-compute-token',
    ECU_CLOUD_WORKER_URL: 'https://private-cloud-worker.example/jobs',
  });
  const serialized = JSON.stringify(status);

  assert.equal(Object.hasOwn(status, 'localEndpoint'), false);
  assert.equal(Object.hasOwn(status, 'cloudEndpoint'), false);
  assert.equal(serialized.includes('super-secret-compute-token'), false);
  assert.equal(serialized.includes('private-laptop-tunnel.example'), false);
  assert.equal(serialized.includes('private-cloud-worker.example'), false);
});
