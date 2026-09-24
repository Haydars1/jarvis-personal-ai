import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMachineHypothesisGroup } from '../src/application/ecu/machine-consensus.js';

function row(i,{confidence=.97,signed=8,p95=10,label='torque_limiter'}={}){
  return {pairId:'pair-'+i,label,confidence,signed,p95};
}

test('promotes only after eight independent high-confidence agreeing pairs',()=>{
  const result=evaluateMachineHypothesisGroup(Array.from({length:8},(_,i)=>row(i)));
  assert.equal(result.promote,true);
  assert.equal(result.reason,'MACHINE_CONSENSUS_VERIFIED');
  assert.equal(result.values.length,8);
  assert.equal(result.directionAgreement,1);
});

test('duplicate pair ids cannot amplify machine consensus',()=>{
  const rows=Array.from({length:20},()=>row(1));
  const result=evaluateMachineHypothesisGroup(rows);
  assert.equal(result.promote,false);
  assert.equal(result.reason,'INSUFFICIENT_PAIRS');
  assert.equal(result.values.length,1);
});

test('rejects weak direction agreement and extreme changes',()=>{
  const mixed=Array.from({length:8},(_,i)=>row(i,{signed:i<4?8:-8}));
  assert.equal(evaluateMachineHypothesisGroup(mixed).reason,'DIRECTION_CONSENSUS_WEAK');

  const extreme=Array.from({length:8},(_,i)=>row(i,{p95:40}));
  assert.equal(evaluateMachineHypothesisGroup(extreme).reason,'INSUFFICIENT_PAIRS');
});

test('rejects unsupported semantic labels',()=>{
  const rows=Array.from({length:8},(_,i)=>row(i,{label:'unknown_magic_map'}));
  const result=evaluateMachineHypothesisGroup(rows);
  assert.equal(result.promote,false);
  assert.equal(result.values.length,0);
});
