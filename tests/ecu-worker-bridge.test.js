import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function request(path, init = {}) { return new Request(`https://jarvis.test${path}`, init); }
function coreFallback() { return { async fetch(){ return new Response('core',{status:299}); } }; }

test('compute worker can pull immutable artifact only with bearer token', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async readOriginal(_env, sha) {
      assert.equal(sha, 'a'.repeat(64));
      return Uint8Array.from([1,2,3,4]);
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };

  let response = await runtime.fetch(request('/api/ecu/internal/artifacts/' + 'a'.repeat(64)), env, {});
  assert.equal(response.status, 401);

  response = await runtime.fetch(request('/api/ecu/internal/artifacts/' + 'a'.repeat(64), {
    headers: { authorization: 'Bearer secret-token' },
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3,4]);
});

test('compute worker callback persists analysis result through injected result writer', async () => {
  const writes = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async applyWorkerResult(_env, jobId, body) {
      writes.push([jobId, body]);
      return { id: jobId, state: body.status };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const body = {
    status: 'NEEDS_REVIEW',
    run_fingerprint: 'f'.repeat(64),
    ecu_family: 'EDC17C46',
    confidence: 0.95,
    supported: true,
    hw_candidates: [{ value: '0281012345' }],
    sw_candidates: [{ value: '1037512345' }],
    evidence: [{ kind: 'fingerprint', text: 'explicit marker: EDC17C46' }],
    map_candidates: [{ offset: 128, rows: 8, cols: 8, data_type: 'u16', endian: 'big', score: 0.91 }],
  };

  let response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
    body: JSON.stringify(body),
  }), env, {});
  assert.equal(response.status, 401);

  response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' },
    body: JSON.stringify(body),
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'job-1');
  assert.equal(writes[0][1].ecu_family, 'EDC17C46');
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'NEEDS_REVIEW' } });
});

test('compute worker can mark a dispatched job running before analysis', async () => {
  const writes = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async applyWorkerState(_env, jobId, body) {
      writes.push([jobId, body]);
      return { id: jobId, state: body.state };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const response = await runtime.fetch(request('/api/ecu/internal/jobs/job-1/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' },
    body: JSON.stringify({ state: 'RUNNING', workerKind: 'cloud' }),
  }), env, {});

  assert.equal(response.status, 200);
  assert.deepEqual(writes, [['job-1', { state: 'RUNNING', workerKind: 'cloud' }]]);
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'RUNNING' } });
});


test('compute worker can fetch immutable training dataset by digest', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async readDataset(_env, digest) {
      assert.equal(digest, 'd'.repeat(64));
      return { version: 'dataset-1', digest, examples: [{ semantic_label: 'torque_limiter' }] };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const response = await runtime.fetch(request('/api/ecu/internal/datasets/' + 'd'.repeat(64), {
    headers: { authorization: 'Bearer secret-token' },
  }), env, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.digest, 'd'.repeat(64));
  assert.equal(body.examples[0].semantic_label, 'torque_limiter');
});


test('training worker callback stores candidate model through injected result writer', async () => {
  const writes = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async applyTrainingResult(_env, trainingId, body) {
      writes.push([trainingId, body]);
      return { id: trainingId, status: body.status, modelVersion: 'model-candidate-1' };
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const body = {
    status: 'CANDIDATE',
    dataset_version: 'dataset-8-1',
    dataset_digest: 'd'.repeat(64),
    production_model_version: 'baseline',
    model_json: '{"version":1,"labels":{}}',
    label_count: 2,
    example_count: 8,
    metrics: { accuracy: .9, macro_f1: .88, unknown_precision: 1, calibration_error: .08 },
    paid_api_used: false,
  };

  const response = await runtime.fetch(request('/api/ecu/internal/training/training-1/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' },
    body: JSON.stringify(body),
  }), env, {});

  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'training-1');
  assert.equal(writes[0][1].dataset_version, 'dataset-8-1');
  assert.deepEqual(await response.json(), {
    training: { id: 'training-1', status: 'CANDIDATE', modelVersion: 'model-candidate-1' },
  });
});


test('compute worker can fetch production semantic model by version', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async readModel(_env, version) {
      assert.equal(version, 'model-abc123');
      return '{"version":1,"unknown_distance":3,"min_label_examples":2,"labels":{}}';
    },
  });
  const env = { ECU_COMPUTE_TOKEN: 'secret-token' };
  const response = await runtime.fetch(request('/api/ecu/internal/models/model-abc123', {
    headers: { authorization: 'Bearer secret-token' },
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await response.json();
  assert.equal(body.version, 1);
});


test('ORI MOD pair callback persists diff result through injected writer', async () => {
  const writes=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async applyPairResult(_env,pairId,body){
      writes.push([pairId,body]);
      return {id:pairId,state:body.status,diffDigest:body.diff.digest};
    }
  });
  const env={ECU_COMPUTE_TOKEN:'secret-token'};
  const body={
    status:'COMPLETE',
    operation_label:'stage1',
    diff:{original_size:6,modified_size:6,changed_byte_count:2,ranges:[{start:2,end:4,deltas:[7,7]}],digest:'c'.repeat(64)},
    paid_api_used:false,
  };
  const response=await runtime.fetch(request('/api/ecu/internal/pairs/pair-1/result',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer secret-token'},
    body:JSON.stringify(body),
  }),env,{});
  assert.equal(response.status,200);
  assert.equal(writes.length,1);
  assert.equal(writes[0][0],'pair-1');
  assert.equal(writes[0][1].diff.changed_byte_count,2);
  assert.deepEqual(await response.json(),{pair:{id:'pair-1',state:'COMPLETE',diffDigest:'c'.repeat(64)}});
});


test('compute worker can fetch map context for an immutable artifact hash', async () => {
  const runtime=createEcuRuntime(coreFallback(),{
    async mapContextForArtifact(_env,sha){
      assert.equal(sha,'a'.repeat(64));
      return [{offset:128,rows:8,cols:8,dataType:'u16',semanticLabel:'torque_limiter',confidence:.97}];
    }
  });
  const env={ECU_COMPUTE_TOKEN:'secret-token'};
  const response=await runtime.fetch(request('/api/ecu/internal/map-context/'+'a'.repeat(64),{
    headers:{authorization:'Bearer secret-token'}
  }),env,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.maps[0].semanticLabel,'torque_limiter');
});
