import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuResearch } from '../src/application/ecu/research.js';

function memoryRepository() {
  const buckets = new Set();
  const sources = [];
  const claims = [];
  const runs = [];
  return {
    sources,
    claims,
    runs,
    async claimRunBucket(_env, bucket) {
      if (buckets.has(bucket)) return false;
      buckets.add(bucket);
      runs.push({ bucket, status: 'RUNNING' });
      return true;
    },
    async storeSource(_env, source) { sources.push(source); },
    async storeClaim(_env, claim) { claims.push(claim); },
    async finishRun(_env, bucket, summary) {
      const run = runs.find(item => item.bucket === bucket);
      Object.assign(run, { status: 'COMPLETE', ...summary });
    },
  };
}

test('scheduled research stores provenance as unverified knowledge and deduplicates URLs', async () => {
  const repository = memoryRepository();
  const research = createEcuResearch({
    repository,
    topics: ['EDC17C46 torque map'],
    search: async () => [
      { title: 'Doc A', url: 'https://example.com/a', snippet: 'Torque calibration example', source: 'Google' },
      { title: 'Doc A duplicate', url: 'https://example.com/a', snippet: 'same URL', source: 'Google' },
      { title: 'Doc B', url: 'https://example.com/b', snippet: 'Boost calibration overview', source: 'Google' },
    ],
  });

  const result = await research.run({}, 1_800_000);

  assert.equal(result.skipped, false);
  assert.equal(repository.sources.length, 2);
  assert.equal(repository.claims.length, 2);
  assert.ok(repository.sources.every(item => item.verified === false));
  assert.ok(repository.claims.every(item => item.verificationState === 'UNVERIFIED'));
  assert.ok(repository.claims.every(item => item.sourceUrl.startsWith('https://example.com/')));
});

test('same research time bucket is idempotent', async () => {
  const repository = memoryRepository();
  let searches = 0;
  const research = createEcuResearch({
    repository,
    topics: ['EDC17C46'],
    search: async () => { searches += 1; return []; },
  });

  const first = await research.run({}, 7_200_000);
  const second = await research.run({}, 7_200_001);

  assert.equal(first.skipped, false);
  assert.equal(second.skipped, true);
  assert.equal(searches, 1);
});

test('research never requires a paid language model', async () => {
  const repository = memoryRepository();
  const research = createEcuResearch({ repository, topics: [], search: async () => [] });
  const status = await research.status({});

  assert.equal(status.paidApiRequired, false);
  assert.equal(status.mode, 'continuous-research');
});
