import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLearningDomain,
  isSensitiveMemory,
  normalizeMemoryText,
  knowledgeFreshness,
  scoreProviderDomain
} from '../src/application/learning/policy.js';

test('classifies common Turkish domains', () => {
  assert.equal(classifyLearningDomain('Mercedes E300 motor ve yakıt tüketimi'), 'automotive');
  assert.equal(classifyLearningDomain('JavaScript Cloudflare Worker hatası'), 'software');
  assert.equal(classifyLearningDomain('YouTube için deep house müzik üretimi'), 'music');
});

test('rejects sensitive durable memories', () => {
  assert.equal(isSensitiveMemory('API keyim abc123'), true);
  assert.equal(isSensitiveMemory('şifrem budur'), true);
  assert.equal(isSensitiveMemory('sağlık teşhisim var'), true);
  assert.equal(isSensitiveMemory('Türkçe cevapları tercih ediyorum'), false);
});

test('normalizes memory for deterministic dedupe', () => {
  assert.equal(normalizeMemoryText('  Türkçe   Cevapları Tercih Ediyorum. '), 'türkçe cevapları tercih ediyorum');
});

test('assigns short freshness to current information', () => {
  assert.ok(knowledgeFreshness('news', 'bugünkü fiyat') <= 86400000);
  assert.ok(knowledgeFreshness('software', 'JavaScript sözdizimi') > 86400000);
});

test('provider score rewards success and penalizes failure and latency', () => {
  const good = scoreProviderDomain({ samples: 20, successes: 19, failures: 1, avg_latency_ms: 700 });
  const bad = scoreProviderDomain({ samples: 20, successes: 8, failures: 12, avg_latency_ms: 6000 });
  assert.ok(good > bad);
  assert.ok(good <= 1 && bad >= 0);
});
