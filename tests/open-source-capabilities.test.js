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

const runnableRegistry = [
  {
    repo: 'local/video-engine',
    category: 'video-generation', categories: ['video-generation'],
    executionTarget: 'local-gpu', executionTargets: ['local-gpu'],
    status: 'accepted', score: 92,
    adapter: { status: 'ready', id: 'video-engine' }
  },
  {
    repo: 'local/coder',
    category: 'coding-agent', categories: ['coding-agent'],
    executionTarget: 'local-cpu', executionTargets: ['local-cpu'],
    status: 'accepted', score: 88,
    adapter: { status: 'ready', id: 'coder' }
  },
  {
    repo: 'catalog/unadapted-video',
    category: 'video-generation', categories: ['video-generation'],
    executionTarget: 'local-gpu', executionTargets: ['local-gpu'],
    status: 'accepted', score: 99,
    adapter: null
  }
];

test('task routing selects only compatible runnable open-source capabilities', async () => {
  const { openSourceCandidates } = await fabric();
  const candidates = openSourceCandidates('video_creation', runnableRegistry, {
    availableTargets: ['local-gpu'],
    health: { 'local/video-engine': { available: true } }
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].repo, 'local/video-engine');
  assert.ok(candidates[0].routingScore > 100);
});

test('runtime target mismatch and unhealthy adapters suppress automatic candidates', async () => {
  const { openSourceCandidates } = await fabric();
  assert.deepEqual(openSourceCandidates('video_creation', runnableRegistry, { availableTargets: ['local-cpu'] }), []);
  assert.deepEqual(openSourceCandidates('video_creation', runnableRegistry, {
    availableTargets: ['local-gpu'],
    health: { 'local/video-engine': { available: false } }
  }), []);
});

test('unadapted repositories remain catalog-visible but are not auto-executable', async () => {
  const { openSourceCandidates } = await fabric();
  const hidden = openSourceCandidates('video_creation', runnableRegistry, { availableTargets: ['local-gpu'] });
  assert.equal(hidden.some(item => item.repo === 'catalog/unadapted-video'), false);
  const catalog = openSourceCandidates('video_creation', runnableRegistry, { availableTargets: ['local-gpu'], includeUnadapted: true });
  assert.equal(catalog.some(item => item.repo === 'catalog/unadapted-video'), true);
});

test('execution plan puts runnable open-source lane before provider fallback', async () => {
  const { buildExecutionPlan } = await import('../src/lib/orchestration.js');
  const providers = [
    { provider: 'gemini', capabilities: '["chat","video_creation"]', samples: 10, successes: 9, failures: 1, avg_latency_ms: 1000, priority: 10 },
    { provider: 'openai', capabilities: '["chat"]', samples: 10, successes: 9, failures: 1, avg_latency_ms: 1200, priority: 10 }
  ];
  const plan = buildExecutionPlan('video_creation', runnableRegistry, { availableTargets: ['local-gpu'] }, providers);
  assert.equal(plan.preferredLane, 'open-source');
  assert.equal(plan.openSource[0].repo, 'local/video-engine');
  assert.equal(plan.providers[0].provider, 'gemini');
  assert.ok(plan.providers[0].routingScore > plan.providers[1].routingScore);
});

test('emissions modification open-source candidates remain analysis-only', async () => {
  const { openSourceCandidates } = await fabric();
  const registry = [{
    repo: 'local/bin-inspector',
    category: 'ecu-file-analysis', categories: ['ecu-file-analysis'],
    executionTarget: 'local-cpu', executionTargets: ['local-cpu'],
    status: 'accepted', score: 90,
    adapter: { status: 'ready', id: 'bin-inspector' }
  }];
  const [candidate] = openSourceCandidates('emissions_modification', registry, { availableTargets: ['local-cpu'] });
  assert.equal(candidate.executionMode, 'analysis-only');
});
