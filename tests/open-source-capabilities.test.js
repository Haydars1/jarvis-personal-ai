import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('../src/lib/open-source-capabilities.js', import.meta.url);
const modulePath = fileURLToPath(moduleUrl);

async function fabric() {
  assert.ok(existsSync(modulePath), 'open-source capability fabric module must exist');
  return import(moduleUrl.href);
}

const NOW = Date.parse('2026-09-30T10:00:00Z');
const healthyRepo = {
  full_name: 'example/tool',
  html_url: 'https://github.com/example/tool',
  description: 'useful local automation tool',
  archived: false,
  disabled: false,
  fork: false,
  stargazers_count: 1500,
  forks_count: 120,
  pushed_at: '2026-09-29T10:00:00Z',
  language: 'TypeScript',
  topics: ['automation', 'local-ai'],
  license: { spdx_id: 'MIT' }
};

test('discovery catalog is broad rather than a 4-5 repo shortlist', async () => {
  const { CAPABILITY_DISCOVERY_QUERIES, CURATED_CAPABILITY_SEEDS } = await fabric();
  assert.ok(CAPABILITY_DISCOVERY_QUERIES.length >= 20);
  assert.ok(new Set(CAPABILITY_DISCOVERY_QUERIES.map(item => item.category)).size >= 15);
  assert.ok(CURATED_CAPABILITY_SEEDS.length >= 18);
  const repos = new Set(CURATED_CAPABILITY_SEEDS.map(item => item.repo));
  for (const expected of [
    'ollama/ollama',
    'Aider-AI/aider',
    'n8n-io/n8n',
    'comfyanonymous/ComfyUI',
    'Lightricks/LTX-Video',
    'Wan-Video/Wan2.1',
    'ggerganov/whisper.cpp',
    'qdrant/qdrant',
    'apify/crawlee',
    'mdabrowski1990/uds',
    'miikasyvanen/FastECU',
    'Switchleg1/SimosTools'
  ]) assert.ok(repos.has(expected), `missing curated seed ${expected}`);
});

test('healthy permissive repository is admitted', async () => {
  const { evaluateRepository } = await fabric();
  const result = evaluateRepository(healthyRepo, NOW);
  assert.equal(result.status, 'accepted');
  assert.ok(result.score >= 60 && result.score <= 100);
});

test('copyleft repositories stay external-only', async () => {
  const { evaluateRepository } = await fabric();
  const result = evaluateRepository({ ...healthyRepo, license: { spdx_id: 'GPL-3.0' } }, NOW);
  assert.equal(result.status, 'external-only');
});

test('unknown licenses are quarantined instead of guessed safe', async () => {
  const { evaluateRepository } = await fabric();
  const result = evaluateRepository({ ...healthyRepo, license: { spdx_id: 'NOASSERTION' } }, NOW);
  assert.equal(result.status, 'quarantine');
});

test('archived repositories are rejected from automatic routing', async () => {
  const { evaluateRepository } = await fabric();
  const result = evaluateRepository({ ...healthyRepo, archived: true }, NOW);
  assert.equal(result.status, 'rejected');
});

test('dangerous abuse-oriented repositories are rejected', async () => {
  const { evaluateRepository } = await fabric();
  const result = evaluateRepository({
    ...healthyRepo,
    description: 'credential stealer malware payload framework',
    topics: ['malware', 'credential-stealer', 'phishing']
  }, NOW);
  assert.equal(result.status, 'rejected');
  assert.ok(result.reasons.some(reason => /risk/i.test(reason)));
});

test('missing metadata fails closed without throwing', async () => {
  const { evaluateRepository, normalizeRepository } = await fabric();
  const result = evaluateRepository({ full_name: 'example/unknown', license: null, topics: null, pushed_at: null }, NOW);
  assert.ok(['quarantine', 'rejected'].includes(result.status));
  const normalized = normalizeRepository({ full_name: 'example/unknown' }, { category: 'local-llm', executionTarget: 'local-cpu' }, NOW);
  assert.equal(normalized.repo, 'example/unknown');
  assert.equal(normalized.category, 'local-llm');
  assert.equal(normalized.executionTarget, 'local-cpu');
});
