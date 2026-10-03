import path from 'node:path';
import { fileNodeId, normalizeRepoPath, symbolNodeId } from './ids.mjs';
import { createNode, createEdge } from './model.mjs';

function lineAt(source,index){return source.slice(0,index).split('\n').length;}
function moduleNode(file){
  const normalized=normalizeRepoPath(file);
  return createNode({id:fileNodeId(normalized),kind:'module',name:path.posix.basename(normalized),file:normalized});
}
function matchingBrace(source,open){
  if(open<0)return -1;
  let depth=0,quote='',escaped=false,lineComment=false,blockComment=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return i;}
  }
  return -1;
}
function pushUnique(map,value){const key=[value.source,value.target,value.type,value.provenance].join('\u0000');map.set(key,createEdge(value));}

export function analyzeSwiftFile({file,source}={}){
  const normalized=normalizeRepoPath(file);
  const text=String(source??'');
  const module=moduleNode(normalized);
  const nodes=new Map([[module.id,module]]),edges=new Map(),diagnostics=new Set();
  const types=[];
  const typeByName=new Map();
  const symbolsByName=new Map();

  function addSymbol(kind,name,index,scope=''){
    const id=symbolNodeId('swift',normalized,kind,name,scope);
    const node=createNode({id,kind,name,file:normalized,line:lineAt(text,index)});
    nodes.set(id,node);
    if(!symbolsByName.has(name))symbolsByName.set(name,[]);
    symbolsByName.get(name).push(node);
    pushUnique(edges,{source:module.id,target:id,type:'defines',provenance:'SWIFT'});
    return node;
  }

  for(const match of text.matchAll(/^\s*import\s+([A-Za-z_][\w.]*)/gm)){
    const name=match[1];
    const id=symbolNodeId('swift',normalized,'import',name);
    nodes.set(id,createNode({id,kind:'module-reference',name,file:normalized,line:lineAt(text,match.index)}));
    pushUnique(edges,{source:module.id,target:id,type:'imports',provenance:'SWIFT'});
  }

  const typeRe=/\b(class|struct|enum|protocol|actor)\s+([A-Za-z_]\w*)(?:\s*:\s*([^\{\n]+))?\s*\{/g;
  for(const match of text.matchAll(typeRe)){
    const kind=match[1],name=match[2],parents=String(match[3]||'').split(',').map(v=>v.trim().replace(/\s+where\b.*$/,'')).filter(Boolean);
    const open=match.index+match[0].lastIndexOf('{');
    const close=matchingBrace(text,open);
    const node=addSymbol(kind,name,match.index);
    const info={kind,name,node,parents,open,close:close<0?text.length:close};
    types.push(info);typeByName.set(name,info);
    if(close<0)diagnostics.add(`brace mismatch: ${normalized}:${lineAt(text,open)}`);
  }

  for(const info of types){
    for(const parentRaw of info.parents){
      const parent=parentRaw.replace(/<.*>/g,'').trim().split(/\s+/)[0];
      const target=typeByName.get(parent);
      if(!target){diagnostics.add(`external inheritance/conformance skipped: ${info.name} -> ${parent}`);continue;}
      const type=target.kind==='protocol'?'conforms':'inherits';
      pushUnique(edges,{source:info.node.id,target:target.node.id,type,provenance:'SWIFT'});
    }
  }

  const functions=[];
  const funcRe=/\bfunc\s+([A-Za-z_]\w*)\s*\([^)]*\)[^{\n]*\{/g;
  for(const match of text.matchAll(funcRe)){
    const name=match[1],open=match.index+match[0].lastIndexOf('{'),close=matchingBrace(text,open);
    const owner=types.filter(type=>match.index>type.open&&match.index<type.close).sort((a,b)=>(a.close-a.open)-(b.close-b.open))[0]||null;
    const kind=owner?'method':'function';
    const node=addSymbol(kind,name,match.index,owner?.name||'');
    functions.push({name,node,owner,open,close:close<0?text.length:close});
    if(close<0)diagnostics.add(`brace mismatch: ${normalized}:${lineAt(text,open)}`);
  }

  const callSkip=new Set(['if','for','while','switch','return','guard','catch','func','init','super','self']);
  for(const fn of functions){
    const body=text.slice(fn.open+1,fn.close);
    for(const match of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)){
      const name=match[1];
      if(callSkip.has(name)||name===fn.name)continue;
      const candidates=symbolsByName.get(name)||[];
      const target=candidates.find(node=>node.kind==='function')||candidates.find(node=>node.kind==='method'&&fn.owner&&node.id.includes(encodeURIComponent(fn.owner.name)))||null;
      if(target&&target.id!==fn.node.id)pushUnique(edges,{source:fn.node.id,target:target.id,type:'calls',provenance:'SWIFT'});
    }
  }

  const opens=(text.match(/\{/g)||[]).length,closes=(text.match(/\}/g)||[]).length;
  if(opens!==closes)diagnostics.add(`brace mismatch: ${normalized}`);

  return {
    nodes:[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    edges:[...edges.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target)||a.type.localeCompare(b.type)),
    diagnostics:[...diagnostics].sort()
  };
}
