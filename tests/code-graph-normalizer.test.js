import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeGraphify } from '../scripts/code-graph/normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rawPath = join(here, 'fixtures', 'graphify-raw.json');

async function rawFixture() {
  return JSON.parse(await readFile(rawPath, 'utf8'));
}

const metadata = {
  sourceCommit: 'cccccccccccccccccccccccccccccccccccccccc',
  generatedAt: '2026-10-03T13:00:00.000Z'
};

test('normalizes_supported_graphify_shape', async () => {
  const graph = normalizeGraphify(await rawFixture(), metadata);
  assert.equal(graph.version, 1);
  assert.equal(graph.generator, 'graphify');
  assert.equal(graph.source_commit, metadata.sourceCommit);
  assert.equal(graph.generated_at, metadata.generatedAt);
  assert.equal(graph.status, 'ready');
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.deepEqual(graph.stats, { nodes: 2, edges: 1 });
  assert.deepEqual(graph.edges[0], {
    source: 'src/app-entry.js:composeApplication',
    target: 'src/worker.js:handleRequest',
    type: 'calls',
    provenance: 'EXTRACTED'
  });
});

test('preserves_source_location_and_provenance', async () => {
  const graph = normalizeGraphify(await rawFixture(), metadata);
  assert.deepEqual(graph.nodes[0], {
    id: 'src/app-entry.js:composeApplication',
    kind: 'function',
    name: 'composeApplication',
    file: 'src/app-entry.js',
    line: 20
  });
  assert.equal(graph.edges[0].provenance, 'EXTRACTED');
});

test('accepts_raw_edges_key_as_well_as_clustered_links_key', async () => {
  const raw = await rawFixture();
  raw.edges = raw.links;
  delete raw.links;
  const graph = normalizeGraphify(raw, metadata);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].type, 'calls');
});

test('rejects_unknown_shape', () => {
  assert.throws(
    () => normalizeGraphify({ vertices: [], relationships: [] }, metadata),
    /Unsupported Graphify graph shape/
  );
});

test('rejects_empty_graphify_output', () => {
  assert.throws(
    () => normalizeGraphify({ nodes: [], links: [] }, metadata),
    /Graphify graph is empty/
  );
});
