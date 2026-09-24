import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRulepackLearning } from '../src/application/ecu/rulepacks.js';

function repository(rows){
  const saved=[];
  return {
    saved,
    async listVerifiedEvidence(){return rows;},
    async saveCandidate(_env,candidate){saved.push(candidate);return candidate;},
    async latest(){return saved.at(-1)||null;}
  };
}

test('builds evidence-only rulepack candidate from repeated verified ORI MOD pairs',async()=>{
  const rows=Array.from({length:5},(_,i)=>({
    pairId:'p'+i,
    operationLabel:'stage1',
    semanticLabel:'torque_limiter',
    humanVerified:true,
    deltaStats:{p95AbsPercent:5+i*.1}
  }));
  const repo=repository(rows);
  const service=createEcuRulepackLearning({repository:repo,minPairsPerLabel:5});
  const result=await service.refresh({});
  assert.equal(result.created,true);
  assert.equal(result.candidate.verified,false);
  assert.equal(result.candidate.state,'EVIDENCE_CANDIDATE');
  assert.equal(result.candidate.rules.torque_limiter.evidencePairs,5);
  assert.ok(result.candidate.rules.torque_limiter.observedEnvelopePercent>=5);
  assert.ok(!('maxDeltaPercent' in result.candidate.rules.torque_limiter));
});

test('does not create candidate from unverified or insufficient evidence',async()=>{
  const rows=[
    {pairId:'p1',operationLabel:'stage1',semanticLabel:'boost_target',humanVerified:false,deltaStats:{p95AbsPercent:4}},
    {pairId:'p2',operationLabel:'stage1',semanticLabel:'boost_target',humanVerified:true,deltaStats:{p95AbsPercent:4}},
  ];
  const repo=repository(rows);
  const service=createEcuRulepackLearning({repository:repo,minPairsPerLabel:3});
  const result=await service.refresh({});
  assert.equal(result.created,false);
  assert.equal(result.reason,'INSUFFICIENT_VERIFIED_CHANGE_EVIDENCE');
  assert.equal(repo.saved.length,0);
});

test('status never presents evidence candidate as verified production rules',async()=>{
  const repo=repository([]);
  repo.saved.push({version:'rules-candidate-1',state:'EVIDENCE_CANDIDATE',verified:false,rules:{}});
  const service=createEcuRulepackLearning({repository:repo});
  const status=await service.status({});
  assert.equal(status.latest.verified,false);
  assert.equal(status.production,null);
});


test('adds a signed target only when repeated verified pairs agree on direction',async()=>{
  const rows=Array.from({length:5},(_,i)=>({
    pairId:'signed-'+i,
    operationLabel:'stage1',
    semanticLabel:'torque_limiter',
    humanVerified:true,
    deltaStats:{p95AbsPercent:8+i*.1,medianSignedPercent:7+i*.1}
  }));
  const repo=repository(rows);
  const service=createEcuRulepackLearning({repository:repo,minPairsPerLabel:5});
  const result=await service.refresh({});
  const rule=result.candidate.rules.torque_limiter;
  assert.equal(result.created,true);
  assert.ok(rule.targetDeltaPercent>0);
  assert.equal(rule.directionAgreement,1);
});


test('learns exact patch rulepacks per ECU scope and never mixes SW variants',async()=>{
  const rows=[
    ...Array.from({length:3},(_,i)=>({
      pairId:'a'+i,operationLabel:'egr_off',ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1',
      semanticLabel:'__PATCH__',mapOffset:100,humanVerified:true,
      deltaStats:{patchBeforeHex:'0102',patchAfterHex:'aabb',length:2}
    })),
    ...Array.from({length:3},(_,i)=>({
      pairId:'b'+i,operationLabel:'egr_off',ecuFamily:'EDC17C46',hw:'HW1',sw:'SW2',
      semanticLabel:'__PATCH__',mapOffset:120,humanVerified:true,
      deltaStats:{patchBeforeHex:'0304',patchAfterHex:'ccdd',length:2}
    })),
  ];
  const repo=repository(rows);
  const service=createEcuRulepackLearning({repository:repo,operationLabel:'*',minPairsPerLabel:5});
  const result=await service.refresh({});
  assert.equal(result.created,true);
  assert.equal(result.candidates.length,2);
  const sw1=result.candidates.find(item=>item.sw==='SW1');
  const sw2=result.candidates.find(item=>item.sw==='SW2');
  assert.equal(sw1.ecuFamily,'EDC17C46');
  assert.deepEqual(sw1.rules.__patches,[{
    offset:100,length:2,beforeHex:'0102',afterHex:'aabb',evidencePairs:3
  }]);
  assert.deepEqual(sw2.rules.__patches,[{
    offset:120,length:2,beforeHex:'0304',afterHex:'ccdd',evidencePairs:3
  }]);
});


test('exact patch rulepack requires repeated verified pairs',async()=>{
  const rows=[
    {pairId:'p1',operationLabel:'dtc_off',ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1',semanticLabel:'__PATCH__',mapOffset:10,humanVerified:true,deltaStats:{patchBeforeHex:'01',patchAfterHex:'00',length:1}},
    {pairId:'p2',operationLabel:'dtc_off',ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1',semanticLabel:'__PATCH__',mapOffset:10,humanVerified:true,deltaStats:{patchBeforeHex:'01',patchAfterHex:'00',length:1}},
  ];
  const repo=repository(rows);
  const service=createEcuRulepackLearning({repository:repo,operationLabel:'*'});
  const result=await service.refresh({});
  assert.equal(result.created,false);
});
