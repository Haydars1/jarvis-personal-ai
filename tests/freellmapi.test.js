import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFreeLlmApiEndpoint, listFreeLlmApiModels } from '../src/lib/freellmapi.js';

const valid = 'https://my-personal-llm.onrender.com/v1';

test('accepts an HTTPS /v1 gateway without changing the host', () => {
  assert.equal(normalizeFreeLlmApiEndpoint(valid),valid);
  assert.equal(normalizeFreeLlmApiEndpoint(valid+'/'),valid);
});
test('refuses non-TLS, network-local, invalid routes and credentials embedded in URLs', () => {
  for(const url of [
    'http://freellmapi.example.com/v1',
    'http://localhost:3001/v1',
    'https://127.0.0.1/v1',
    'https://10.0.1.7/v1',
    'https://192.168.1.4/v1',
    'https://172.23.0.6/v1',
    'https://169.254.169.254/v1',
    'https://127.0.0.1:8443/v1',
    'https://user:pass@freellmapi.example.com/v1',
    'https://freellmapi.example.com/v1?key=123',
    'https://freellmapi.example.com/v1#secret',
    'https://freellmapi.example.com/admin',
    'https://x.local/v1',
    'https://[::1]/v1',
    'https://localhost/v1',
    'file:///v1',
    'not a URL'
  ]) {
    assert.throws(()=>normalizeFreeLlmApiEndpoint(url),/FREELLMAPI_HTTPS_PUBLIC_V1_URL_REQUIRED/,url);
  }
});
test('calls /v1/models with unified API key using no redirect and never sends credentials in URL', async () => {
  const seen=[];
  const models = await listFreeLlmApiModels(valid,'safe-key',{
    transport:async (url,options)=>{
      seen.push({url,options});
      return Response.json({object:'list',data:[{id:'auto'},{id:'auto:fast'},{id:'mistral-medium'},{name:'not a model'}]});
    }
  });
  assert.deepEqual(models,['auto','auto:fast','mistral-medium']);
  assert.equal(seen[0].url,valid+'/models?available=true');
  assert.equal(seen[0].options.headers.authorization,'Bearer safe-key');
  assert.equal(seen[0].options.redirect,'error');
  assert.equal(seen[0].url.includes('safe-key'),false);
});
test('rejects empty key without any outgoing network request', async () => {
  await assert.rejects(listFreeLlmApiModels(valid,'',{transport:()=>{throw Error('UNEXPECTED_NETWORK_CALL');}}),/FREELLMAPI_KEY_REQUIRED/);
});
test('rejects auth failure, malformed payload and empty models', async () => {
  await assert.rejects(listFreeLlmApiModels(valid,'k',{transport:async()=>new Response('{}',{status:401})}),/FREELLMAPI_HTTP_401/);
  await assert.rejects(listFreeLlmApiModels(valid,'k',{transport:async()=>Response.json({data:{id:'auto'}})}),/FREELLMAPI_INVALID_MODELS_RESPONSE/);
});
