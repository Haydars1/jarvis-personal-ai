import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCodeGraph } from '../../src/lib/code-graph.js';

function validate(graph,label){
  const result=validateCodeGraph(graph);
  if(!result.valid)throw new Error(`Invalid ${label} graph: ${result.errors.join('; ')}`);
}
function ratio(count,total){return total?count/total:0;}
function edgeKey(edge){return [edge.source,edge.target,edge.type].join('\u0000');}

export function compareGraphs(nativeGraph,referenceGraph){
  validate(nativeGraph,'native');
  validate(referenceGraph,'reference');
  const nativeNodes=new Set(nativeGraph.nodes.map(node=>node.id));
  const referenceNodes=new Set(referenceGraph.nodes.map(node=>node.id));
  const nativeEdges=new Set(nativeGraph.edges.map(edgeKey));
  const referenceEdges=new Set(referenceGraph.edges.map(edgeKey));
  const nodeCount=[...nativeNodes].filter(id=>referenceNodes.has(id)).length;
  const edgeCount=[...nativeEdges].filter(id=>referenceEdges.has(id)).length;
  return {
    native:{nodes:nativeGraph.nodes.length,edges:nativeGraph.edges.length},
    reference:{nodes:referenceGraph.nodes.length,edges:referenceGraph.edges.length},
    node_overlap:{count:nodeCount,native_ratio:ratio(nodeCount,nativeNodes.size),reference_ratio:ratio(nodeCount,referenceNodes.size)},
    edge_overlap:{count:edgeCount,native_ratio:ratio(edgeCount,nativeEdges.size),reference_ratio:ratio(edgeCount,referenceEdges.size)},
    same_source_commit:nativeGraph.source_commit===referenceGraph.source_commit
  };
}

function isCli(){return process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);}
if(isCli()){
  const nativePath=resolve(process.argv[2]||'graphify-out/code-graph.json');
  const referencePath=resolve(process.argv[3]||'graphify-out/graphify-code-graph.json');
  const nativeGraph=JSON.parse(readFileSync(nativePath,'utf8'));
  const referenceGraph=JSON.parse(readFileSync(referencePath,'utf8'));
  console.log(JSON.stringify(compareGraphs(nativeGraph,referenceGraph),null,2));
}
