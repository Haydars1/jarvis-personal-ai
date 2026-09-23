import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

test('external ECU dispatch refuses HTTP redirects', async () => {
  let seenInit = null;
  const dispatch = createComputeDispatch({
    fetchImpl: async (_url, init) => {
      seenInit = init;
      if (init.redirect !== 'error') throw new Error('redirects must be disabled');
      return new Response(JSON.stringify({ accepted: true }), { status: 202 });
    },
  });

  const result = await dispatch(
    {
      id: 'job-redirect-safety',
      runFingerprint: 'f'.repeat(64),
      artifactSha256: 'a'.repeat(64),
      artifactUri: 'r2://ecu-artifacts/originals/' + 'a'.repeat(64),
      operation: 'analyze',
    },
    { ECU_CLOUD_WORKER_URL: 'https://worker.example.com/jobs', ECU_COMPUTE_TOKEN: 'secret' },
  );

  assert.equal(result.accepted, true);
  assert.equal(seenInit.redirect, 'error');
});
