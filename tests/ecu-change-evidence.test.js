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


test('preserves signed median delta for Stage1 rule learning',()=>{
  const rows=extractVerifiedChangeEvidence({
    map_delta_evidence:[{
      semantic_label:'torque_limiter',
      map_offset:4096,
      changed_cells:8,
      measured_cells:8,
      mean_abs_percent:7.5,
      max_abs_percent:9,
      p95_abs_percent:8.5,
      median_signed_percent:7.8,
      human_verified:true,
    }],
    linked_ranges:[{
      start:4096,end:4112,deltas:8,
      map_hits:[{
        offset:4096,semantic_label:'torque_limiter',
        semantic_confidence:.98,human_verified:true,overlap_bytes:16,
      }]
    }]
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].deltaStats.medianSignedPercent,7.8);
});
