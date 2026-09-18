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
