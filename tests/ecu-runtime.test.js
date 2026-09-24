import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime, isPortablePatchRulepack, shouldRetryNeedsReview } from '../src/application/ecu/runtime.js';

function request(path, init = {}) {
  return new Request(`https://jarvis.test${path}`, init);
}

function coreFallback() {
  return {
    async fetch() { return new Response('core', { status: 299 }); },
    async scheduled() { return 'scheduled-core'; },
  };
}

test('creates an ECU analysis job through injected repository', async () => {
  const created = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async createJob(_env, input) {
      created.push(input);
      return { id: 'job-1', fileId: input.fileId, operation: input.operation, state: 'QUEUED' };
    },
  });

  const response = await runtime.fetch(request('/api/ecu/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileId: 'file-1', operation: 'analyze' }),
  }), {}, {});

  assert.equal(response.status, 202);
  assert.deepEqual(created, [{ fileId: 'file-1', operation: 'analyze', callbackBaseUrl: 'https://jarvis.test' }]);
  assert.deepEqual(await response.json(), {
    job: { id: 'job-1', fileId: 'file-1', operation: 'analyze', state: 'QUEUED' },
  });
});

test('rejects missing file id', async () => {
  const runtime = createEcuRuntime(coreFallback(), { async createJob() { throw new Error('should not run'); } });
  const response = await runtime.fetch(request('/api/ecu/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }), {}, {});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /fileId/);
});

test('returns ECU job status and history', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async getJob(_env, id) { return id === 'job-1' ? { id, state: 'RUNNING' } : null; },
    async listJobs() { return [{ id: 'job-1', state: 'RUNNING' }]; },
  });

  let response = await runtime.fetch(request('/api/ecu/jobs/job-1'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'RUNNING' } });

  response = await runtime.fetch(request('/api/ecu/jobs?limit=20'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { jobs: [{ id: 'job-1', state: 'RUNNING' }] });
});

test('exposes research/training/upload status without consuming a paid model', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async researchStatus() { return { status: 'IDLE', paidApiRequired: false }; },
    async trainingStatus() { return { status: 'IDLE', paidApiRequired: false }; },
    async uploadStatus() { return { ready: false, storage: 'unconfigured' }; },
  });

  for (const [path, expected] of [
    ['/api/ecu/research/status', { status: 'IDLE', paidApiRequired: false }],
    ['/api/ecu/training/status', { status: 'IDLE', paidApiRequired: false }],
    ['/api/ecu/upload-session', { ready: false, storage: 'unconfigured' }],
  ]) {
    const response = await runtime.fetch(request(path, { method: path.endsWith('upload-session') ? 'POST' : 'GET' }), {}, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  }
});

test('delegates unknown routes and scheduled events to core', async () => {
  const runtime = createEcuRuntime(coreFallback(), {});
  const response = await runtime.fetch(request('/api/other'), {}, {});
  assert.equal(response.status, 299);
  assert.equal(await runtime.scheduled({}, {}, {}), 'scheduled-core');
});

test('uploads an immutable ECU original and returns its content-addressed file id', async () => {
  const uploaded = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal(_env, input) {
      uploaded.push(input);
      return {
        id: 'a'.repeat(64),
        sha256: 'a'.repeat(64),
        artifactUri: 'r2://ecu-artifacts/originals/' + 'a'.repeat(64),
        originalName: input.filename,
        sizeBytes: input.bytes.byteLength,
        existed: false,
      };
    },
  });

  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-ecu-filename': 'passat-original.bin',
    },
    body: bytes,
  }), {}, {});

  assert.equal(response.status, 201);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].filename, 'passat-original.bin');
  assert.deepEqual([...uploaded[0].bytes], [...bytes]);
  const payload = await response.json();
  assert.equal(payload.file.id, 'a'.repeat(64));
  assert.equal(payload.file.sha256, 'a'.repeat(64));
  assert.equal(payload.file.sizeBytes, 4);
});

test('rejects empty or oversized ECU uploads before storage', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal() { throw new Error('should not run'); },
    maxUploadBytes: 4,
  });

  let response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Uint8Array([]),
  }), {}, {});
  assert.equal(response.status, 400);

  response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: Uint8Array.from([1, 2, 3, 4, 5]),
  }), {}, {});
  assert.equal(response.status, 413);
});

test('upload-and-analyze pipeline stores the original first and queues analysis by immutable file id', async () => {
  const calls = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal(_env, input) {
      calls.push(['upload', input.filename, input.bytes.byteLength]);
      return { id: 'b'.repeat(64), sha256: 'b'.repeat(64), sizeBytes: input.bytes.byteLength, existed: false };
    },
    async createJob(_env, input) {
      calls.push(['job', input.fileId, input.operation]);
      return { id: 'job-analysis-1', fileId: input.fileId, operation: input.operation, state: 'QUEUED' };
    },
  });

  const response = await runtime.fetch(request('/api/ecu/analyze-file', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-ecu-filename': 'ori.bin' },
    body: Uint8Array.from([9, 8, 7]),
  }), {}, {});

  assert.equal(response.status, 202);
  assert.deepEqual(calls, [
    ['upload', 'ori.bin', 3],
    ['job', 'b'.repeat(64), 'analyze'],
  ]);
  const payload = await response.json();
  assert.equal(payload.file.id, 'b'.repeat(64));
  assert.equal(payload.job.id, 'job-analysis-1');
  assert.equal(payload.job.state, 'QUEUED');
});


test('manual training endpoint triggers controlled retraining check', async () => {
  const calls = [];
  const training = {
    async maybeRun(_env, timestamp) {
      calls.push(timestamp);
      return { scheduled: true, job: { id: 'training-1' } };
    },
    async status() { return { status: 'READY_TO_TRAIN' }; },
  };
  const runtime = createEcuRuntime(coreFallback(), { training });
  const response = await runtime.fetch(request('/api/ecu/training/run', { method: 'POST' }), {}, {});
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.scheduled, true);
  assert.equal(calls.length, 1);
});


test('lists persisted map candidates for an analysis job', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async listMaps(_env, jobId) {
      assert.equal(jobId, 'job-1');
      return [{ id: 'job-1-map-0', offset: 128, rows: 8, cols: 8, semanticLabel: 'UNKNOWN', confidence: .91 }];
    },
  });
  const response = await runtime.fetch(request('/api/ecu/jobs/job-1/maps'), {}, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.maps[0].id, 'job-1-map-0');
  assert.equal(body.maps[0].offset, 128);
});


test('exposes compute availability status without requiring the laptop', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async computeStatus() {
      return { localOnline: false, cloudContainerReady: true, cloudUrlReady: false, preferred: 'cloud-container' };
    },
  });
  const response = await runtime.fetch(request('/api/ecu/compute/status'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    localOnline: false,
    cloudContainerReady: true,
    cloudUrlReady: false,
    preferred: 'cloud-container',
  });
});


test('reports compute unavailable when auth token is missing', async () => {
  const runtime = createEcuRuntime(coreFallback());
  const response = await runtime.fetch(request('/api/ecu/compute/status'), {
    ECU_COMPUTE_CONTAINER: { getByName() { return {}; } },
  }, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tokenConfigured, false);
  assert.equal(body.preferred, 'none');
});


test('reuses identical ECU analysis jobs by deterministic fingerprint', async () => {
  const rows = new Map();
  const db = {
    prepare(sql) {
      return {
        _bind: [],
        bind(...args){ this._bind=args; return this; },
        async first(){
          if(sql.includes('FROM ecu_files WHERE id=')) return { id:'f1', sha256:'a'.repeat(64), artifact_uri:'r2://ecu-artifacts/originals/'+'a'.repeat(64) };
          if(sql.includes('FROM ecu_jobs WHERE run_fingerprint=')) return rows.get(this._bind[0]) || null;
          return null;
        },
        async run(){
          if(sql.startsWith('INSERT INTO ecu_jobs')){
            const [id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,created_at,updated_at]=this._bind;
            rows.set(run_fingerprint,{id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,worker_kind:null,result_json:null,error:null,created_at,updated_at});
          }
          if(sql.startsWith('UPDATE ecu_jobs SET state=')){
            const [state,worker_kind,updated_at,id]=this._bind;
            for(const [key,row] of rows){ if(row.id===id) rows.set(key,{...row,state,worker_kind,updated_at}); }
          }
          return { success:true };
        }
      };
    }
  };
  let dispatchCount=0;
  const runtime=createEcuRuntime(coreFallback(),{
    computeDispatch:async()=>{dispatchCount++;return {accepted:true,workerKind:'cloud-container'};}
  });
  const env={DB:db};
  const body=JSON.stringify({fileId:'f1',operation:'analyze'});
  let response=await runtime.fetch(request('/api/ecu/jobs',{method:'POST',headers:{'content-type':'application/json'},body}),env,{});
  assert.equal(response.status,202);
  const first=(await response.json()).job;

  response=await runtime.fetch(request('/api/ecu/jobs',{method:'POST',headers:{'content-type':'application/json'},body}),env,{});
  assert.equal(response.status,202);
  const second=(await response.json()).job;

  assert.equal(second.id,first.id);
  assert.equal(second.runFingerprint,first.runFingerprint);
  assert.equal(dispatchCount,1);
});


test('rolls production model back to recorded rollback target', async () => {
  const calls=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async rollbackModel(_env,version){
      calls.push(version);
      return {from:'model-new',to:version,state:'PRODUCTION'};
    }
  });
  const response=await runtime.fetch(request('/api/ecu/models/model-old/rollback',{method:'POST'}),{},{});
  assert.equal(response.status,200);
  assert.deepEqual(calls,['model-old']);
  assert.deepEqual(await response.json(),{rollback:{from:'model-new',to:'model-old',state:'PRODUCTION'}});
});


test('lists ECU model history with rollback candidates', async () => {
  const runtime=createEcuRuntime(coreFallback(),{
    async listModels(){
      return [
        {version:'model-new',state:'PRODUCTION',benchmarkScore:.91,rollbackTarget:'model-old'},
        {version:'model-old',state:'ROLLBACK',benchmarkScore:.88,rollbackTarget:null},
      ];
    }
  });
  const response=await runtime.fetch(request('/api/ecu/models'),{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.models.length,2);
  assert.equal(body.models[0].state,'PRODUCTION');
  assert.equal(body.models[1].state,'ROLLBACK');
});


test('exposes ECU observability metrics without binary payloads', async () => {
  const runtime=createEcuRuntime(coreFallback(),{
    async metricsStatus(){
      return {
        counts:{QUEUED:2,RUNNING:1,NEEDS_REVIEW:3,READY:1,FAILED:1},
        averageTurnaroundMs:4200,
        productionModel:'model-1',
        binaryPayloadLogged:false,
      };
    }
  });
  const response=await runtime.fetch(request('/api/ecu/metrics'),{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.counts.QUEUED,2);
  assert.equal(body.averageTurnaroundMs,4200);
  assert.equal(body.productionModel,'model-1');
  assert.equal(body.binaryPayloadLogged,false);
});


test('downloads only registered validated MOD artifact', async () => {
  const runtime=createEcuRuntime(coreFallback(),{
    async getValidatedMod(_env,jobId){
      assert.equal(jobId,'job-1');
      return {
        bytes:Uint8Array.from([9,8,7]),
        sha256:'a'.repeat(64),
        checksumAlgorithm:'verified-fixture',
        filename:'job-1-MOD.bin',
      };
    }
  });
  const response=await runtime.fetch(request('/api/ecu/jobs/job-1/mod'),{},{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/octet-stream');
  assert.match(response.headers.get('content-disposition'),/job-1-MOD\.bin/);
  assert.equal(response.headers.get('x-ecu-sha256'),'a'.repeat(64));
  assert.equal(response.headers.get('x-ecu-checksum-algorithm'),'verified-fixture');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[9,8,7]);
});

test('returns 404 when validated MOD artifact does not exist', async () => {
  const runtime=createEcuRuntime(coreFallback(),{async getValidatedMod(){return null}});
  const response=await runtime.fetch(request('/api/ecu/jobs/job-404/mod'),{},{});
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{error:'ECU_MOD_NOT_FOUND'});
});


test('compute status reflects live local worker heartbeat', async () => {
  const now=Date.now();
  const env={
    ECU_COMPUTE_TOKEN:'secret',
    DB:{
      prepare(sql){
        return {
          bind(){return this;},
          async first(){
            if(sql.includes('FROM ecu_workers'))return {endpoint:'https://laptop.example/jobs',expires_at:now+60_000,last_seen_at:now};
            return null;
          }
        };
      }
    },
    ECU_COMPUTE_CONTAINER:{getByName(){return {}}},
  };
  const runtime=createEcuRuntime(coreFallback());
  const response=await runtime.fetch(request('/api/ecu/compute/status'),env,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.localOnline,true);
  assert.equal(body.preferred,'local');
  assert.equal(body.localEndpoint,'https://laptop.example/jobs');
});


test('serves scoped production rulepacks only to authorized compute workers', async () => {
  const calls=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async rulepackForIdentity(_env,input){
      calls.push(input);
      return {version:'rules-1',rules:{__patches:[{offset:10,beforeHex:'01',afterHex:'00'}]},ecuFamily:input.ecuFamily,hw:input.hw,sw:input.sw};
    }
  });
  let response=await runtime.fetch(request('/api/ecu/internal/rulepack?operationLabel=egr_off&ecuFamily=EDC17C46&hw=HW1&sw=SW1'),{ECU_COMPUTE_TOKEN:'secret'},{});
  assert.equal(response.status,401);

  response=await runtime.fetch(request('/api/ecu/internal/rulepack?operationLabel=egr_off&ecuFamily=EDC17C46&hw=HW1&sw=SW1',{
    headers:{authorization:'Bearer secret'}
  }),{ECU_COMPUTE_TOKEN:'secret'},{});
  assert.equal(response.status,200);
  assert.deepEqual(calls,[{operationLabel:'egr_off',ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1'}]);
  const body=await response.json();
  assert.equal(body.rulepack.version,'rules-1');
});


test('serves checksum profiles only to authorized compute workers', async () => {
  const calls=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async checksumProfileForIdentity(_env,input){
      calls.push(input);
      return {
        id:'cs-1',ecuFamily:input.ecuFamily,hw:input.hw,sw:input.sw,
        algorithm:'sum16',data_start:0,data_end:1024,checksum_offset:1022,
        checksum_size:2,endian:'big',zero_field:true,verifiedPairs:7
      };
    }
  });
  let response=await runtime.fetch(request('/api/ecu/internal/checksum-profile?ecuFamily=EDC17C46&hw=HW1&sw=SW1'),{ECU_COMPUTE_TOKEN:'secret'},{});
  assert.equal(response.status,401);

  response=await runtime.fetch(request('/api/ecu/internal/checksum-profile?ecuFamily=EDC17C46&hw=HW1&sw=SW1',{
    headers:{authorization:'Bearer secret'}
  }),{ECU_COMPUTE_TOKEN:'secret'},{});
  assert.equal(response.status,200);
  assert.deepEqual(calls,[{ecuFamily:'EDC17C46',hw:'HW1',sw:'SW1'}]);
  const body=await response.json();
  assert.equal(body.profile.algorithm,'sum16');
  assert.equal(body.profile.verifiedPairs,7);
});


test('manual research endpoint triggers GitHub and web research cycle',async()=>{
  const calls=[];
  const research={
    async run(_env,timestamp){
      calls.push(timestamp);
      return {skipped:false,sourcesFound:12,claimsFound:30,verified:4};
    },
    async status(){return {status:'IDLE',paidApiRequired:false};},
  };
  const runtime=createEcuRuntime(coreFallback(),{research});
  const response=await runtime.fetch(request('/api/ecu/research/run',{method:'POST'}),{},{});
  assert.equal(response.status,202);
  const body=await response.json();
  assert.equal(body.sourcesFound,12);
  assert.equal(body.claimsFound,30);
  assert.equal(calls.length,1);
});


test('lists learned GitHub ECU repositories and capabilities',async()=>{
  const runtime=createEcuRuntime(coreFallback(),{
    async listGitHubRepositories(_env,limit){
      assert.equal(limit,'8');
      return [{
        repository:'v-arapidis/openremap-core',
        license:'mit',
        reusePolicy:'ADAPT_WITH_ATTRIBUTION',
        stars:123,
        capabilities:['IDENTIFY','PATCH_RECIPE','CHECKSUM'],
        defaultBranch:'main',
        lastSeenAt:1234,
      }];
    }
  });
  const response=await runtime.fetch(request('/api/ecu/research/github?limit=8'),{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.repositories.length,1);
  assert.equal(body.repositories[0].repository,'v-arapidis/openremap-core');
  assert.ok(body.repositories[0].capabilities.includes('PATCH_RECIPE'));
});


test('triggers targeted research when an ECU service rulepack is missing',async()=>{
  const targeted=[];
  const pending=[];
  const env={DB:{prepare(sql){
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        if(sql.includes('FROM ecu_analysis_results')){
          return {
            ecu_family:'EDC17C46',
            hw_candidates:JSON.stringify([{value:'HW1'}]),
            sw_candidates:JSON.stringify([{value:'SW1'}]),
          };
        }
        return null;
      },
    };
  }}};
  const runtime=createEcuRuntime(coreFallback(),{
    async createJob(_env,input){
      return {
        id:'job-targeted',
        fileId:input.fileId,
        operation:input.operation,
        state:'QUEUED',
        rulepackVersion:'baseline',
      };
    },
    async researchTargeted(_env,input){
      targeted.push(input);
      return {sourcesFound:1};
    },
  });
  const ctx={waitUntil(promise){pending.push(promise);}};
  const response=await runtime.fetch(request('/api/ecu/jobs',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({fileId:'file-1',operation:'egr_off_proposal'}),
  }),env,ctx);
  assert.equal(response.status,202);
  await Promise.all(pending);
  assert.deepEqual(targeted,[{
    operationLabel:'egr_off',
    ecuFamily:'EDC17C46',
    hw:'HW1',
    sw:'SW1',
  }]);
});


test('portable patch rulepacks require contextual anchors and repeated evidence',()=>{
  const good={
    __patches:[{
      offset:100,length:2,beforeHex:'0102',afterHex:'aabb',
      contextBeforeHex:'1020',contextAfterHex:'3040',evidencePairs:5,
    }]
  };
  assert.equal(isPortablePatchRulepack('egr_off',good),true);
  assert.equal(isPortablePatchRulepack('stage1',good),false);
  assert.equal(isPortablePatchRulepack('egr_off',{
    __patches:[{offset:100,length:2,beforeHex:'0102',afterHex:'aabb',evidencePairs:5}]
  }),false);
  assert.equal(isPortablePatchRulepack('egr_off',{
    __patches:[{offset:100,length:2,beforeHex:'0102',afterHex:'aabb',contextBeforeHex:'10',evidencePairs:4}]
  }),false);
});


test('default ECU job dispatch carries parsed production rulepack rules',async()=>{
  const rules={__patches:[{
    offset:32,length:1,beforeHex:'01',afterHex:'00',
    contextBeforeHex:'aabb',contextAfterHex:'ccdd',evidencePairs:5
  }]};
  const dispatches=[];
  const rows={
    file:{id:'file-1',sha256:'a'.repeat(64),artifact_uri:'r2://ecu-artifacts/originals/'+'a'.repeat(64)},
    model:{version:'model-1'},
    identity:{ecu_family:'EDC17C46',hw_candidates:JSON.stringify([{value:'HW1'}]),sw_candidates:JSON.stringify([{value:'SW1'}])},
    rulepack:{version:'rules-1',rules_json:JSON.stringify(rules),ecu_family:'EDC17C46',hw:'HW1',sw:'SW1'},
  };
  const jobs=new Map();
  const db={
    prepare(sql){
      return {
        args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          if(sql.includes('FROM ecu_files WHERE id=? LIMIT 1'))return rows.file;
          if(sql.includes("FROM ecu_model_versions WHERE state='PRODUCTION'"))return rows.model;
          if(sql.includes('FROM ecu_analysis_results a'))return rows.identity;
          if(sql.includes("FROM ecu_rulepack_versions")&&sql.includes("LIMIT 1"))return rows.rulepack;
          if(sql.includes('FROM ecu_jobs WHERE run_fingerprint='))return null;
          return null;
        },
        async all(){return {results:[]};},
        async run(){
          if(sql.startsWith('INSERT INTO ecu_jobs')){
            const [id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,created_at,updated_at]=this.args;
            jobs.set(id,{id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,created_at,updated_at});
          }
          return {success:true};
        }
      };
    }
  };
  const runtime=createEcuRuntime(coreFallback(),{
    computeDispatch:async(job)=>{
      dispatches.push(job);
      return {accepted:true,workerKind:'cloud-container'};
    }
  });
  const response=await runtime.fetch(request('/api/ecu/jobs',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({fileId:'file-1',operation:'egr_off_proposal'}),
  }),{DB:db},{});
  assert.equal(response.status,202);
  assert.equal(dispatches.length,1);
  assert.deepEqual(dispatches[0].config.rulepack,rules);
  assert.equal(dispatches[0].config.rulepack_verified,true);
  assert.equal(dispatches[0].rulepackVersion,'rules-1');
});


test('retries review jobs only for newly satisfiable knowledge blockers',()=>{
  assert.equal(shouldRetryNeedsReview({
    proposal:{reasons:['RULEPACK_UNVERIFIED']}
  }),true);
  assert.equal(shouldRetryNeedsReview({
    proposal:{validation:{errors:['PATCH_RULEPACK_MISSING']}}
  }),true);
  assert.equal(shouldRetryNeedsReview({
    proposal:{reasons:['CHECKSUM_PROFILE_UNVERIFIED']}
  }),true);
  assert.equal(shouldRetryNeedsReview({
    proposal:{reasons:['PATCH_PRECONDITION_MISMATCH:128']}
  }),false);
  assert.equal(shouldRetryNeedsReview({
    proposal:{reasons:['PATCH_CONTEXT_AMBIGUOUS:128']}
  }),false);
});


test('scheduled ECU runtime runs review retry after learning refresh',async()=>{
  const calls=[];
  const rulepacks={
    async refresh(){calls.push('rulepacks');return {created:false};},
    async status(){return {production:null};},
  };
  const research={
    async run(){calls.push('research');return {skipped:true};},
    async status(){return {status:'IDLE'};},
    async targeted(){return {skipped:true};},
  };
  const training={
    async maybeRun(){calls.push('training');return {scheduled:false};},
    async status(){return {status:'IDLE'};},
  };
  const runtime=createEcuRuntime(coreFallback(),{
    research,
    rulepacks,
    training,
    async dispatchQueuedJobs(){calls.push('dispatch');return {attempted:0,dispatched:0};},
    async retryReviewJobs(){calls.push('retry');return {attempted:0,retried:0};},
    async refreshChecksumProfiles(){calls.push('checksum');return {created:0};},
  });
  await runtime.scheduled({scheduledTime:123},{},{});
  assert.deepEqual(calls,['dispatch','research','rulepacks','retry','checksum','training']);
});


test('blocked ECU worker result launches targeted research with real fingerprint',async()=>{
  const targeted=[];
  const waits=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async applyWorkerResult(_env,jobId,body){
      assert.equal(jobId,'job-1');
      assert.equal(body.ecu_family,'EDC17C46');
      return {id:'job-1',operation:'egr_off_proposal',state:'NEEDS_REVIEW'};
    },
    async researchTargeted(_env,input){
      targeted.push(input);
      return {sourcesFound:2,claimsFound:4};
    },
  });
  const response=await runtime.fetch(request('/api/ecu/internal/jobs/job-1/result',{
    method:'POST',
    headers:{authorization:'Bearer secret','content-type':'application/json'},
    body:JSON.stringify({
      status:'NEEDS_REVIEW',
      ecu_family:'EDC17C46',
      hw_candidates:[{value:'HW1'}],
      sw_candidates:[{value:'SW2'}],
      proposal:{reasons:['RULEPACK_UNVERIFIED']},
    }),
  }),{ECU_COMPUTE_TOKEN:'secret'},{
    waitUntil(promise){waits.push(promise);}
  });
  assert.equal(response.status,200);
  await Promise.all(waits);
  assert.deepEqual(targeted,[{
    ecuFamily:'EDC17C46',
    operationLabel:'egr_off',
    hw:'HW1',
    sw:'SW2',
  }]);
});


test('non-knowledge ECU review blocker does not launch targeted research',async()=>{
  let targeted=0;
  const waits=[];
  const runtime=createEcuRuntime(coreFallback(),{
    async applyWorkerResult(){
      return {id:'job-2',operation:'egr_off_proposal',state:'NEEDS_REVIEW'};
    },
    async researchTargeted(){targeted+=1;},
  });
  const response=await runtime.fetch(request('/api/ecu/internal/jobs/job-2/result',{
    method:'POST',
    headers:{authorization:'Bearer secret','content-type':'application/json'},
    body:JSON.stringify({
      status:'NEEDS_REVIEW',
      ecu_family:'EDC17C46',
      hw_candidates:[{value:'HW1'}],
      sw_candidates:[{value:'SW2'}],
      proposal:{reasons:['PATCH_CONTEXT_AMBIGUOUS:128']},
    }),
  }),{ECU_COMPUTE_TOKEN:'secret'},{
    waitUntil(promise){waits.push(promise);}
  });
  assert.equal(response.status,200);
  await Promise.all(waits);
  assert.equal(targeted,0);
});
