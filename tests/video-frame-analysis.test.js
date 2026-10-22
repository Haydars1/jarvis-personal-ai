import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoFrameAnalysis } from '../src/application/capabilities/video-frame-analysis.js';
import { encryptCredential, jsonResponse } from '../src/lib/runtime.js';

function setup(authenticated = true) {
  let stored = null;
  const core = {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/api/auth/status') return jsonResponse({ authenticated });
      if (path === '/api/learning/video-skills') {
        stored = await request.json();
        return jsonResponse({ ok: true, record: { candidates: [], title: stored.title, screen_text: stored.screen_text } }, 201);
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    }
  };
  return { handler: createVideoFrameAnalysis(core), saved: () => stored };
}
function request(body, path = '/api/learning/video-skills/from-frames', method = 'POST') {
  return new Request('https://app.example' + path, {
    method, headers: { cookie: 'test-session=mock', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
const frame = { timestamp_sec: 1, mime: 'image/jpeg', data: 'A'.repeat(1200) };

test('video frames require a valid owner session', async () => {
  const { handler } = setup(false);
  const res = await handler.fetch(request({ frames: [frame] }), {});
  assert.equal(res.status, 401);
});
test('rejects missing or oversized frames before calling a vision provider', async () => {
  const { handler } = setup();
  assert.equal((await handler.fetch(request({ frames: [] }), {})).status, 400);
  assert.equal((await handler.fetch(request({ frames: Array(7).fill(frame) }), {})).status, 400);
  assert.equal((await handler.fetch(request({ frames: [{ ...frame, data: 'A'.repeat(550001) }] }), {})).status, 400);
  assert.equal((await handler.fetch(request(undefined, '/api/learning/video-skills/from-frames', 'GET'), {})).status, 405);
});
test('reports disconnected vision provider without claiming successful learning', async () => {
  const { handler, saved } = setup();
  const env = { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) } };
  const res = await handler.fetch(request({ frames: [frame] }), env);
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'VISION_PROVIDER_UNAVAILABLE');
  assert.equal(saved(), null);
});
test('analyzed observations are persisted as candidates without video bytes', async () => {
  const { handler, saved } = setup();
  const env = { CREDENTIAL_MASTER_KEY: 'test-only-credential-secret-at-least-24-chars' };
  const encrypted_secret = await encryptCredential(env, 'placeholder-test-key');
  env.DB = { prepare: () => ({
    bind: () => ({ all: async () => ({ results: [{ provider: 'gemini', label: 'Test Gemini', encrypted_secret, model: 'gemini-test' }] }) })
  }) };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    candidates: [{ content: { parts: [{ text: '[1.0] Jenkins ve Docker paneli görüntülendi.' }] } }]
  });
  try {
    const res = await handler.fetch(request({ title: 'jenkins.mp4', frames: [frame], notes: 'CI öğrenimi' }), env);
    assert.equal(res.status, 201);
    const result = await res.json();
    assert.equal(result.analyzed_frames, 1);
    assert.equal(result.vision.provider, 'Test Gemini');
    assert.match(saved().screen_text, /Jenkins ve Docker/);
    assert.ok(!JSON.stringify(saved()).includes(frame.data));
  } finally {
    globalThis.fetch = previousFetch;
  }
});
