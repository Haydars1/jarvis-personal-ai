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
  const intake = await (await call('/api/learning/video-skills', 201, { title: 'Jenkins eğitimi', notes: 'Jenkins Docker CI öğrenimi' })).json();
  assert.equal(intake.record.status, 'analyzed-not-installed');
  assert.ok(intake.record.candidates.some(skill => skill.id === 'jenkins'));
  const providerAvailability = await (await call('/api/learning/video-skills/providers', 200)).json();
  assert.equal(typeof providerAvailability.cloudflare_ai_bound, 'boolean');
  const recentIntakes = await (await call('/api/learning/video-skills', 200)).json();
  assert.ok(recentIntakes.records.some(record => record.id === intake.record.id));
  await call('/api/learning/video-skills/from-frames', 400, { frames: [] });
  await call('/api/learning/video-skills/from-frames', 422, { frames: [{ mime: 'image/jpeg', timestamp_sec: 1, data: 'A'.repeat(1200) }] });
  await call('/api/learning/video-skills/from-audio', 400, { data: 'invalid' });


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
      await page.locator('#chatProvider').filter({ hasText: /^JARVIS$/ }).waitFor();
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/after-login.png', fullPage: true });
      // Exercise the actual browser UI, not only the Worker API.
      await page.locator('[data-page="settings"]:visible').first().click();
      const videoSkillsPanel = page.locator('details.settingsBlock').filter({ has: page.locator('#skillVideoAnalyze') });
      await videoSkillsPanel.locator('summary').click();
      await page.locator('#skillSubtitleFile').setInputFiles({
        name: 'jenkins-caption.srt', mimeType: 'text/plain',
        buffer: Buffer.from('1\n00:00:01,000 --> 00:00:03,000\nJenkins ve Docker ile test yapalım\n')
      });
      await page.locator('#skillVideoStatus').filter({ hasText: 'Altyazı aktarıldı' }).waitFor();
      assert.match(await page.locator('#skillVideoTranscript').inputValue(), /Jenkins ve Docker/);
      await page.locator('#skillVideoSaveNotes').click();
      await page.locator('#skillVideoStatus').filter({ hasText: 'Metin kaydedildi' }).waitFor();
      await page.locator('#skillVideoCandidates').filter({ hasText: 'Jenkins' }).waitFor();
      assert.equal(await page.locator('#skillVideoCopyForChatGPT').isEnabled(), true);
      await page.locator('#skillVideoTranscribe').click();
      await page.locator('#skillVideoStatus').filter({ hasText: 'Video veya ses dosyası seç.' }).waitFor();
      // Exercise browser-side WAV decoding without invoking Workers AI or consuming quota.
      let sampledWav = false;
      await page.route('**/api/learning/video-skills/from-audio', async route => {
        const requestBody = route.request().postDataJSON();
        assert.equal(requestBody.save, false);
        assert.ok(requestBody.data?.startsWith('UklGR'));
        sampledWav = true;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
          ok: true, transcribed_audio_seconds: 1, transcription_model: 'mock-whisper',
          transcript: 'Jenkins Docker eğitim',
          record: { title: 'audio-fixture.wav', status: 'analyzed-not-installed', candidates: [] }
        }) });
      });
      const browserWav = Buffer.alloc(44 + 32000);
      browserWav.write('RIFF', 0); browserWav.writeUInt32LE(36 + 32000, 4);
      browserWav.write('WAVE', 8); browserWav.write('fmt ', 12);
      browserWav.writeUInt32LE(16, 16); browserWav.writeUInt16LE(1, 20);
      browserWav.writeUInt16LE(1, 22); browserWav.writeUInt32LE(16000, 24);
      browserWav.writeUInt32LE(32000, 28); browserWav.writeUInt16LE(2, 32);
      browserWav.writeUInt16LE(16, 34); browserWav.write('data', 36);
      browserWav.writeUInt32LE(32000, 40);
      await page.locator('#skillVideoAudioFile').setInputFiles({
        name: 'audio-fixture.wav', mimeType: 'audio/wav', buffer: browserWav
      });
      await page.locator('#skillVideoTranscribe').click();
      await page.locator('#skillVideoStatus').filter({ hasText: 'işlendi ve tek kayda eklendi' }).waitFor();
      assert.equal(sampledWav, true);
      assert.match(await page.locator('#skillVideoTranscript').inputValue(), /Jenkins Docker eğitim/);
      await page.unroute('**/api/learning/video-skills/from-audio');
      await page.locator('#skillVideoHistory').filter({ hasText: 'jenkins-caption.srt' }).waitFor();
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/video-skill-ui.png', fullPage: true });

      console.log('Browser login state', await page.locator('#app').getAttribute('class'), 'errors', errors);
      await page.locator('[data-page="ecu"]:visible').first().click({ timeout: 10000 });
      await page.locator('#ecuFile').setInputFiles({ name: 'browser-fixture.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3, 4]) });
      await page.locator('#ecuDrop').filter({ hasText: 'browser-fixture.bin' }).waitFor();
      // The current app is ECU-first: legacy #ecuShell, #tools and old
      // calibration/Thinkdiag browser widgets are not mounted in this entrypoint.
      // Their API behavior is tested above; test the active ECU and 20-PDF UI here.
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-mobile.png', fullPage: true });
      await page.locator('[data-page="partcatalog"]:visible').first().click();
      await page.locator('#ecuManualLearning').waitFor({ state: 'visible' });
      console.log('ECU library panel', await page.locator('#ecuLibraryStatus').innerText(), await page.locator('#ecuLibraryStats').innerText());
      const library = await page.evaluate(async () => {
        const [stats, concepts] = await Promise.all([
          fetch('/api/ecu/manual-library/stats').then(r=>r.json()),
          fetch('/api/ecu/manual-library/concepts').then(r=>r.json())
        ]);
        return { stats, concepts };
      });
      console.log('ECU library APIs', JSON.stringify({stats:library.stats,manual_count:library.concepts?.manuals?.length}).slice(0,900));
      assert.equal(library.stats.source_documents, 20);
      assert.equal(library.concepts.manuals.length, 20);
      assert.ok(library.concepts.concepts.length >= 50);
      await page.screenshot({ animations: 'disabled', timeout: 10000, path: '.wrangler/browser-report/ecu-manual-library.png', fullPage: true });
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log(`Browser checks passed: sign-in, ECU file upload, 20-PDF knowledge library, ${expectedRepositoryTotal}-repo API, desktop/mobile rendering.`);
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
