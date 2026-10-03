import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankImpactedFiles, validateCodeGraph } from '../../src/lib/code-graph.js';

const CONTAINER_KINDS=new Set(['module','config','module-reference']);

function validate(graph,label){
  const result=validateCodeGraph(graph);
  if(!result.valid)throw new Error(`Invalid ${label} graph: ${result.errors.join('; ')}`);
}
function ratio(count,total){return total?count/total:0;}
function semanticNodeKey(node){return [node.kind||'',node.file||'',node.name||''].join('\u0000');}
function nodeKeyMap(graph){return new Map(graph.nodes.map(node=>[node.id,semanticNodeKey(node)]));}
function semanticEdgeKey(edge,nodeKeys){
  const source=nodeKeys.get(edge.source);
  const target=nodeKeys.get(edge.target);
  if(!source||!target)return null;
  return [source,target,edge.type||''].join('\u0000');
}
function setOverlap(nativeSet,referenceSet){
  const count=[...nativeSet].filter(value=>referenceSet.has(value)).length;
  return {count,native_ratio:ratio(count,nativeSet.size),reference_ratio:ratio(count,referenceSet.size)};
}
function semanticEdges(graph,type=null){
  const keys=nodeKeyMap(graph),result=new Set();
  for(const edge of graph.edges){
    if(type&&edge.type!==type)continue;
    const key=semanticEdgeKey(edge,keys);
    if(key)result.add(key);
  }
  return result;
}
function semanticSymbols(graph){
  return new Set(graph.nodes.filter(node=>!CONTAINER_KINDS.has(node.kind)).map(semanticNodeKey));
}
function impactedFiles(graph,changedFiles){
  if(!changedFiles.length)return new Set();
  return new Set(rankImpactedFiles(graph,changedFiles).map(item=>item.file));
}

export function compareGraphs(nativeGraph,referenceGraph,{changedFiles=[]}={}){
  validate(nativeGraph,'native');
  validate(referenceGraph,'reference');
  const nativeNodes=new Set(nativeGraph.nodes.map(semanticNodeKey));
  const referenceNodes=new Set(referenceGraph.nodes.map(semanticNodeKey));
  const nativeEdges=semanticEdges(nativeGraph);
  const referenceEdges=semanticEdges(referenceGraph);
  const nativeImports=semanticEdges(nativeGraph,'imports');
  const referenceImports=semanticEdges(referenceGraph,'imports');
  const nativeSymbols=semanticSymbols(nativeGraph);
  const referenceSymbols=semanticSymbols(referenceGraph);
  const normalizedChanged=[...new Set(changedFiles.map(value=>String(value||'').trim()).filter(Boolean))].sort();
  const nativeImpact=impactedFiles(nativeGraph,normalizedChanged);
  const referenceImpact=impactedFiles(referenceGraph,normalizedChanged);
  const impact=setOverlap(nativeImpact,referenceImpact);
  return {
    native:{nodes:nativeGraph.nodes.length,edges:nativeGraph.edges.length},
    reference:{nodes:referenceGraph.nodes.length,edges:referenceGraph.edges.length},
    node_overlap:setOverlap(nativeNodes,referenceNodes),
    edge_overlap:setOverlap(nativeEdges,referenceEdges),
    import_overlap:setOverlap(nativeImports,referenceImports),
    symbol_overlap:setOverlap(nativeSymbols,referenceSymbols),
    impact_overlap:{changed_files:normalizedChanged,...impact,native_files:nativeImpact.size,reference_files:referenceImpact.size},
    same_source_commit:nativeGraph.source_commit===referenceGraph.source_commit
  };
}

function isCli(){return process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);}
if(isCli()){
  const nativePath=resolve(process.argv[2]||'graphify-out/code-graph.json');
  const referencePath=resolve(process.argv[3]||'graphify-out/graphify-code-graph.json');
  const changedFiles=process.argv.slice(4);
  const nativeGraph=JSON.parse(readFileSync(nativePath,'utf8'));
  const referenceGraph=JSON.parse(readFileSync(referencePath,'utf8'));
  console.log(JSON.stringify(compareGraphs(nativeGraph,referenceGraph,{changedFiles}),null,2));
}
