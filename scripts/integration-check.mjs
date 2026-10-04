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
function sleep(ms) { return new Promise(resolvePromise => setTimeout(resolvePromise, ms)); }
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(`${base}/health`); if (response.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error(`Local Worker did not start\n${output.slice(-4000)}`);
}
async function call(path, expected = 200, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.clone().text();
  assert.equal(response.status, expected, `${path}: expected ${expected}, got ${response.status}: ${text.slice(0, 600)}`);
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return response;
}
let cookie = '';
try {
  server = spawn(process.execPath, [cli, 'dev', '--config', config, '--port', String(port), '--local'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { output += chunk.toString(); process.stdout.write(chunk); });
  server.stderr.on('data', chunk => { output += chunk.toString(); process.stderr.write(chunk); });
  await waitForServer();
  const health = await (await call('/health', 200)).json();
  assert.equal(health.ok, true);
  await call('/api/ecu/channels', 401);
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
  const repositoryIndex = await (await call('/api/tools/repositories', 200)).json();
  assert.equal(repositoryIndex.total, repositoryIntegrations().length);
  assert.ok(repositoryIndex.total >= 214);
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
    const reportDir = resolve('.wrangler/browser-report');
    mkdirSync(reportDir, { recursive: true });
    const browserScript = `
      const { chromium } = require('playwright');
      (async()=>{const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1440,height:1000}}); await page.goto('${base}', {waitUntil:'networkidle'}); await page.screenshot({path:'${join(reportDir, 'home.png').replaceAll('\\', '\\\\')}', fullPage:true}); const title=await page.title(); if(!title) throw new Error('empty title'); await browser.close();})().catch(error=>{console.error(error);process.exit(1)});
    `;
    const browserResult = spawnSync(process.execPath, ['-e', browserScript], { env, encoding: 'utf8' });
    if (browserResult.status !== 0) throw new Error(`Browser check failed: ${browserResult.stderr || browserResult.stdout}`);
  }
  count = 1;
} finally {
  if (server) server.kill('SIGTERM');
  rmSync(directory, { recursive: true, force: true });
}
if (count !== 1) throw new Error('Integration check did not complete');
console.log('Integration checks passed.');
