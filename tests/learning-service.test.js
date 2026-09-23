import test from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePersonalFact, sourceBackedKnowledge, savePersonalFact } from '../src/application/learning/service.js';

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

test('new personal facts persist memory and metadata in one D1 batch', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          const statement = { sql, args, first: async () => null, run: async () => ({ success:true }) };
          statements.push(statement);
          return statement;
        }
      };
    },
    async batch(batchStatements) {
      assert.equal(batchStatements.length, 2);
      assert.match(batchStatements[0].sql, /INSERT INTO memories/);
      assert.match(batchStatements[1].sql, /INSERT INTO personal_memory_meta/);
      return batchStatements.map(() => ({ success:true }));
    }
  };
  const id = await savePersonalFact({ DB:db }, 'Türkçe cevapları tercih ediyorum', () => 'memory-1');
  assert.equal(id, 'memory-1');
  assert.equal(statements.length, 3);
});

test('duplicate personal fact refreshes metadata without creating a new memory', async () => {
  let factoryCalled = false;
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            first: async () => sql.startsWith('SELECT') ? { memory_id:'memory-existing' } : null,
            run: async () => ({ success:true })
          };
        }
      };
    }
  };
  const id = await savePersonalFact({ DB:db }, 'Türkçe cevapları tercih ediyorum', () => { factoryCalled = true; return 'memory-new'; });
  assert.equal(id, 'memory-existing');
  assert.equal(factoryCalled, false);
  assert.equal(calls.filter(row => /INSERT INTO memories/.test(row.sql)).length, 0);
  assert.equal(calls.filter(row => /UPDATE personal_memory_meta/.test(row.sql)).length, 1);
});
