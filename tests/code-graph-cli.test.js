import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli = resolve('scripts/code-graph/query.mjs');
const fixture = resolve('tests/fixtures/code-graph.json');
const sourceCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function runStatus(graphPath, sha) {
  return spawnSync(process.execPath, [cli, 'status'], {
    encoding: 'utf8',
    env: { ...process.env, CODE_GRAPH_PATH: graphPath, GITHUB_SHA: sha }
  });
}

test('graph_status_exits_zero_for_current_valid_graph', () => {
  const result = runStatus(fixture, sourceCommit);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.validation.valid, true);
  assert.equal(body.status, 'ready');
});

test('graph_status_exits_nonzero_for_stale_graph', () => {
  const result = runStatus(fixture, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, 'stale');
});

test('graph_status_exits_nonzero_for_invalid_graph', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-code-graph-'));
  const graphPath = join(dir, 'invalid.json');
  writeFileSync(graphPath, JSON.stringify({ version: 1, status: 'ready', nodes: [], edges: [] }));
  const result = runStatus(graphPath, sourceCommit);
  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, 'invalid');
  assert.equal(body.validation.valid, false);
});
