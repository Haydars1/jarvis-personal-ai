import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeGraphify } from './normalize.mjs';

const root = resolve(process.cwd());
const outDir = resolve(root, 'graphify-out');
const rawPath = resolve(outDir, 'graph.json');
const normalizedPath = resolve(outDir, 'code-graph.json');
const graphifyCommand = process.env.GRAPHIFY_COMMAND || 'graphify';

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

mkdirSync(outDir, { recursive: true });

const probe = spawnSync(graphifyCommand, ['--version'], { encoding: 'utf8' });
if (probe.error?.code === 'ENOENT') {
  fail('Graphify code-graph generation is unavailable. Normal JARVIS runtime remains usable; only graph generation failed. Install the open-source Graphify CLI (official PyPI package: graphifyy) or set GRAPHIFY_COMMAND.', 2);
}
if (probe.status !== 0) {
  fail(`Graphify executable was found but could not run (${probe.stderr || probe.stdout || `exit ${probe.status}`}). Normal JARVIS runtime remains usable; only graph generation failed.`, 2);
}

const run = spawnSync(
  graphifyCommand,
  ['extract', root, '--out', root, '--code-only', '--no-cluster'],
  { cwd: root, stdio: 'inherit', env: process.env }
);
if (run.error?.code === 'ENOENT' || run.status !== 0) {
  fail('Graphify extraction failed. Normal JARVIS runtime remains usable; only graph generation failed.', 3);
}
if (!existsSync(rawPath)) fail(`Graphify completed but ${rawPath} was not created.`, 4);

let sourceCommit;
try {
  sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  fail('Could not determine the exact source commit for code-graph freshness validation.', 5);
}

let raw;
try {
  raw = JSON.parse(readFileSync(rawPath, 'utf8'));
} catch (error) {
  fail(`Graphify output is not valid JSON: ${error.message}`, 6);
}

let graph;
try {
  graph = normalizeGraphify(raw, { sourceCommit, generatedAt: new Date().toISOString() });
} catch (error) {
  fail(`Graphify output could not be normalized safely: ${error.message}`, 7);
}

writeFileSync(normalizedPath, `${JSON.stringify(graph, null, 2)}\n`);
console.log(`Wrote ${normalizedPath} (${graph.stats.nodes} nodes, ${graph.stats.edges} edges, source ${graph.source_commit})`);
