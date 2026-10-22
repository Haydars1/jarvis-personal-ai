import { jsonResponse } from '../../lib/runtime.js';
import { analyzeFrames } from './youtube-learning.js';

export function createVideoFrameAnalysis(core) {
  return {
    async fetch(req, env, ctx) {
      if (new URL(req.url).pathname !== '/api/learning/video-skills/from-frames') return core.fetch(req, env, ctx);
      if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      const auth = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
      let permitted = false;
      try { permitted = auth.ok && (await auth.json()).authenticated === true; } catch {}
      if (!permitted) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
      const max = 4000000;
      if (Number(req.headers.get('content-length') || 0) > max) return jsonResponse({ error: 'REQUEST_TOO_LARGE' }, 413);
      const raw = await req.text();
      if (raw.length > max) return jsonResponse({ error: 'REQUEST_TOO_LARGE' }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400); }
      if (!body || !Array.isArray(body.frames) || !body.frames.length || body.frames.length > 6)
        return jsonResponse({ error: 'INVALID_FRAMES' }, 400);
      if (body.frames.some(f => !f || f.mime !== 'image/jpeg' || typeof f.data !== 'string' ||
        f.data.length < 500 || f.data.length > 550000 || f.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.data) ||
        !Number.isFinite(f.timestamp_sec) || f.timestamp_sec < 0 || f.timestamp_sec > 14400))
        return jsonResponse({ error: 'INVALID_FRAME' }, 400);
      try {
        const vision = await analyzeFrames(env, { frames: body.frames, intent: 'skill-discovery' });
        const requestBody = {
          title: String(body.title || 'Video öğrenme').slice(0, 200),
          transcript: String(body.transcript || '').slice(0, 40000),
          notes: String(body.notes || '').slice(0, 40000),
          screen_text: vision.text
        };
        const response = await core.fetch(new Request(new URL('/api/learning/video-skills', req.url), {
          method: 'POST', headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify(requestBody)
        }), env, ctx);
        if (!response.ok) return response;
        const stored = await response.json();
        return jsonResponse({ ...stored, analyzed_frames: body.frames.length, vision: { provider: vision.provider, model: vision.model } }, 201);
      } catch (error) {
        const message = String(error?.message || error);
        if (message.startsWith('VISION_')) return jsonResponse({ error: message }, 422);
        return jsonResponse({ error: 'VIDEO_FRAME_ANALYSIS_FAILED' }, 500);
      }
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
