import { normalizeGraphNode, normalizeGraphEdge, validateCodeGraph } from '../../src/lib/code-graph.js';

function edgeList(raw) {
  if (Array.isArray(raw?.edges)) return raw.edges;
  if (Array.isArray(raw?.links)) return raw.links;
  if (Array.isArray(raw?.graph?.edges)) return raw.graph.edges;
  if (Array.isArray(raw?.graph?.links)) return raw.graph.links;
  return null;
}
function nodeList(raw) {
  if (Array.isArray(raw?.nodes)) return raw.nodes;
  if (Array.isArray(raw?.graph?.nodes)) return raw.graph.nodes;
  return null;
}
export function normalizeGraphify(raw, { sourceCommit, generatedAt = new Date().toISOString() } = {}) {
  const nodes = nodeList(raw), edges = edgeList(raw);
  if (!nodes || !edges) throw new Error('Unsupported Graphify graph shape');
  if (!nodes.length || !edges.length) throw new Error('Graphify graph is empty');
  const normalizedNodes = nodes.map(node => normalizeGraphNode({
    id: node.id,
    kind: node.kind ?? node.type,
    name: node.name ?? node.label,
    file: node.file ?? node.path,
    line: node.line
  }));
  const normalizedEdges = edges.map(edge => normalizeGraphEdge({
    source: edge.source?.id ?? edge.source,
    target: edge.target?.id ?? edge.target,
    type: edge.type ?? edge.relationship ?? edge.label,
    provenance: edge.provenance
  }));
  const graph = { version: 1, generator: 'graphify', source_commit: String(sourceCommit || ''), generated_at: generatedAt, status: 'ready', nodes: normalizedNodes, edges: normalizedEdges, stats: { nodes: normalizedNodes.length, edges: normalizedEdges.length } };
  const validation = validateCodeGraph(graph);
  if (!validation.valid) throw new Error('Invalid normalized Graphify graph: ' + validation.errors.join('; '));
  return graph;
}
