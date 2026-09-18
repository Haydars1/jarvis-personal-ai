import { createEcuJobRecord } from './models.js';
import { createEcuResearch } from './research.js';
import { createEcuTraining } from './training.js';
import { createEcuArtifactStore } from '../../infrastructure/ecu/artifact-store.js';
import { createComputeDispatch } from '../../infrastructure/ecu/compute-dispatch.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function sha256Text(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function isComputeAuthorized(req, env = {}) {
  const expected = String(env.ECU_COMPUTE_TOKEN || '').trim();
  if (!expected) return false;
  const actual = String(req.headers.get('authorization') || '');
  return actual === `Bearer ${expected}`;
}

function requestFilename(req) {
  const raw = String(req.headers.get('x-ecu-filename') || 'original.bin').trim();
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  return decoded.slice(0, 180) || 'original.bin';
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    fileId: row.file_id,
    operation: row.operation,
    state: row.state,
    runFingerprint: row.run_fingerprint ?? null,
    modelVersion: row.model_version ?? null,
    workerKind: row.worker_kind ?? null,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function defaultCreateJob(env, { fileId, operation = 'analyze' }, dispatch) {
  const file = await env.DB.prepare('SELECT id,sha256,artifact_uri FROM ecu_files WHERE id=? LIMIT 1').bind(fileId).first();
  if (!file) throw new Error('ECU_FILE_NOT_FOUND');
  const record = createEcuJobRecord({ id: uid(), artifactHash: fileId, operation, createdAt: now() });
  const modelVersion = 'baseline';
  const rulepackVersion = 'baseline';
  const runFingerprint = await sha256Text(JSON.stringify({
    artifactSha256: file.sha256,
    operation,
    modelVersion,
    rulepackVersion,
  }));
  await env.DB.prepare('INSERT INTO ecu_jobs(id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(record.id, fileId, operation, record.state, runFingerprint, modelVersion, rulepackVersion, record.createdAt, record.updatedAt).run();

  const dispatched = await dispatch({
    id: record.id,
    runFingerprint,
    artifactUri: file.artifact_uri,
    artifactSha256: file.sha256,
    operation,
    modelVersion,
    rulepackVersion,
  }, env);
  const state = dispatched?.accepted ? 'DISPATCHED' : 'QUEUED';
  await env.DB.prepare('UPDATE ecu_jobs SET state=?,worker_kind=?,updated_at=? WHERE id=?')
    .bind(state, dispatched?.workerKind || null, now(), record.id).run();
  return {
    ...record,
    fileId,
    state,
    runFingerprint,
    modelVersion,
    rulepackVersion,
    workerKind: dispatched?.workerKind || null,
    dispatchReason: dispatched?.reason || null,
  };
}

async function defaultGetJob(env, id) {
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(id).first());
}

async function defaultListJobs(env, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const rows = (await env.DB.prepare('SELECT * FROM ecu_jobs ORDER BY created_at DESC LIMIT ?').bind(safeLimit).all()).results || [];
  return rows.map(mapJob);
}

async function defaultUploadOriginal(env, { bytes, filename = 'original.bin', contentType = 'application/octet-stream' }) {
  const store = createEcuArtifactStore(env.ECU_ARTIFACTS);
  const saved = await store.putOriginal(bytes, { filename, contentType });
  const id = saved.sha256;
  const artifactUri = `r2://ecu-artifacts/${saved.key}`;
  const createdAt = now();
  await env.DB.prepare(`INSERT INTO ecu_files(id,sha256,original_name,artifact_uri,size_bytes,immutable,created_at)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(sha256) DO NOTHING`)
    .bind(id, saved.sha256, filename, artifactUri, saved.sizeBytes, 1, createdAt).run();
  return {
    id,
    sha256: saved.sha256,
    artifactUri,
    originalName: filename,
    sizeBytes: saved.sizeBytes,
    existed: saved.existed,
    immutable: true,
  };
}

async function defaultReadOriginal(env, sha256) {
  const store = createEcuArtifactStore(env.ECU_ARTIFACTS);
  return store.getOriginal(sha256);
}

async function defaultApplyWorkerResult(env, jobId, body = {}) {
  const allowed = new Set(['NEEDS_REVIEW', 'READY', 'FAILED']);
  const status = allowed.has(String(body.status || '')) ? String(body.status) : 'NEEDS_REVIEW';
  const timestamp = now();
  const job = await env.DB.prepare('SELECT id FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first();
  if (!job) throw new Error('ECU_JOB_NOT_FOUND');

  const resultJson = JSON.stringify(body);
  await env.DB.prepare(`UPDATE ecu_jobs
    SET state=?,run_fingerprint=?,result_json=?,error=?,updated_at=?
    WHERE id=?`)
    .bind(
      status,
      body.run_fingerprint || null,
      resultJson,
      body.error || null,
      timestamp,
      jobId,
    ).run();

  if (status !== 'FAILED') {
    const resultId = `analysis-${jobId}`;
    await env.DB.prepare(`INSERT INTO ecu_analysis_results(
      id,job_id,ecu_family,hw_candidates,sw_candidates,confidence,evidence,feature_schema_version,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(job_id) DO UPDATE SET
      ecu_family=excluded.ecu_family,
      hw_candidates=excluded.hw_candidates,
      sw_candidates=excluded.sw_candidates,
      confidence=excluded.confidence,
      evidence=excluded.evidence,
      feature_schema_version=excluded.feature_schema_version`)
      .bind(
        resultId,
        jobId,
        body.ecu_family || 'UNKNOWN',
        JSON.stringify(body.hw_candidates || []),
        JSON.stringify(body.sw_candidates || []),
        Number(body.confidence || 0),
        JSON.stringify(body.evidence || []),
        String(body.feature_schema_version || 'v1'),
        timestamp,
      ).run();

    await env.DB.prepare('DELETE FROM ecu_map_candidates WHERE job_id=?').bind(jobId).run();
    for (const [index, candidate] of (body.map_candidates || []).entries()) {
      await env.DB.prepare(`INSERT INTO ecu_map_candidates(
        id,job_id,map_offset,rows,cols,data_type,endian,semantic_label,confidence,features_json,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(
          `${jobId}-map-${index}`,
          jobId,
          Number(candidate.offset || 0),
          candidate.rows == null ? null : Number(candidate.rows),
          candidate.cols == null ? null : Number(candidate.cols),
          candidate.data_type || null,
          candidate.endian || null,
          candidate.semantic_label || null,
          Number(candidate.score ?? candidate.confidence ?? 0),
          JSON.stringify(candidate),
          timestamp,
        ).run();
    }
  }
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first());
}

async function defaultUploadStatus(env) {
  return {
    ready: Boolean(env.ECU_ARTIFACTS),
    storage: env.ECU_ARTIFACTS ? 'r2' : 'unconfigured',
  };
}

export function createEcuRuntime(core, overrides = {}) {
  const research = overrides.research || createEcuResearch();
  const training = overrides.training || createEcuTraining();
  const computeDispatch = overrides.computeDispatch || createComputeDispatch();
  const deps = {
    createJob: (env, input) => defaultCreateJob(env, input, computeDispatch),
    getJob: defaultGetJob,
    listJobs: defaultListJobs,
    researchStatus: env => research.status(env),
    trainingStatus: env => training.status(env),
    uploadStatus: defaultUploadStatus,
    uploadOriginal: defaultUploadOriginal,
    readOriginal: defaultReadOriginal,
    applyWorkerResult: defaultApplyWorkerResult,
    ...overrides,
  };

  const maxUploadBytes = Math.max(1, Number(overrides.maxUploadBytes || 16 * 1024 * 1024));

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api/ecu/internal/artifacts/') && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const sha256 = decodeURIComponent(url.pathname.slice('/api/ecu/internal/artifacts/'.length));
        if (!/^[a-f0-9]{64}$/i.test(sha256)) return json({ error: 'INVALID_ARTIFACT_SHA256' }, 400);
        try {
          const bytes = await deps.readOriginal(env, sha256.toLowerCase());
          if (!bytes) return json({ error: 'ECU_FILE_NOT_FOUND' }, 404);
          return new Response(bytes, {
            status: 200,
            headers: {
              'content-type': 'application/octet-stream',
              'cache-control': 'no-store',
              'x-content-type-options': 'nosniff',
            },
          });
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/jobs/') && url.pathname.endsWith('/result') && req.method === 'POST') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const jobId = decodeURIComponent(url.pathname.slice('/api/ecu/internal/jobs/'.length, -'/result'.length));
        if (!jobId) return json({ error: 'ECU_JOB_ID_REQUIRED' }, 400);
        const body = await readJson(req);
        try {
          return json({ job: await deps.applyWorkerResult(env, jobId, body) });
        } catch (error) {
          if (error?.message === 'ECU_JOB_NOT_FOUND') return json({ error: 'ECU_JOB_NOT_FOUND' }, 404);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/files' && req.method === 'POST') {
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const buffer = await req.arrayBuffer();
        if (!buffer.byteLength) return json({ error: 'ECU_FILE_EMPTY' }, 400);
        if (buffer.byteLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const filename = requestFilename(req);
        const contentType = String(req.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
        try {
          const file = await deps.uploadOriginal(env, { bytes: new Uint8Array(buffer), filename, contentType });
          return json({ file }, file.existed ? 200 : 201);
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }
      if (url.pathname === '/api/ecu/analyze-file' && req.method === 'POST') {
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const buffer = await req.arrayBuffer();
        if (!buffer.byteLength) return json({ error: 'ECU_FILE_EMPTY' }, 400);
        if (buffer.byteLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const filename = requestFilename(req);
        const contentType = String(req.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
        try {
          const file = await deps.uploadOriginal(env, { bytes: new Uint8Array(buffer), filename, contentType });
          const job = await deps.createJob(env, { fileId: file.id, operation: 'analyze' });
          return json({ file, job }, 202);
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/jobs' && req.method === 'POST') {
        const body = await readJson(req);
        const fileId = String(body.fileId || '').trim();
        const operation = String(body.operation || 'analyze').trim() || 'analyze';
        if (!fileId) return json({ error: 'fileId is required' }, 400);
        try {
          return json({ job: await deps.createJob(env, { fileId, operation }) }, 202);
        } catch (error) {
          if (error?.message === 'ECU_FILE_NOT_FOUND') return json({ error: 'ECU_FILE_NOT_FOUND' }, 404);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/jobs' && req.method === 'GET') {
        return json({ jobs: await deps.listJobs(env, url.searchParams.get('limit')) });
      }

      if (url.pathname.startsWith('/api/ecu/jobs/') && req.method === 'GET') {
        const id = decodeURIComponent(url.pathname.slice('/api/ecu/jobs/'.length));
        const job = await deps.getJob(env, id);
        return job ? json({ job }) : json({ error: 'ECU_JOB_NOT_FOUND' }, 404);
      }

      if (url.pathname === '/api/ecu/research/status' && req.method === 'GET') {
        return json(await deps.researchStatus(env));
      }

      if (url.pathname === '/api/ecu/training/status' && req.method === 'GET') {
        return json(await deps.trainingStatus(env));
      }

      if (url.pathname === '/api/ecu/upload-session' && req.method === 'POST') {
        return json(await deps.uploadStatus(env));
      }

      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      const timestamp = Number(event?.scheduledTime || Date.now());
      try {
        await research.run(env, timestamp);
      } catch {
        // Background learning must never break the main JARVIS scheduler.
      }
      try {
        await training.maybeRun(env, timestamp);
      } catch {
        // Training checks are optional background work and remain recoverable.
      }
      return core.scheduled?.(event, env, ctx);
    },
  };
}
