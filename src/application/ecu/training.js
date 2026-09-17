const DAY_MS = 24 * 60 * 60 * 1000;

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function chooseEndpoint(env = {}) {
  const localUrl = String(env.ECU_LOCAL_WORKER_URL || '').trim();
  const localOnline = String(env.ECU_LOCAL_WORKER_ONLINE || '') === '1';
  if (localUrl && localOnline) return { url: localUrl, workerKind: 'local' };
  const trainingUrl = String(env.ECU_TRAINING_WORKER_URL || '').trim();
  if (trainingUrl) return { url: trainingUrl, workerKind: 'cloud' };
  const cloudUrl = String(env.ECU_CLOUD_WORKER_URL || '').trim();
  if (cloudUrl) return { url: cloudUrl, workerKind: 'cloud' };
  return null;
}

async function defaultDispatch(job, env = {}) {
  const endpoint = chooseEndpoint(env);
  if (!endpoint) return { accepted: false, state: 'QUEUED', workerKind: null, reason: 'NO_COMPUTE_ENDPOINT' };
  const headers = {
    'content-type': 'application/json',
    'idempotency-key': job.runFingerprint,
  };
  const token = String(env.ECU_COMPUTE_TOKEN || '').trim();
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        job_id: job.id,
        operation: 'train',
        dataset_version: job.datasetVersion,
        dataset_digest: job.datasetDigest,
        production_model_version: job.productionModelVersion,
        paid_api_allowed: false,
      }),
    });
    if (!response.ok) return { accepted: false, state: 'QUEUED', workerKind: endpoint.workerKind, reason: `DISPATCH_HTTP_${response.status}` };
    return { accepted: true, state: 'DISPATCHED', workerKind: endpoint.workerKind };
  } catch {
    return { accepted: false, state: 'QUEUED', workerKind: endpoint.workerKind, reason: 'DISPATCH_FAILED' };
  }
}

const defaultRepository = {
  async getState(env) {
    const verified = await env.DB.prepare('SELECT COUNT(*) AS count FROM ecu_training_examples WHERE human_verified=1').first();
    const productionModel = await env.DB.prepare("SELECT version,dataset_version,benchmark_score,artifact_uri,state FROM ecu_model_versions WHERE state='PRODUCTION' ORDER BY promoted_at DESC,created_at DESC LIMIT 1").first();
    const latestDataset = await env.DB.prepare('SELECT version,digest,example_count,artifact_uri,created_at FROM ecu_dataset_versions ORDER BY created_at DESC LIMIT 1').first();
    return {
      verifiedExamples: Number(verified?.count || 0),
      productionModel: productionModel || null,
      latestDataset: latestDataset || null,
    };
  },

  async claimRunBucket(env, bucket) {
    const id = `training-${bucket}`;
    const exists = await env.DB.prepare('SELECT id FROM ecu_training_runs WHERE id=? LIMIT 1').bind(id).first();
    if (exists) return false;
    const timestamp = Date.now();
    await env.DB.prepare('INSERT INTO ecu_training_runs(id,bucket,status,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(id, bucket, 'QUEUED', timestamp, timestamp).run();
    return true;
  },

  async finishRun(env, bucket, patch) {
    const timestamp = Date.now();
    await env.DB.prepare(`UPDATE ecu_training_runs SET status=?,run_fingerprint=?,worker_kind=?,reason=?,updated_at=? WHERE id=?`)
      .bind(
        patch.status || 'QUEUED',
        patch.runFingerprint || null,
        patch.workerKind || null,
        patch.reason || null,
        timestamp,
        `training-${bucket}`,
      ).run();
  },
};

export function createEcuTraining({
  repository = defaultRepository,
  dispatch = defaultDispatch,
  minVerifiedExamples = 50,
} = {}) {
  return {
    async maybeRun(env, timestamp = Date.now()) {
      const state = await repository.getState(env);
      if (Number(state.verifiedExamples || 0) < minVerifiedExamples) {
        return {
          scheduled: false,
          reason: 'INSUFFICIENT_VERIFIED_EXAMPLES',
          verifiedExamples: Number(state.verifiedExamples || 0),
          required: minVerifiedExamples,
        };
      }
      if (!state.latestDataset?.version || !state.latestDataset?.digest) {
        return { scheduled: false, reason: 'NO_DATASET_SNAPSHOT' };
      }

      const bucket = Math.floor(Number(timestamp) / DAY_MS) * DAY_MS;
      if (!(await repository.claimRunBucket(env, bucket))) {
        return { scheduled: false, reason: 'ALREADY_CHECKED', bucket };
      }

      const productionModelVersion = state.productionModel?.version || 'baseline';
      const runFingerprint = await sha256Text(JSON.stringify({
        operation: 'train',
        bucket,
        datasetVersion: state.latestDataset.version,
        datasetDigest: state.latestDataset.digest,
        productionModelVersion,
      }));
      const job = {
        id: `training-${bucket}`,
        operation: 'train',
        datasetVersion: state.latestDataset.version,
        datasetDigest: state.latestDataset.digest,
        productionModelVersion,
        paidApiAllowed: false,
        runFingerprint,
      };
      const dispatched = await dispatch(job, env);
      await repository.finishRun(env, bucket, {
        status: dispatched?.accepted ? 'DISPATCHED' : 'QUEUED',
        runFingerprint,
        workerKind: dispatched?.workerKind || null,
        reason: dispatched?.reason || null,
      });
      return {
        scheduled: true,
        bucket,
        job,
        dispatch: dispatched || null,
      };
    },

    async status(env) {
      const state = await repository.getState(env);
      return {
        status: Number(state.verifiedExamples || 0) >= minVerifiedExamples ? 'READY_TO_TRAIN' : 'COLLECTING_DATA',
        verifiedExamples: Number(state.verifiedExamples || 0),
        minVerifiedExamples,
        productionModel: state.productionModel || null,
        latestDataset: state.latestDataset || null,
        paidApiRequired: false,
      };
    },
  };
}
