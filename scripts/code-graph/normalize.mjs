import { validateCodeGraph } from '../../src/lib/code-graph.js';

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Graphify ${field} is required`);
  return text;
}

function graphifyLine(value) {
  if (Number.isInteger(value) && value > 0) return value;
  const match = String(value ?? '').trim().match(/^L?(\d+)(?::\d+)?$/i);
  if (!match) return undefined;
  const line = Number(match[1]);
  return Number.isInteger(line) && line > 0 ? line : undefined;
}

function nodeKind(node) {
  return String(node.type || node.node_type || node.kind || node.file_type || 'code').trim().toLowerCase() || 'code';
}

export function normalizeGraphify(raw, metadata = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Unsupported Graphify graph shape');
  if (!Array.isArray(raw.nodes) || (!Array.isArray(raw.links) && !Array.isArray(raw.edges))) {
    throw new Error('Unsupported Graphify graph shape');
  }

  const rawEdges = Array.isArray(raw.links) ? raw.links : raw.edges;
  if (raw.nodes.length === 0 || rawEdges.length === 0) throw new Error('Graphify graph is empty');

  const nodes = raw.nodes.map((node, index) => {
    if (!node || typeof node !== 'object') throw new Error(`Graphify nodes[${index}] must be an object`);
    const normalized = {
      id: requiredText(node.id, `nodes[${index}].id`),
      kind: nodeKind(node),
      name: requiredText(node.label || node.name || node.id, `nodes[${index}].label`),
      file: requiredText(node.source_file || node.file || node.path, `nodes[${index}].source_file`)
    };
    const line = graphifyLine(node.source_location ?? node.line ?? node.start_line);
    if (line) normalized.line = line;
    return normalized;
  });

  const edges = rawEdges.map((edge, index) => {
    if (!edge || typeof edge !== 'object') throw new Error(`Graphify edges[${index}] must be an object`);
    return {
      source: requiredText(edge.source?.id ?? edge.source, `edges[${index}].source`),
      target: requiredText(edge.target?.id ?? edge.target, `edges[${index}].target`),
      type: requiredText(edge.relation || edge.type || edge.kind || edge.label || 'relates', `edges[${index}].relation`).toLowerCase(),
      provenance: String(edge.confidence || edge.provenance || 'EXTRACTED').trim().toUpperCase() || 'EXTRACTED'
    };
  });

  const graph = {
    version: 1,
    generator: 'graphify',
    source_commit: requiredText(metadata.sourceCommit, 'metadata.sourceCommit'),
    generated_at: requiredText(metadata.generatedAt, 'metadata.generatedAt'),
    status: 'ready',
    nodes,
    edges,
    stats: { nodes: nodes.length, edges: edges.length }
  };
  const validation = validateCodeGraph(graph);
  if (!validation.valid) throw new Error(`Normalized Graphify graph is invalid: ${validation.errors.join('; ')}`);
  return graph;
}
