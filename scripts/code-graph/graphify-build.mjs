import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeGraphify } from './normalize.mjs';

function currentCommit() {
  if (String(process.env.GITHUB_SHA || '').trim()) return String(process.env.GITHUB_SHA).trim();
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function rawGraphPath() {
  const explicit = process.argv[2] || process.env.GRAPHIFY_RAW_GRAPH;
  if (explicit) return resolve(explicit);
  const candidates = [
    resolve('graphify-out/graphify-raw.json'),
    resolve('graphify-out/graph.json'),
    resolve('graphify-out/graphify.json')
  ];
  return candidates.find(existsSync) || null;
}

const input = rawGraphPath();
if (!input || !existsSync(input)) {
  console.error('No Graphify JSON export found. Run Graphify separately, then pass its JSON path as the first argument or GRAPHIFY_RAW_GRAPH. Native graph:build does not depend on Graphify.');
  process.exit(2);
}

const raw = JSON.parse(readFileSync(input, 'utf8'));
const graph = normalizeGraphify(raw, {
  sourceCommit: currentCommit(),
  generatedAt: new Date().toISOString()
});

mkdirSync(resolve('graphify-out'), { recursive: true });
const output = resolve('graphify-out/graphify-code-graph.json');
writeFileSync(output, `${JSON.stringify(graph, null, 2)}\n`);
console.log(`Wrote ${output}`);
