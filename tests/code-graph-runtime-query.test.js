import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { executeCodeGraphQuery } from '../.github/scripts/code-graph-job.mjs';

const graph=JSON.parse(readFileSync(new URL('./fixtures/code-graph.json',import.meta.url),'utf8'));
const meta={repo:'Haydars1/jarvis-personal-ai',commit:graph.source_commit};

test('runtime graph query reports current graph status',()=>{
  const result=executeCodeGraphQuery(graph,{operation:'status'},meta);
  assert.equal(result.graph_status,'ready');
  assert.equal(result.repo,'Haydars1/jarvis-personal-ai');
});

test('runtime graph query finds repository nodes',()=>{
  const result=executeCodeGraphQuery(graph,{operation:'find',query:'worker'},meta);
  assert.ok(result.nodes.some(node=>node.file==='src/worker.js'));
});

test('runtime graph query ranks impacted files deterministically',()=>{
  const result=executeCodeGraphQuery(graph,{operation:'impact',files:['src/worker.js']},meta);
  assert.equal(result.impacted[0].file,'src/app-entry.js');
  assert.ok(result.impacted[0].score>=result.impacted.at(-1).score);
});

test('runtime graph query resolves fuzzy path targets',()=>{
  const result=executeCodeGraphQuery(graph,{operation:'path',from:'app-entry',to:'presenter'},meta);
  assert.ok(Array.isArray(result.path));
  assert.equal(result.path[0].file,'src/app-entry.js');
  assert.equal(result.path.at(-1).file,'src/application/chat/presenter.js');
});

test('runtime graph query rejects unsupported operations',()=>{
  assert.throws(()=>executeCodeGraphQuery(graph,{operation:'delete'},meta),/CODE_GRAPH_OPERATION_NOT_SUPPORTED/);
});
