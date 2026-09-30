import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const adaptersUrl = new URL('../local-bridge/capability-adapters.mjs', import.meta.url);
const adaptersPath = fileURLToPath(adaptersUrl);
const bridgePath = fileURLToPath(new URL('../local-bridge/capability-bridge.mjs', import.meta.url));
const cloudUrl = new URL('../src/application/capabilities/bridge.js', import.meta.url);
const cloudPath = fileURLToPath(cloudUrl);
const catalogUrl = new URL('../src/application/capabilities/catalog.js', import.meta.url);
const catalogPath = fileURLToPath(catalogUrl);
const schemaPath = fileURLToPath(new URL('../schema.sql', import.meta.url));
const appEntryPath = fileURLToPath(new URL('../src/app-entry.js', import.meta.url));

async function adapters() {
  assert.ok(existsSync(adaptersPath), 'generic local capability adapters must exist');
  return import(adaptersUrl.href);
}

async function cloudBridge() {
  assert.ok(existsSync(cloudPath), 'cloud capability bridge must exist');
  return import(cloudUrl.href);
}

test('generic bridge schema has isolated bridge and job queues', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS capability_bridges/);
  assert.match(schema, /token_sha256 TEXT NOT NULL UNIQUE/);
  assert.match(schema, /adapter_manifest TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS capability_jobs/);
  assert.match(schema, /capability TEXT NOT NULL/);
  assert.match(schema, /adapter_id TEXT/);
  assert.match(schema, /idx_capability_jobs_queue/);
});

test('catalog loader exposes the real harvested registry', async () => {
  assert.ok(existsSync(catalogPath), 'capability catalog module must exist');
  const { capabilityCatalog, capabilityCatalogSummary } = await import(catalogUrl.href);
  const entries = capabilityCatalog();
  assert.ok(entries.length >= 100);
  const summary = capabilityCatalogSummary();
  assert.equal(summary.total, entries.length);
  assert.ok(summary.accepted >= 1);
});

test('local adapter config supports broad generic execution types without remote shell control', async () => {
  const { SUPPORTED_ADAPTER_TYPES, parseAdapterConfig } = await adapters();
  for (const type of ['ollama', 'openai-compatible', 'json-http', 'command-json']) {
    assert.ok(SUPPORTED_ADAPTER_TYPES.includes(type), `missing adapter type ${type}`);
  }
  const parsed = parseAdapterConfig(JSON.stringify([
    { id: 'qwen', type: 'ollama', endpoint: 'http://127.0.0.1:11434', model: 'qwen3:4b', capabilities: ['chat','coding'], repo: 'ollama/ollama' },
    { id: 'worker', type: 'command-json', command: 'python3', args: ['adapter.py'], capabilities: ['speech-to-text'], repo: 'ggerganov/whisper.cpp' }
  ]));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].repo, 'ollama/ollama');
  assert.deepEqual(parsed[1].args, ['adapter.py']);
});

test('adapter selection respects capability, runtime availability, and explicit adapter id', async () => {
  const { parseAdapterConfig, selectAdapter } = await adapters();
  const list = parseAdapterConfig(JSON.stringify([
    { id: 'cpu-chat', type: 'ollama', endpoint: 'http://127.0.0.1:11434', capabilities: ['chat'], executionTarget: 'local-cpu' },
    { id: 'gpu-video', type: 'json-http', endpoint: 'http://127.0.0.1:8188/prompt', capabilities: ['video-generation'], executionTarget: 'local-gpu' }
  ]));
  assert.equal(selectAdapter(list, { capability: 'chat' }, ['local-cpu']).id, 'cpu-chat');
  assert.equal(selectAdapter(list, { capability: 'video-generation' }, ['local-cpu']), null);
  assert.equal(selectAdapter(list, { capability: 'video-generation', adapter_id: 'gpu-video' }, ['local-gpu']).id, 'gpu-video');
});

test('command-json adapter executable and arguments come only from local config', async () => {
  const { buildCommandInvocation } = await adapters();
  const adapter = { id: 'wrapper', type: 'command-json', command: 'node', args: ['safe-wrapper.mjs'] };
  const invocation = buildCommandInvocation(adapter, { command: 'rm', args: ['-rf','/'], payload: { hello: 'world' } });
  assert.equal(invocation.command, 'node');
  assert.deepEqual(invocation.args, ['safe-wrapper.mjs']);
  assert.equal(invocation.shell, false);
  assert.match(invocation.stdin, /"hello":"world"/);
  assert.doesNotMatch(invocation.stdin, /rm/);
});

test('cloud bridge sanitizes advertised adapters and matches capabilities deterministically', async () => {
  const { sanitizeAdapterManifest, bridgeSupportsCapability } = await cloudBridge();
  const manifest = sanitizeAdapterManifest([
    { id: ' qwen ', type: 'ollama', repo: 'ollama/ollama', capabilities: ['chat','coding','chat'], executionTarget: 'local-cpu' },
    { id: '../bad', type: 'command-json', capabilities: ['coding'] },
    { id: 'empty', type: 'json-http', capabilities: [] }
  ]);
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].id, 'qwen');
  assert.deepEqual(manifest[0].capabilities, ['chat','coding']);
  assert.equal(bridgeSupportsCapability(manifest, 'coding'), true);
  assert.equal(bridgeSupportsCapability(manifest, 'video-generation'), false);
});

test('local agent never enables shell evaluation or remote executable selection', () => {
  assert.ok(existsSync(bridgePath), 'generic capability local bridge agent must exist');
  const source = readFileSync(bridgePath, 'utf8');
  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
  assert.match(source, /JARVIS_CAPABILITY_ADAPTERS_JSON/);
  assert.match(source, /\/api\/capability-bridge\/jobs\/next/);
});

test('composition root exposes capability bridge APIs without replacing ECU safety bridge', () => {
  const source = readFileSync(appEntryPath, 'utf8');
  assert.match(source, /createCapabilityBridge/);
  assert.match(source, /\/api\/capability-bridge\//);
  assert.match(source, /createEcuDeviceBridge/);
});
