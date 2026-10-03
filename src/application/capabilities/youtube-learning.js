import { decryptCredential, execute, fetchWithTimeout, jsonResponse, queryAll, queryOne } from '../../lib/runtime.js';
import { listYouTubeLearningSources, persistYouTubeLearning } from '../../lib/youtube-learning-memory.js';
import { verifyRunnerJwt } from './cloud-execution.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

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

async function transcribeAudio(env, body) {
  if (!env.AI) throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  const audio = String(body?.data || '').trim();
  if (!audio || audio.length > 9_000_000) throw new Error('AUDIO_CHUNK_INVALID');
  const language = String(body?.language || '').trim().slice(0, 12);
  const input = {
    audio,
    task: 'transcribe',
    vad_filter: true,
    initial_prompt: 'Teknik otomotiv, ECU, WinOLS, teşhis, kodlama ve kalibrasyon terimlerini mümkün olduğunca aynen koru.'
  };
  if (language) input.language = language;
  const result = await env.AI.run(WHISPER_MODEL, input);
  return {
    kind: 'audio',
    text: String(result?.text || result?.result?.text || '').trim(),
    model: WHISPER_MODEL,
    timestamp_sec: Math.max(0, Number(body?.timestamp_sec) || 0)
  };
}

async function healthyGemini(env) {
  const rows = await queryAll(env, `SELECT * FROM credentials
    WHERE enabled=1 AND last_status='ok' AND lower(provider)='gemini'
    ORDER BY priority ASC, created_at ASC LIMIT 1`);
  return rows[0] || null;
}

async function analyzeFrames(env, body) {
  const frames = (Array.isArray(body?.frames) ? body.frames : []).slice(0, 6)
    .map(frame => ({
      timestamp_sec: Math.max(0, Number(frame?.timestamp_sec) || 0),
      mime: ['image/jpeg','image/png','image/webp'].includes(String(frame?.mime || '').toLowerCase()) ? String(frame.mime).toLowerCase() : 'image/jpeg',
      data: String(frame?.data || '').trim()
    }))
    .filter(frame => frame.data && frame.data.length <= 2_000_000);
  if (!frames.length) throw new Error('VIDEO_FRAMES_REQUIRED');
  const credential = await healthyGemini(env);
  if (!credential) throw new Error('VISION_PROVIDER_UNAVAILABLE');
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const model = String(credential.model || 'gemini-2.5-flash').trim();
  const prompt = [
    'Bu kareler JARVIS YT Öğretisi için teknik eğitim videosundan alınmıştır.',
    'İnsan kimliğiyle ilgilenme. Ekrandaki teknik bilgiyi çıkar: yazılar, menüler, ECU/WinOLS haritaları, tablolar, grafikler, hata kodları, ölçüm değerleri, bağlantı şemaları, kullanılan yazılım adımları ve görünür uyarılar.',
    'Her kare için yalnız doğrulanabilir gördüğün bilgiyi Türkçe yaz. Emin olmadığını uydurma.',
    'Çıktıyı her satırda [saniye] açıklama biçiminde ver.'
  ].join(' ');
  const parts = [{ text: prompt }];
  for (const frame of frames) {
    parts.push({ text: `Kare zamanı: ${frame.timestamp_sec.toFixed(1)} saniye` });
    parts.push({ inlineData: { mimeType: frame.mime, data: frame.data } });
  }
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1200 }
    })
  }, 18000);
  if (!response.ok) throw new Error(`VISION_GEMINI_${response.status}`);
  const payload = await response.json();
  const text = String(payload?.candidates?.[0]?.content?.parts?.map(item => item?.text || '').join('') || '').trim();
  if (!text) throw new Error('VISION_EMPTY');
  return { kind: 'frames', text, provider: credential.label || 'Gemini', model };
}

async function handleRunnerMediaAnalyze(req, env) {
  if (!(await runnerAuthed(req))) return jsonResponse({ error: 'RUNNER_AUTH_REQUIRED' }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.kind === 'audio') return jsonResponse(await transcribeAudio(env, body));
    if (body?.kind === 'frames') return jsonResponse(await analyzeFrames(env, body));
    return jsonResponse({ error: 'MEDIA_KIND_INVALID' }, 400);
  } catch (error) {
    return jsonResponse({ error: String(error?.message || error) }, 422);
  }
}

export function createYouTubeLearningCapability(core) {
  if (!core?.fetch) throw new Error('YOUTUBE_LEARNING_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/learning/youtube/media/analyze' && req.method === 'POST') {
        return handleRunnerMediaAnalyze(req, env);
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
