import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGraphs } from '../scripts/code-graph/compare.mjs';

const graph=(generator,nodes,edges)=>({version:1,generator,source_commit:'abc',generated_at:'2026-10-03T00:00:00.000Z',status:'ready',nodes,edges,stats:{nodes:nodes.length,edges:edges.length}});
const node=(id,file)=>({id,kind:'module',name:id,file});
const edge=(source,target,type='imports')=>({source,target,type,provenance:'TEST'});

test('compares native and reference graphs without choosing a winner',()=>{
  const native=graph('jarvis-native',[node('a','a.js'),node('b','b.js')],[edge('a','b')]);
  const reference=graph('graphify',[node('a','a.js'),node('c','c.js')],[edge('a','c')]);
  const result=compareGraphs(native,reference);
  assert.deepEqual(result.native,{nodes:2,edges:1});
  assert.deepEqual(result.reference,{nodes:2,edges:1});
  assert.deepEqual(result.node_overlap,{count:1,native_ratio:0.5,reference_ratio:0.5});
  assert.deepEqual(result.edge_overlap,{count:0,native_ratio:0,reference_ratio:0});
  assert.equal(result.same_source_commit,true);
});

test('comparison is deterministic and does not mutate either graph',()=>{
  const native=graph('jarvis-native',[node('b','b.js'),node('a','a.js')],[edge('b','a')]);
  const reference=graph('graphify',[node('a','a.js'),node('b','b.js')],[edge('b','a')]);
  const before=JSON.stringify({native,reference});
  assert.deepEqual(compareGraphs(native,reference),compareGraphs(native,reference));
  assert.equal(JSON.stringify({native,reference}),before);
});

test('comparison rejects malformed graphs instead of inventing metrics',()=>{
  const valid=graph('jarvis-native',[node('a','a.js'),node('b','b.js')],[edge('a','b')]);
  assert.throws(()=>compareGraphs(valid,{nodes:[],edges:[]}),/invalid reference graph/i);
});
