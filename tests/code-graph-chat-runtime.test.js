import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCodeGraphIntent, JARVIS_CODE_GRAPH_REPO } from '../src/application/code-graph/chat-runtime.js';

test('routes impacted-file questions to reverse dependency analysis',()=>{
  assert.equal(JARVIS_CODE_GRAPH_REPO,'Haydars1/jarvis-personal-ai');
  assert.deepEqual(parseCodeGraphIntent('JARVIS kodunda src/worker.js dosyasını değiştirsem neler etkilenir?'),{operation:'impact',files:['src/worker.js']});
});

test('routes dependency questions to graph neighbors',()=>{
  assert.deepEqual(parseCodeGraphIntent('Graphify ile `src/application/chat/orchestrator.js` bağımlılıklarını göster'),{operation:'neighbors',query:'src/application/chat/orchestrator.js',direction:'both'});
});

test('routes dependency path questions with two targets',()=>{
  assert.deepEqual(parseCodeGraphIntent('JARVIS code graph `src/app-entry.js` ile `src/worker.js` arasında dependency path göster'),{operation:'path',from:'src/app-entry.js',to:'src/worker.js'});
});

test('routes explicit graph symbol lookup',()=>{
  assert.deepEqual(parseCodeGraphIntent('Graphify code graph içinde `compileRepositorySkill` bul'),{operation:'find',query:'compileRepositorySkill'});
});

test('ordinary chat does not create graph work',()=>{
  assert.equal(parseCodeGraphIntent('Bugün nasılsın?'),null);
  assert.equal(parseCodeGraphIntent('Bana kısa bir mesaj yaz'),null);
});
