import { validateCodeGraph } from '../../../src/lib/code-graph.js';
import { normalizeRepoPath } from './ids.mjs';

function required(value,label){
  const text=String(value??'').trim();
  if(!text)throw new Error(`${label} is required`);
  return text;
}

export function createNode(input={}){
  const node={
    id:required(input.id,'node id'),
    kind:required(input.kind,'node kind').toLowerCase(),
    name:required(input.name,'node name'),
    file:normalizeRepoPath(input.file)
  };
  if(input.line!==undefined&&input.line!==null){
    if(!Number.isInteger(input.line)||input.line<1)throw new Error('node line must be a positive integer');
    node.line=input.line;
  }
  return node;
}

export function createEdge(input={}){
  return {
    source:required(input.source,'edge source'),
    target:required(input.target,'edge target'),
    type:required(input.type,'edge type').toLowerCase(),
    provenance:required(input.provenance??'NATIVE','edge provenance').toUpperCase()
  };
}

function uniqueSortedNodes(nodes=[]){
  const byId=new Map();
  for(const raw of nodes){
    const node=createNode(raw);
    const previous=byId.get(node.id);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(node))throw new Error(`conflicting node id: ${node.id}`);
    byId.set(node.id,node);
  }
  return [...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

function uniqueSortedEdges(edges=[]){
  const byKey=new Map();
  for(const raw of edges){
    const edge=createEdge(raw);
    const key=[edge.source,edge.target,edge.type,edge.provenance].join('\u0000');
    byKey.set(key,edge);
  }
  return [...byKey.values()].sort((a,b)=>
    a.source.localeCompare(b.source)||
    a.target.localeCompare(b.target)||
    a.type.localeCompare(b.type)||
    a.provenance.localeCompare(b.provenance)
  );
}

export function finalizeGraph(parts={},metadata={}){
  const nodes=uniqueSortedNodes(parts.nodes||[]);
  const edges=uniqueSortedEdges(parts.edges||[]);
  const diagnostics=[...new Set((parts.diagnostics||[]).map(value=>String(value).trim()).filter(Boolean))].sort();
  const graph={
    version:1,
    generator:'jarvis-native',
    source_commit:required(metadata.sourceCommit,'sourceCommit'),
    generated_at:required(metadata.generatedAt,'generatedAt'),
    status:metadata.status||'ready',
    nodes,
    edges,
    stats:{nodes:nodes.length,edges:edges.length}
  };
  if(diagnostics.length)graph.diagnostics=diagnostics;
  const validation=validateCodeGraph(graph);
  if(!validation.valid)throw new Error(`Invalid native code graph: ${validation.errors.join('; ')}`);
  return graph;
}
