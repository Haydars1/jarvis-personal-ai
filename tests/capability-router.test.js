import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableProviderFailure, providerRank, runCapabilityFailover, selectCapabilityCandidates } from '../src/application/providers/capability-router.js';

test('task capability changes preferred provider order', () => {
  assert.ok(providerRank('anthropic','coding') < providerRank('gemini','coding'));
  assert.ok(providerRank('perplexity','research') < providerRank('openai','research'));
  assert.ok(providerRank('higgsfield','video') < providerRank('runway','video'));
});

test('learned health can affect capability candidate selection', () => {
  const rows=[
    {provider:'openai',label:'OpenAI',last_status:'error',priority:10},
    {provider:'anthropic',label:'Claude',last_status:'ok',priority:10}
  ];
  const picked=selectCapabilityCandidates(rows,'coding',()=>0);
  assert.equal(picked[0].provider,'anthropic');
});

test('failover tries the next capable provider after quota error', async () => {
  const candidates=[{provider:'gemini'},{provider:'openai'}];
  const seen=[];
  const out=await runCapabilityFailover(candidates,async c=>{
    seen.push(c.provider);
    if(c.provider==='gemini'){const e=new Error('quota 429');e.status=429;throw e;}
    return {text:'ok'};
  });
  assert.deepEqual(seen,['gemini','openai']);
  assert.equal(out.selected.provider,'openai');
  assert.equal(out.attempts.length,2);
});

test('quota, rate limit and server failures are retryable', () => {
  assert.equal(isRetryableProviderFailure(Object.assign(new Error('quota'),{status:429})),true);
  assert.equal(isRetryableProviderFailure(Object.assign(new Error('server'),{status:503})),true);
});
