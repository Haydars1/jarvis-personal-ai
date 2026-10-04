import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFreeIntegrationCatalog } from '../src/lib/repository-integrations.js';

const repo = (name, status='source-only', extra={}) => ({
  repo: name,
  url: `https://github.com/${name}`,
  category: extra.category || 'developer-tools',
  license: extra.license || 'MIT',
  source_commit: extra.source_commit || 'abc123',
  source_verification: 'source-verified',
  integration: {
    status,
    mode: extra.mode || 'repository-tools',
    route: extra.route || '/api/tools/cloud/jobs',
    detail: extra.detail || ''
  }
});

test('catalog reuses existing repository integrations without duplicating canonical repos', () => {
  const rows = [
    repo('microsoft/playwright-mcp','ready',{category:'browser-automation',mode:'native-adapter'}),
    repo('remotion-dev/remotion'),
    repo('apify/crawlee'),
    repo('artemnovitckii/notebooklm-coach','ready',{category:'youtube-teaching',mode:'youtube-teaching'})
  ];
  const catalog = buildFreeIntegrationCatalog({ repositoryIntegrations: rows, providerState:{} });
  for (const name of rows.map(x => x.repo)) {
    const matches = catalog.filter(x => x.provenance?.repo === name);
    assert.equal(matches.length, 1, `${name} should appear once`);
  }
  const notebook = catalog.find(x => x.provenance?.repo === 'artemnovitckii/notebooklm-coach');
  assert.equal(notebook.runtimeState, 'reference-only');
  assert.equal(notebook.autoExecutable, false);
});

test('connection-required repository and JARVIS Google surfaces remain truthful', () => {
  const rows = [repo('example/configured-service','configuration-required',{mode:'openai-compatible'})];
  const disconnected = buildFreeIntegrationCatalog({ repositoryIntegrations: rows, providerState:{ google:{ connected:false, youtube:false } } });
  assert.equal(disconnected.find(x => x.provenance?.repo === 'example/configured-service').runtimeState, 'connection-required');
  assert.equal(disconnected.find(x => x.id === 'google-drive').runtimeState, 'connection-required');
  assert.equal(disconnected.find(x => x.id === 'youtube').runtimeState, 'connection-required');

  const connected = buildFreeIntegrationCatalog({ repositoryIntegrations: rows, providerState:{ google:{ connected:true, youtube:true } } });
  assert.equal(connected.find(x => x.id === 'google-drive').runtimeState, 'ready');
  assert.equal(connected.find(x => x.id === 'youtube').runtimeState, 'ready');
});

test('ChatGPT-only connectors stay external even when connected and HeyGen stays non-routable', () => {
  const catalog = buildFreeIntegrationCatalog({
    repositoryIntegrations: [],
    providerState:{ chatgpt:{ figma:{connected:true}, canva:{connected:true}, consensus:{connected:true}, heygen:{connected:true} } }
  });
  for (const id of ['figma-chatgpt','canva-chatgpt','consensus-chatgpt']) {
    const item = catalog.find(x => x.id === id);
    assert.equal(item.surface, 'chatgpt');
    assert.equal(item.authState, 'connected');
    assert.equal(item.runtimeState, 'reference-only');
    assert.equal(item.autoExecutable, false);
  }
  const heygen = catalog.find(x => x.id === 'heygen-chatgpt');
  assert.equal(heygen.pricing, 'unknown');
  assert.equal(heygen.autoExecutable, false);
});
