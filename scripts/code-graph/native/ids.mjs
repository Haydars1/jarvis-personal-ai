import path from 'node:path';

function required(value,label){
  const text=String(value??'').trim();
  if(!text)throw new Error(`${label} is required`);
  return text;
}

export function normalizeRepoPath(value){
  let text=required(value,'repository path').replaceAll('\\','/');
  if(text.startsWith('/')||/^[A-Za-z]:\//.test(text))throw new Error('repository-relative path required');
  text=text.replace(/^\.\//,'');
  const normalized=path.posix.normalize(text).replace(/^\.\//,'');
  if(!normalized||normalized==='.'||normalized==='..'||normalized.startsWith('../'))throw new Error('repository-relative path required');
  return normalized;
}

export function fileNodeId(file){
  return `file:${normalizeRepoPath(file)}`;
}

function token(value,label){
  return encodeURIComponent(required(value,label));
}

export function symbolNodeId(language,file,kind,name,scope=''){
  const lang=token(language,'language').toLowerCase();
  const normalizedFile=normalizeRepoPath(file);
  const symbolKind=token(kind,'symbol kind').toLowerCase();
  const symbolName=token(name,'symbol name');
  const scopeText=String(scope??'').trim();
  const scoped=scopeText?`${encodeURIComponent(scopeText)}/${symbolName}`:symbolName;
  return `${lang}:${normalizedFile}#${symbolKind}:${scoped}`;
}
