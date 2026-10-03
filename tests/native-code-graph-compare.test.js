import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGraphs } from '../scripts/code-graph/compare.mjs';

const graph=(generator,nodes,edges)=>({version:1,generator,source_commit:'abc',generated_at:'2026-10-03T00:00:00.000Z',status:'ready',nodes,edges,stats:{nodes:nodes.length,edges:edges.length}});
const node=(id,file,{kind='module',name=id}={})=>({id,kind,name,file});
const edge=(source,target,type='imports')=>({source,target,type,provenance:'TEST'});

test('compares native and reference graphs by semantic identity rather than provider ids',()=>{
  const native=graph('jarvis-native',[
    node('native:app','src/app.js',{name:'app.js'}),
    node('native:worker','src/worker.js',{name:'worker.js'}),
    node('native:run','src/worker.js',{kind:'function',name:'run'})
  ],[
    edge('native:app','native:worker','imports'),
    edge('native:worker','native:run','defines')
  ]);
  const reference=graph('graphify',[
    node('graphify-91','src/app.js',{name:'app.js'}),
    node('graphify-22','src/worker.js',{name:'worker.js'}),
    node('graphify-77','src/worker.js',{kind:'function',name:'run'})
  ],[
    edge('graphify-91','graphify-22','imports'),
    edge('graphify-22','graphify-77','defines')
  ]);
  const result=compareGraphs(native,reference,{changedFiles:['src/worker.js']});
  assert.deepEqual(result.native,{nodes:3,edges:2});
  assert.deepEqual(result.reference,{nodes:3,edges:2});
  assert.deepEqual(result.node_overlap,{count:3,native_ratio:1,reference_ratio:1});
  assert.deepEqual(result.edge_overlap,{count:2,native_ratio:1,reference_ratio:1});
  assert.deepEqual(result.import_overlap,{count:1,native_ratio:1,reference_ratio:1});
  assert.deepEqual(result.symbol_overlap,{count:1,native_ratio:1,reference_ratio:1});
  assert.deepEqual(result.impact_overlap,{changed_files:['src/worker.js'],count:1,native_ratio:1,reference_ratio:1,native_files:1,reference_files:1});
  assert.equal(result.same_source_commit,true);
});

test('comparison is deterministic and does not mutate either graph',()=>{
  const native=graph('jarvis-native',[node('b','b.js'),node('a','a.js')],[edge('b','a')]);
  const reference=graph('graphify',[node('x','a.js',{name:'a'}),node('y','b.js',{name:'b'})],[edge('y','x')]);
  const before=JSON.stringify({native,reference});
  assert.deepEqual(compareGraphs(native,reference),compareGraphs(native,reference));
  assert.equal(JSON.stringify({native,reference}),before);
});

test('comparison rejects malformed graphs instead of inventing metrics',()=>{
  const valid=graph('jarvis-native',[node('a','a.js'),node('b','b.js')],[edge('a','b')]);
  assert.throws(()=>compareGraphs(valid,{nodes:[],edges:[]}),/invalid reference graph/i);
});
