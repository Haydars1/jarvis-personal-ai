import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateCodeGraph,
  getCodeGraphStatus,
  normalizeGraphNode,
  normalizeGraphEdge,
  findGraphNodes,
  getGraphNeighbors,
  findGraphPath,
  rankImpactedFiles
} from '../src/lib/code-graph.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'code-graph.json');

async function fixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

test('accepts_valid_version_1_graph', async () => {
  const graph = await fixture();
  assert.deepEqual(validateCodeGraph(graph), { valid: true, errors: [] });
  assert.equal(graph.version, 1);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.length > 0);
});

test('rejects_empty_graph', () => {
  const graph = {
    version: 1,
    generator: 'graphify',
    source_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    generated_at: '2026-10-03T12:00:00.000Z',
    status: 'ready',
    nodes: [],
    edges: [],
    stats: { nodes: 0, edges: 0 }
  };
  const result = validateCodeGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('nodes')));
});

test('rejects_malformed_edges', async () => {
  const graph = await fixture();
  graph.edges = [{ source: 'missing', target: graph.nodes[0].id, type: 'imports' }];
  const result = validateCodeGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('source')));
});

test('reports_ready_for_matching_commit', async () => {
  const graph = await fixture();
  assert.equal(getCodeGraphStatus(graph, graph.source_commit), 'ready');
});

test('reports_stale_for_different_commit', async () => {
  const graph = await fixture();
  assert.equal(getCodeGraphStatus(graph, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'), 'stale');
});

test('normalization_helpers_preserve_supported_fields', () => {
  assert.deepEqual(
    normalizeGraphNode({ id: 'n1', kind: 'function', name: 'run', file: 'src/a.js', line: 7, ignored: true }),
    { id: 'n1', kind: 'function', name: 'run', file: 'src/a.js', line: 7 }
  );
  assert.deepEqual(
    normalizeGraphEdge({ source: 'n1', target: 'n2', type: 'calls', provenance: 'EXTRACTED', ignored: true }),
    { source: 'n1', target: 'n2', type: 'calls', provenance: 'EXTRACTED' }
  );
});

test('finds_nodes_by_name_and_file', async () => {
  const graph = await fixture();
  assert.deepEqual(findGraphNodes(graph, 'WORKER').map(node => node.id), ['file:src/worker.js']);
  assert.deepEqual(findGraphNodes(graph, 'application/chat').map(node => node.id), [
    'file:src/application/chat/orchestrator.js',
    'file:src/application/chat/presenter.js'
  ]);
});

test('returns_directional_neighbors', async () => {
  const graph = await fixture();
  assert.deepEqual(getGraphNeighbors(graph, 'symbol:compose', { direction: 'outgoing' }).map(node => node.id), ['file:src/worker.js']);
  assert.deepEqual(getGraphNeighbors(graph, 'file:src/worker.js', { direction: 'incoming' }).map(node => node.id), [
    'file:src/application/chat/presenter.js',
    'symbol:compose'
  ]);
});

test('finds_shortest_path_with_cycle', async () => {
  const graph = await fixture();
  assert.deepEqual(findGraphPath(graph, 'file:src/app-entry.js', 'file:src/application/chat/presenter.js'), [
    'file:src/app-entry.js',
    'symbol:compose',
    'file:src/worker.js',
    'file:src/application/chat/orchestrator.js',
    'file:src/application/chat/presenter.js'
  ]);
});

test('returns_null_for_disconnected_path', async () => {
  const graph = await fixture();
  assert.equal(findGraphPath(graph, 'file:src/app-entry.js', 'file:src/disconnected.js'), null);
});

test('ranks_reverse_dependency_impact', async () => {
  const graph = await fixture();
  assert.deepEqual(rankImpactedFiles(graph, ['src/worker.js']), [
    { file: 'src/app-entry.js', score: 2 },
    { file: 'src/application/chat/orchestrator.js', score: 1 },
    { file: 'src/application/chat/presenter.js', score: 1 }
  ]);
});
