import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

test('repository contains a populated versioned capability registry document', () => {
  assert.ok(existsSync(registryPath), 'data/capability-registry.json must exist');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  assert.equal(registry.schemaVersion, 1);
  assert.ok(Array.isArray(registry.entries));
  assert.ok(registry.entries.length >= 100, 'real harvested registry should stay populated');
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
