import { execute, jsonResponse, queryOne } from '../../lib/runtime.js';
import { listYouTubeLearningSources, persistYouTubeLearning } from '../../lib/youtube-learning-memory.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function appAuthed(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
  try { return !!(await response.json()).authenticated; } catch { return false; }
}

async function queueJob(env, { repo, url, parentSourceId }) {
  const ts = now();
  const id = uid();
  const input = { url, source: 'youtube-channel-fanout', parent_source_id: parentSourceId };
  await execute(env, `INSERT INTO cloud_tool_jobs(id,adapter_id,repo,commit_sha,input_json,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`, id, 'youtube-teaching', repo, null, JSON.stringify(input), 'queued', ts, ts);
  return id;
}

export async function queueChannelVideoLearning(env, job, result, parentSourceId) {
  const videos = Array.isArray(result?.videos) ? result.videos.slice(0, 50) : [];
  let queued = 0;
  for (const video of videos) {
    const url = String(video?.url || '').trim();
    if (!url) continue;
    const learned = await queryOne(env, 'SELECT id,status FROM learning_sources WHERE source_url=?', url);
    if (learned && ['learned', 'no-transcript'].includes(String(learned.status || ''))) continue;
    const pending = await queryOne(env, `SELECT id FROM cloud_tool_jobs
      WHERE adapter_id='youtube-teaching' AND status IN ('queued','running') AND input_json LIKE ? LIMIT 1`, `%${url}%`);
    if (pending) continue;
    await queueJob(env, { repo: job.repo, url, parentSourceId });
    queued += 1;
  }
  return queued;
}

export function createYouTubeLearningCapability(core) {
  if (!core?.fetch) throw new Error('YOUTUBE_LEARNING_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/learning/youtube/sources' && req.method === 'GET') {
        if (!(await appAuthed(core, req, env, ctx))) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
        const limit = Number(url.searchParams.get('limit') || 100);
        return jsonResponse({ sources: await listYouTubeLearningSources(env, limit) });
      }

      const resultMatch = url.pathname.match(/^\/api\/tools\/cloud\/runner\/jobs\/([^/]+)\/result$/);
      if (!resultMatch || req.method !== 'POST') return core.fetch(req, env, ctx);

      const body = await req.clone().json().catch(() => ({}));
      const response = await core.fetch(req, env, ctx);
      if (!response.ok || body?.ok !== true) return response;

      let payload;
      try { payload = await response.clone().json(); } catch { return response; }
      const job = payload?.job;
      if (!job || job.adapter_id !== 'youtube-teaching') return response;

      const parentSourceId = String(job?.input?.parent_source_id || '').trim() || null;
      const learning = await persistYouTubeLearning(env, body.result || {}, { jobId: job.id, parentSourceId });
      const isChannel = String(body?.result?.kind || '') === 'channel';
      const queuedVideos = isChannel ? await queueChannelVideoLearning(env, job, body.result || {}, learning.source_id) : 0;
      const learningStatus = isChannel ? 'index-queued' : learning.learning_status;
      const enrichedResult = {
        ...(body.result || {}),
        learning_status: learningStatus,
        learning_source_id: learning.source_id,
        learning_chunks: learning.learning_chunks,
        queued_videos: queuedVideos
      };

      const ts = now();
      await execute(env, 'UPDATE cloud_tool_jobs SET result_json=?,updated_at=? WHERE id=?', JSON.stringify(enrichedResult), ts, job.id);
      const enrichedJob = { ...job, result: enrichedResult, updated_at: ts };
      return jsonResponse({ ...payload, learning: { ...learning, learning_status: learningStatus, queued_videos: queuedVideos }, job: enrichedJob });
    },
    scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
