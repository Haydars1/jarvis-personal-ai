// hayırlıevlad GitHub API — credential lookup, repo config, API client, file ops
// Language: JavaScript (Cloudflare Workers ESM)

import { te, td, fetchT } from './core.js';
import { credentialSecrets } from './credentials.js';

export async function githubCredential(env) {
  const rows = await credentialSecrets(env, null);
  return rows.find(c => String(c.provider || '').toLowerCase() === 'github' && c.enabled);
}

export function repoCfg(c) {
  const repo = String(c?.endpoint || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw Error('GITHUB_REPO_REQUIRED: endpoint alanına owner/repo yaz');
  return { repo, branch: String(c.model || 'main').trim() || 'main' };
}

export async function gh(c, path, opts = {}) {
  const r = await fetchT('https://api.github.com' + path, { ...opts, headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'hayirlievlad-SelfUpdate', authorization: 'Bearer ' + c.secret, ...(opts.headers || {}) } });
  const text = await r.text(); let data; try { data = text ? JSON.parse(text) : {} } catch { data = { text } };
  if (!r.ok) throw Error('GITHUB_' + r.status + ':' + (data.message || text).slice(0, 240)); return data;
}

export function b64Utf8(s) {
  const bytes = te.encode(String(s)); let x = ''; for (const b of bytes) x += String.fromCharCode(b); return btoa(x);
}

export async function repoFile(c, repo, path, ref) {
  const d = await gh(c, `/repos/${repo}/contents/${encodeURIComponent(path).replaceAll('%2F', '/')}?ref=${encodeURIComponent(ref)}`);
  return { sha: d.sha, content: td.decode(Uint8Array.from(atob((d.content || '').replace(/\n/g, '')), x => x.charCodeAt(0))) };
}

export const SELF_EDIT_ALLOW = new Set([
  'src/worker.js', 'public/app.js', 'public/index.html', 'public/app.css',
  'schema.sql', 'README-v6.txt',
  'ios/JARVIS/JarvisAPI.swift', 'ios/JARVIS/AppState.swift',
  'ios/JARVIS/ContentView.swift', 'ios/JARVIS/SettingsView.swift', 'ios/project.yml',
  '.github/workflows/deploy-cloudflare.yml', '.github/workflows/ios-native-check.yml'
]);

export function cleanAiJson(t) {
  t = String(t || '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) t = m[1].trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}
