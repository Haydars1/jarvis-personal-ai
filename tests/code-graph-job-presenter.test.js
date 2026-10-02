import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCodeGraphResult } from '../src/application/code-graph/job-presenter.js';

test('formats impacted files for chat',()=>{
  const text=formatCodeGraphResult({operation:'impact',stats:{nodes:10,edges:20},files:['src/worker.js'],impacted:[{file:'src/app-entry.js',score:2},{file:'src/application/chat/orchestrator.js',score:1}]});
  assert.match(text,/10 düğüm \/ 20 bağlantı/);
  assert.match(text,/src\/app-entry\.js/);
  assert.match(text,/orchestrator\.js/);
});

test('formats dependency path in order',()=>{
  const text=formatCodeGraphResult({operation:'path',stats:{nodes:5,edges:4},path:[{file:'src/a.js',name:'A',kind:'module'},{file:'src/b.js',name:'B',kind:'module'}]});
  assert.ok(text.indexOf('src/a.js')<text.indexOf('src/b.js'));
  assert.match(text,/Bağımlılık yolu/);
});

test('formats empty lookup without inventing nodes',()=>{
  const text=formatCodeGraphResult({operation:'find',stats:{nodes:3,edges:2},query:'missing',nodes:[]});
  assert.match(text,/Eşleşme bulunamadı/);
});
