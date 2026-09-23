import test from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePersonalFact, sourceBackedKnowledge, savePersonalFact, learnSearchResults } from '../src/application/learning/service.js';

test('personal learning rejects sensitive facts and accepts durable preference', () => {
  assert.equal(eligiblePersonalFact('API keyim abc123'), false);
  assert.equal(eligiblePersonalFact('Sağlık teşhisim astım'), false);
  assert.equal(eligiblePersonalFact('Türkçe cevapları tercih ediyorum'), true);
});

test('knowledge promotion accepts safe provenance, rejects unsafe rows and deduplicates repeated evidence', () => {
  const rows = sourceBackedKnowledge('software', [
    { title: 'Docs', url: 'https://example.com/docs', snippet: 'Cloudflare Worker bilgisi ve güncel çalışma davranışı.' },
    { title: 'Mirror', url: 'https://mirror.example/docs', snippet: ' Cloudflare   Worker bilgisi ve güncel çalışma davranışı. ' },
    { title: 'Eksik', url: '', snippet: 'Kaynağı olmayan yeterince uzun bir bilgi satırı.' },
    { title: 'Javascript', url: 'javascript:alert(1)', snippet: 'Tehlikeli kaynak üzerinden gelen yeterince uzun bilgi.' },
    { title: 'Data', url: 'data:text/plain,hello', snippet: 'Yerleşik veri kaynağından gelen yeterince uzun bilgi.' }
  ], 1000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_url, 'https://example.com/docs');
});

test('research learning persists bounded evidence and records synthesis outcome', async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...args) { calls.push({ sql,args }); return { run: async () => ({ success:true }) }; } }; } };
  const result = await learnSearchResults({ DB:db }, 'Cloudflare Worker güncel bilgi', [
    { title:'Docs', url:'https://example.com/a', snippet:'Cloudflare Worker için doğrulanmış ve yeterince uzun güncel bilgi.' },
    { title:'Docs 2', url:'https://example.com/b', snippet:'Cloudflare Worker için ikinci doğrulanmış ve yeterince uzun bilgi.' }
  ]);
  assert.equal(result.saved, 2);
  assert.equal(result.candidates, 2);
  assert.equal(calls.filter(row => /INSERT INTO knowledge_memories/.test(row.sql)).length, 2);
  const event = calls.find(row => /INSERT INTO learning_events/.test(row.sql));
  assert.ok(event);
  assert.equal(event.args[1], 'research_synthesis');
  assert.equal(event.args[4], 'success');
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
