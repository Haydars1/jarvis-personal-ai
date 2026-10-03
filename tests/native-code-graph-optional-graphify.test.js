import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('default graph build is native and Graphify is opt-in only',()=>{
  assert.equal(pkg.scripts['graph:build'],'node scripts/code-graph/build.mjs');
  assert.equal(pkg.scripts['graph:build:graphify'],'node scripts/code-graph/graphify-build.mjs');
  assert.equal(pkg.scripts['graph:compare'],'node scripts/code-graph/compare.mjs');
  const nativeBuild=readFileSync(new URL('../scripts/code-graph/build.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(nativeBuild,/graphifyy|GRAPHIFY_COMMAND|spawnSync\([^\n]*graphify|pip\s+install/i);
  assert.match(nativeBuild,/buildNativeCodeGraph/);
});

test('optional Graphify adapter cannot overwrite the native graph artifact',()=>{
  const source=readFileSync(new URL('../scripts/code-graph/graphify-build.mjs',import.meta.url),'utf8');
  assert.match(source,/graphify-code-graph\.json/);
  assert.doesNotMatch(source,/writeFileSync\([^\n]*['"]code-graph\.json['"]/);
});
