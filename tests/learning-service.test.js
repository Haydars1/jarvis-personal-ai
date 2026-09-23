import test from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePersonalFact, sourceBackedKnowledge } from '../src/application/learning/service.js';

test('personal learning rejects sensitive facts and accepts durable preference', () => {
  assert.equal(eligiblePersonalFact('API keyim abc123'), false);
  assert.equal(eligiblePersonalFact('Sağlık teşhisim astım'), false);
  assert.equal(eligiblePersonalFact('Türkçe cevapları tercih ediyorum'), true);
});

test('knowledge promotion only accepts rows with trustworthy http provenance', () => {
  const rows = sourceBackedKnowledge('software', [
    { title: 'Docs', url: 'https://example.com/docs', snippet: 'Cloudflare Worker bilgisi' },
    { title: 'Eksik', url: '', snippet: 'Kaynağı olmayan bilgi' },
    { title: 'Javascript', url: 'javascript:alert(1)', snippet: 'Tehlikeli kaynak' },
    { title: 'Data', url: 'data:text/plain,hello', snippet: 'Yerleşik veri kaynağı' }
  ], 1000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_url, 'https://example.com/docs');
});
