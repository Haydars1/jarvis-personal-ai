import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildNativeCodeGraph } from '../scripts/code-graph/native/builder.mjs';
import { validateCodeGraph, findGraphPath, rankImpactedFiles } from '../src/lib/code-graph.js';
import { fileNodeId } from '../scripts/code-graph/native/ids.mjs';

async function put(root,file,content){
  const target=path.join(root,...file.split('/'));
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,content);
}
async function withRepo(fn){
  const root=await mkdtemp(path.join(tmpdir(),'jarvis-native-builder-'));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}

test('builds deterministic valid version-1 graph from repository sources',()=>withRepo(async root=>{
  await put(root,'src/app.js',`import { run } from './worker.js'; export function start(){ return run(); }`);
  await put(root,'src/worker.js',`export function run(){ return 1; }`);
  await put(root,'src/broken.js',`export function broken( {`);
  await put(root,'.env','SECRET=never-read');
  const metadata={sourceCommit:'commit-123',generatedAt:'2026-10-03T00:00:00.000Z'};
  const first=await buildNativeCodeGraph({root,...metadata});
  const second=await buildNativeCodeGraph({root,...metadata});
  assert.deepEqual(first,second);
  assert.equal(first.generator,'jarvis-native');
  assert.equal(first.source_commit,'commit-123');
  assert.equal(first.status,'ready');
  assert.equal(validateCodeGraph(first).valid,true);
  assert.equal(first.nodes.some(node=>node.file==='.env'),false);
  assert.equal(first.diagnostics.some(item=>item.includes('src/broken.js')&&/parse error/i.test(item)),true);
  assert.deepEqual(findGraphPath(first,fileNodeId('src/app.js'),fileNodeId('src/worker.js')),[fileNodeId('src/app.js'),fileNodeId('src/worker.js')]);
  assert.equal(rankImpactedFiles(first,['src/worker.js']).some(item=>item.file==='src/app.js'),true);
}));

test('resolves extensionless and index local imports without executing source',()=>withRepo(async root=>{
  await put(root,'src/app.ts',`import { helper } from './lib'; export const run=()=>helper();`);
  await put(root,'src/lib/index.ts',`export const helper=()=>1;`);
  const graph=await buildNativeCodeGraph({root,sourceCommit:'c2',generatedAt:'2026-10-03T00:00:00.000Z'});
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.source===fileNodeId('src/app.ts')&&edge.target===fileNodeId('src/lib/index.ts')),true);
}));
