import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNativeCodeGraph } from './native/builder.mjs';

const root=resolve(process.cwd());
const outDir=resolve(root,'graphify-out');
const normalizedPath=resolve(outDir,'code-graph.json');

function fail(message,code=1){
  console.error(message);
  process.exit(code);
}

let sourceCommit;
try{
  sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
}catch{
  fail('Could not determine the exact source commit for native code-graph freshness validation.',2);
}

let graph;
try{
  graph=await buildNativeCodeGraph({root,sourceCommit,generatedAt:new Date().toISOString()});
}catch(error){
  fail(`Native JARVIS code-graph generation failed: ${error.message||error}`,3);
}

mkdirSync(outDir,{recursive:true});
writeFileSync(normalizedPath,`${JSON.stringify(graph,null,2)}\n`);
console.log(`Wrote ${normalizedPath} with JARVIS native engine (${graph.stats.nodes} nodes, ${graph.stats.edges} edges, source ${graph.source_commit})`);
