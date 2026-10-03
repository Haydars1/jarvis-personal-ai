import path from 'node:path';
import { fileNodeId, normalizeRepoPath, symbolNodeId } from './ids.mjs';
import { createNode, createEdge } from './model.mjs';

function moduleNode(file){
  const normalized=normalizeRepoPath(file);
  return createNode({id:fileNodeId(normalized),kind:'config',name:path.posix.basename(normalized),file:normalized});
}
function addEdge(map,input){
  const edge=createEdge(input);
  map.set([edge.source,edge.target,edge.type,edge.provenance].join('\u0000'),edge);
}
function localFile(value,available){
  const candidate=String(value??'').trim().replace(/^\.\//,'').replace(/[),;]+$/,'');
  if(!candidate||candidate.startsWith('/')||candidate.startsWith('..'))return null;
  try{
    const normalized=normalizeRepoPath(candidate);
    return available.has(normalized)?normalized:null;
  }catch{return null;}
}
function stripJsonComments(source){
  let out='',quote='',escaped=false,line=false,block=false;
  const text=String(source??'');
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(line){if(ch==='\n'){line=false;out+=ch;}else out+=' ';continue;}
    if(block){if(ch==='*'&&next==='/'){out+='  ';block=false;i++;}else out+=ch==='\n'?'\n':' ';continue;}
    if(quote){out+=ch;if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"){quote=ch;out+=ch;continue;}
    if(ch==='/'&&next==='/'){out+='  ';line=true;i++;continue;}
    if(ch==='/'&&next==='*'){out+='  ';block=true;i++;continue;}
    out+=ch;
  }
  return out;
}
function commandTargets(command,available){
  const found=[];
  const text=String(command??'');
  const tokenRe=/(?:^|[\s;&|])(?:node\s+)?((?:\.?\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:js|mjs|cjs|ts|tsx|sh|py))(?=\s|$|[;&|])/g;
  for(const match of text.matchAll(tokenRe)){
    const target=localFile(match[1],available);
    if(target)found.push(target);
  }
  return [...new Set(found)].sort();
}

export function analyzeConfigFile({file,source,availableFiles=[]}={}){
  const normalized=normalizeRepoPath(file);
  const module=moduleNode(normalized);
  const nodes=new Map([[module.id,module]]),edges=new Map(),diagnostics=new Set();
  const available=new Set(availableFiles.map(item=>normalizeRepoPath(item)));
  const text=String(source??'');
  const base=path.posix.basename(normalized).toLowerCase();

  if(base==='package.json'){
    let parsed;
    try{parsed=JSON.parse(text);}catch(error){
      diagnostics.add(`parse error: ${normalized}: ${String(error.message||error).split('\n')[0]}`);
      return {nodes:[...nodes.values()],edges:[],diagnostics:[...diagnostics].sort()};
    }
    const scripts=parsed?.scripts&&typeof parsed.scripts==='object'?parsed.scripts:{};
    for(const name of Object.keys(scripts).sort()){
      const id=symbolNodeId('config',normalized,'script',name);
      const node=createNode({id,kind:'script',name,file:normalized});
      nodes.set(id,node);
      addEdge(edges,{source:module.id,target:id,type:'defines',provenance:'CONFIG'});
      for(const target of commandTargets(scripts[name],available)){
        addEdge(edges,{source:id,target:fileNodeId(target),type:'runs',provenance:'CONFIG'});
      }
    }
  }else if(normalized.startsWith('.github/workflows/')&&/\.ya?ml$/i.test(normalized)){
    const runRe=/^\s*-?\s*run:\s*(.+?)\s*$/gm;
    for(const match of text.matchAll(runRe)){
      for(const target of commandTargets(match[1],available)){
        addEdge(edges,{source:module.id,target:fileNodeId(target),type:'runs',provenance:'CONFIG'});
      }
    }
  }else if(base==='wrangler.jsonc'){
    try{
      const parsed=JSON.parse(stripJsonComments(text));
      const requested=String(parsed?.main||'').trim();
      if(requested){
        const target=localFile(requested,available);
        if(target)addEdge(edges,{source:module.id,target:fileNodeId(target),type:'entrypoint',provenance:'CONFIG'});
        else diagnostics.add(`missing local target skipped: ${requested}`);
      }
    }catch(error){diagnostics.add(`parse error: ${normalized}: ${String(error.message||error).split('\n')[0]}`);}
  }else if(base==='wrangler.toml'){
    const match=text.match(/^\s*main\s*=\s*["']([^"']+)["']/m);
    if(match){
      const target=localFile(match[1],available);
      if(target)addEdge(edges,{source:module.id,target:fileNodeId(target),type:'entrypoint',provenance:'CONFIG'});
      else diagnostics.add(`missing local target skipped: ${match[1]}`);
    }
  }

  return {
    nodes:[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    edges:[...edges.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target)||a.type.localeCompare(b.type)),
    diagnostics:[...diagnostics].sort()
  };
}
