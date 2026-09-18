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
