import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRegisteredWorkerEndpoint } from '../src/infrastructure/ecu/worker-endpoint-safety.js';

test('worker endpoint validator accepts only unambiguous public HTTPS /jobs endpoints', () => {
  assert.equal(isSafeRegisteredWorkerEndpoint('https://worker.example.com/jobs'), true);
  assert.equal(isSafeRegisteredWorkerEndpoint('https://worker.example.com/v1/jobs'), true);

  for (const endpoint of [
    'http://worker.example.com/jobs',
    'https://localhost/jobs',
    'https://127.0.0.1/jobs',
    'https://10.0.0.1/jobs',
    'https://100.64.0.1/jobs',
    'https://169.254.1.1/jobs',
    'https://172.16.0.1/jobs',
    'https://192.168.1.1/jobs',
    'https://224.0.0.1/jobs',
    'https://[::1]/jobs',
    'https://[fc00::1]/jobs',
    'https://[fd00::1]/jobs',
    'https://[fe80::1]/jobs',
    'https://[::ffff:7f00:1]/jobs',
    'https://worker.local/jobs',
    'https://user:pass@worker.example.com/jobs',
    'https://worker.example.com/jobs?target=internal',
    'https://worker.example.com/jobs#fragment',
    'https://worker.example.com/not-jobs',
  ]) {
    assert.equal(isSafeRegisteredWorkerEndpoint(endpoint), false, endpoint);
  }
});
