import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVerifiedChangeEvidence } from '../src/application/ecu/change-evidence.js';

test('extracts only human-verified semantic overlaps from ORI MOD diff',()=>{
  const diff={
    linked_ranges:[
      {start:100,end:104,map_hits:[
        {offset:96,semantic_label:'torque_limiter',semantic_confidence:1,human_verified:true,overlap_bytes:4},
        {offset:200,semantic_label:'boost_target',semantic_confidence:.98,human_verified:false,overlap_bytes:1},
      ]},
      {start:300,end:302,map_hits:[
        {offset:300,semantic_label:'UNKNOWN',semantic_confidence:1,human_verified:true,overlap_bytes:2},
      ]},
    ]
  };
  const rows=extractVerifiedChangeEvidence(diff);
  assert.deepEqual(rows,[{
    rangeStart:100,
    rangeEnd:104,
    mapOffset:96,
    semanticLabel:'torque_limiter',
    confidence:1,
    overlapBytes:4,
  }]);
});

test('deduplicates repeated verified hits deterministically',()=>{
  const hit={offset:10,semantic_label:'boost_target',semantic_confidence:.95,human_verified:true,overlap_bytes:2};
  const diff={linked_ranges:[{start:10,end:12,map_hits:[hit,hit]}]};
  const rows=extractVerifiedChangeEvidence(diff);
  assert.equal(rows.length,1);
});


test('attaches verified map delta statistics to semantic change evidence',()=>{
  const diff={
    linked_ranges:[{start:10,end:12,map_hits:[
      {offset:8,semantic_label:'boost_target',semantic_confidence:1,human_verified:true,overlap_bytes:2}
    ]}],
    map_delta_evidence:[{
      semantic_label:'boost_target',map_offset:8,changed_cells:3,measured_cells:3,
      mean_abs_percent:4.2,max_abs_percent:5.1,p95_abs_percent:5.1,
      semantic_confidence:1,human_verified:true
    }]
  };
  const rows=extractVerifiedChangeEvidence(diff);
  assert.equal(rows.length,1);
  assert.equal(rows[0].deltaStats.changedCells,3);
  assert.equal(rows[0].deltaStats.maxAbsPercent,5.1);
});
