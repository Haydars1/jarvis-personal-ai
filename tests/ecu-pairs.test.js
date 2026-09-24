import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function request(path, init={}){return new Request('https://jarvis.test'+path,init)}
function core(){return {async fetch(){return new Response('core',{status:299})}}}

test('creates a verified ORI MOD learning pair job', async()=>{
  const calls=[];
  const runtime=createEcuRuntime(core(),{
    async createPair(_env,input){
      calls.push(input);
      return {id:'pair-1',state:'DISPATCHED',operationLabel:input.operationLabel};
    }
  });
  const response=await runtime.fetch(request('/api/ecu/training/pairs',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({oriFileId:'ori-1',modFileId:'mod-1',operationLabel:'stage1'})
  }),{},{});
  assert.equal(response.status,202);
  assert.deepEqual(calls,[{oriFileId:'ori-1',modFileId:'mod-1',operationLabel:'stage1',callbackBaseUrl:'https://jarvis.test'}]);
  assert.deepEqual(await response.json(),{pair:{id:'pair-1',state:'DISPATCHED',operationLabel:'stage1'}});
});

test('rejects incomplete ORI MOD pair requests',async()=>{
  const runtime=createEcuRuntime(core(),{async createPair(){throw new Error('should not run')}});
  const response=await runtime.fetch(request('/api/ecu/training/pairs',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({oriFileId:'ori-1'})
  }),{},{});
  assert.equal(response.status,400);
});


test('lists ORI MOD learning pair jobs',async()=>{
  const runtime=createEcuRuntime(core(),{
    async listPairs(){return [{id:'pair-1',state:'COMPLETE',operationLabel:'stage1',changedByteCount:2}]}
  });
  const response=await runtime.fetch(request('/api/ecu/training/pairs?limit=10'),{},{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.pairs[0].id,'pair-1');
  assert.equal(body.pairs[0].changedByteCount,2);
});


test('deduplicates identical ORI MOD pairs by deterministic fingerprint',async()=>{
  let pairRow=null;
  let dispatches=0;
  const files={
    ori:{id:'ori',sha256:'a'.repeat(64),artifact_uri:'r2://ori',size_bytes:4},
    mod:{id:'mod',sha256:'b'.repeat(64),artifact_uri:'r2://mod',size_bytes:4},
  };
  const env={DB:{prepare(sql){
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        if(sql.includes('FROM ecu_files WHERE id='))return files[this.args[0]]||null;
        if(sql.includes('FROM ecu_training_pairs WHERE run_fingerprint='))return pairRow;
        if(sql.includes('FROM ecu_analysis_results'))return null;
        return null;
      },
      async run(){
        if(sql.startsWith('INSERT INTO ecu_training_pairs')){
          const [id,ori_file_id,mod_file_id,operation_label,ecu_family,hw,sw,state,run_fingerprint,created_at,updated_at]=this.args;
          pairRow={id,ori_file_id,mod_file_id,operation_label,ecu_family,hw,sw,state,run_fingerprint,worker_kind:null,created_at,updated_at};
        }
        if(sql.startsWith('UPDATE ecu_training_pairs SET state=')&&pairRow){
          pairRow={...pairRow,state:this.args[0],worker_kind:this.args[1],updated_at:this.args[2]};
        }
        return {success:true};
      }
    };
  }}};
  const runtime=createEcuRuntime(core(),{
    computeDispatch:async()=>{dispatches++;return {accepted:true,workerKind:'cloud-container'};}
  });
  const body=JSON.stringify({oriFileId:'ori',modFileId:'mod',operationLabel:'egr_off'});
  let response=await runtime.fetch(request('/api/ecu/training/pairs',{method:'POST',headers:{'content-type':'application/json'},body}),env,{});
  assert.equal(response.status,202);
  const first=(await response.json()).pair;
  response=await runtime.fetch(request('/api/ecu/training/pairs',{method:'POST',headers:{'content-type':'application/json'},body}),env,{});
  assert.equal(response.status,202);
  const second=(await response.json()).pair;
  assert.equal(second.id,first.id);
  assert.equal(second.cached,true);
  assert.equal(dispatches,1);
});
