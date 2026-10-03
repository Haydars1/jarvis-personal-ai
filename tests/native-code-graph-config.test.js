import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConfigFile } from '../scripts/code-graph/native/config.mjs';
import { fileNodeId } from '../scripts/code-graph/native/ids.mjs';

function edge(result,type){return result.edges.filter(item=>item.type===type);}

const files=['package.json','server.js','scripts/build.mjs','scripts/check.mjs','src/app-entry.js','.github/workflows/ci.yml','wrangler.jsonc','wrangler.toml'];

test('extracts package scripts and repository-local run targets',()=>{
  const source=JSON.stringify({scripts:{build:'node scripts/build.mjs',check:'node scripts/check.mjs && node scripts/build.mjs',start:'node server.js',external:'tool --flag'}});
  const result=analyzeConfigFile({file:'package.json',source,availableFiles:files});
  assert.equal(result.nodes.some(node=>node.kind==='script'&&node.name==='build'),true);
  assert.equal(result.nodes.some(node=>node.kind==='script'&&node.name==='check'),true);
  const runs=edge(result,'runs');
  assert.equal(runs.some(item=>item.target===fileNodeId('scripts/build.mjs')),true);
  assert.equal(runs.some(item=>item.target===fileNodeId('scripts/check.mjs')),true);
  assert.equal(runs.some(item=>item.target===fileNodeId('server.js')),true);
  assert.equal(result.edges.some(item=>String(item.target).includes('tool')),false);
});

test('malformed package JSON is diagnosed without evaluating it',()=>{
  const result=analyzeConfigFile({file:'package.json',source:'{"scripts":',availableFiles:files});
  assert.equal(result.edges.length,0);
  assert.equal(result.diagnostics.some(item=>/parse/i.test(item)),true);
});

test('extracts deterministic GitHub workflow run targets',()=>{
  const source=`name: CI\njobs:\n  test:\n    steps:\n      - run: node scripts/check.mjs\n      - run: npm test\n`;
  const result=analyzeConfigFile({file:'.github/workflows/ci.yml',source,availableFiles:files});
  assert.equal(edge(result,'runs').some(item=>item.source===fileNodeId('.github/workflows/ci.yml')&&item.target===fileNodeId('scripts/check.mjs')),true);
});

test('extracts Wrangler entrypoint from JSONC and TOML without executing config',()=>{
  const jsonc=analyzeConfigFile({file:'wrangler.jsonc',source:`{ // worker\n "main": "src/app-entry.js"\n}`,availableFiles:files});
  const toml=analyzeConfigFile({file:'wrangler.toml',source:`main = "src/app-entry.js"`,availableFiles:files});
  assert.equal(edge(jsonc,'entrypoint').some(item=>item.target===fileNodeId('src/app-entry.js')),true);
  assert.equal(edge(toml,'entrypoint').some(item=>item.target===fileNodeId('src/app-entry.js')),true);
});

test('does not invent config edges to missing repository files',()=>{
  const result=analyzeConfigFile({file:'wrangler.toml',source:`main = "src/missing.js"`,availableFiles:files});
  assert.equal(edge(result,'entrypoint').length,0);
  assert.equal(result.diagnostics.some(item=>/missing local target/i.test(item)),true);
});
