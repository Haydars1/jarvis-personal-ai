import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryIntegrations } from '../src/lib/repository-integrations.js';
import { ALL_PDF_SEEDS } from '../.github/scripts/harvest-capabilities.mjs';
import { auditPdfRepositories } from '../.github/scripts/audit-pdf-repositories.mjs';
import { resolveNativeSkillAdapter } from '../src/lib/native-skill-adapters.js';
test('every one of 214 attached PDF repositories has a concrete source route and harvest seed', () => {
  const rows = repositoryIntegrations(); assert.equal(rows.length, 214); assert.equal(new Set(rows.map(row => row.repo.toLowerCase())).size, 214);
  for (const row of rows) { assert.ok(ALL_PDF_SEEDS.some(seed => seed.repo.toLowerCase() === row.repo.toLowerCase()), row.repo); assert.ok(row.integration.route); assert.ok(row.pdf.length); }
  assert.equal(rows.find(row => row.repo === 'brendan-w/python-OBD').integration.status, 'hardware-required');
  assert.equal(rows.find(row => row.repo === 'microsoft/markitdown').integration.status, 'source-only');
});
test('ThinkDiag recording adapter never masquerades as a physical vehicle bridge', () => {
  const adapter = resolveNativeSkillAdapter({ repo: 'cubigato/thinkcar-tc-reader', capabilities: ['vehicle-diagnostics'] });
  assert.equal(adapter.id, 'thinkdiag-tc-import'); assert.equal(adapter.lane, 'worker');
});
test('per-repo audit follows canonical metadata, pins README, distinguishes unavailable repos', async () => {
  const requests = []; const fetchImpl = async url => { requests.push(url); if (url.includes('/missing/')) return { ok: false, status: 404 }; return { ok: true, json: async () => url.includes('/readme?') ? { content: Buffer.from('Documentation').toString('base64'), path: 'README.md' } : url.includes('/commits/') ? { sha: 'a'.repeat(40) } : { full_name: 'example/tool', default_branch: 'main', license: { spdx_id: 'MIT' } } }; };
  const result = await auditPdfRepositories({ 'example/tool': [], 'missing/repo': [] }, { fetchImpl, concurrency: 2 });
  assert.equal(result.counts['source-verified'], 1); assert.equal(result.counts.unavailable, 1); assert.ok(requests.some(url => url.endsWith('/readme?ref=' + 'a'.repeat(40)))); assert.equal(result.results[0].executed_upstream_code, false);
});
