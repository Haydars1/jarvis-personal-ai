import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('wrangler points at the explicit application composition root', () => {
  const wrangler = read('wrangler.jsonc');
  assert.match(wrangler, /"main"\s*:\s*"src\/app-entry\.js"/);
});

test('composition root owns smart routing, Google search, enhancements, OS, social, video, output, capabilities, media, orchestration and push wiring', () => {
  const entry = read('src/app-entry.js');
  assert.match(entry, /from '\.\/provider-entry\.js'/);
  assert.match(entry, /createSmartRouter/);
  assert.match(entry, /createGoogleSearch/);
  assert.match(entry, /createChatEnhancements/);
  assert.match(entry, /createJarvisOS/);
  assert.match(entry, /createSocialGrowth/);
  assert.match(entry, /createVideoFailover/);
  assert.match(entry, /createChatOutput/);
  assert.match(entry, /createCapabilityRuntime/);
  assert.match(entry, /createChatOrchestrator/);
  assert.match(entry, /createMediaRescue/);
  assert.match(entry, /createPushApi/);
  assert.doesNotMatch(entry, /from '\.\/smart-router-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/google-search-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/chat-enhancements-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/jarvis-os-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/social-growth-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/video-failover-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/chat-output-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/capability-runtime-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/apns-push-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/jarvis-orchestrator-entry\.js'/);
  assert.doesNotMatch(entry, /from '\.\/media-rescue-entry\.js'/);
});

test('migrated entries remain thin compatibility adapters', () => {
  const adapters = [
    ['src/apns-push-entry.js', /createPushApi/, 2000],
    ['src/jarvis-orchestrator-entry.js', /createChatOrchestrator/, 1200],
    ['src/media-rescue-entry.js', /createMediaRescue/, 1200],
    ['src/capability-runtime-entry.js', /createCapabilityRuntime/, 800],
    ['src/chat-output-entry.js', /createChatOutput/, 800],
    ['src/video-failover-entry.js', /createVideoFailover/, 800],
    ['src/social-growth-entry.js', /createSocialGrowth/, 800],
    ['src/jarvis-os-entry.js', /createJarvisOS/, 800],
    ['src/chat-enhancements-entry.js', /createChatEnhancements/, 800],
    ['src/google-search-entry.js', /createGoogleSearch/, 800],
    ['src/smart-router-entry.js', /createSmartRouter/, 800]
  ];
  for (const [path, marker, max] of adapters) {
    const source = read(path);
    assert.match(source, marker);
    assert.ok(source.length < max, `${path} should stay a thin adapter`);
  }
});
