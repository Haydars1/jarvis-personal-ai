import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitizeSourcePoolSummary } from '../src/application/ecu/source-pool-state.js';

const read = relative => readFileSync(fileURLToPath(new URL('../'+relative, import.meta.url)), 'utf8');

test('local ECU bridge automatically starts source-pool synchronization and reports it in heartbeat', () => {
  const source = read('local-bridge/ecu-bridge.mjs');
  assert.match(source, /import \{ syncSourcePool \}/);
  assert.match(source, /JARVIS_SOURCE_SYNC\|\|'1'/);
  assert.match(source, /void refreshSourcePool\(\)/);
  assert.match(source, /source_pool:sourcePool/);
});

test('source-pool heartbeat summary is bounded before persistence', () => {
  const summary = sanitizeSourcePoolSummary({ status:'ready', root:'x'.repeat(800), requestedRepositories:232, ready:229, failed:3, error:'e'.repeat(2000) });
  assert.equal(summary.status, 'ready');
  assert.equal(summary.requested, 232);
  assert.equal(summary.ready, 229);
  assert.equal(summary.failed, 3);
  assert.equal(summary.root.length, 500);
  assert.equal(summary.error.length, 1000);
});

test('cloud runtime persists source-pool state without a new secret', () => {
  const state = read('src/application/ecu/source-pool-state.js');
  assert.match(state, /ecu_device_bridges WHERE token_sha256/);
  assert.match(state, /CREATE TABLE IF NOT EXISTS source_pool_state/);
  assert.match(state, /\/api\/ecu\/device\/source-pool/);
  assert.match(state, /source_pool_state\(bridge_id,summary_json/);
});

test('application composes source-pool state into the ECU bridge route', () => {
  const source = read('src/app-entry.js');
  assert.match(source, /createSourcePoolState/);
  assert.match(source, /createEcuChannelStore\(createSourcePoolState\(createEcuDeviceBridge/);
});

test('source-pool CLI detection is Windows-safe', () => {
  const source = read('local-bridge/source-pool-sync.mjs');
  assert.match(source, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(source, /new URL\(import\.meta\.url\)\.pathname/);
});
