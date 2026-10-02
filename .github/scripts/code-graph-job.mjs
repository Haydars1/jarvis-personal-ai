import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeGraphify } from '../../scripts/code-graph/normalize.mjs';
import { findGraphNodes, getGraphNeighbors, findGraphPath, rankImpactedFiles, getCodeGraphStatus } from '../../src/lib/code-graph.js';

const GRAPHIFY_VERSION='0.9.74';

function run(command,args,{cwd}={}){
  const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}});
  if(result.error||result.status!==0)throw new Error(`${command} ${args.join(' ')} failed: ${String(result.stderr||result.stdout||result.error?.message||'unknown').slice(-1200)}`);
  return result.stdout.trim();
}
function ensureGraphify(){
  const probe=spawnSync('graphify',['--version'],{encoding:'utf8'});
  if(!probe.error&&probe.status===0)return;
  run('python3',['-m','pip','install',`graphifyy[sql]==${GRAPHIFY_VERSION}`]);
  run('graphify',['--version']);
}
function resolveNode(graph,query){
  const direct=graph.nodes.find(node=>node.id===query);if(direct)return direct;
  return findGraphNodes(graph,String(query||''),{limit:1})[0]||null;
}
function compactNode(node){return node?{id:node.id,kind:node.kind,name:node.name,file:node.file,line:node.line||null}:null;}

export async function buildRuntimeCodeGraph(ctx){
  ensureGraphify();
  const out=await mkdtemp(path.join(tmpdir(),'jarvis-code-graph-'));
  run('graphify',['extract',ctx.dest,'--out',out,'--code-only','--no-cluster'],{cwd:ctx.dest});
  const rawPath=path.join(out,'graphify-out','graph.json');
  if(!existsSync(rawPath))throw new Error('GRAPHIFY_OUTPUT_MISSING');
  const raw=JSON.parse(readFileSync(rawPath,'utf8'));
  return normalizeGraphify(raw,{sourceCommit:ctx.commit,generatedAt:new Date().toISOString()});
}

export async function executeCodeGraphJob(job,ctx){
  const graph=await buildRuntimeCodeGraph(ctx),input=job.input||{},operation=String(input.operation||'status');
  const common={repo:job.repo,commit:ctx.commit,engine:'graphify',graph_status:getCodeGraphStatus(graph,ctx.commit),stats:graph.stats,operation};
  if(operation==='status')return common;
  if(operation==='find')return {...common,query:String(input.query||''),nodes:findGraphNodes(graph,String(input.query||''),{limit:20}).map(compactNode)};
  if(operation==='impact')return {...common,files:Array.isArray(input.files)?input.files.map(String).slice(0,12):[],impacted:rankImpactedFiles(graph,Array.isArray(input.files)?input.files:[],{limit:30})};
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
