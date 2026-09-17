import { createEcuJobRecord } from './models.js';
import { createEcuResearch } from './research.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

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

async function defaultCreateJob(env, { fileId, operation = 'analyze' }) {
  const file = await env.DB.prepare('SELECT id FROM ecu_files WHERE id=? LIMIT 1').bind(fileId).first();
  if (!file) throw new Error('ECU_FILE_NOT_FOUND');
  const record = createEcuJobRecord({ id: uid(), artifactHash: fileId, operation, createdAt: now() });
  await env.DB.prepare('INSERT INTO ecu_jobs(id,file_id,operation,state,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(record.id, fileId, operation, record.state, record.createdAt, record.updatedAt).run();
  return { ...record, fileId };
}

async function defaultGetJob(env, id) {
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(id).first());
}

async function defaultListJobs(env, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const rows = (await env.DB.prepare('SELECT * FROM ecu_jobs ORDER BY created_at DESC LIMIT ?').bind(safeLimit).all()).results || [];
  return rows.map(mapJob);
}

async function defaultTrainingStatus() {
  return { status: 'IDLE', paidApiRequired: false, configured: false };
}

async function defaultUploadStatus(env) {
  return {
    ready: Boolean(env.ECU_ARTIFACTS),
    storage: env.ECU_ARTIFACTS ? 'r2' : 'unconfigured',
  };
}

export function createEcuRuntime(core, overrides = {}) {
  const research = overrides.research || createEcuResearch();
  const deps = {
    createJob: defaultCreateJob,
    getJob: defaultGetJob,
    listJobs: defaultListJobs,
    researchStatus: env => research.status(env),
    trainingStatus: defaultTrainingStatus,
    uploadStatus: defaultUploadStatus,
    ...overrides,
  };

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
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
      await research.run(env, timestamp);
      return core.scheduled?.(event, env, ctx);
    },
  };
}
