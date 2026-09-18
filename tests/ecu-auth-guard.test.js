import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuAuthGuard } from '../src/application/ecu/auth-guard.js';

function req(path,headers={}){
  return new Request('https://jarvis.test'+path,{headers});
}

test('blocks public ECU API routes without owner session',async()=>{
  let calls=0;
  const core={async fetch(){calls++;return new Response('ok')}};
  const guard=createEcuAuthGuard(core,{isOwnerAuthenticated:async()=>false});
  const res=await guard.fetch(req('/api/ecu/jobs'),{},{});
  assert.equal(res.status,401);
  assert.deepEqual(await res.json(),{error:'AUTH_REQUIRED'});
  assert.equal(calls,0);
});

test('allows public ECU API routes for authenticated owner',async()=>{
  let calls=0;
  const core={async fetch(){calls++;return new Response('ok',{status:200})}};
  const guard=createEcuAuthGuard(core,{isOwnerAuthenticated:async()=>true});
  const res=await guard.fetch(req('/api/ecu/jobs'),{},{});
  assert.equal(res.status,200);
  assert.equal(calls,1);
});

test('does not apply owner cookie auth to internal compute routes',async()=>{
  let calls=0;
  const core={async fetch(request){
    calls++;
    assert.match(new URL(request.url).pathname,/^\/api\/ecu\/internal\//);
    return new Response('worker',{status:202});
  }};
  const guard=createEcuAuthGuard(core,{isOwnerAuthenticated:async()=>{throw new Error('must not run')}});
  const res=await guard.fetch(req('/api/ecu/internal/jobs/j1/result'),{},{});
  assert.equal(res.status,202);
  assert.equal(calls,1);
});

test('delegates non ECU routes without extra auth checks',async()=>{
  let authCalls=0;
  const core={async fetch(){return new Response('chat',{status:200})}};
  const guard=createEcuAuthGuard(core,{isOwnerAuthenticated:async()=>{authCalls++;return false}});
  const res=await guard.fetch(req('/api/chat/send'),{},{});
  assert.equal(res.status,200);
  assert.equal(authCalls,0);
});
