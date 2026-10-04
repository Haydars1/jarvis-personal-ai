import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CURATED_CAPABILITY_SEEDS } from '../src/lib/open-source-capabilities.js';
import { readLegacyRegistryCompatibility, validateCapabilityRegistryV2 } from '../src/lib/capability-registry-v2.js';

const harvesterUrl = new URL('../.github/scripts/harvest-capabilities.mjs', import.meta.url);
const harvesterPath = fileURLToPath(harvesterUrl);
const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const registryPath = fileURLToPath(new URL('../data/capability-registry.json', import.meta.url));
const workflowPath = fileURLToPath(new URL('../.github/workflows/capability-harvest.yml', import.meta.url));

async function harvester() {
  assert.ok(existsSync(harvesterPath), 'metadata-only capability harvester must exist');
  return import(harvesterUrl.href);
}

test('harvester deduplicates repositories while preserving capability coverage', async () => {
  const { dedupeRepositories } = await harvester();
  const entries = dedupeRepositories([
    {
      repo: 'example/tool', category: 'local-llm', categories: ['local-llm'],
      executionTarget: 'local-cpu', executionTargets: ['local-cpu'], score: 80,
      status: 'accepted', source: 'github-search'
    },
    {
      repo: 'example/tool', category: 'coding-agent', categories: ['coding-agent'],
      executionTarget: 'local-gpu', executionTargets: ['local-gpu'], score: 91,
      status: 'accepted', source: 'curated'
    }
  ]);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].categories, ['coding-agent', 'local-llm']);
  assert.deepEqual(entries[0].executionTargets, ['local-cpu', 'local-gpu']);
  assert.equal(entries[0].score, 91);
  assert.equal(entries[0].source, 'curated');
});

test('curated catalog restrictions survive a higher-scored search duplicate', async () => {
  const { dedupeRepositories } = await harvester();
  const [entry] = dedupeRepositories([
    {
      repo: 'restricted/video', category: 'video-generation', categories: ['video-generation'],
      executionTarget: 'local-gpu', executionTargets: ['local-gpu'], score: 99,
      status: 'accepted', source: 'github-search', autoExecute: true
    },
    {
      repo: 'restricted/video', category: 'video-generation', categories: ['video-generation'],
      executionTarget: 'catalog-only', executionTargets: ['catalog-only'], score: 40,
      status: 'quarantine', source: 'curated', autoExecute: false,
      restriction: 'region/license restriction', catalogSource: 'uploaded-pdf-2026-09-30', guidePage: 9
    }
  ]);
  assert.equal(entry.autoExecute, false);
  assert.equal(entry.restriction, 'region/license restriction');
  assert.equal(entry.catalogSource, 'uploaded-pdf-2026-09-30');
  assert.equal(entry.guidePage, 9);
  assert.ok(entry.executionTargets.includes('catalog-only'));
});

test('harvest retains every curated seed even when GitHub metadata lookup fails', async () => {
  const { harvestCapabilities } = await harvester();
  const fetchImpl = async url => ({
    ok: String(url).includes('/search/repositories'),
    status: String(url).includes('/search/repositories') ? 200 : 404,
    async json() { return { items: [] }; },
    async text() { return ''; }
  });
  const registry = await harvestCapabilities({ fetchImpl, token: '', limit: 1, delayMs: 0, now: Date.parse('2026-09-30T10:00:00Z') });
  const repos = new Set(registry.entries.map(entry => entry.repo));
  const missing = CURATED_CAPABILITY_SEEDS.map(seed => seed.repo).filter(repo => !repos.has(repo));
  assert.deepEqual(missing, []);
  assert.equal(new Set(CURATED_CAPABILITY_SEEDS.map(seed => String(seed.repo).toLowerCase())).size, CURATED_CAPABILITY_SEEDS.length, 'curated source pool must not contain duplicate repository ids');
});

test('registry sorting is deterministic by capability then score then repo', async () => {
  const { sortRegistry } = await harvester();
  const sorted = sortRegistry([
    { repo: 'z/video', category: 'video-generation', categories: ['video-generation'], score: 70 },
    { repo: 'a/video', category: 'video-generation', categories: ['video-generation'], score: 90 },
    { repo: 'c/code', category: 'coding-agent', categories: ['coding-agent'], score: 50 }
  ]);
  assert.deepEqual(sorted.map(item => item.repo), ['c/code', 'a/video', 'z/video']);
});

test('package exposes metadata harvester command and syntax checks it', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.scripts['harvest:capabilities'], 'node .github/scripts/harvest-capabilities.mjs');
  assert.match(pkg.scripts['check:syntax'], /open-source-capabilities\.js/);
  assert.match(pkg.scripts['check:syntax'], /harvest-capabilities\.mjs/);
});

test('checked-in legacy registry is compatibility-loadable without treating emptiness as populated production data', () => {
  assert.ok(existsSync(registryPath), 'data/capability-registry.json must exist');
  const raw=readFileSync(registryPath,'utf8');
  const loaded=readLegacyRegistryCompatibility(raw);
  assert.ok(['ok','empty'].includes(loaded.status));
  assert.equal(loaded.registry.schemaVersion,2);
  assert.deepEqual(validateCapabilityRegistryV2(loaded.registry).ok,true);
  if(loaded.status==='ok')assert.ok(loaded.registry.sources.length>0);
});

test('scheduled harvester is metadata-only and validates before promotion', () => {
  assert.ok(existsSync(workflowPath), 'capability harvest workflow must exist');
  const source = readFileSync(workflowPath, 'utf8');
  assert.match(source, /schedule:/);
  assert.match(source, /cron:\s*['"][^'"]+['"]/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /contents:\s*write/);
  assert.match(source, /npm run harvest:capabilities/);
  assert.match(source, /npm run check/);
  assert.match(source, /wrangler deploy --dry-run/);
  assert.match(source, /src\/lib\/pdf-guide-seeds\.js/);
  assert.doesNotMatch(source, /git clone.*(?:repo|url|registry)/i);
  assert.doesNotMatch(source, /npm install.*(?:discovered|registry|third-party)/i);
});

test('tested registry refresh promotes directly to main without forbidden PR creation', () => {
  const source = readFileSync(workflowPath, 'utf8');
  assert.match(source, /git diff --quiet -- data\/capability-registry\.json/);
  assert.match(source, /git add data\/capability-registry\.json/);
  assert.doesNotMatch(source, /git add -A/);
  assert.match(source, /git fetch origin main/);
  assert.match(source, /origin\/main/);
  assert.match(source, /HEAD\^/);
  assert.match(source, /git push origin HEAD:main/);
  assert.doesNotMatch(source, /gh pr create/);
  assert.doesNotMatch(source, /pull-requests:\s*write/);
});
