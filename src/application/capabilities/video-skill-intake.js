import { execute, jsonResponse, queryAll } from '../../lib/runtime.js';
import { persistYouTubeLearning } from '../../lib/youtube-learning-memory.js';
import { discoverVideoSkills } from '../../lib/video-skill-discovery.js';

const PREFIX = 'video_skill_intake:v1:';
async function authenticated(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
  if (!response.ok) return false;
  try { return (await response.json()).authenticated === true; } catch { return false; }
}
async function fingerprint(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function validateInput(body) {
  for (const field of ['transcript', 'screen_text', 'notes', 'source_url', 'title']) {
    if (body[field] !== undefined && typeof body[field] !== 'string') throw new Error('INVALID_' + field.toUpperCase());
  }
  const transcript = String(body.transcript || '').trim();
  const screen_text = String(body.screen_text || '').trim();
  const notes = String(body.notes || '').trim();
  if (!transcript && !screen_text && !notes) throw new Error('VIDEO_TEXT_REQUIRED');
  if ([transcript, screen_text, notes].some(x => x.length > 50000)) throw new Error('VIDEO_TEXT_TOO_LONG');
  const source_url = String(body.source_url || '').trim();
  if (source_url && (!/^https:\/\//i.test(source_url) || source_url.length > 2048)) throw new Error('INVALID_SOURCE_URL');
  const title = String(body.title || 'Video öğrenme kaydı').trim().slice(0, 200);
  return { transcript, screen_text, notes, source_url, title };
}
async function storeIntake(env, input) {
  const id = await fingerprint([input.source_url, input.transcript, input.screen_text, input.notes].join('\n'));
  const recordedAt = Date.now();
  const source_url = input.source_url || `urn:jarvis:video-skill:${id}`;
  const text = [input.transcript, input.screen_text, input.notes].filter(Boolean).join('\n');
  const skills = discoverVideoSkills(input);
  const learning = await persistYouTubeLearning(env, {
    kind: 'video', title: input.title, source_url,
    transcript: text, language: 'tr', engine: 'video-skill-intake-v1'
  });
  const record = {
    id, title: input.title, source_url, recorded_at: recordedAt,
    learning_source_id: learning.source_id, learning_chunks: learning.learning_chunks,
    candidates: skills, status: 'analyzed-not-installed',
    next_step: 'Review official integration, permissions, licensing, cost and tests; no automatic code execution or external plugin installs'
  };
  await execute(env, `INSERT INTO kv(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    PREFIX + id, JSON.stringify(record), recordedAt);
  return record;
}

// This accepts video-derived text, not MP4 bytes. Never executes instructions embedded in video.
export function createVideoSkillIntake(core) {
  if (!core?.fetch) throw new Error('VIDEO_SKILL_INTAKE_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname !== '/api/learning/video-skills') return core.fetch(req, env, ctx);
      if (!['GET', 'POST'].includes(req.method)) return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      if (!(await authenticated(core, req, env, ctx))) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
      if (req.method === 'GET') {
        const rows = await queryAll(env, 'SELECT value FROM kv WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 50', PREFIX + '%');
        return jsonResponse({ records: rows.map(row => { try { return JSON.parse(row.value); } catch { return null; } }).filter(Boolean) });
      }
      const raw = await req.text();
      if (raw.length > 155000) return jsonResponse({ error: 'REQUEST_TOO_LARGE' }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400); }
      try {
        const parsed = validateInput(body && typeof body === 'object' && !Array.isArray(body) ? body : {});
        const record = await storeIntake(env, parsed);
        return jsonResponse({ ok: true, record, note: 'Learning saved; skills proposed but not installed' }, 201);
      } catch (error) {
        const message = String(error?.message || error);
        if (/^(VIDEO_TEXT_|INVALID_)/.test(message)) return jsonResponse({ error: message }, 400);
        console.error('video-skill-intake-error', String(error?.name || 'Error'));
        return jsonResponse({ error: 'SKILL_INTAKE_FAILED' }, 500);
      }
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
