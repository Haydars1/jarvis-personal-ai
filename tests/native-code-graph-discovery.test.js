import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverRepositoryFiles } from '../scripts/code-graph/native/discover.mjs';

async function withRepo(fn){
  const root=await mkdtemp(path.join(tmpdir(),'jarvis-native-discovery-'));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
async function put(root,file,content='export const x=1;'){
  const target=path.join(root,...file.split('/'));
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,content);
}

test('discovers supported repository files in deterministic order and excludes unsafe paths',()=>withRepo(async root=>{
  await put(root,'src/z.js');
  await put(root,'src/a.ts');
  await put(root,'ios/App.swift','struct App {}');
  await put(root,'schema.sql','CREATE TABLE x(id INTEGER);');
  await put(root,'package.json','{}');
  await put(root,'wrangler.jsonc','{}');
  await put(root,'.github/workflows/ci.yml','jobs: {}');
  await put(root,'.git/config','secret');
  await put(root,'node_modules/pkg/index.js');
  await put(root,'graphify-out/code-graph.json','{}');
  await put(root,'dist/bundle.js');
  await put(root,'build/output.js');
  await put(root,'.cache/x.js');
  await put(root,'.env','TOKEN=x');
  await put(root,'.env.local','TOKEN=y');
  await put(root,'public/image.png','not-code');
  const result=await discoverRepositoryFiles(root);
  assert.deepEqual(result.files,[
    '.github/workflows/ci.yml','ios/App.swift','package.json','schema.sql','src/a.ts','src/z.js','wrangler.jsonc'
  ]);
  assert.equal(result.files.some(file=>file.includes('node_modules')),false);
  assert.equal(result.files.some(file=>file.startsWith('.env')),false);
}));

test('does not follow symlinks outside the repository root',()=>withRepo(async root=>{
  const outside=await mkdtemp(path.join(tmpdir(),'jarvis-native-outside-'));
  try{
    await put(outside,'escape.js');
    await symlink(outside,path.join(root,'linked-outside'),'dir');
    const result=await discoverRepositoryFiles(root);
    assert.deepEqual(result.files,[]);
    assert.equal(result.diagnostics.some(item=>/symlink/i.test(item)),true);
  }finally{await rm(outside,{recursive:true,force:true});}
}));

test('enforces max file size without reading oversized sources',()=>withRepo(async root=>{
  await put(root,'src/small.js','export const ok=1;');
  await put(root,'src/huge.js','x'.repeat(256));
  const result=await discoverRepositoryFiles(root,{maxFileSize:64});
  assert.deepEqual(result.files,['src/small.js']);
  assert.equal(result.diagnostics.some(item=>item.includes('src/huge.js')&&/size/i.test(item)),true);
}));

test('enforces a deterministic maximum file count',()=>withRepo(async root=>{
  await put(root,'src/c.js');
  await put(root,'src/a.js');
  await put(root,'src/b.js');
  const result=await discoverRepositoryFiles(root,{maxFiles:2});
  assert.deepEqual(result.files,['src/a.js','src/b.js']);
  assert.equal(result.diagnostics.some(item=>/file limit/i.test(item)),true);
}));
