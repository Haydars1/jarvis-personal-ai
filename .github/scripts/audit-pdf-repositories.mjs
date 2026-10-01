import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function auditPdfRepositories(provenance, { fetchImpl = fetch, token = process.env.GITHUB_TOKEN, concurrency = 4 } = {}) {
  const repos = Object.keys(provenance).sort(); const results = []; let next = 0;
  async function request(path) { const response = await fetchImpl('https://api.github.com' + path, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'jarvis-pdf-source-audit', ...(token ? { authorization: 'Bearer ' + token } : {}) }, signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error('GITHUB_' + response.status); return response.json(); }
  async function worker() {
    while (next < repos.length) {
      const repo = repos[next++]; const result = { repo, pdf: provenance[repo], checked_at: new Date().toISOString(), status: 'unavailable', executed_upstream_code: false };
      try {
        const metadata = await request('/repos/' + repo); result.canonical_repo = metadata.full_name; result.license = metadata.license?.spdx_id || null; result.archived = metadata.archived; result.language = metadata.language;
        const commit = await request('/repos/' + repo + '/commits/' + encodeURIComponent(metadata.default_branch)); result.source_commit = commit.sha;
        try { const readme = await request('/repos/' + repo + '/readme?ref=' + commit.sha); const text = Buffer.from(readme.content, 'base64').toString('utf8'); result.readme_sha256 = createHash('sha256').update(text).digest('hex'); result.readme_path = readme.path; result.readme_bytes = Buffer.byteLength(text); result.status = 'source-verified'; }
        catch (error) { result.status = 'metadata-only'; result.readme_error = error.message; }
      } catch (error) { result.error = error.message; }
      results.push(result); console.log(repo + ': ' + result.status);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(8, concurrency)) }, worker));
  return { schema_version: 1, total: repos.length, results: results.sort((a, b) => a.repo.localeCompare(b.repo)), counts: results.reduce((out, row) => ({ ...out, [row.status]: (out[row.status] || 0) + 1 }), {}) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const provenance = JSON.parse(await readFile(new URL('../../data/pdf-repository-provenance.json', import.meta.url), 'utf8'));
  const report = await auditPdfRepositories(provenance); await mkdir('.wrangler', { recursive: true });
  await writeFile('.wrangler/pdf-repository-audit.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.counts));
  // Missing repositories are explicit per-row outcomes. Rate/network failure must not masquerade as a successful audit.
  if (!report.results.some(row => row.status === 'source-verified')) process.exitCode = 1;
}
