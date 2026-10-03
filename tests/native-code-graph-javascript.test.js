import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeJavaScriptFile } from '../scripts/code-graph/native/javascript.mjs';
import { fileNodeId } from '../scripts/code-graph/native/ids.mjs';

const resolver=(specifier,fromFile)=>{
  if(specifier==='./dep.js')return 'src/dep.js';
  if(specifier==='./a.js')return 'src/a.js';
  if(specifier==='./b.js')return 'src/b.js';
  return null;
};

function edge(result,type){return result.edges.filter(item=>item.type===type);}

test('extracts local imports exports declarations and high-confidence calls from JavaScript',()=>{
  const source=`import { dep } from './dep.js';\nexport function alpha(){ return beta(); }\nfunction beta(){ return dep(); }\nexport class Service { run(){ return beta(); } }`;
  const result=analyzeJavaScriptFile({file:'src/app.js',source,resolveLocalModule:resolver});
  assert.equal(result.nodes.some(node=>node.id===fileNodeId('src/app.js')&&node.kind==='module'),true);
  assert.equal(result.nodes.some(node=>node.kind==='function'&&node.name==='alpha'),true);
  assert.equal(result.nodes.some(node=>node.kind==='function'&&node.name==='beta'),true);
  assert.equal(result.nodes.some(node=>node.kind==='class'&&node.name==='Service'),true);
  assert.equal(result.nodes.some(node=>node.kind==='method'&&node.name==='run'),true);
  assert.deepEqual(edge(result,'imports').map(item=>[item.source,item.target]),[[fileNodeId('src/app.js'),fileNodeId('src/dep.js')]]);
  assert.equal(edge(result,'exports').length>=2,true);
  assert.equal(edge(result,'calls').some(item=>result.nodes.find(node=>node.id===item.target)?.name==='beta'),true);
});

test('supports TypeScript syntax and keeps duplicate method names scoped to their class',()=>{
  const source=`interface Shape { area(): number }\nclass A { run(): number { return helper(); } }\nclass B { run(): number { return helper(); } }\nconst helper = (): number => 1;`;
  const result=analyzeJavaScriptFile({file:'src/sample.ts',source,resolveLocalModule:resolver});
  const runNodes=result.nodes.filter(node=>node.kind==='method'&&node.name==='run');
  assert.equal(runNodes.length,2);
  assert.notEqual(runNodes[0].id,runNodes[1].id);
  assert.equal(result.nodes.some(node=>node.kind==='function'&&node.name==='helper'),true);
  assert.equal(result.diagnostics.length,0);
});

test('creates deterministic cyclic local module import edges',()=>{
  const a=analyzeJavaScriptFile({file:'src/a.js',source:`import './b.js'; export const a=1;`,resolveLocalModule:resolver});
  const b=analyzeJavaScriptFile({file:'src/b.js',source:`import './a.js'; export const b=1;`,resolveLocalModule:resolver});
  assert.equal(edge(a,'imports').some(item=>item.target===fileNodeId('src/b.js')),true);
  assert.equal(edge(b,'imports').some(item=>item.target===fileNodeId('src/a.js')),true);
});

test('omits unresolved external and dynamic imports instead of inventing edges',()=>{
  const result=analyzeJavaScriptFile({file:'src/app.js',source:`import React from 'react'; const name='./x.js'; async function load(){ return import(name); }`,resolveLocalModule:resolver});
  assert.equal(edge(result,'imports').length,0);
  assert.equal(result.diagnostics.some(item=>/external import/i.test(item)),true);
  assert.equal(result.diagnostics.some(item=>/dynamic import/i.test(item)),true);
});

test('malformed source degrades only that file and returns diagnostics',()=>{
  const result=analyzeJavaScriptFile({file:'src/broken.js',source:`export function broken( {`,resolveLocalModule:resolver});
  assert.equal(result.nodes.length,1);
  assert.equal(result.nodes[0].id,fileNodeId('src/broken.js'));
  assert.equal(result.edges.length,0);
  assert.equal(result.diagnostics.some(item=>/parse/i.test(item)),true);
});
