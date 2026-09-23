import test from 'node:test';
import assert from 'node:assert/strict';
import { decideEcuModelPromotion, ecuBenchmarkScore } from '../src/application/ecu/promotion.js';

const m=(o={})=>({accuracy:.9,macro_f1:.88,unknown_precision:.95,calibration_error:.08,evaluation_count:20,...o});

test('first model promotes only when held-out safety floors are met',()=>{
  assert.equal(decideEcuModelPromotion(null,m()).promote,true);
  assert.equal(decideEcuModelPromotion(null,m({evaluation_count:2})).promote,false);
  assert.equal(decideEcuModelPromotion(null,m({unknown_precision:.5})).promote,false);
});

test('candidate must improve composite score without safety regression',()=>{
  const prod=m({accuracy:.85,macro_f1:.82,unknown_precision:.95,calibration_error:.1});
  const better=m({accuracy:.91,macro_f1:.89,unknown_precision:.95,calibration_error:.08});
  const unsafe=m({accuracy:.97,macro_f1:.95,unknown_precision:.7,calibration_error:.08});
  assert.equal(decideEcuModelPromotion(prod,better).promote,true);
  assert.equal(decideEcuModelPromotion(prod,unsafe).promote,false);
  assert.equal(decideEcuModelPromotion(prod,prod).promote,false);
});

test('malformed or non-finite benchmark metrics fail closed',()=>{
  const prod=m({accuracy:.85,macro_f1:.82});
  for (const candidate of [
    m({accuracy:'not-a-number'}),
    m({macro_f1:NaN}),
    m({unknown_precision:Infinity}),
    m({calibration_error:undefined}),
    m({evaluation_count:'invalid'}),
  ]) {
    const decision=decideEcuModelPromotion(prod,candidate);
    assert.equal(decision.promote,false);
    assert.equal(decision.reason,'INVALID_BENCHMARK_METRICS');
  }
  const invalidProduction=decideEcuModelPromotion(m({unknown_precision:'bad'}),m({accuracy:.99}));
  assert.equal(invalidProduction.promote,false);
  assert.equal(invalidProduction.reason,'INVALID_PRODUCTION_BENCHMARK_METRICS');
  assert.equal(ecuBenchmarkScore(m({accuracy:NaN})),0);
});
