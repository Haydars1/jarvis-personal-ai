import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CURATED_CAPABILITY_SEEDS } from '../src/lib/open-source-capabilities.js';
import { OBD_PDF_SEEDS } from '../src/lib/obd-pdf-seeds.js';

const DEFAULT_ROOT = path.join(os.homedir(), '.jarvis', 'third_party');
const DEFAULT_CONCURRENCY = 2;

export function sourcePoolSeeds() {
  const map = new Map();
  for (const seed of [...CURATED_CAPABILITY_SEEDS, ...OBD_PDF_SEEDS]) {
    const key = String(seed.repo || '').toLowerCase();
    if (!key) continue;
    const previous = map.get(key) || {};
    map.set(key, {
      ...previous,
      ...seed,
      categories: [...new Set([...(previous.categories || [previous.category].filter(Boolean)), ...(seed.categories || [seed.category].filter(Boolean))])],
      executionTargets: [...new Set([...(previous.executionTargets || [previous.executionTarget].filter(Boolean)), ...(seed.executionTargets || [seed.executionTarget].filter(Boolean))])],
      autoExecute: previous.autoExecute === false || seed.autoExecute === false ? false : (seed.autoExecute ?? previous.autoExecute ?? true),
      restrictions: [...new Set([...(previous.restrictions || [previous.restriction].filter(Boolean)), ...(seed.restrictions || [seed.restriction].filter(Boolean))])]
    });
  }
  return [...map.values()].sort((a, b) => String(a.repo).localeCompare(String(b.repo)));
}

export function safeRepoSegments(repo) {
  const [owner, name, ...extra] = String(repo || '').split('/');
  if (!owner || !name || extra.length || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error(`INVALID_REPOSITORY_NAME:${repo}`);
  }
  return [owner, name];
}

export function repoLocalPath(root, repo) {
  const [owner, name] = safeRepoSegments(repo);
  return path.join(root, 'sources', owner, name);
}

export function cloneArgs(repo, destination) {
  return [
    'clone', '--depth', '1', '--filter=blob:none', '--single-branch', '--no-tags',
    `https://github.com/${repo}.git`, destination
  ];
}

export function fetchArgs() {
  return ['fetch', '--depth', '1', '--no-tags', 'origin', 'HEAD'];
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

function run(command, args, { cwd, env = {}, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
        ...env
      },
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true
    });
    let stdout = '', stderr = '';
    if (quiet) {
      child.stdout?.on('data', chunk => { stdout += chunk; });
      child.stderr?.on('data', chunk => { stderr += chunk; });
    }
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      : reject(new Error(`${command} ${args.join(' ')} exited ${code}${stderr ? `: ${stderr.trim().slice(-500)}` : ''}`)));
  });
}

async function git(args, options = {}) {
  return run('git', args, options);
}

async function resolveCommit(cwd) {
  const { stdout } = await git(['rev-parse', 'HEAD'], { cwd, quiet: true });
  return stdout.trim();
}

async function resolveRemote(cwd) {
  const { stdout } = await git(['remote', 'get-url', 'origin'], { cwd, quiet: true });
  return stdout.trim();
}

export async function syncRepository(seed, { root = DEFAULT_ROOT, dryRun = false } = {}) {
  const repo = String(seed.repo);
  const destination = repoLocalPath(root, repo);
  const startedAt = Date.now();
  if (dryRun) {
    return { repo, path: destination, status: 'dry-run', autoExecute: seed.autoExecute !== false, categories: seed.categories || [seed.category] };
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const gitDir = path.join(destination, '.git');
  if (await exists(gitDir)) {
    await git(['remote', 'set-url', 'origin', `https://github.com/${repo}.git`], { cwd: destination });
    await git(fetchArgs(), { cwd: destination });
    await git(['reset', '--hard', 'FETCH_HEAD'], { cwd: destination });
    await git(['clean', '-fd'], { cwd: destination });
  } else {
    await git(cloneArgs(repo, destination));
  }

  const [commit, remote] = await Promise.all([resolveCommit(destination), resolveRemote(destination)]);
  return {
    repo,
    canonicalRemote: remote,
    path: destination,
    commit,
    status: 'ready',
    autoExecute: seed.autoExecute !== false,
    restriction: seed.restriction || null,
    categories: seed.categories || [seed.category].filter(Boolean),
    executionTargets: seed.executionTargets || [seed.executionTarget].filter(Boolean),
    syncedAt: Date.now(),
    durationMs: Date.now() - startedAt
  };
}

async function readManifest(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return { schemaVersion: 1, entries: [] }; }
}

export async function syncSourcePool({
  root = process.env.JARVIS_SOURCE_ROOT || DEFAULT_ROOT,
  concurrency = Number(process.env.JARVIS_SOURCE_CONCURRENCY || DEFAULT_CONCURRENCY),
  dryRun = false,
  only = null
} = {}) {
  const manifestPath = path.join(root, 'source-pool-manifest.json');
  await mkdir(root, { recursive: true });
  const previous = await readManifest(manifestPath);
  const previousMap = new Map((previous.entries || []).map(entry => [String(entry.repo).toLowerCase(), entry]));
  let seeds = sourcePoolSeeds();
  if (only?.length) {
    const wanted = new Set(only.map(value => String(value).toLowerCase()));
    seeds = seeds.filter(seed => wanted.has(String(seed.repo).toLowerCase()));
  }

  const results = new Array(seeds.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= seeds.length) return;
      const seed = seeds[index];
      process.stdout.write(`[source-pool ${index + 1}/${seeds.length}] ${seed.repo}\n`);
      try {
        results[index] = await syncRepository(seed, { root, dryRun });
      } catch (error) {
        results[index] = {
          ...(previousMap.get(String(seed.repo).toLowerCase()) || {}),
          repo: seed.repo,
          path: repoLocalPath(root, seed.repo),
          status: 'failed',
          error: String(error?.message || error),
          failedAt: Date.now(),
          autoExecute: seed.autoExecute !== false,
          restriction: seed.restriction || null,
          categories: seed.categories || [seed.category].filter(Boolean),
          executionTargets: seed.executionTargets || [seed.executionTarget].filter(Boolean)
        };
      }
    }
  };

  const workerCount = Math.max(1, Math.min(8, Number.isFinite(concurrency) ? Math.floor(concurrency) : DEFAULT_CONCURRENCY));
  await Promise.all(Array.from({ length: workerCount }, worker));
  const entries = results.filter(Boolean).sort((a, b) => String(a.repo).localeCompare(String(b.repo)));
  const manifest = {
    schemaVersion: 1,
    root,
    generatedAt: Date.now(),
    requestedRepositories: seeds.length,
    ready: entries.filter(entry => entry.status === 'ready').length,
    failed: entries.filter(entry => entry.status === 'failed').length,
    dryRun: entries.filter(entry => entry.status === 'dry-run').length,
    entries
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dryRun: false, only: null };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--root=')) options.root = arg.slice('--root='.length);
    else if (arg.startsWith('--concurrency=')) options.concurrency = Number(arg.slice('--concurrency='.length));
    else if (arg.startsWith('--only=')) options.only = arg.slice('--only='.length).split(',').map(value => value.trim()).filter(Boolean);
  }
  return options;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) {
  syncSourcePool(parseArgs()).then(manifest => {
    console.log(JSON.stringify({ root: manifest.root, requested: manifest.requestedRepositories, ready: manifest.ready, failed: manifest.failed, dryRun: manifest.dryRun }, null, 2));
    if (manifest.failed > 0 && !manifest.dryRun) process.exitCode = 2;
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
