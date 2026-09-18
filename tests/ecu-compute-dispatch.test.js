import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputeDispatch } from '../src/infrastructure/ecu/compute-dispatch.js';

function job(overrides = {}) {
  return {
    id: 'job-1',
    runFingerprint: 'f'.repeat(64),
    artifactUri: 'r2://ecu-artifacts/originals/abc',
    artifactSha256: 'a'.repeat(64),
    operation: 'analyze',
    modelVersion: 'baseline',
    rulepackVersion: 'baseline',
    ...overrides,
  };
}

test('prefers an available local worker over cloud compute', async () => {
  const calls = [];
  const dispatch = createComputeDispatch({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_URL: 'https://local-worker.example/jobs',
    ECU_LOCAL_WORKER_ONLINE: '1',
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
    ECU_COMPUTE_TOKEN: 'secret',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'local');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://local-worker.example/jobs');
  assert.equal(calls[0].init.headers['idempotency-key'], 'f'.repeat(64));
});

test('falls back to cloud worker when local worker is unavailable', async () => {
  const calls = [];
  const dispatch = createComputeDispatch({
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_URL: 'https://local-worker.example/jobs',
    ECU_LOCAL_WORKER_ONLINE: '0',
    ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs',
    ECU_COMPUTE_TOKEN: 'secret',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'cloud');
  assert.deepEqual(calls, ['https://cloud-worker.example/jobs']);
});

test('keeps the job recoverable when no worker is configured or dispatch fails', async () => {
  const noEndpoint = createComputeDispatch({ fetchImpl: async () => { throw new Error('should not run'); } });
  assert.deepEqual(await noEndpoint(job(), {}), {
    accepted: false,
    state: 'QUEUED',
    workerKind: null,
    reason: 'NO_COMPUTE_ENDPOINT',
  });

  const broken = createComputeDispatch({ fetchImpl: async () => { throw new Error('offline'); } });
  const result = await broken(job(), { ECU_CLOUD_WORKER_URL: 'https://cloud-worker.example/jobs', ECU_COMPUTE_TOKEN: 'secret' });
  assert.equal(result.accepted, false);
  assert.equal(result.state, 'QUEUED');
  assert.equal(result.workerKind, 'cloud');
  assert.equal(result.reason, 'DISPATCH_FAILED');
});


test('dispatches ORI MOD pair jobs with both immutable artifact hashes', async () => {
  const calls=[];
  const dispatch=createComputeDispatch({
    fetchImpl:async(url,init)=>{
      calls.push({url,body:JSON.parse(init.body)});
      return new Response(JSON.stringify({accepted:true}),{status:202,headers:{'content-type':'application/json'}});
    }
  });
  const pair={
    id:'pair-1',
    runFingerprint:'p'.repeat(64),
    operation:'diff_pair',
    oriArtifactSha256:'a'.repeat(64),
    modArtifactSha256:'b'.repeat(64),
    oriArtifactUri:'r2://ecu-artifacts/originals/'+'a'.repeat(64),
    modArtifactUri:'r2://ecu-artifacts/originals/'+'b'.repeat(64),
    operationLabel:'stage1',
    config:{callback_base_url:'https://jarvis.example'},
  };
  const result=await dispatch(pair,{ECU_CLOUD_WORKER_URL:'https://worker.example/jobs',ECU_COMPUTE_TOKEN:'secret'});
  assert.equal(result.accepted,true);
  assert.equal(calls[0].body.operation,'diff_pair');
  assert.equal(calls[0].body.ori_artifact_sha256,'a'.repeat(64));
  assert.equal(calls[0].body.mod_artifact_sha256,'b'.repeat(64));
  assert.equal(calls[0].body.operation_label,'stage1');
});


test('uses scale-to-zero Cloudflare container binding when local worker is offline', async () => {
  const calls = [];
  const stub = {
    async fetch(request) {
      calls.push(request);
      return new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
  const dispatch = createComputeDispatch({
    fetchImpl: async () => { throw new Error('external fetch should not run'); },
  });

  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_ONLINE: '0',
    ECU_COMPUTE_CONTAINER: { getByName(name) { assert.equal(name, 'jarvis-ecu-compute'); return stub; } },
    ECU_COMPUTE_TOKEN: 'secret',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.workerKind, 'cloud-container');
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, '/jobs');
  assert.equal(calls[0].headers.get('authorization'), 'Bearer secret');
});

test('prefers local worker over Cloudflare container binding', async () => {
  let containerCalls = 0;
  const dispatch = createComputeDispatch({
    fetchImpl: async () => new Response(JSON.stringify({ accepted: true }), { status: 202 }),
  });
  const result = await dispatch(job(), {
    ECU_LOCAL_WORKER_URL: 'https://local.example/jobs',
    ECU_LOCAL_WORKER_ONLINE: '1',
    ECU_COMPUTE_CONTAINER: { getByName() { containerCalls++; return { fetch(){} }; } },
    ECU_COMPUTE_TOKEN: 'secret',
  });
  assert.equal(result.workerKind, 'local');
  assert.equal(containerCalls, 0);
});


test('does not wake cloud container without compute token', async () => {
  let woke = false;
  const dispatch = createComputeDispatch({ fetchImpl: async () => { throw new Error('should not fetch'); } });
  const result = await dispatch(job(), {
    ECU_COMPUTE_CONTAINER: {
      getByName() { woke = true; return { fetch: async () => new Response('{}', { status: 202 }) }; },
    },
  });
  assert.equal(result.accepted, false);
  assert.equal(result.state, 'QUEUED');
  assert.equal(result.reason, 'NO_COMPUTE_TOKEN');
  assert.equal(woke, false);
});


test('dispatches training jobs through scale-to-zero container', async () => {
  const calls=[];
  const stub={
    async fetch(request){
      calls.push(JSON.parse(await request.text()));
      return new Response(JSON.stringify({accepted:true}),{status:202,headers:{'content-type':'application/json'}});
    }
  };
  const dispatch=createComputeDispatch({fetchImpl:async()=>{throw new Error('external fetch should not run')}});
  const result=await dispatch({
    id:'training-1',
    operation:'train',
    runFingerprint:'t'.repeat(64),
    datasetVersion:'dataset-1',
    datasetDigest:'d'.repeat(64),
    productionModelVersion:'model-1',
    config:{callback_base_url:'https://jarvis.example'},
  },{
    ECU_COMPUTE_CONTAINER:{getByName(){return stub}},
    ECU_COMPUTE_TOKEN:'secret',
  });
  assert.equal(result.accepted,true);
  assert.equal(result.workerKind,'cloud-container');
  assert.equal(calls.length,1);
  assert.equal(calls[0].operation,'train');
  assert.equal(calls[0].dataset_version,'dataset-1');
  assert.equal(calls[0].dataset_digest,'d'.repeat(64));
  assert.equal(calls[0].production_model_version,'model-1');
  assert.equal(calls[0].paid_api_allowed,false);
});
