const GRAPH_STATUSES = new Set(['ready', 'degraded', 'unavailable']);

export function normalizeGraphNode(node = {}) {
  const normalized = {
    id: node.id,
    kind: node.kind,
    name: node.name,
    file: node.file
  };
  if (node.line !== undefined && node.line !== null) normalized.line = node.line;
  return normalized;
}

export function normalizeGraphEdge(edge = {}) {
  const normalized = {
    source: edge.source,
    target: edge.target,
    type: edge.type
  };
  if (edge.provenance !== undefined && edge.provenance !== null) normalized.provenance = edge.provenance;
  return normalized;
}

export function validateCodeGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return { valid: false, errors: ['graph must be an object'] };
  }
  if (graph.version !== 1) errors.push('version must be 1');
  if (typeof graph.source_commit !== 'string' || graph.source_commit.length === 0) errors.push('source_commit must be a non-empty string');
  if (!GRAPH_STATUSES.has(graph.status)) errors.push('status must be ready, degraded, or unavailable');
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) errors.push('nodes must be a non-empty array');
  if (!Array.isArray(graph.edges) || graph.edges.length === 0) errors.push('edges must be a non-empty array');

  const nodeIds = new Set();
  if (Array.isArray(graph.nodes)) {
    for (const [index, node] of graph.nodes.entries()) {
      if (!node || typeof node !== 'object') {
        errors.push(`nodes[${index}] must be an object`);
        continue;
      }
      if (typeof node.id !== 'string' || node.id.length === 0) errors.push(`nodes[${index}].id must be a non-empty string`);
      else if (nodeIds.has(node.id)) errors.push(`nodes[${index}].id must be unique`);
      else nodeIds.add(node.id);
      if (typeof node.kind !== 'string' || node.kind.length === 0) errors.push(`nodes[${index}].kind must be a non-empty string`);
      if (typeof node.name !== 'string' || node.name.length === 0) errors.push(`nodes[${index}].name must be a non-empty string`);
      if (typeof node.file !== 'string' || node.file.length === 0) errors.push(`nodes[${index}].file must be a non-empty string`);
      if (node.line !== undefined && (!Number.isInteger(node.line) || node.line < 1)) errors.push(`nodes[${index}].line must be a positive integer`);
    }
  }

  if (Array.isArray(graph.edges)) {
    for (const [index, edge] of graph.edges.entries()) {
      if (!edge || typeof edge !== 'object') {
        errors.push(`edges[${index}] must be an object`);
        continue;
      }
      if (typeof edge.source !== 'string' || !nodeIds.has(edge.source)) errors.push(`edges[${index}].source must reference an existing node`);
      if (typeof edge.target !== 'string' || !nodeIds.has(edge.target)) errors.push(`edges[${index}].target must reference an existing node`);
      if (typeof edge.type !== 'string' || edge.type.length === 0) errors.push(`edges[${index}].type must be a non-empty string`);
    }
  }

  if (graph.stats !== undefined) {
    if (!graph.stats || typeof graph.stats !== 'object') errors.push('stats must be an object');
    else {
      if (Number(graph.stats.nodes) !== (Array.isArray(graph.nodes) ? graph.nodes.length : 0)) errors.push('stats.nodes must match nodes length');
      if (Number(graph.stats.edges) !== (Array.isArray(graph.edges) ? graph.edges.length : 0)) errors.push('stats.edges must match edges length');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getCodeGraphStatus(graph, sourceCommit) {
  const validation = validateCodeGraph(graph);
  if (!validation.valid) return 'invalid';
  if (sourceCommit && graph.source_commit !== sourceCommit) return 'stale';
  return graph.status;
}
