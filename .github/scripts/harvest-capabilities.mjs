import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CAPABILITY_DISCOVERY_QUERIES,
  CURATED_CAPABILITY_SEEDS,
  normalizeRepository
} from '../../src/lib/open-source-capabilities.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT = resolve(ROOT, 'data/capability-registry.json');
const STATUS_RISK = Object.freeze({ accepted: 0, 'external-only': 1, quarantine: 2, rejected: 3 });

function uniqSorted(values = []) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))].sort((a, b) => a.localeCompare(b));
}

function restrictiveStatus(a = 'quarantine', b = 'quarantine') {
  return (STATUS_RISK[a] ?? STATUS_RISK.quarantine) >= (STATUS_RISK[b] ?? STATUS_RISK.quarantine) ? a : b;
}

function sourcePriority(source = '') {
  return source === 'curated' ? 3 : source === 'awesome-catalog' ? 2 : source === 'github-search' ? 1 : 0;
}

function curatedPolicy(previous = {}, normalized = {}) {
  const curated = [previous, normalized].filter(entry => entry?.source === 'curated');
  const policy = curated[0] || null;
  if (!policy) return {};
  return {
    autoExecute: curated.some(entry => entry.autoExecute === false) ? false : policy.autoExecute,
    restriction: curated.map(entry => entry.restriction).find(Boolean) || null,
    catalogSource: curated.map(entry => entry.catalogSource).find(Boolean) || null,
    guidePage: curated.map(entry => entry.guidePage).find(value => Number.isFinite(Number(value))) ?? null,
    requiresModelLicenseCheck: curated.some(entry => entry.requiresModelLicenseCheck === true) || Boolean(policy.requiresModelLicenseCheck)
  };
}

export function dedupeRepositories(entries = []) {
  const byRepo = new Map();
  for (const raw of Array.isArray(entries) ? entries : []) {
    if (!raw?.repo) continue;
    const key = String(raw.repo).toLowerCase();
    const categories = uniqSorted(raw.categories?.length ? raw.categories : [raw.category]);
    const targets = uniqSorted(raw.executionTargets?.length ? raw.executionTargets : [raw.executionTarget]);
    const normalized = {
      ...raw,
      category: categories[0] || String(raw.category || 'uncategorized'),
      categories,
      executionTarget: targets[0] || String(raw.executionTarget || 'external-service'),
      executionTargets: targets
    };
    const previous = byRepo.get(key);
    if (!previous) {
      byRepo.set(key, normalized);
      continue;
    }

    const best = Number(normalized.score || 0) > Number(previous.score || 0) ? normalized : previous;
    const source = sourcePriority(normalized.source) > sourcePriority(previous.source) ? normalized.source : previous.source;
    const mergedCategories = uniqSorted([...previous.categories, ...normalized.categories]);
    const mergedTargets = uniqSorted([...previous.executionTargets, ...normalized.executionTargets]);
    const policy = curatedPolicy(previous, normalized);
    byRepo.set(key, {
      ...previous,
      ...best,
      ...policy,
      repo: previous.repo || normalized.repo,
      category: mergedCategories[0] || best.category,
      categories: mergedCategories,
      executionTarget: mergedTargets[0] || best.executionTarget,
      executionTargets: mergedTargets,
      status: restrictiveStatus(previous.status, normalized.status),
      score: Math.max(Number(previous.score || 0), Number(normalized.score || 0)),
      source,
      reasons: uniqSorted([...(previous.reasons || []), ...(normalized.reasons || [])]),
      topics: uniqSorted([...(previous.topics || []), ...(normalized.topics || [])])
    });
  }
  return [...byRepo.values()];
}

export function sortRegistry(entries = []) {
  return [...entries].sort((a, b) => {
    const aCategory = String(a?.categories?.[0] || a?.category || '');
    const bCategory = String(b?.categories?.[0] || b?.category || '');
    return aCategory.localeCompare(bCategory)
      || Number(b?.score || 0) - Number(a?.score || 0)
      || String(a?.repo || '').localeCompare(String(b?.repo || ''));
  });
}

function requestHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'jarvis-capability-harvester'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubJson(url, { fetchImpl = globalThis.fetch, token = '', optional = false } = {}) {
  const response = await fetchImpl(url, { headers: requestHeaders(token) });
  if (!response.ok) {
    if (optional) return null;
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub ${response.status} for ${url}: ${body.slice(0, 240)}`);
  }
  return response.json();
}

function curatedFallback(seed, now) {
  return normalizeRepository({ full_name: seed.repo }, { ...seed, source: 'curated' }, now);
}

async function harvestSearchQuery(definition, options) {
  const query = encodeURIComponent(definition.query);
  const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${options.limit}`;
  const payload = await githubJson(url, options);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map(repo => normalizeRepository(repo, { ...definition, source: 'github-search' }, options.now));
}

async function harvestCuratedSeed(seed, options) {
  const url = `https://api.github.com/repos/${seed.repo}`;
  const repo = await githubJson(url, { ...options, optional: true });
  return repo ? normalizeRepository(repo, { ...seed, source: 'curated' }, options.now) : curatedFallback(seed, options.now);
}

async function smallDelay(ms = 225) {
  await new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

export async function harvestCapabilities({
  fetchImpl = globalThis.fetch,
  token = process.env.GITHUB_TOKEN || '',
  limit = Number(process.env.CAPABILITY_HARVEST_PER_QUERY || 12),
  now = Date.now(),
  delayMs = Number(process.env.CAPABILITY_HARVEST_DELAY_MS || 225)
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  const boundedLimit = Math.max(1, Math.min(30, Number.isFinite(limit) ? Math.floor(limit) : 12));
  const options = { fetchImpl, token, limit: boundedLimit, now };
  const discovered = [];
  const errors = [];

  for (const definition of CAPABILITY_DISCOVERY_QUERIES) {
    try {
      discovered.push(...await harvestSearchQuery(definition, options));
    } catch (error) {
      errors.push({ source: 'search', query: definition.query, error: String(error?.message || error) });
    }
    if (delayMs > 0) await smallDelay(delayMs);
  }

  for (const seed of CURATED_CAPABILITY_SEEDS) {
    try {
      discovered.push(await harvestCuratedSeed(seed, options));
    } catch (error) {
      discovered.push(curatedFallback(seed, now));
      errors.push({ source: 'curated', repo: seed.repo, error: String(error?.message || error) });
    }
  }

  const entries = sortRegistry(dedupeRepositories(discovered));
  return {
    schemaVersion: 1,
    entries,
    stats: {
      queries: CAPABILITY_DISCOVERY_QUERIES.length,
      curatedSeeds: CURATED_CAPABILITY_SEEDS.length,
      candidates: discovered.length,
      uniqueRepositories: entries.length,
      errors: errors.length
    }
  };
}

export async function writeRegistry(registry, outputPath = DEFAULT_OUTPUT) {
  await mkdir(dirname(outputPath), { recursive: true });
  const stable = {
    schemaVersion: registry.schemaVersion || 1,
    entries: sortRegistry(dedupeRepositories(registry.entries || []))
  };
  await writeFile(outputPath, `${JSON.stringify(stable, null, 2)}\n`, 'utf8');
  return stable;
}

async function main() {
  const registry = await harvestCapabilities();
  const stable = await writeRegistry(registry);
  const counts = stable.entries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});
  const repos = new Set(stable.entries.map(entry => String(entry.repo).toLowerCase()));
  const missingCurated = CURATED_CAPABILITY_SEEDS.map(seed => seed.repo).filter(repo => !repos.has(repo.toLowerCase()));
  if (missingCurated.length) throw new Error(`Registry missing curated seeds: ${missingCurated.join(', ')}`);
  console.log(JSON.stringify({ entries: stable.entries.length, curatedSeeds: CURATED_CAPABILITY_SEEDS.length, missingCurated: 0, status: counts }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
