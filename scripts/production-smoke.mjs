import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function productionSmoke(baseUrl, request = fetch) {
  const base = String(baseUrl || '').replace(/\/$/, '').replace(/\/(api\/)?health$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('HEALTH_URL_REQUIRED');
  const checks = [];
  async function check(path, expected, init, validate) {
    const response = await request(`${base}${path}`, { ...init, signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, expected, `${path}: expected HTTP ${expected}`);
    if (validate) await validate(response);
    checks.push(path);
  }
  await check('/api/health', 200, undefined, async r => assert.equal((await r.json()).ok, true));
  await check('/', 200, undefined, async r => assert.match(await r.text(), /JARVIS/i));
  await check('/app.js', 200, undefined, async r => assert.match(r.headers.get('content-type'), /javascript/));
  await check('/api/auth/status', 200, undefined, async r => assert.equal((await r.json()).authenticated, false));
  for (const path of ['/api/ecu/channels', '/api/ecu/device/bridges', '/api/integrations/status']) {
    await check(path, 401, undefined);
  }
  await check('/api/chat/send', 401, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Deployment session boundary check' }) });
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = await productionSmoke(process.env.HEALTH_URL);
  console.log(`Production HTTP checks passed (${checks.length}); no AI generation was requested.`);
}
