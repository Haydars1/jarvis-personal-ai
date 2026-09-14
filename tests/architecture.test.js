import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('wrangler points at the explicit application composition root', () => {
  const wrangler = read('wrangler.jsonc');
  assert.match(wrangler, /"main"\s*:\s*"src\/app-entry\.js"/);
});

test('composition root owns chat, media rescue and push wiring', () => {
  const entry = read('src/app-entry.js');
  assert.match(entry, /from '\.\/capability-runtime-entry\.js'/);
  assert.match(entry, /createChatOrchestrator/);
  assert.match(entry, /createMediaRescue/);
  assert.match(entry, /createPushApi/);
  assert.doesNotMatch(entry, /from '\.\/apns-push-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/jarvis-orchestrator-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/media-rescue-entry\.js'/);
});

test('old top-level entries are compatibility adapters, not implementation owners', () => {
  const apns = read('src/apns-push-entry.js');
  const orchestrator = read('src/jarvis-orchestrator-entry.js');
  const media = read('src/media-rescue-entry.js');

  assert.match(apns, /createPushApi/);
  assert.match(orchestrator, /createChatOrchestrator/);
  assert.match(media, /createMediaRescue/);
  assert.ok(apns.length < 2000);
  assert.ok(orchestrator.length < 1200);
  assert.ok(media.length < 1200);
});
