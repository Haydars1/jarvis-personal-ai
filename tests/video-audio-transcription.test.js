import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoAudioTranscription, validateWavInput } from '../src/application/capabilities/video-audio-transcription.js';
import { jsonResponse } from '../src/lib/runtime.js';

function fixtureWav(seconds = 0.5) {
  const length = Math.floor(16000 * seconds) * 2;
  const buffer = Buffer.alloc(44 + length);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(length, 40);
  return buffer.toString('base64');
}
function setup({ authed = true, ai = null } = {}) {
  let saved = null;
  const core = {
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === '/api/auth/status') return jsonResponse({ authenticated: authed });
      if (path === '/api/learning/video-skills') {
        saved = await req.json();
        return jsonResponse({ ok: true, record: { status: 'analyzed-not-installed', candidates: [], title: saved.title } }, 201);
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    }
  };
  const handler = createVideoAudioTranscription(core);
  const env = ai ? { AI: { run: ai } } : {};
  return { handler, env, saved: () => saved };
}
function post(data, method = 'POST') {
  return new Request('https://app.test/api/learning/video-skills/from-audio', {
    method, headers: { cookie: 'fake-auth', 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(data) } : {})
  });
}

test('validates short 16-kHz mono PCM WAV and rejects forged headers', () => {
  const valid = fixtureWav();
  assert.equal(validateWavInput({ data: valid }).seconds, 0.5);
  const corrupt = Buffer.from(valid, 'base64');
  corrupt.writeUInt16LE(2, 22);
  assert.throws(() => validateWavInput({ data: corrupt.toString('base64') }), /INVALID_AUDIO_FORMAT/);
  assert.throws(() => validateWavInput({ data: 'AAAA' }), /INVALID_AUDIO_DATA/);
  assert.throws(() => validateWavInput({ data: fixtureWav(31) }), /INVALID_AUDIO_DURATION|INVALID_AUDIO_SIZE|INVALID_AUDIO_DATA/);
});
test('denies unauthenticated audio before external model invocation', async () => {
  let called = false;
  const { handler, env } = setup({ authed: false, ai: async () => { called = true; } });
  const res = await handler.fetch(post({ data: fixtureWav() }), env);
  assert.equal(res.status, 401);
  assert.equal(called, false);
});
test('refuses unavailable AI binding and unsupported methods', async () => {
  const { handler, env, saved } = setup();
  const res = await handler.fetch(post({ data: fixtureWav() }), env);
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'CLOUDFLARE_AI_UNAVAILABLE');
  assert.equal(saved(), null);
  assert.equal((await handler.fetch(post(undefined, 'GET'), env)).status, 405);
});
test('transcribes supported audio and persists only text, not audio bytes', async () => {
  let invoked = 0;
  const { handler, env, saved } = setup({
    ai: async (model, body) => {
      invoked++;
      assert.match(model, /whisper/);
      assert.equal(body.task, 'transcribe');
      return { text: 'Jenkins Docker Kubernetes uygulamaları' };
    }
  });
  const data = fixtureWav();
  const res = await handler.fetch(post({ data, notes: 'CI eğitim videosu', title: 'öğrenim.wav' }), env);
  assert.equal(res.status, 201);
  assert.equal(invoked, 1);
  const json = await res.json();
  assert.match(json.transcript, /Jenkins Docker Kubernetes/);
  assert.equal(saved().title, 'öğrenim.wav');
  assert.equal(saved().notes, 'CI eğitim videosu');
  assert.equal(saved().transcript, 'Jenkins Docker Kubernetes uygulamaları');
  assert.ok(!JSON.stringify(saved()).includes(data));
});
test('does not claim learning from silent audio', async () => {
  const { handler, env, saved } = setup({ ai: async () => ({ text: '  ' }) });
  const res = await handler.fetch(post({ data: fixtureWav() }), env);
  assert.equal(res.status, 422);
  assert.equal(saved(), null);
});

test('offers an authenticated, non-billable capability check without exposing keys', async () => {
  const { handler } = setup({ ai: async () => ({ text: 'unused' }) });
  const env = { AI: { run: async () => { throw Error('should not invoke'); } },
    DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ id: 'configured-provider' }] }) }) }) }
  };
  const res = await handler.fetch(new Request('https://app.test/api/learning/video-skills/providers'), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.cloudflare_ai_bound, true);
  assert.equal(data.gemini_configured, true);
  assert.ok(!JSON.stringify(data).includes('configured-provider'));
  const { handler: denied } = setup({ authed: false });
  assert.equal((await denied.fetch(new Request('https://app.test/api/learning/video-skills/providers'), env)).status, 401);
});

test('chunk mode transcribes but does not persist until client explicitly saves combined notes', async () => {
  const { handler, env, saved } = setup({ ai: async () => ({ text: 'Jenkins Build Test Deploy' }) });
  const res = await handler.fetch(post({ data: fixtureWav(), save: false }), env);
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.saved, false);
  assert.equal(payload.transcript, 'Jenkins Build Test Deploy');
  assert.equal(saved(), null);
});

test('audio mode must not be an arbitrary value', async () => {
  const { handler, env } = setup({ ai: async () => ({ text: 'unused' }) });
  const res = await handler.fetch(post({ data: fixtureWav(), save: 'false' }), env);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'INVALID_SAVE');
});

test('silence in one segment does not stop the multi-part transcription workflow', async () => {
  const { handler, env, saved } = setup({ ai: async () => ({ text: '' }) });
  const res = await handler.fetch(post({ data: fixtureWav(), save: false }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.silent, true);
  assert.equal(body.transcript, '');
  assert.equal(saved(), null);
});
