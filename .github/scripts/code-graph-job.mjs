import { buildNativeCodeGraph } from '../../scripts/code-graph/native/builder.mjs';
import { findGraphNodes, getGraphNeighbors, findGraphPath, rankImpactedFiles, getCodeGraphStatus } from '../../src/lib/code-graph.js';

function resolveNode(graph,query){
  const direct=graph.nodes.find(node=>node.id===query);if(direct)return direct;
  return findGraphNodes(graph,String(query||''),{limit:1})[0]||null;
}
function compactNode(node){return node?{id:node.id,kind:node.kind,name:node.name,file:node.file,line:node.line||null}:null;}

export async function buildRuntimeCodeGraph(ctx){
  return buildNativeCodeGraph({
    root:ctx.dest,
    sourceCommit:ctx.commit,
    generatedAt:new Date().toISOString()
  });
}

export function executeCodeGraphQuery(graph,input={},metadata={}){
  const operation=String(input.operation||'status');
  const commit=String(metadata.commit||graph.source_commit||'');
  const common={repo:String(metadata.repo||''),commit,engine:'jarvis-native',graph_status:getCodeGraphStatus(graph,commit),stats:graph.stats,operation};
  if(operation==='status')return common;
  if(operation==='find')return {...common,query:String(input.query||''),nodes:findGraphNodes(graph,String(input.query||''),{limit:20}).map(compactNode)};
  if(operation==='impact'){
    const files=Array.isArray(input.files)?input.files.map(String).slice(0,12):[];
    return {...common,files,impacted:rankImpactedFiles(graph,files,{limit:30})};
  }
  if(operation==='neighbors'){
    const node=resolveNode(graph,String(input.node_id||input.query||''));
    if(!node)return {...common,query:String(input.query||''),node:null,neighbors:[]};
    const direction=['incoming','outgoing','both'].includes(String(input.direction||''))?String(input.direction):'both';
    return {...common,query:String(input.query||''),node:compactNode(node),direction,neighbors:getGraphNeighbors(graph,node.id,{direction}).slice(0,40).map(compactNode)};
  }
  if(operation==='path'){
    const from=resolveNode(graph,String(input.from||'')),to=resolveNode(graph,String(input.to||''));
    const ids=from&&to?findGraphPath(graph,from.id,to.id):null;
    return {...common,from:compactNode(from),to:compactNode(to),path:ids?ids.map(id=>compactNode(graph.nodes.find(node=>node.id===id))):null};
  }
  throw new Error('CODE_GRAPH_OPERATION_NOT_SUPPORTED');
}

export async function executeCodeGraphJob(job,ctx){
  const graph=await buildRuntimeCodeGraph(ctx);
  return executeCodeGraphQuery(graph,job.input||{},{repo:job.repo,commit:ctx.commit});
}
