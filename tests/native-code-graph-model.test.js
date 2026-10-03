import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCodeGraph } from '../src/lib/code-graph.js';
import { normalizeRepoPath, fileNodeId, symbolNodeId } from '../scripts/code-graph/native/ids.mjs';
import { createNode, createEdge, finalizeGraph } from '../scripts/code-graph/native/model.mjs';

test('normalizes Windows and POSIX repository paths deterministically',()=>{
  assert.equal(normalizeRepoPath('src\\application\\chat.js'),'src/application/chat.js');
  assert.equal(normalizeRepoPath('./src//application/./chat.js'),'src/application/chat.js');
  assert.throws(()=>normalizeRepoPath('../outside.js'),/repository-relative/i);
  assert.throws(()=>normalizeRepoPath('/absolute/file.js'),/repository-relative/i);
});

test('builds stable file and scoped symbol ids',()=>{
  assert.equal(fileNodeId('src\\app.js'),'file:src/app.js');
  const first=symbolNodeId('js','src/app.js','function','run','ClassA');
  const second=symbolNodeId('js','src/app.js','function','run','ClassB');
  assert.equal(first,symbolNodeId('js','src/app.js','function','run','ClassA'));
  assert.notEqual(first,second);
  assert.match(first,/^js:src\/app\.js#/);
});

test('creates normalized graph nodes and edges',()=>{
  assert.deepEqual(createNode({id:'file:src/app.js',kind:'module',name:'app',file:'src\\app.js',line:2}),{
    id:'file:src/app.js',kind:'module',name:'app',file:'src/app.js',line:2
  });
  assert.deepEqual(createEdge({source:'b',target:'a',type:'imports',provenance:'import'}),{
    source:'b',target:'a',type:'imports',provenance:'IMPORT'
  });
});

test('finalizes a deterministic valid version-1 graph',()=>{
  const parts={
    nodes:[
      createNode({id:'file:src/b.js',kind:'module',name:'b',file:'src/b.js'}),
      createNode({id:'file:src/a.js',kind:'module',name:'a',file:'src/a.js'}),
      createNode({id:'file:src/a.js',kind:'module',name:'a',file:'src/a.js'})
    ],
    edges:[
      createEdge({source:'file:src/b.js',target:'file:src/a.js',type:'imports',provenance:'IMPORT'}),
      createEdge({source:'file:src/b.js',target:'file:src/a.js',type:'imports',provenance:'IMPORT'})
    ],
    diagnostics:['ignored dynamic import']
  };
  const graph=finalizeGraph(parts,{sourceCommit:'abc123',generatedAt:'2026-10-03T00:00:00.000Z'});
  assert.equal(graph.version,1);
  assert.equal(graph.generator,'jarvis-native');
  assert.equal(graph.source_commit,'abc123');
  assert.equal(graph.status,'ready');
  assert.deepEqual(graph.nodes.map(node=>node.id),['file:src/a.js','file:src/b.js']);
  assert.equal(graph.edges.length,1);
  assert.deepEqual(graph.stats,{nodes:2,edges:1});
  assert.deepEqual(graph.diagnostics,['ignored dynamic import']);
  assert.equal(validateCodeGraph(graph).valid,true);
});
