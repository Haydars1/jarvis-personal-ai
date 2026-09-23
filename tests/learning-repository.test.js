import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeRecord, buildLearningEvent, buildProviderDomainMetric } from '../src/application/learning/repository.js';

test('knowledge record requires provenance', () => {
  assert.throws(() => buildKnowledgeRecord({ text: 'Güncel bir bilgi', domain: 'news' }), /provenance/i);
  const row = buildKnowledgeRecord({ text: 'Kaynaklı bilgi', domain: 'software', sourceUrl: 'https://example.com/docs', sourceTitle: 'Docs', confidence: 0.9, now: 1000 });
  assert.equal(row.domain, 'software');
  assert.equal(row.source_url, 'https://example.com/docs');
  assert.equal(row.confidence, 0.9);
  assert.ok(row.expires_at > row.verified_at);
});

test('knowledge record rejects unsafe provenance protocols', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,bad', 'file:///etc/passwd', 'not-a-url']) {
    assert.throws(() => buildKnowledgeRecord({ text: 'unsafe', sourceUrl }), /provenance/i);
  }
  assert.doesNotThrow(() => buildKnowledgeRecord({ text: 'safe', sourceUrl: 'https://example.com/source' }));
});

test('learning event contains bounded diagnostic metadata', () => {
  const row = buildLearningEvent({ kind: 'provider_outcome', domain: 'software', provider: 'gemini', outcome: 'timeout', latencyMs: 3500, errorClass: 'timeout', now: 2000 });
  assert.equal(row.kind, 'provider_outcome');
  assert.equal(row.latency_ms, 3500);
  assert.equal(row.error_class, 'timeout');
});

test('provider domain metric uses provider and domain identity', () => {
  const row = buildProviderDomainMetric({ provider: 'gemini', domain: 'software', ok: true, latencyMs: 800, now: 3000 });
  assert.equal(row.provider, 'gemini');
  assert.equal(row.domain, 'software');
  assert.equal(row.samples, 1);
  assert.equal(row.successes, 1);
  assert.equal(row.failures, 0);
});