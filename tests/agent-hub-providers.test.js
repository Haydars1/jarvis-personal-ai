import test from 'node:test';
import assert from 'node:assert/strict';
import {hubProviderStatus,HUB_PROVIDERS} from '../src/lib/agent-hub-providers.js';
import {USER_CURATED_CAPABILITY_SEEDS} from '../src/lib/user-curated-capability-seeds.js';
test('requested integrations and remote FreeLLMAPI are listed safely',()=>{
 assert.deepEqual(HUB_PROVIDERS.map(p=>p.id),['openhands','n8n','skills','freellmapi','ollama']);
 const statuses=hubProviderStatus({});
 assert.ok(statuses.every(s=>!s.available));
 assert.equal(statuses.find(s=>s.id==='skills').state,'catalog-available');
});
test('configured endpoints are not falsely marked reachable',()=>{
 const s=hubProviderStatus({N8N_BASE_URL:'https://example.com'});
 assert.equal(s.find(x=>x.id==='n8n').state,'configured-unverified');
 assert.equal(s.find(x=>x.id==='n8n').available,false);
});
test('discovery entries cannot auto execute',()=>{
 for(const repo of ['OpenHands/OpenHands','n8n-io/n8n','vercel-labs/skills','ollama/ollama']){
   const skill=USER_CURATED_CAPABILITY_SEEDS.find(x=>x.repo===repo);
   assert.ok(skill,repo);
   assert.equal(skill.autoExecute,false);
 }
});

test('FreeLLMAPI is explicitly unconfigured without an HTTPS gateway',()=>{
 const item=hubProviderStatus({}).find(p=>p.id==='freellmapi');
 assert.equal(item.state,'not-configured');
 assert.equal(item.available,false);
});
