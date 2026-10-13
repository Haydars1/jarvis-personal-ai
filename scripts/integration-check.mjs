import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { repositoryIntegrations } from '../src/lib/repository-integrations.js';

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
const expectedRepositoryTotal = repositoryIntegrations().length;
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
  await call('/api/tools/repositories', 401);
  await call('/api/ecu/thinkdiag/profile', 401);
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
  const hubDashboard = await (await call('/api/tools/agent-hub', 200)).json();
  assert.equal(hubDashboard.ok,true);
  assert.ok(hubDashboard.capabilities.curated_repositories>0);
  const hubCatalog = await (await call('/api/tools/agent-hub/catalog', 200)).json();
  assert.ok(hubCatalog.repositories.includes('haydars1/jarvis-personal-ai'));
  assert.ok(hubCatalog.repositories.includes('haydars1/6006coding-site'));
  const hubProviders = await (await call('/api/tools/agent-hub/providers', 200)).json();
  assert.deepEqual(hubProviders.providers.map(p => p.id), ['openhands','n8n','skills','freellmapi','ollama']);
  assert.ok(hubProviders.providers.every(p => p.available === false));

  await call('/api/integrations/status', 200);
  assert.equal((await (await call('/api/tools/repositories', 200)).json()).total, expectedRepositoryTotal);
  assert.equal((await (await call('/api/ecu/thinkdiag/profile', 200)).json()).model, 'THINKDIAG2');
  const tcBase64 = readFileSync('tests/fixtures/thinkcar-subaru.tc.base64', 'utf8').trim();
  const tcImport = await (await call('/api/ecu/thinkdiag/import', 200, { base64: tcBase64 })).json();
  assert.equal(tcImport.recording.record_count, 203);
  assert.equal(tcImport.summary.length, 32);
  const tcChat = await (await call('/api/chat/send', 200, { channel: 'ecu', text: 'Kaydı incele', attachments: [{ name: 'sample.TC', base64: tcBase64, type: 'application/octet-stream' }] })).json();
  assert.equal(tcChat.analysis.type, 'thinkdiag-tc');
  assert.equal(tcChat.history.length, 2);
  await call('/api/ecu/thinkdiag/import', 400, { base64: 'AQID' });
  const report = await (await call('/api/chat/send', 200, { channel: 'ecu', text: 'Raporu incele', attachments: [{ name: 'test.pdf', type: 'application/pdf', base64: 'AQID', extractedText: 'Engine P0299 underboost\nBCM B138F4B heater\nABS C0035 wheel\nGateway U0100 communication' }] })).json();
  assert.equal(report.analysis.type, 'diagnostic-report'); assert.equal(report.analysis.code_count, 4);
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
      await page.locator('[data-page="chat"]:visible').first().click({ timeout: 10000 });
      await page.locator('#chatProvider').filter({ hasText: /^JARVIS$/ }).waitFor();
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/after-login.png', fullPage: true });
      console.log('Browser login state', await page.locator('#app').getAttribute('class'), 'errors', errors);
      await page.locator('[data-page="ecu"]:visible').first().click({ timeout: 10000 });
      await page.locator('#ecuFile').setInputFiles({ name: 'browser-fixture.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3, 4]) });
      await page.locator('#ecuDrop').filter({ hasText: 'browser-fixture.bin' }).waitFor();
      await page.locator('#ecuDrop .ecuDropIcon').filter({ hasText: '✓' }).waitFor({ timeout: 30000 });
      await page.locator('#step2').waitFor({ state: 'visible' });
      // Current ECU screen: verify file analysis and device controls.
      // TC/PDF diagnostic imports are covered by authenticated API tests above.
      assert.match(await page.locator('#step2 .stepHead').innerText(), /Tuning Seçenekleri/);
      await page.locator('#ecuDeviceBtn').click();
      await page.locator('#ecuDevicePanel').waitFor({ state: 'visible' });
      await page.locator('#ecuDeviceClose').click();
      await page.locator('#ecuDevicePanel').waitFor({ state: 'hidden' });
      mkdirSync('.wrangler/browser-report', { recursive: true });
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-mobile.png', fullPage: true });
      // Tools is no longer a navigation page: Agent Hub is mounted under settings.
      await page.locator('[data-page="settings"]:visible').first().click();
      await page.locator('#jarvisAgentHub').waitFor({ state:'visible' });
      const hubResponse = await page.evaluate(async()=>{
        const res=await fetch('/api/tools/agent-hub',{credentials:'same-origin'});
        return {status:res.status,body:await res.text()};
      });
      console.log('Browser Agent Hub API',hubResponse.status,hubResponse.body.slice(0,400));
      console.log('Browser Agent Hub panel',await page.locator('#agentHubStats').innerText(),
        await page.locator('#agentHubMessage').innerText());
      assert.equal(hubResponse.status,200,'Agent Hub must be available to authenticated browser session');
      await page.locator('#agentHubStats').filter({ hasText:'Katalog:' }).waitFor({ timeout:10000 });
      await page.locator('#hubAutoRepo').fill('Haydars1/jarvis-personal-ai');
      await page.locator('#hubAutoTask').fill('ECU dosya yükleme sorunu');
      assert.equal(await page.locator('#hubAutoRepo').inputValue(),'Haydars1/jarvis-personal-ai');
      await page.locator('#hubSkillSource').selectOption('anthropics/skills');
      await page.screenshot({ animations:'disabled',timeout:10000,path:'.wrangler/browser-report/agent-hub-settings.png',fullPage:true });
      // Repository counts are checked through the authenticated HTTP API above.
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log(`Browser checks passed: sign-in, ECU upload, analysis options, device panel, Agent Hub settings, desktop/mobile rendering. TC/PDF diagnostic API checks passed separately.`);
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
