import test from 'node:test';
import assert from 'node:assert/strict';
import { rankVehicleCandidate, classifyProtocolEvidence, createEcuCompatibilityAssistant } from '../src/application/ecu/compatibility-assistant.js';

test('vehicle lookup returns possibilities, never guaranteed KT200 support', () => {
  const candidate = rankVehicleCandidate({
    part_number:'04L 906 021', brand:'Audi', model:'A6', engine:'2.0 TDI', ecu_type:'EDC17'
  }, {brand:'Audi', model:'A6', engine:'2.0 TDI', year:2021});
  assert.equal(candidate.kt200_method, 'NOT_VERIFIED');
  assert.equal(candidate.year_verified, false);
  assert.equal(candidate.match_status, 'POSSIBLE_ECU_NOT_VERIFIED');
});
test('wrong model/brand is never silently accepted', () => {
  assert.equal(rankVehicleCandidate({part_number:'1234', brand:'BMW', model:'320d'}, {brand:'Audi',model:'A6'}), null);
});
test('protocol notes require precise part + HW + SW match', () => {
  const row = {part_number:'04L-906-021', hw:'H52', sw:'0123'};
  assert.equal(classifyProtocolEvidence(row, {ecu_part_number:'04L906021'}), 'VERIFY_HW_SW');
  assert.equal(classifyProtocolEvidence(row, {ecu_part_number:'04L906021',hw:'H53',sw:'0123'}), 'DIFFERENT_HW_SW');
  assert.equal(classifyProtocolEvidence(row, {ecu_part_number:'04L906021',hw:'H52',sw:'0123'}), 'OPERATOR_RECORDED_EXACT_ID');
  assert.equal(classifyProtocolEvidence(row, {ecu_part_number:'04L906022',hw:'H52',sw:'0123'}), 'DIFFERENT_ECU');
});
test('unauthenticated lookup is blocked', async () => {
  const core = { fetch:async()=>new Response(JSON.stringify({authenticated:false}),{headers:{'content-type':'application/json'}}) };
  const handler = createEcuCompatibilityAssistant(core);
  const result = await handler.fetch(new Request('https://example.com/api/ecu/compatibility/lookup?brand=Audi&model=A6'), { DB:{} }, {});
  assert.equal(result.status, 401);
});
test('missing D1 binding is returned without fake compatibility', async () => {
  const core = { fetch:async()=>new Response(JSON.stringify({authenticated:true}),{headers:{'content-type':'application/json'}}) };
  const handler = createEcuCompatibilityAssistant(core);
  const response = await handler.fetch(new Request('https://example.com/api/ecu/compatibility/lookup?brand=Audi&model=A6'), {}, {});
  assert.equal(response.status, 503);
});
