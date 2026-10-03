import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRuntimeCodeGraph, executeCodeGraphQuery } from '../.github/scripts/code-graph-job.mjs';

async function put(root,file,content){
  const target=path.join(root,...file.split('/'));
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,content);
}

test('runtime graph job builds with JARVIS native engine and no Graphify executable',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'jarvis-native-runtime-'));
  try{
    await put(root,'src/app.js',`import { work } from './worker.js'; export const run=()=>work();`);
    await put(root,'src/worker.js',`export const work=()=>1;`);
    const graph=await buildRuntimeCodeGraph({dest:root,commit:'runtime-commit'});
    assert.equal(graph.generator,'jarvis-native');
    assert.equal(graph.source_commit,'runtime-commit');
    const result=executeCodeGraphQuery(graph,{operation:'status'},{repo:'example/repo',commit:'runtime-commit'});
    assert.equal(result.engine,'jarvis-native');
    assert.equal(result.graph_status,'ready');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('runtime graph job source contains no Graphify or Python installer path',async()=>{
  const source=await readFile(new URL('../.github/scripts/code-graph-job.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/graphifyy|GRAPHIFY_VERSION|pip\s+install|ensureGraphify/i);
  assert.match(source,/buildNativeCodeGraph/);
});
