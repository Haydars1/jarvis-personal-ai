import {execFileSync} from 'node:child_process';import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';import {resolve} from 'node:path';import {normalizeGraphify} from './normalize.mjs';
const root=resolve(process.cwd()),out=resolve(root,'graphify-out');mkdirSync(out,{recursive:true});
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let command=process.env.GRAPHIFY_COMMAND||'graphify';
try{execFileSync(command,[root],{stdio:'inherit',env:{...process.env,GRAPHIFY_OUTPUT_DIR:out}});}catch(e){console.error('Graphify code-graph generation is unavailable. Normal JARVIS runtime remains usable; only graph generation failed. Install the open-source Graphify CLI or set GRAPHIFY_COMMAND.');process.exit(2);}
const candidates=['graph.json','graphify.json'].map(x=>resolve(out,x));const rawPath=candidates.find(existsSync);
if(!rawPath){console.error('Graphify completed but no supported graph JSON was found in graphify-out/.');process.exit(3);}
const graph=normalizeGraphify(JSON.parse(readFileSync(rawPath,'utf8')),{sourceCommit:commit});writeFileSync(resolve(out,'code-graph.json'),JSON.stringify(graph,null,2)+'\n');console.log('Wrote graphify-out/code-graph.json');
