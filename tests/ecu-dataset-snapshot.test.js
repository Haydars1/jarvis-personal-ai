import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEcuDatasetSnapshot } from '../src/application/ecu/dataset.js';

const row=(sw,verified=true,label='torque_limiter')=>({
  ecu_family:'EDC17C46',
  hw:'HW-A',
  sw,
  artifact_sha256:(sw.replace(/[^a-f0-9]/gi,'a')+'0'.repeat(64)).slice(0,64),
  map_offset:4096,
  semantic_label:label,
  source_type:'human_map_review',
  source_confidence:1,
  human_verified:verified?1:0,
  features_json:JSON.stringify({rows:16,cols:16,span:400,unique_ratio:.8,smoothness:.9,score:.95}),
  updated_at:1000,
});

test('dataset snapshot excludes unverified rows and is deterministic', async()=>{
  const a=await buildEcuDatasetSnapshot([row('SW-1'),row('SW-2',false)],'dataset-test');
  const b=await buildEcuDatasetSnapshot([row('SW-2',false),row('SW-1')],'dataset-test');
  assert.equal(a.exampleCount,1);
  assert.equal(a.digest,b.digest);
  assert.equal(a.version,'dataset-test');
  assert.equal(a.examples[0].sw,'SW-1');
  assert.equal(a.examples[0].human_verified,true);
});

test('dataset snapshot keeps the same ECU/HW/SW group in one split', async()=>{
  const snapshot=await buildEcuDatasetSnapshot([
    row('SW-1',true,'torque_limiter'),
    row('SW-1',true,'boost_target'),
    row('SW-2'),row('SW-3'),row('SW-4'),row('SW-5')
  ],'dataset-groups');
  const seen=new Map();
  for(const [split,rows] of Object.entries(snapshot.splits)){
    for(const item of rows){
      const key=[item.ecu_family,item.hw,item.sw].join('|');
      if(!seen.has(key))seen.set(key,new Set());
      seen.get(key).add(split);
    }
  }
  assert.ok([...seen.values()].every(parts=>parts.size===1));
});
