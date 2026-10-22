import { jsonResponse, queryAll } from '../../lib/runtime.js';
import { transcribeAudio } from './youtube-learning.js';

const MAX_WAV_BASE64 = 1_400_000;
const MAX_BODY = 1_550_000;

// The browser sends a short 16-kHz mono PCM WAV clip; no full video or MP4 upload.
export function validateWavInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_AUDIO_REQUEST');
  const data = body.data;
  if (typeof data !== 'string' || data.length < 60 || data.length > MAX_WAV_BASE64 ||
      data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('INVALID_AUDIO_DATA');
  let binary;
  try { binary = atob(data); } catch { throw new Error('INVALID_AUDIO_DATA'); }
  if (binary.length < 46 || binary.length > 1_000_000) throw new Error('INVALID_AUDIO_SIZE');
  const head = new DataView(Uint8Array.from(binary.slice(0, 44), c => c.charCodeAt(0)).buffer);
  const tag = offset => binary.slice(offset, offset + 4);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data' ||
      head.getUint32(16, true) !== 16 || head.getUint16(20, true) !== 1 ||
      head.getUint16(22, true) !== 1 || head.getUint32(24, true) !== 16000 ||
      head.getUint32(28, true) !== 32000 || head.getUint16(32, true) !== 2 ||
      head.getUint16(34, true) !== 16) throw new Error('INVALID_AUDIO_FORMAT');
  const bytes = head.getUint32(40, true);
  if (!bytes || bytes % 2 || bytes !== binary.length - 44 || bytes > 960000)
    throw new Error('INVALID_AUDIO_DURATION');
  if (body.save !== undefined && typeof body.save !== 'boolean') throw new Error('INVALID_SAVE');
  for (const key of ['title', 'notes', 'transcript', 'language']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error('INVALID_' + key.toUpperCase());
  }
  if (String(body.notes || '').length > 40000 || String(body.transcript || '').length > 40000 ||
      String(body.title || '').length > 200) throw new Error('INVALID_TEXT_LENGTH');
  return {
    data,
    title: String(body.title || 'Sesli video öğrenimi').trim().slice(0, 200),
    notes: String(body.notes || '').trim(),
    transcript: String(body.transcript || '').trim(),
    language: String(body.language || '').trim().slice(0, 12),
    seconds: bytes / 32000,
    save: body.save !== false
  };
}

export function createVideoAudioTranscription(core) {
  if (!core?.fetch) throw new Error('VIDEO_AUDIO_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const pathname = new URL(req.url).pathname;
      const providerCheck = pathname === '/api/learning/video-skills/providers';
      if (pathname !== '/api/learning/video-skills/from-audio' && !providerCheck) return core.fetch(req, env, ctx);
      if (providerCheck ? req.method !== 'GET' : req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      const auth = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
      let authenticated = false;
      try { authenticated = auth.ok && (await auth.json()).authenticated === true; } catch {}
      if (!authenticated) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
      if (providerCheck) {
        let geminiConfigured = false;
        try {
          const creds = await queryAll(env, "SELECT id FROM credentials WHERE enabled=1 AND last_status='ok' AND lower(provider)='gemini' LIMIT 1");
          geminiConfigured = creds.length > 0;
        } catch { return jsonResponse({ cloudflare_ai_bound: !!env.AI?.run, gemini_configured: null, note: 'Provider database not readable' }); }
        return jsonResponse({ cloudflare_ai_bound: !!env.AI?.run, gemini_configured: geminiConfigured, note: 'Configuration check only; no model call or quota usage' });
      }
      if (Number(req.headers.get('content-length') || 0) > MAX_BODY)
        return jsonResponse({ error: 'REQUEST_TOO_LARGE' }, 413);
      const raw = await req.text();
      if (raw.length > MAX_BODY) return jsonResponse({ error: 'REQUEST_TOO_LARGE' }, 413);
      let payload;
      try { payload = JSON.parse(raw); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400); }
      let input;
      try { input = validateWavInput(payload); }
      catch (error) { return jsonResponse({ error: String(error.message).slice(0, 100) }, 400); }
      if (!env.AI) return jsonResponse({ error: 'CLOUDFLARE_AI_UNAVAILABLE' }, 422);
      try {
        const result = await transcribeAudio(env, { data: input.data, language: input.language });
        const spoken = String(result.text || '').trim();
        if (!spoken) {
          if (!input.save) return jsonResponse({ ok: true, saved: false, silent: true,
            transcript: '', transcribed_audio_seconds: input.seconds, transcription_model: result.model });
          return jsonResponse({ error: 'AUDIO_NO_SPEECH_DETECTED' }, 422);
        }
        if (!input.save) return jsonResponse({ ok: true, saved: false, transcribed_audio_seconds: input.seconds, transcript: spoken.slice(0, 49000), transcription_model: result.model }, 200);
        const saved = await core.fetch(new Request(new URL('/api/learning/video-skills', req.url), {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({
            title: input.title,
            notes: input.notes,
            transcript: [input.transcript, spoken].filter(Boolean).join('\n').slice(0, 49000)
          })
        }), env, ctx);
        if (!saved.ok) return saved;
        const response = await saved.json();
        return jsonResponse({
          ...response,
          transcribed_audio_seconds: input.seconds,
          transcript: spoken.slice(0, 49000),
          transcription_model: result.model
        }, 201);
      } catch (error) {
        console.error('video-audio-transcription-error', String(error?.name || 'Error'));
        return jsonResponse({ error: 'AUDIO_TRANSCRIPTION_FAILED' }, 502);
      }
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
