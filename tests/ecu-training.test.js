import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuTraining } from '../src/application/ecu/training.js';

function repository({ verified = 0, production = null, lastDataset = null } = {}) {
  const buckets = new Set();
  const runs = [];
  return {
    runs,
    async getState() {
      return { verifiedExamples: verified, productionModel: production, latestDataset: lastDataset };
    },
    async claimRunBucket(_env, bucket) {
      if (buckets.has(bucket)) return false;
      buckets.add(bucket);
      runs.push({ bucket, status: 'QUEUED' });
      return true;
    },
    async finishRun(_env, bucket, patch) {
      const run = runs.find(item => item.bucket === bucket);
      Object.assign(run, patch);
    },
  };
}

test('does not schedule retraining before enough verified examples exist', async () => {
  const repo = repository({ verified: 12 });
  let dispatched = 0;
  const training = createEcuTraining({ repository: repo, minVerifiedExamples: 50, dispatch: async () => { dispatched += 1; } });

  const result = await training.maybeRun({}, 86_400_000);

  assert.equal(result.scheduled, false);
  assert.equal(result.reason, 'INSUFFICIENT_VERIFIED_EXAMPLES');
  assert.equal(dispatched, 0);
});

test('schedules a deterministic training job when verified threshold is met', async () => {
  const repo = repository({ verified: 75, production: { version: 'v1' }, lastDataset: { version: 'dataset-4', digest: 'd'.repeat(64) } });
  const jobs = [];
  const training = createEcuTraining({
    repository: repo,
    minVerifiedExamples: 50,
    dispatch: async (job) => { jobs.push(job); return { accepted: true, workerKind: 'cloud', state: 'DISPATCHED' }; },
  });

  const result = await training.maybeRun({ ECU_CLOUD_WORKER_URL: 'https://worker.example/jobs' }, 172_800_000);

  assert.equal(result.scheduled, true);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].operation, 'train');
  assert.equal(jobs[0].datasetVersion, 'dataset-4');
  assert.equal(jobs[0].productionModelVersion, 'v1');
  assert.equal(jobs[0].paidApiAllowed, false);
  assert.equal(jobs[0].runFingerprint.length, 64);
});

test('same daily training bucket is idempotent', async () => {
  const repo = repository({ verified: 50, production: { version: 'v1' }, lastDataset: { version: 'dataset-1', digest: 'a'.repeat(64) } });
  let dispatched = 0;
  const training = createEcuTraining({ repository: repo, dispatch: async () => { dispatched += 1; return { accepted: true }; } });

  const first = await training.maybeRun({}, 259_200_000);
  const second = await training.maybeRun({}, 259_200_001);

  assert.equal(first.scheduled, true);
  assert.equal(second.scheduled, false);
  assert.equal(second.reason, 'ALREADY_CHECKED');
  assert.equal(dispatched, 1);
});

test('training status exposes verified data and never requires paid LLM API', async () => {
  const repo = repository({ verified: 63, production: { version: 'v3' }, lastDataset: { version: 'dataset-9', digest: '9'.repeat(64) } });
  const training = createEcuTraining({ repository: repo });

  const status = await training.status({});

  assert.equal(status.paidApiRequired, false);
  assert.equal(status.verifiedExamples, 63);
  assert.equal(status.productionModel.version, 'v3');
  assert.equal(status.latestDataset.version, 'dataset-9');
});
