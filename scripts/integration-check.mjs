import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// Isolated local Worker: no AI binding, production credentials, external services or vehicle.
const directory = mkdtempSync(join(tmpdir(), 'jarvis-http-test-'));
const config = join(directory, 'wrangler.json');
const persistence = join(directory, 'state');
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
const port = 18787;
const base = `http://127.0.0.1:${port}`;
writeFileSync(config, JSON.stringify({
  name: 'jarvis-http-test', main: resolve('src/app-entry.js'), compatibility_date: '2026-09-12',
  compatibility_flags: ['nodejs_compat'],
  assets: { directory: resolve('public'), binding: 'ASSETS', not_found_handling: 'single-page-application' },
  d1_databases: [{ binding: 'DB', database_name: 'jarvis-test', database_id: '00000000-0000-0000-0000-000000000001' }],
  vars: { JARVIS_SECRET: 'isolated-http-test-secret-only', CREDENTIAL_MASTER_KEY: 'isolated-http-master-key-only' }
}));
let server, output = '';
let count = 0;
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
try {
  const schema = spawnSync(process.execPath, [cli, 'd1', 'execute', 'jarvis-test', '--local', '--config', config, '--persist-to', persistence, '--file', resolve('schema.sql')], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(schema.status, 0, schema.stderr || schema.stdout);
  server = spawn(process.execPath, [cli, 'dev', '--local', '--config', config, '--persist-to', persistence, '--ip', '127.0.0.1', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Local Worker did not become ready: ${output}`);
  let cookie = '';
  async function call(path, expected, body, headers = {}) {
    const r = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
    assert.equal(r.status, expected, `${path}: ${await r.clone().text()}`);
    count++;
    return r;
  }
  assert.equal((await (await call('/api/health', 200)).json()).ok, true);
  assert.match(await (await call('/', 200)).text(), /JARVIS/);
  await call('/api/ecu/channels', 401);
  await call('/api/chat/send', 401, { text: 'session test' });
  await call('/api/tools/cloud/adapters', 401);
  await call('/api/auth/setup', 400, { password: 'short' });
  const setup = await call('/api/auth/setup', 200, { password: 'http-test-password-only' });
  cookie = setup.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await call('/api/auth/status', 200)).json()).authenticated, true);
  await call('/api/auth/setup', 409, { password: 'http-test-password-only' });
  await call('/api/auth/login', 403, { password: 'incorrect' });
  await call('/api/auth/login', 200, { password: 'http-test-password-only' });
  const channels = await (await call('/api/ecu/channels', 200)).json();
  assert.ok(Array.isArray(channels.channels));
  const file = { name: 'http-fixture.bin', base64: 'AQID' };
  const analyzed = await (await call('/api/chat/send', 200, { channel: 'ecu', text: 'Dosya içeriğini incele', attachments: [file] })).json();
  assert.match(analyzed.reply, /Boyut: 3 byte/);
  assert.ok(analyzed.channelId);
  const history = await (await call(`/api/ecu/channels/${analyzed.channelId}/messages`, 200)).json();
  assert.equal(history.messages.length, 2);
  await call('/api/chat/send', 400, { channel: 'ecu', attachments: [{ name: 'bad.bin', base64: '!!!' }] });
  const bridge = await (await call('/api/ecu/device/bridges/register', 201, { label: 'HTTP simulation fixture' })).json();
  await call('/api/ecu/device/heartbeat', 200, { capabilities: ['read_dtc'] }, { authorization: `Bearer ${bridge.token}` });
  const queued = await (await call('/api/ecu/device/jobs', 201, { action: 'read_dtc', bridge_id: bridge.bridge.id })).json();
  const claimed = await (await call('/api/ecu/device/jobs/next', 200, undefined, { authorization: `Bearer ${bridge.token}` })).json();
  assert.equal(claimed.job.id, queued.job.id);
  assert.equal(claimed.job.status, 'running');
  const result = await (await call(`/api/ecu/device/jobs/${queued.job.id}/result`, 200, { ok: true, result: { simulated: true, dtcs: [] } }, { authorization: `Bearer ${bridge.token}` })).json();
  assert.equal(result.job.status, 'completed');
  await call('/api/ecu/device/jobs', 409, { action: 'clear_dtc' });
  await call('/api/tools/cloud/adapters', 200);
  await call('/api/integrations/status', 200);
  cookie = '';
  await call('/api/ecu/channels', 401);
  if (process.env.JARVIS_BROWSER_TEST === '1') {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      mkdirSync('.wrangler/browser-report', { recursive: true });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.locator('#authMsg').filter({ hasText: 'Parolanı gir' }).waitFor();
      await page.locator('#pw').fill('http-test-password-only');
      await page.locator('#authBtn').click();
      await page.locator('#app').waitFor({ state: 'visible' });
      await page.locator('#chatProvider').filter({ hasText: /^JARVIS$/ }).waitFor();
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/after-login.png', fullPage: true });
      console.log('Browser login state', await page.locator('#app').getAttribute('class'), 'errors', errors);
      await page.locator('[data-page="ecu"]:visible').first().click({ timeout: 10000 });
      await page.locator('#ecuFile').setInputFiles({ name: 'browser-fixture.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3, 4]) });
      await page.locator('#ecuMeta').filter({ hasText: 'browser-fixture.bin' }).waitFor();
      mkdirSync('.wrangler/browser-report', { recursive: true });
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-mobile.png', fullPage: true });
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log('Browser checks passed: password sign-in, navigation, real file input, desktop/mobile rendering.');
    } finally { await browser.close(); }
  }
  console.log(`Full Worker HTTP integration checks passed (${count}). No paid API or physical device was used.`);
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  rmSync(directory, { recursive: true, force: true });
}
