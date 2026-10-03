import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { normalizeRepoPath } from './ids.mjs';

const EXCLUDED_DIRS=new Set(['.git','node_modules','graphify-out','dist','build','cache','.cache','coverage','.next','.wrangler','vendor']);
const EXCLUDED_FILES=new Set(['package-lock.json','yarn.lock','pnpm-lock.yaml','npm-shrinkwrap.json']);
const SOURCE_EXTS=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.swift','.sql']);
const WORKFLOW_EXTS=new Set(['.yml','.yaml']);

function supportedFile(rel){
  const name=path.posix.basename(rel);
  if(EXCLUDED_FILES.has(name))return false;
  if(/^\.env(?:\.|$)/i.test(name))return false;
  if(name==='package.json'||name==='wrangler.jsonc'||name==='wrangler.toml')return true;
  const ext=path.posix.extname(name).toLowerCase();
  if(SOURCE_EXTS.has(ext))return true;
  return rel.startsWith('.github/workflows/')&&WORKFLOW_EXTS.has(ext);
}

export async function discoverRepositoryFiles(root,options={}){
  const base=path.resolve(String(root||'.'));
  const maxFiles=Number.isInteger(options.maxFiles)&&options.maxFiles>0?options.maxFiles:5000;
  const maxFileSize=Number.isInteger(options.maxFileSize)&&options.maxFileSize>0?options.maxFileSize:1024*1024;
  const files=[];
  const diagnostics=[];
  let limited=false;

  async function walk(abs,relDir=''){
    let entries;
    try{entries=await readdir(abs,{withFileTypes:true});}
    catch(error){diagnostics.push(`read error: ${normalizeRepoPath(relDir||'.')} (${error.code||'unknown'})`);return;}
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      const rel=relDir?`${relDir}/${entry.name}`:entry.name;
      if(entry.isSymbolicLink()){
        diagnostics.push(`symlink skipped: ${rel}`);
        continue;
      }
      if(entry.isDirectory()){
        if(EXCLUDED_DIRS.has(entry.name))continue;
        await walk(path.join(abs,entry.name),rel);
        continue;
      }
      if(!entry.isFile()||!supportedFile(rel))continue;
      if(files.length>=maxFiles){limited=true;continue;}
      let info;
      try{info=await lstat(path.join(abs,entry.name));}
      catch(error){diagnostics.push(`stat error: ${rel} (${error.code||'unknown'})`);continue;}
      if(info.size>maxFileSize){diagnostics.push(`size limit skipped: ${rel}`);continue;}
      files.push(normalizeRepoPath(rel));
    }
  }

  await walk(base);
  files.sort();
  if(limited)diagnostics.push(`file limit reached: ${maxFiles}`);
  diagnostics.sort();
  return {files,diagnostics};
}
