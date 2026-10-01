import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createEcuBinaryInspector } from '../src/application/ecu/binary-inspector.js';
import { createEcuChannelStore } from '../src/application/ecu/channels.js';
import { createEmergencyChatFallback } from '../src/application/chat/emergency-fallback.js';
import { callVaultProvider } from '../src/application/chat/smart-router.js';
import { encryptCredential } from '../src/lib/runtime.js';
import { decodeEcuFile, MAX_ECU_FILE_BYTES } from '../src/lib/ecu-file.js';
import { createOwnerRouteGuard } from '../src/application/chat/owner-route-guard.js';
import { createEcuDeviceBridge } from '../src/application/ecu/device-bridge.js';
import { createPushApi } from '../src/infrastructure/apns/push-service.js';

const request = body => new Request('https://jarvis.test/api/chat/send', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const attachment = (name, bytes) => ({ name, base64: Buffer.from(bytes).toString('base64') });
const core = { fetch: async () => new Response(JSON.stringify({ reply: 'passthrough' })) };

function database(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  db.exec(schema); // Production deploy applies this additive schema repeatedly.
  const DB = { prepare(sql) {
    const statement = db.prepare(sql);
    const bound = args => ({
      all: async () => ({ results: statement.all(...args) }),
      first: async () => statement.get(...args) || null,
      run: async () => statement.run(...args)
    });
    return { ...bound([]), bind: (...args) => bound(args) };
  } };
  return { db, DB };
}

test('ECU upload handles padded Base64 and rejects empty, malformed and oversized input', () => {
  assert.deepEqual([...decodeEcuFile('AQ==')], [1]);
  assert.deepEqual([...decodeEcuFile('AQI=')], [1, 2]);
  for (const value of ['', undefined, null, 123]) assert.throws(() => decodeEcuFile(value), /ECU_FILE_EMPTY/);
  assert.throws(() => decodeEcuFile('!!!'), /ECU_FILE_INVALID_BASE64/);
  assert.throws(() => decodeEcuFile('A'.repeat(Math.ceil(MAX_ECU_FILE_BYTES / 3) * 4 + 1)), /ECU_FILE_TOO_LARGE/);
});

test('owner guard blocks unauthenticated chat and ECU channel access before execution', async () => {
  for (const path of ['/api/chat/send', '/api/ecu/channels', '/api/ecu/channels/test/messages']) {
    for (const status of [new Response('{"authenticated":false}'), new Response('not json')]) {
      const guard = createOwnerRouteGuard({ fetch: async () => status }, async () => { assert.fail('Unauthorized route executed'); });
      assert.equal((await guard(new Request(`https://jarvis.test${path}`), {}, {})).status, 401);
    }
  }
});

test('iOS push registration persists safely and reports missing Apple configuration', async t => {
  const env = database(t);
  const push = createPushApi({ fetch: async () => new Response('{"authenticated":true}') });
  const call = (path, body) => push(new Request(`https://jarvis.test/api/mobile/push/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }), env, {});
  assert.equal((await call('register', { token: 'invalid' })).status, 400);
  const fixtureToken = 'a'.repeat(64);
  const first = await (await call('register', { token: fixtureToken, environment: 'sandbox' })).json();
  const second = await (await call('register', { token: fixtureToken, environment: 'production' })).json();
  assert.equal(first.id, second.id);
  const status = await (await call('status')).json();
  assert.equal(status.configured, false);
  assert.deepEqual(status.missing, ['APNS_TEAM_ID', 'APNS_KEY_ID', 'APNS_PRIVATE_KEY']);
  assert.equal(status.devices.length, 1);
  assert.equal(status.devices[0].environment, 'production');
  assert.equal(JSON.stringify(status).includes(fixtureToken), false);
  assert.equal((await call('test', {})).status, 503);
});

test('owner guard forwards session headers and preserves separately authenticated bridge routes', async () => {
  const auth = { fetch: async req => {
    assert.equal(req.headers.get('cookie'), 'fixture-session');
    return new Response('{"authenticated":true}');
  } };
  const guard = createOwnerRouteGuard(auth, async () => new Response('ok'));
  assert.equal((await guard(new Request('https://jarvis.test/api/ecu/channels', { headers: { cookie: 'fixture-session' } }), {}, {})).status, 200);
  const bridgeGuard = createOwnerRouteGuard({ fetch: () => { assert.fail('Bridge token auth must remain separate'); } }, async req => new Response(req.headers.get('authorization')));
  assert.equal(await (await bridgeGuard(new Request('https://jarvis.test/api/ecu/device/heartbeat', { headers: { authorization: 'Bearer fixture-token' } }), {}, {})).text(), 'Bearer fixture-token');
});

test('device job completes registration, token heartbeat, claim and simulated result on the real schema', async t => {
  const env = database(t);
  const bridge = createEcuDeviceBridge({ fetch: async () => new Response('{"authenticated":true}') });
  const call = async (path, body, token) => bridge.fetch(new Request(`https://jarvis.test/api/ecu/device/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }), env, {});
  const registered = await (await call('bridges/register', { label: 'Simulation fixture' })).json();
  assert.ok(registered.token);
  assert.equal((await call('heartbeat', { capabilities: ['read_dtc'] }, 'wrong-token')).status, 401);
  assert.equal((await call('heartbeat', { capabilities: ['read_dtc', 'read_live_data'] }, registered.token)).status, 200);
  for (const action of ['read_dtc', 'read_live_data']) {
    const queued = await (await call('jobs', { action, bridge_id: registered.bridge.id })).json();
    assert.equal(queued.job.status, 'pending');
    const claimed = await (await call('jobs/next', undefined, registered.token)).json();
    assert.equal(claimed.job.id, queued.job.id);
    assert.equal(claimed.job.status, 'running');
    const completed = await (await call(`jobs/${queued.job.id}/result`, { ok: true, result: { simulated: true, action } }, registered.token)).json();
    assert.equal(completed.job.status, 'completed');
    assert.equal(completed.job.result.simulated, true);
  }
  assert.equal((await (await call('jobs/next', undefined, registered.token)).json()).job, null);
  assert.equal((await call('jobs', { action: 'clear_dtc' })).status, 409);
});

test('binary inspector calculates actual ORI/MOD differences including appended bytes', async () => {
  const handler = createEcuBinaryInspector(core);
  const response = await handler.fetch(request({ channel: 'ecu', attachments: [
    attachment('original.ori', [1, 2, 3]), attachment('tuned.mod', [1, 9, 3, 4])
  ] }), {}, {});
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(payload.reply, /Değişen byte: 2/);
  assert.match(payload.reply, /İlk fark: 0x1 • Son fark: 0x3/);
  assert.match(payload.reply, /%50/);
});

test('binary inspector recognizes MOD and ECU files without a MIME type', async () => {
  for (const name of ['test.mod', 'test.ecu']) {
    const response = await createEcuBinaryInspector(core).fetch(request({ channel: 'ecu', attachments: [attachment(name, [1])] }), {}, {});
    assert.match((await response.json()).reply, /Boyut: 1 byte/);
  }
});

test('binary diff reports additional ranges only when some ranges are omitted', async () => {
  for (const count of [12, 24, 25]) {
    const a = Array(count * 2).fill(0), b = a.map((value, i) => i % 2 === 0 ? 1 : value);
    const response = await createEcuBinaryInspector(core).fetch(request({ channel: 'ecu', attachments: [attachment('ori.bin', a), attachment('mod.bin', b)] }), {}, {});
    const payload = await response.json();
    assert.equal(payload.reply.includes('daha fazla bölge var'), count > 12);
    assert.equal(payload.analysis.truncatedRanges, count > 24);
    assert.equal(payload.analysis.changed, count);
  }
});

test('ECU channel validates input before writing any channel or message', async t => {
  const env = database(t), handler = createEcuChannelStore(createEcuBinaryInspector(core));
  for (const base64 of ['', '!!!']) {
    const response = await handler.fetch(request({ channel: 'ecu', attachments: [{ name: 'file.bin', base64 }] }), env, {});
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /^ECU_FILE_/);
  }
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM ecu_chat_channels').get().n, 0);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM ecu_chat_messages').get().n, 0);
});

test('ECU analysis persists exact file size, reuses the channel and returns ordered history', async t => {
  const env = database(t), handler = createEcuChannelStore(createEcuBinaryInspector(core));
  const body = { channel: 'ecu', text: 'analiz et', attachments: [attachment('original.bin', [1])] };
  const first = await (await handler.fetch(request(body), env, {})).json();
  const second = await (await handler.fetch(request(body), env, {})).json();
  assert.equal(first.channelId, second.channelId);
  assert.equal(env.db.prepare('SELECT file_size FROM ecu_chat_channels').get().file_size, 1);
  assert.deepEqual(second.history.map(item => item.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(second.channel.file_sha256.length, 64);
});

test('ECU channel history retains the newest 1000 messages rather than the oldest', async t => {
  const env = database(t), handler = createEcuChannelStore(core);
  const response = await handler.fetch(new Request('https://jarvis.test/api/ecu/channels', { method: 'POST', body: JSON.stringify({ id: 'long-chat', title: 'test' }) }), env, {});
  assert.equal(response.status, 200);
  const insert = env.db.prepare('INSERT INTO ecu_chat_messages(id,channel_id,role,content,created_at) VALUES(?,?,?,?,?)');
  for (let i = 0; i < 1005; i++) insert.run(String(i), 'long-chat', 'user', String(i), i);
  const payload = await (await handler.fetch(new Request('https://jarvis.test/api/ecu/channels/long-chat/messages'), env, {})).json();
  assert.equal(payload.messages.length, 1000);
  assert.equal(payload.messages[0].content, '5');
  assert.equal(payload.messages.at(-1).content, '1004');
});

test('emergency AI replaces only the failed current answer and preserves older messages', async () => {
  const failure = 'JARVIS şu an yanıt üretemedi. Mesajın kaydedildi.';
  const history = [{ role: 'user', content: 'önceki soru' }, { role: 'assistant', content: 'önceki doğru cevap' }, { role: 'user', content: 'yeni soru' }, { role: 'assistant', content: failure }];
  const handle = createEmergencyChatFallback(async () => new Response(JSON.stringify({ reply: failure, history, channelId: 'keep-me' })));
  const payload = await (await handle(request({ text: 'yeni soru' }), { AI: { run: async () => ({ response: 'yeni cevap' }) } }, {})).json();
  assert.equal(payload.history[1].content, 'önceki doğru cevap');
  assert.equal(payload.history.at(-1).content, 'yeni cevap');
  assert.equal(payload.channelId, 'keep-me');
  assert.equal(history.at(-1).content, failure);
});

test('emergency AI leaves healthy, error and unavailable-AI responses unchanged', async () => {
  for (const [status, reply] of [[200, 'doğru cevap'], [400, 'JARVIS şu an yanıt üretemedi']]) {
    const original = new Response(JSON.stringify({ reply }), { status });
    const handle = createEmergencyChatFallback(async () => original);
    assert.equal(await handle(request({ text: 'soru' }), { AI: { run: () => { throw new Error('must not run'); } } }, {}), original);
  }
  const original = new Response(JSON.stringify({ reply: 'JARVIS şu an yanıt üretemedi' }));
  assert.equal(await createEmergencyChatFallback(async () => original)(request({ text: 'soru' }), {}, {}), original);
});

test('Anthropic request uses Messages protocol and records successful metrics', async t => {
  const env = { ...database(t), CREDENTIAL_MASTER_KEY: 'test-master-key-for-reliability-only' };
  const encrypted_secret = await encryptCredential(env, 'fixture-key');
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'fixture-key');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(init.body);
    assert.equal(body.system, 'Türkçe cevap ver');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'merhaba' }]);
    assert.equal(body.max_tokens, 900);
    return new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: 'not output' }, { type: 'text', text: 'Merhaba' }] }));
  };
  const result = await callVaultProvider(env, { provider: 'anthropic', label: 'Claude test', model: 'configured-model', encrypted_secret }, [{ role: 'system', content: 'Türkçe cevap ver' }, { role: 'user', content: 'merhaba' }]);
  assert.equal(result.text, 'Merhaba');
  assert.equal(env.db.prepare('SELECT successes FROM provider_metrics').get().successes, 1);
});

test('OpenAI-compatible endpoint is not doubled and failed quota updates provider metrics', async t => {
  const env = { ...database(t), CREDENTIAL_MASTER_KEY: 'test-master-key-for-reliability-only' };
  const encrypted_secret = await encryptCredential(env, 'fixture-key');
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    assert.equal(url, 'https://example.test/v1/chat/completions');
    return new Response('{}', { status: 429 });
  };
  await assert.rejects(callVaultProvider(env, { provider: 'openai-compatible', endpoint: 'https://example.test/v1/chat/completions', model: 'configured-model', encrypted_secret }, [{ role: 'user', content: 'test' }]), /429/);
  const metric = env.db.prepare('SELECT failures,last_error FROM provider_metrics').get();
  assert.equal(metric.failures, 1);
  assert.match(metric.last_error, /429/);
});
