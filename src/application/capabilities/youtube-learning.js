import { decryptCredential, execute, fetchWithTimeout, jsonResponse, queryAll, queryOne } from '../../lib/runtime.js';
import { listYouTubeLearningSources, persistYouTubeLearning } from '../../lib/youtube-learning-memory.js';
import { verifyRunnerJwt } from './cloud-execution.js';
import { buildYouTubeInsightRequest, canonicalYouTubeVideoUrl, parseYouTubeInsightResponse, YOUTUBE_INSIGHT_MODEL_DEFAULT } from '../../lib/youtube-insight.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function appAuthed(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
  try { return !!(await response.json()).authenticated; } catch { return false; }
}

function bearer(req) {
  const match = String(req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}
async function runnerAuthed(req) {
  try { return await verifyRunnerJwt(bearer(req)); } catch { return null; }
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

async function healthyGemini(env) {
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE enabled=1 AND last_status='ok' AND lower(provider)='gemini' ORDER BY priority ASC, created_at ASC LIMIT 1");
  return rows[0] || null;
}

export async function analyzeYouTubeDirect(env, body, dependencies = {}) {
  // Video bytes never transit the Jarvis runner or its D1 database.
  const sourceUrl = canonicalYouTubeVideoUrl(String(body?.url || ''));
  const credential = await healthyGemini(env);
  if (!credential) throw new Error('YOUTUBE_GEMINI_PROVIDER_UNAVAILABLE');
  const apiKey = await decryptCredential(env, credential.encrypted_secret);
  const requestedModel = String(credential.model || YOUTUBE_INSIGHT_MODEL_DEFAULT).trim();
  const model = /^[a-z0-9][a-z0-9._-]{1,85}$/i.test(requestedModel) ? requestedModel : YOUTUBE_INSIGHT_MODEL_DEFAULT;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const request = buildYouTubeInsightRequest(sourceUrl);
  const fetcher = dependencies.fetchImpl || fetchWithTimeout;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(request)
  }, 110000);
  if (!response.ok) {
    if (response.status === 429) throw new Error('YOUTUBE_VIDEO_PROVIDER_RATE_LIMIT');
    if (response.status === 400 || response.status === 404) throw new Error('YOUTUBE_VIDEO_UNAVAILABLE_OR_UNSUPPORTED');
    throw new Error('YOUTUBE_VIDEO_GEMINI_HTTP_' + response.status);
  }
  const insight = parseYouTubeInsightResponse(await response.json());
  return {
    kind: 'video', source_url: sourceUrl,
    video_id: sourceUrl.split('v=')[1],
    title: insight.title, language: 'tr',
    transcript: insight.transcript,
    video_analyzed: true,
    learning_method: insight.learning_method,
    model, provider: 'gemini',
    modalities: ['direct-video'],
    audio_used: true, vision_used: true, captions_available: false,
    insights_count: insight.insights_count,
    lesson_details: {
      summary: insight.summary, concepts: insight.concepts,
      procedure: insight.procedure, decision_rules: insight.decision_rules,
      mistakes: insight.mistakes, transferable_lessons: insight.transferable_lessons,
      uncertainties: insight.uncertainties
    }
  };
}

async function handleRunnerVideoAnalyze(req, env) {
  if (!(await runnerAuthed(req))) return jsonResponse({ error: 'RUNNER_AUTH_REQUIRED' }, 401);
  const body = await req.json().catch(() => ({}));
  try { return jsonResponse(await analyzeYouTubeDirect(env, body)); }
  catch (error) { return jsonResponse({ error: String(error?.message || error) }, 422); }
}

export function createYouTubeLearningCapability(core) {
  if (!core?.fetch) throw new Error('YOUTUBE_LEARNING_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/learning/youtube/direct/analyze' && req.method === 'POST') {
        return handleRunnerVideoAnalyze(req, env);
      }
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
