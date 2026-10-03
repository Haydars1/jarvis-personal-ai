import path from 'node:path';
import { parse } from '@babel/parser';
import { fileNodeId, normalizeRepoPath, symbolNodeId } from './ids.mjs';
import { createNode, createEdge } from './model.mjs';

function moduleNode(file){
  const normalized=normalizeRepoPath(file);
  return createNode({id:fileNodeId(normalized),kind:'module',name:path.posix.basename(normalized),file:normalized});
}

function pluginsFor(file){
  const lower=String(file).toLowerCase();
  const plugins=[];
  if(/\.(ts|tsx)$/.test(lower))plugins.push('typescript');
  if(/\.(jsx|tsx)$/.test(lower))plugins.push('jsx');
  return plugins;
}

function childNodes(node){
  const out=[];
  for(const [key,value] of Object.entries(node||{})){
    if(['loc','start','end','extra','tokens','comments','errors'].includes(key))continue;
    if(Array.isArray(value)){
      for(const child of value)if(child&&typeof child==='object'&&typeof child.type==='string')out.push(child);
    }else if(value&&typeof value==='object'&&typeof value.type==='string')out.push(value);
  }
  return out;
}

function staticName(node){
  if(!node)return '';
  if(node.type==='Identifier'||node.type==='PrivateName')return node.name||node.id?.name||'';
  if(node.type==='StringLiteral'||node.type==='NumericLiteral')return String(node.value);
  return '';
}

function declarationNames(node){
  if(!node)return [];
  if(['FunctionDeclaration','ClassDeclaration','TSInterfaceDeclaration','TSTypeAliasDeclaration','TSEnumDeclaration'].includes(node.type))return node.id?.name?[node.id.name]:[];
  if(node.type==='VariableDeclaration')return node.declarations.flatMap(item=>item.id?.type==='Identifier'?[item.id.name]:[]);
  return [];
}

export function analyzeJavaScriptFile({file,source,resolveLocalModule}={}){
  const normalizedFile=normalizeRepoPath(file);
  const module=moduleNode(normalizedFile);
  const nodes=new Map([[module.id,module]]);
  const edges=new Map();
  const diagnostics=new Set();
  const symbolsByName=new Map();
  const nodeToSymbol=new WeakMap();
  const scopesByNode=new WeakMap();

  function addNode(node){nodes.set(node.id,node);return node;}
  function addEdge(edge){
    const normalized=createEdge(edge);
    edges.set([normalized.source,normalized.target,normalized.type,normalized.provenance].join('\u0000'),normalized);
    return normalized;
  }
  function remember(name,id,scope){
    if(!name)return;
    if(!symbolsByName.has(name))symbolsByName.set(name,[]);
    symbolsByName.get(name).push({id,scope:[...scope]});
  }
  function makeSymbol(kind,name,astNode,scope=[]){
    const scopeText=scope.join('/');
    const id=symbolNodeId('js',normalizedFile,kind,name,scopeText);
    const symbol=addNode(createNode({id,kind,name,file:normalizedFile,line:astNode?.loc?.start?.line||undefined}));
    nodeToSymbol.set(astNode,symbol.id);
    remember(name,symbol.id,scope);
    addEdge({source:module.id,target:symbol.id,type:'defines',provenance:'AST'});
    return symbol.id;
  }

  let ast;
  try{
    ast=parse(String(source??''),{
      sourceType:'unambiguous',
      plugins:pluginsFor(normalizedFile),
      errorRecovery:false,
      allowAwaitOutsideFunction:true,
      allowReturnOutsideFunction:true
    });
  }catch(error){
    diagnostics.add(`parse error: ${normalizedFile}: ${String(error.message||error).split('\n')[0]}`);
    return {nodes:[...nodes.values()],edges:[],diagnostics:[...diagnostics].sort()};
  }

  function collect(node,context={scope:[],className:null}){
    if(!node||typeof node!=='object')return;
    let next=context;
    switch(node.type){
      case 'FunctionDeclaration': {
        const name=node.id?.name;
        if(name){
          const id=makeSymbol('function',name,node,context.scope);
          next={scope:[...context.scope,name],className:null,ownerId:id};
        }
        break;
      }
      case 'ClassDeclaration': {
        const name=node.id?.name;
        if(name){
          const id=makeSymbol('class',name,node,context.scope);
          next={scope:[...context.scope,name],className:name,ownerId:id};
        }
        break;
      }
      case 'ClassMethod':
      case 'ClassPrivateMethod': {
        const name=staticName(node.key);
        if(name){
          const id=makeSymbol('method',name,node,context.scope);
          next={scope:[...context.scope,name],className:context.className,ownerId:id};
        }
        break;
      }
      case 'VariableDeclarator': {
        const name=node.id?.type==='Identifier'?node.id.name:'';
        const functional=['ArrowFunctionExpression','FunctionExpression'].includes(node.init?.type);
        if(name){
          const id=makeSymbol(functional?'function':'variable',name,node,context.scope);
          if(functional)next={scope:[...context.scope,name],className:context.className,ownerId:id};
        }
        break;
      }
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
      case 'TSEnumDeclaration': {
        const name=node.id?.name;
        if(name)makeSymbol(node.type==='TSInterfaceDeclaration'?'interface':node.type==='TSEnumDeclaration'?'enum':'type',name,node,context.scope);
        break;
      }
      default: break;
    }
    scopesByNode.set(node,next);
    for(const child of childNodes(node))collect(child,next);
  }
  collect(ast.program,{scope:[],className:null,ownerId:module.id});

  function localTarget(specifier){
    let resolved=null;
    try{resolved=typeof resolveLocalModule==='function'?resolveLocalModule(specifier,normalizedFile):null;}
    catch(error){diagnostics.add(`import resolver error: ${specifier}: ${error.message||error}`);return null;}
    if(!resolved){
      diagnostics.add(`${String(specifier).startsWith('.')?'unresolved local':'external'} import skipped: ${specifier}`);
      return null;
    }
    const target=moduleNode(resolved);
    addNode(target);
    return target;
  }

  for(const statement of ast.program.body){
    const sourceNode=statement.type==='ImportDeclaration'?statement.source:
      ['ExportNamedDeclaration','ExportAllDeclaration'].includes(statement.type)?statement.source:null;
    if(sourceNode?.value){
      const target=localTarget(String(sourceNode.value));
      if(target)addEdge({source:module.id,target:target.id,type:'imports',provenance:'IMPORT'});
    }
    if(statement.type==='ExportNamedDeclaration'||statement.type==='ExportDefaultDeclaration'){
      const declaration=statement.declaration;
      for(const name of declarationNames(declaration)){
        const candidates=symbolsByName.get(name)||[];
        const target=candidates.find(item=>item.scope.length===0)||candidates[0];
        if(target)addEdge({source:module.id,target:target.id,type:'exports',provenance:'AST'});
      }
      for(const specifier of statement.specifiers||[]){
        const name=specifier.local?.name;
        const candidates=symbolsByName.get(name)||[];
        const target=candidates.find(item=>item.scope.length===0)||candidates[0];
        if(target)addEdge({source:module.id,target:target.id,type:'exports',provenance:'AST'});
      }
    }
  }

  function resolveSymbol(name,scope=[]){
    const candidates=symbolsByName.get(name)||[];
    if(!candidates.length)return null;
    const ranked=[...candidates].sort((a,b)=>{
      const commonA=a.scope.reduce((n,value,index)=>n+(scope[index]===value?1:0),0);
      const commonB=b.scope.reduce((n,value,index)=>n+(scope[index]===value?1:0),0);
      return commonB-commonA||a.scope.length-b.scope.length||a.id.localeCompare(b.id);
    });
    return ranked[0]?.id||null;
  }

  function scan(node,context={scope:[],className:null,ownerId:module.id}){
    if(!node||typeof node!=='object')return;
    const collected=scopesByNode.get(node);
    let next=context;
    if(collected){
      next={...context,...collected,ownerId:nodeToSymbol.get(node)||collected.ownerId||context.ownerId};
    }
    if(node.type==='ImportExpression'||(node.type==='CallExpression'&&node.callee?.type==='Import')){
      diagnostics.add(`dynamic import skipped: ${normalizedFile}:${node.loc?.start?.line||'?'}`);
    }else if(node.type==='CallExpression'){
      let targetId=null;
      if(node.callee?.type==='Identifier')targetId=resolveSymbol(node.callee.name,next.scope);
      else if(node.callee?.type==='MemberExpression'&&node.callee.object?.type==='ThisExpression'){
        targetId=resolveSymbol(staticName(node.callee.property),next.scope.slice(0,1));
      }
      if(targetId&&targetId!==next.ownerId)addEdge({source:next.ownerId||module.id,target:targetId,type:'calls',provenance:'AST'});
    }
    for(const child of childNodes(node))scan(child,next);
  }
  scan(ast.program,{scope:[],className:null,ownerId:module.id});

  return {
    nodes:[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    edges:[...edges.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target)||a.type.localeCompare(b.type)),
    diagnostics:[...diagnostics].sort()
  };
}
