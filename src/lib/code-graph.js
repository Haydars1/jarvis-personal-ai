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

function graphIndex(graph) {
  const validation = validateCodeGraph(graph);
  if (!validation.valid) throw new Error(`Invalid code graph: ${validation.errors.join('; ')}`);
  return new Map(graph.nodes.map(node => [node.id, node]));
}

export function findGraphNodes(graph, query, options = {}) {
  graphIndex(graph);
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : Infinity;
  return graph.nodes
    .filter(node => [node.name, node.file, node.kind].some(value => String(value ?? '').toLowerCase().includes(needle)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function getGraphNeighbors(graph, nodeId, options = {}) {
  const nodes = graphIndex(graph);
  if (!nodes.has(nodeId)) return [];
  const direction = options.direction || 'both';
  if (!['both', 'incoming', 'outgoing'].includes(direction)) throw new Error(`Unsupported graph direction: ${direction}`);
  const ids = new Set();
  for (const edge of graph.edges) {
    if ((direction === 'both' || direction === 'outgoing') && edge.source === nodeId) ids.add(edge.target);
    if ((direction === 'both' || direction === 'incoming') && edge.target === nodeId) ids.add(edge.source);
  }
  return [...ids].sort().map(id => nodes.get(id)).filter(Boolean);
}

export function findGraphPath(graph, fromId, toId, options = {}) {
  const nodes = graphIndex(graph);
  if (!nodes.has(fromId) || !nodes.has(toId)) return null;
  if (fromId === toId) return [fromId];
  const direction = options.direction || 'outgoing';
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const neighbors = getGraphNeighbors(graph, current, { direction }).map(node => node.id);
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      const nextPath = [...path, neighbor];
      if (neighbor === toId) return nextPath;
      visited.add(neighbor);
      queue.push(nextPath);
    }
  }
  return null;
}

export function rankImpactedFiles(graph, changedFiles, options = {}) {
  const nodes = graphIndex(graph);
  const changed = new Set((Array.isArray(changedFiles) ? changedFiles : [changedFiles]).filter(Boolean).map(String));
  if (!changed.size) return [];
  const seeds = graph.nodes.filter(node => changed.has(node.file)).map(node => node.id).sort();
  if (!seeds.length) return [];
  const visited = new Set(seeds);
  const queue = [...seeds];
  const scores = new Map();
  while (queue.length) {
    const current = queue.shift();
    const incoming = getGraphNeighbors(graph, current, { direction: 'incoming' });
    for (const node of incoming) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      queue.push(node.id);
      if (!changed.has(node.file)) scores.set(node.file, (scores.get(node.file) || 0) + 1);
    }
  }
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : Infinity;
  return [...scores.entries()]
    .map(([file, score]) => ({ file, score }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, limit);
}

export const CODE_GRAPH_CAPABILITIES=Object.freeze(['code-graph','dependency-trace','impact-analysis','symbol-neighborhood']);
export function graphCapabilities(graph,sourceCommit){return getCodeGraphStatus(graph,sourceCommit)==='ready'?[...CODE_GRAPH_CAPABILITIES]:[];}
