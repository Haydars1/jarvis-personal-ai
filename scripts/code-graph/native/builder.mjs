import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { discoverRepositoryFiles } from './discover.mjs';
import { analyzeJavaScriptFile } from './javascript.mjs';
import { fileNodeId, normalizeRepoPath } from './ids.mjs';
import { createNode, finalizeGraph } from './model.mjs';

const JS_EXTENSIONS=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx']);
const LOCAL_EXTENSIONS=['.js','.mjs','.cjs','.jsx','.ts','.tsx'];

function required(value,label){
  const text=String(value??'').trim();
  if(!text)throw new Error(`${label} is required`);
  return text;
}

function repositoryFileNode(file){
  const normalized=normalizeRepoPath(file);
  return createNode({
    id:fileNodeId(normalized),
    kind:'module',
    name:path.posix.basename(normalized),
    file:normalized
  });
}

export function createLocalModuleResolver(files=[]){
  const available=new Set(files.map(normalizeRepoPath));
  return (specifier,fromFile)=>{
    const value=String(specifier??'').trim().split(/[?#]/,1)[0];
    if(!value.startsWith('.'))return null;
    const from=normalizeRepoPath(fromFile);
    const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),value));
    if(base==='..'||base.startsWith('../')||base.startsWith('/'))return null;
    const candidates=[];
    if(path.posix.extname(base))candidates.push(base);
    else{
      candidates.push(base);
      for(const ext of LOCAL_EXTENSIONS)candidates.push(`${base}${ext}`);
      for(const ext of LOCAL_EXTENSIONS)candidates.push(`${base}/index${ext}`);
    }
    return candidates.map(candidate=>normalizeRepoPath(candidate)).find(candidate=>available.has(candidate))||null;
  };
}

export async function buildNativeCodeGraph({root,sourceCommit,generatedAt=new Date().toISOString(),discoveryOptions={}}={}){
  const repositoryRoot=path.resolve(required(root,'root'));
  const commit=required(sourceCommit,'sourceCommit');
  const discovery=await discoverRepositoryFiles(repositoryRoot,discoveryOptions);
  const files=discovery.files;
  if(files.length===0)throw new Error('Native code graph has no supported repository files');

  const nodes=files.map(repositoryFileNode);
  const edges=[];
  const diagnostics=[...discovery.diagnostics];
  const resolveLocalModule=createLocalModuleResolver(files);

  for(const file of files){
    const ext=path.posix.extname(file).toLowerCase();
    if(!JS_EXTENSIONS.has(ext))continue;
    let source;
    try{source=await readFile(path.join(repositoryRoot,...file.split('/')),'utf8');}
    catch(error){diagnostics.push(`read error: ${file}: ${error.code||error.message||'unknown'}`);continue;}
    const analyzed=analyzeJavaScriptFile({file,source,resolveLocalModule});
    nodes.push(...analyzed.nodes);
    edges.push(...analyzed.edges);
    diagnostics.push(...analyzed.diagnostics);
  }

  return finalizeGraph(
    {nodes,edges,diagnostics},
    {sourceCommit:commit,generatedAt:required(generatedAt,'generatedAt'),status:'ready'}
  );
}
