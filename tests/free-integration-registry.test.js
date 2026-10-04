import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_INTEGRATION_TEAMS,
  FREE_INTEGRATION_SEEDS,
  normalizeIntegration,
  isAutoExecutableIntegration,
  integrationSummary
} from '../src/lib/free-integration-registry.js';

test('free ready integrations are executable but unsafe states are never auto-routed', () => {
  assert.equal(isAutoExecutableIntegration(normalizeIntegration({ id:'ok', name:'OK', team:'Build', pricing:'free', runtimeState:'ready', surface:'worker', sourceType:'repo' })), true);
  assert.equal(isAutoExecutableIntegration(normalizeIntegration({ id:'ok2', name:'OK2', team:'Build', pricing:'free-plan', runtimeState:'ready', surface:'worker', sourceType:'repo' })), true);
  for (const [pricing, runtimeState] of [
    ['unknown','ready'], ['paid','ready'], ['free','connection-required'], ['free','reference-only'], ['free','excluded'], ['free','unavailable']
  ]) {
    assert.equal(isAutoExecutableIntegration(normalizeIntegration({ id:`${pricing}-${runtimeState}`, name:'X', team:'Build', pricing, runtimeState, surface:'worker', sourceType:'repo' })), false);
  }
});

test('known paid screenshot tools stay excluded and unknown pricing never becomes free', () => {
  for (const name of ['ScreensDesign MCP','Higgsfield MCP','Plaud','ManyChat','Sandcastles MCP']) {
    const record = normalizeIntegration({ id:name.toLowerCase().replace(/\s+/g,'-'), name, team:'Design', pricing:'paid', runtimeState:'ready' });
    assert.equal(record.pricing, 'paid');
    assert.equal(record.runtimeState, 'excluded');
    assert.equal(record.autoExecutable, false);
  }
  const unknown = normalizeIntegration({ id:'mystery', name:'Mystery', team:'Scale' });
  assert.equal(unknown.pricing, 'unknown');
  assert.equal(unknown.autoExecutable, false);
});

test('registry has canonical teams, unique ids and truthful summary counts', () => {
  assert.deepEqual(FREE_INTEGRATION_TEAMS, ['Build','Design','Growth','Operations','Scale']);
  assert.equal(new Set(FREE_INTEGRATION_SEEDS.map(x => x.id)).size, FREE_INTEGRATION_SEEDS.length);
  const rows = FREE_INTEGRATION_TEAMS.map((team, i) => normalizeIntegration({ id:`r${i}`, name:team, team, pricing:'free', runtimeState:i === 0 ? 'ready' : 'reference-only', surface:'worker', sourceType:'repo' }));
  const summary = integrationSummary(rows);
  assert.equal(summary.total, 5);
  assert.equal(summary.autoExecutable, 1);
  for (const team of FREE_INTEGRATION_TEAMS) assert.equal(summary.teams[team], 1);
});
