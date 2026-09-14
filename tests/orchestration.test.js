import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanReply,
  complexity,
  directUrl,
  needsOrchestration,
  scoreProvider,
  taskKind,
  wantsResearch,
  wantsTools
} from '../src/lib/orchestration.js';

test('classifies common chat without orchestration', () => {
  assert.equal(taskKind('merhaba nasılsın'), 'chat');
  assert.equal(needsOrchestration('merhaba nasılsın'), false);
});

test('classifies research and live sports as research', () => {
  assert.equal(wantsResearch('Galatasaray canlı skor ne'), true);
  assert.equal(taskKind('Galatasaray canlı skor ne'), 'research');
  assert.equal(needsOrchestration('Galatasaray canlı skor ne'), true);
});

test('detects explicit tool intent', () => {
  assert.equal(wantsTools('bunu yapacak bir araç bul ve sisteme ekle'), true);
  assert.equal(needsOrchestration('bunu yapacak bir araç bul ve sisteme ekle'), true);
});

test('complexity remains deterministic', () => {
  assert.equal(complexity('kısa soru?'), 'simple');
  assert.equal(complexity('Bunu araştır ve karşılaştır; sonra artıları, eksileri, riski ve planı yaz. Ayrıca kaynak ver.'), 'complex');
});

test('unwraps DuckDuckGo redirect URL without double decoding', () => {
  const source = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1%25202';
  assert.equal(directUrl(source), 'https://example.com/a?x=1%202');
});

test('cleanReply normalizes redirect links and excessive blank lines', () => {
  const source = 'Kaynak: https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fhaber\n\n\n\nBitti';
  assert.equal(cleanReply(source), 'Kaynak: https://example.com/haber\n\nBitti');
});

test('provider scoring rewards healthy low-latency capability matches', () => {
  const fast = scoreProvider({ provider: 'gemini', capabilities: '["chat"]', samples: 10, successes: 10, avg_latency_ms: 900, priority: 10 }, 'research');
  const slow = scoreProvider({ provider: 'gemini', capabilities: '["chat"]', samples: 10, successes: 5, avg_latency_ms: 7000, priority: 10 }, 'research');
  assert.ok(fast > slow);
});
