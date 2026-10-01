import test from 'node:test';
import assert from 'node:assert/strict';
import { productionSmoke } from '../scripts/production-smoke.mjs';

test('production smoke validates public assets and protected sessions without paid generation', async () => {
  const visited = [];
  const checks = await productionSmoke('https://jarvis.test/api/health', async (url, init) => {
    visited.push({ url, init });
    const path = new URL(url).pathname;
    if (path === '/api/health') return new Response('{"ok":true}');
    if (path === '/') return new Response('<title>JARVIS</title>');
    if (path === '/app.js') return new Response('code', { headers: { 'content-type': 'application/javascript' } });
    if (path === '/api/auth/status') return new Response('{"authenticated":false}');
    return new Response('{"error":"AUTH_REQUIRED"}', { status: 401 });
  });
  assert.equal(checks.length, 8);
  assert.equal(visited.filter(item => item.init.method === 'POST').length, 1);
  assert.equal(visited.at(-1).url, 'https://jarvis.test/api/chat/send');
});

test('production smoke fails when private ECU channels become public', async () => {
  await assert.rejects(productionSmoke('https://jarvis.test', async url => {
    const path = new URL(url).pathname;
    if (path === '/api/health') return new Response('{"ok":true}');
    if (path === '/') return new Response('JARVIS');
    if (path === '/app.js') return new Response('code', { headers: { 'content-type': 'text/javascript' } });
    if (path === '/api/auth/status') return new Response('{"authenticated":false}');
    return new Response('{}');
  }), /expected HTTP 401/);
});
