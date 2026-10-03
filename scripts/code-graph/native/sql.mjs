import path from 'node:path';
import { fileNodeId, normalizeRepoPath, symbolNodeId } from './ids.mjs';
import { createNode, createEdge } from './model.mjs';

function moduleNode(file){
  const normalized=normalizeRepoPath(file);
  return createNode({id:fileNodeId(normalized),kind:'module',name:path.posix.basename(normalized),file:normalized});
}
function lineAt(source,index){return source.slice(0,index).split('\n').length;}
function cleanIdentifier(value=''){
  const text=String(value).trim();
  if((text.startsWith('"')&&text.endsWith('"'))||(text.startsWith('`')&&text.endsWith('`'))||(text.startsWith('[')&&text.endsWith(']')))return text.slice(1,-1);
  return text;
}
function stripComments(source){
  return String(source??'').replace(/\/\*[\s\S]*?\*\//g,match=>match.replace(/[^\n]/g,' ')).replace(/--[^\n]*/g,match=>' '.repeat(match.length));
}
function matchingParen(source,open){
  let depth=0,quote='';
  for(let i=open;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(ch===quote){
        if(source[i+1]===quote){i++;continue;}
        quote='';
      }
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='(')depth++;
    else if(ch===')'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}
function addEdge(map,input){
  const edge=createEdge(input);
  map.set([edge.source,edge.target,edge.type,edge.provenance].join('\u0000'),edge);
}
function identifierPattern(){return '(?:"[^"]+"|`[^`]+`|\\[[^\\]]+\\]|[A-Za-z_][A-Za-z0-9_$.]*)';}

export function analyzeSqlFile({file,source}={}){
  const normalized=normalizeRepoPath(file);
  const original=String(source??'');
  const text=stripComments(original);
  const module=moduleNode(normalized);
  const nodes=new Map([[module.id,module]]),edges=new Map(),diagnostics=new Set();
  const tables=new Map();
  const tableBodies=[];
  const idPat=identifierPattern();
  const tableRe=new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${idPat})\\s*\\(`,'gi');

  for(const match of text.matchAll(tableRe)){
    const name=cleanIdentifier(match[1]);
    const open=match.index+match[0].lastIndexOf('(');
    const close=matchingParen(text,open);
    if(close<0){diagnostics.add(`malformed CREATE TABLE statement: ${normalized}:${lineAt(original,match.index)}`);continue;}
    const id=symbolNodeId('sql',normalized,'table',name);
    const node=createNode({id,kind:'table',name,file:normalized,line:lineAt(original,match.index)});
    nodes.set(id,node);
    tables.set(name.toLowerCase(),node);
    tableBodies.push({node,body:text.slice(open+1,close),start:open+1});
    addEdge(edges,{source:module.id,target:id,type:'defines',provenance:'SCHEMA'});
  }

  const createTableCount=(text.match(/\bCREATE\s+TABLE\b/gi)||[]).length;
  if(createTableCount>tableBodies.length)diagnostics.add(`malformed CREATE TABLE statement: ${normalized}`);

  for(const entry of tableBodies){
    const refRe=new RegExp(`\\bREFERENCES\\s+(${idPat})`,'gi');
    for(const ref of entry.body.matchAll(refRe)){
      const targetName=cleanIdentifier(ref[1]);
      const target=tables.get(targetName.toLowerCase());
      if(!target){diagnostics.add(`external table reference skipped: ${entry.node.name} -> ${targetName}`);continue;}
      addEdge(edges,{source:entry.node.id,target:target.id,type:'foreign-key',provenance:'SCHEMA'});
    }
  }

  const indexRe=new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${idPat})\\s+ON\\s+(${idPat})\\s*\\(`,'gi');
  let parsedIndexes=0;
  for(const match of text.matchAll(indexRe)){
    parsedIndexes++;
    const name=cleanIdentifier(match[1]),tableName=cleanIdentifier(match[2]);
    const id=symbolNodeId('sql',normalized,'index',name);
    const node=createNode({id,kind:'index',name,file:normalized,line:lineAt(original,match.index)});
    nodes.set(id,node);
    addEdge(edges,{source:module.id,target:id,type:'defines',provenance:'SCHEMA'});
    const target=tables.get(tableName.toLowerCase());
    if(target)addEdge(edges,{source:id,target:target.id,type:'indexes',provenance:'SCHEMA'});
    else diagnostics.add(`external table index skipped: ${name} -> ${tableName}`);
  }
  const createIndexCount=(text.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi)||[]).length;
  if(createIndexCount>parsedIndexes)diagnostics.add(`malformed CREATE INDEX statement: ${normalized}`);

  return {
    nodes:[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    edges:[...edges.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target)||a.type.localeCompare(b.type)),
    diagnostics:[...diagnostics].sort()
  };
}
