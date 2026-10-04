import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntegration } from '../src/lib/free-integration-registry.js';
import { classifyIntegrationTeam, selectFreeIntegration, executeFreeIntegrationPlan } from '../src/application/integrations/free-router.js';

const item = (id, team, overrides={}) => normalizeIntegration({
  id, name:id, team, pricing:'free', runtimeState:'ready', surface:'worker', sourceType:'github-skill', capabilities:overrides.capabilities || [], ...overrides
});

test('team classifier keeps integration routing out of ordinary provider ordering', () => {
  assert.equal(classifyIntegrationTeam({ text:'Bu repo için Playwright ile browser testlerini çalıştır' }), 'Build');
  assert.equal(classifyIntegrationTeam({ text:'Instagram kampanyası ve SEO araştırması yap' }), 'Growth');
  assert.equal(classifyIntegrationTeam({ text:'Figma tasarım akışını hazırla' }), 'Design');
  assert.equal(classifyIntegrationTeam({ text:'Drive dokümanlarını düzenle ve takvimi kontrol et' }), 'Operations');
  assert.equal(classifyIntegrationTeam({ text:'çoklu ajan ve model serving akışını koordine et' }), 'Scale');
});

test('selector never auto-routes paid, unknown, reference-only or connection-required records', () => {
  const catalog = [
    item('paid','Build',{pricing:'paid'}),
    item('unknown','Build',{pricing:'unknown'}),
    item('reference','Build',{runtimeState:'reference-only'}),
    item('connect','Build',{runtimeState:'connection-required'}),
    item('ready','Build')
  ];
  const plan = selectFreeIntegration({ task:{team:'Build'}, catalog });
  assert.equal(plan.selected.id, 'ready');
  assert.deepEqual(plan.candidates.map(x => x.id), ['ready']);
  assert.equal(plan.trace.some(x => x.id === 'paid' && x.reason === 'paid'), true);
  assert.equal(plan.trace.some(x => x.id === 'unknown' && x.reason === 'pricing-unverified'), true);
});

test('executor falls back to the next verified free adapter and records failures', async () => {
  const catalog = [item('alpha','Build',{fallbackOrder:1}), item('beta','Build',{fallbackOrder:2})];
  const result = await executeFreeIntegrationPlan({
    task:{team:'Build'}, catalog,
    execute: async integration => {
      if (integration.id === 'alpha') throw new Error('alpha failed');
      return { ok:true, answer:'beta result' };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.integration.id, 'beta');
  assert.equal(result.result.answer, 'beta result');
  assert.deepEqual(result.trace.filter(x => x.phase === 'execute').map(x => [x.id,x.status]), [['alpha','failed'],['beta','success']]);
});

test('connection-required state is surfaced when no executable free adapter exists', () => {
  const catalog = [item('needs-oauth','Operations',{runtimeState:'connection-required',authState:'required'})];
  const plan = selectFreeIntegration({task:{team:'Operations'},catalog});
  assert.equal(plan.selected, null);
  assert.equal(plan.state, 'connection-required');
  assert.deepEqual(plan.connectionRequired.map(x => x.id), ['needs-oauth']);
});
