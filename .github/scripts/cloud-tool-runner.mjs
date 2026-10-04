import { mkdtemp, readFile, stat, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { compileRepositorySkill } from '../../src/lib/repo-skill-compiler.js';
import { YOUTUBE_TEACHING_REPO, parseYouTubeResourceUrl, fetchYouTubeTranscript, fetchYouTubeChannelIndex, fuseYouTubeLearning } from '../../src/lib/youtube-teaching-runtime.js';
import { executeCodeGraphJob } from './code-graph-job.mjs';

export const ALLOWED_ADAPTERS=Object.freeze({
  'repo-inspect':true,
  'source-search':true,
  'source-read':true,
  'skill-analyze':true,
  'youtube-teaching':true,
  'code-graph-query':true
});

const BASE=String(process.env.JARVIS_URL||'https://jarvis-personal-ai.haydojarvis.workers.dev').replace(/\/$/,'');
const MAX_JOBS=Math.max(1,Math.min(8,Number(process.env.JARVIS_CLOUD_MAX_JOBS||6)));
const MAX_BATCHES=Math.max(1,Math.min(12,Number(process.env.JARVIS_CLOUD_MAX_BATCHES||1)));
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.rs','.go','.java','.kt','.kts','.c','.cc','.cpp','.h','.hpp','.cs','.php','.rb','.swift','.sh','.ps1','.json','.yml','.yaml','.toml','.xml','.md','.txt','.ini','.cfg','.sql']);
const MAX_AUDIO_CHUNKS=24;
const MAX_VISUAL_FRAMES=48;
const AUDIO_CHUNK_SECONDS=300;

function run(command,args,{cwd,quiet=true}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'},stdio:quiet?['ignore','pipe','pipe']:'inherit',windowsHide:true});
    let stdout='',stderr='';
    child.stdout?.on('data',c=>stdout+=c);child.stderr?.on('data',c=>stderr+=c);
    child.on('error',reject);child.on('close',code=>code===0?resolve({stdout:stdout.trim(),stderr:stderr.trim()}):reject(new Error(`${command} ${args.join(' ')} exited ${code}: ${stderr.slice(-800)}`)));
  });
}
async function oidcToken(){
  const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!url||!token)throw new Error('GITHUB_OIDC_UNAVAILABLE');
  const sep=url.includes('?')?'&':'?';
  const response=await fetch(`${url}${sep}audience=jarvis-cloud-tool-runner`,{headers:{Authorization:`bearer ${token}`}});
  if(!response.ok)throw new Error(`OIDC_REQUEST_${response.status}`);
  const payload=await response.json();return payload.value;
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function api(pathname,{method='GET',body,token,retries=3}={}){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(BASE+pathname,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
      if(response.ok)return payload;
      const error=new Error(payload.error||`HTTP_${response.status}`);
      error.status=response.status;
      if(![408,425,429,500,502,503,504].includes(response.status)||attempt===retries)throw error;
      lastError=error;
    }catch(error){
      lastError=error;
      if(attempt===retries)throw error;
    }
    await sleep(Math.min(8000,500*(2**attempt)));
  }
  throw lastError||new Error('API_REQUEST_FAILED');
}
function safeRepo(repo){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repo||'')))throw new Error('INVALID_REPOSITORY');return String(repo);
}
function safeRelative(value){
  const p=String(value||'').replace(/\\/g,'/');
  if(!p||p.startsWith('/')||p.includes('../')||p==='..')throw new Error('INVALID_PATH');return p;
}
async function cloneJob(job){
  const repo=safeRepo(job.repo),root=await mkdtemp(path.join(tmpdir(),'jarvis-cloud-tool-')),dest=path.join(root,'repo');
  await run('git',['clone','--depth','1','--filter=blob:none','--single-branch','--no-tags',`https://github.com/${repo}.git`,dest],{quiet:false});
  if(job.commit){
    await run('git',['fetch','--depth','1','origin',job.commit],{cwd:dest});
    await run('git',['checkout','--detach',job.commit],{cwd:dest});
  }
  const {stdout:commit}=await run('git',['rev-parse','HEAD'],{cwd:dest});
  return {root,dest,commit};
}
async function trackedFiles(dest){
  const {stdout}=await run('git',['ls-files'],{cwd:dest});
  return stdout.split('\n').map(x=>x.trim()).filter(Boolean);
}
async function repoInspect(job,ctx){
  const files=await trackedFiles(ctx.dest),top=files.slice(0,250);
  const candidates=['README.md','README.MD','readme.md','package.json','pyproject.toml','requirements.txt','Cargo.toml','go.mod','Dockerfile'];
  const snippets={};
  for(const file of candidates){
    if(!files.includes(file))continue;
    try{snippets[file]=(await readFile(path.join(ctx.dest,file),'utf8')).slice(0,12000)}catch{}
  }
  const extensions={};for(const file of files){const ext=path.extname(file).toLowerCase()||'(none)';extensions[ext]=(extensions[ext]||0)+1;}
  return {repo:job.repo,commit:ctx.commit,file_count:files.length,files:top,extensions,snippets};
}
async function skillAnalyze(job,ctx){
  const inspection=await repoInspect(job,ctx);
  return compileRepositorySkill(inspection,{repo:job.repo});
}
async function sourceSearch(job,ctx){
  const term=String(job.input?.term||'').trim();if(!term||term.length>200)throw new Error('INVALID_SEARCH_TERM');
  const lower=term.toLowerCase(),files=await trackedFiles(ctx.dest),matches=[];
  for(const file of files.slice(0,4000)){
    if(matches.length>=50)break;
    const ext=path.extname(file).toLowerCase();if(ext&&!TEXT_EXT.has(ext))continue;
    const full=path.join(ctx.dest,file);let info;try{info=await stat(full)}catch{continue}if(info.size>512*1024)continue;
    let text;try{text=await readFile(full,'utf8')}catch{continue}
    const lines=text.split(/\r?\n/);for(let i=0;i<lines.length&&matches.length<50;i++){if(lines[i].toLowerCase().includes(lower))matches.push({file,line:i+1,text:lines[i].slice(0,500)});}
  }
  return {repo:job.repo,commit:ctx.commit,term,matches};
}
async function sourceRead(job,ctx){
  const file=safeRelative(job.input?.path),files=await trackedFiles(ctx.dest);if(!files.includes(file))throw new Error('FILE_NOT_TRACKED');
  const full=path.join(ctx.dest,file),info=await stat(full);if(info.size>250*1024)throw new Error('FILE_TOO_LARGE');
  return {repo:job.repo,commit:ctx.commit,path:file,content:await readFile(full,'utf8')};
}

async function findDownloaded(root,prefix){
  const names=await readdir(root);
  const name=names.find(item=>item.startsWith(prefix+'.'));
  return name?path.join(root,name):null;
}

export async function downloadYouTubeMedia(sourceUrl){
  const root=await mkdtemp(path.join(tmpdir(),'jarvis-youtube-'));
  const audioChunksDir=path.join(root,'audio-chunks'),framesDir=path.join(root,'frames');
  await mkdir(audioChunksDir,{recursive:true});await mkdir(framesDir,{recursive:true});
  let audioPath=null,videoPath=null,duration=0,frameInterval=30;
  try{
    await run('yt-dlp',['--no-playlist','--no-progress','--quiet','--no-warnings','--max-filesize','800M','-f','ba[abr<=128]/ba','-o',path.join(root,'audio.%(ext)s'),sourceUrl]);
    audioPath=await findDownloaded(root,'audio');
  }catch(error){console.warn('YouTube audio download unavailable:',error?.message||error);}
  try{
    await run('yt-dlp',['--no-playlist','--no-progress','--quiet','--no-warnings','--max-filesize','800M','-f','bv*[height<=360]/wv*[height<=360]/bv*','-o',path.join(root,'video.%(ext)s'),sourceUrl]);
    videoPath=await findDownloaded(root,'video');
  }catch(error){console.warn('YouTube video download unavailable:',error?.message||error);}
  if(audioPath){
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',audioPath,'-vn','-ac','1','-ar','16000','-b:a','32k','-f','segment','-segment_time',String(AUDIO_CHUNK_SECONDS),'-reset_timestamps','1',path.join(audioChunksDir,'audio-%03d.mp3')]);
  }
  if(videoPath){
    try{
      const probe=await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',videoPath]);
      duration=Math.max(0,Number(probe.stdout)||0);
    }catch{}
    frameInterval=Math.max(12,Math.min(120,Math.ceil((duration||1200)/42)));
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',videoPath,'-vf',`fps=1/${frameInterval},scale=960:-2`,'-frames:v',String(MAX_VISUAL_FRAMES),'-q:v','5',path.join(framesDir,'frame-%03d.jpg')]);
  }
  const audioChunks=(await readdir(audioChunksDir)).filter(name=>name.endsWith('.mp3')).sort().slice(0,MAX_AUDIO_CHUNKS).map((name,index)=>({path:path.join(audioChunksDir,name),timestamp_sec:index*AUDIO_CHUNK_SECONDS}));
  const frames=(await readdir(framesDir)).filter(name=>name.endsWith('.jpg')).sort().slice(0,MAX_VISUAL_FRAMES).map((name,index)=>({path:path.join(framesDir,name),timestamp_sec:index*frameInterval}));
  return {root,audioChunks,frames,duration,frameInterval};
}

export async function transcribeAudioChunks(chunks,token,language=''){
  const parts=[];
  for(const chunk of (Array.isArray(chunks)?chunks:[]).slice(0,MAX_AUDIO_CHUNKS)){
    try{
      const data=(await readFile(chunk.path)).toString('base64');
      const result=await api('/api/learning/youtube/media/analyze',{method:'POST',token,body:{kind:'audio',data,language:String(language||'').split('-')[0],timestamp_sec:chunk.timestamp_sec}});
      const text=String(result?.text||'').trim();if(text)parts.push(`[${Math.round(chunk.timestamp_sec)}s] ${text}`);
    }catch(error){console.warn(`Audio ASR failed at ${chunk.timestamp_sec}s:`,error?.message||error);}
  }
  return parts.join('\n').trim();
}

function parseVisionNotes(text,fallbackTimestamp=0){
  const output=[];
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const match=line.match(/^\[(\d+(?:\.\d+)?)\s*(?:s|sn|sec|saniye)?\]\s*(.+)$/i);
    if(match)output.push({timestamp_sec:Number(match[1])||0,text:match[2].trim()});
    else output.push({timestamp_sec:fallbackTimestamp,text:line});
  }
  return output;
}

export async function analyzeVisualFrames(frames,token){
  const notes=[];
  const list=(Array.isArray(frames)?frames:[]).slice(0,MAX_VISUAL_FRAMES);
  for(let i=0;i<list.length;i+=6){
    const batch=list.slice(i,i+6),payload=[];
    for(const frame of batch){
      try{payload.push({timestamp_sec:frame.timestamp_sec,mime:'image/jpeg',data:(await readFile(frame.path)).toString('base64')});}catch{}
    }
    if(!payload.length)continue;
    try{
      const result=await api('/api/learning/youtube/media/analyze',{method:'POST',token,body:{kind:'frames',frames:payload}});
      notes.push(...parseVisionNotes(result?.text,payload[0].timestamp_sec));
    }catch(error){console.warn(`Vision analysis failed near ${payload[0].timestamp_sec}s:`,error?.message||error);}
  }
  return notes.slice(0,120);
}

async function youtubeTeaching(job,token){
  if(String(job.repo||'').toLowerCase()!==YOUTUBE_TEACHING_REPO)throw new Error('YOUTUBE_TEACHING_REPO_NOT_ALLOWED');
  const sourceUrl=String(job.input?.url||job.input?.source_url||'').trim();
  const parsed=parseYouTubeResourceUrl(sourceUrl);if(!parsed)throw new Error('YOUTUBE_URL_INVALID');
  if(parsed.type==='channel'){
    const learned=await fetchYouTubeChannelIndex(sourceUrl,{limit:50});
    return {repo:YOUTUBE_TEACHING_REPO,commit:null,engine:'jarvis-clean-room-youtube-teaching',provenance_repo:YOUTUBE_TEACHING_REPO,third_party_code_executed:false,...learned};
  }

  const captions=await fetchYouTubeTranscript(sourceUrl).catch(error=>({kind:'video',source_url:parsed.url,video_id:parsed.videoId,title:'YouTube eğitimi',captions_available:false,transcript:'',language:null,caption_error:String(error?.message||error)}));
  let media=null,asrTranscript='',visualNotes=[],mediaError=null;
  try{
    media=await downloadYouTubeMedia(sourceUrl);
    [asrTranscript,visualNotes]=await Promise.all([
      transcribeAudioChunks(media.audioChunks,token,captions.language),
      analyzeVisualFrames(media.frames,token)
    ]);
  }catch(error){mediaError=String(error?.message||error);}
  finally{if(media?.root)await rm(media.root,{recursive:true,force:true}).catch(()=>{});}
  const fused=fuseYouTubeLearning({captionTranscript:captions.transcript,asrTranscript,visualNotes});
  return {
    repo:YOUTUBE_TEACHING_REPO,commit:null,
    engine:'jarvis-multimodal-youtube-teaching-v2',
    provenance_repo:YOUTUBE_TEACHING_REPO,
    third_party_code_executed:false,
    ...captions,
    caption_transcript:String(captions.transcript||''),
    asr_transcript:asrTranscript,
    visual_notes:visualNotes,
    transcript:fused.transcript,
    modalities:fused.modalities,
    primary_transcript:fused.primary_transcript,
    captions_used:fused.captions_used,
    audio_used:fused.audio_used,
    vision_used:fused.vision_used,
    media_analysis_error:mediaError,
    media_duration_sec:Number(media?.duration||0),
    sampled_visual_frames:Number(media?.frames?.length||0),
    audio_chunks:Number(media?.audioChunks?.length||0)
  };
}
async function executeJob(job,ctx,token){
  const adapter=String(job.adapter_id||'');if(!ALLOWED_ADAPTERS[adapter])throw new Error('ADAPTER_NOT_ALLOWED');
  if(adapter==='youtube-teaching')return youtubeTeaching(job,token);
  if(adapter==='code-graph-query')return executeCodeGraphJob(job,ctx);
  if(adapter==='repo-inspect')return repoInspect(job,ctx);
  if(adapter==='source-search')return sourceSearch(job,ctx);
  if(adapter==='source-read')return sourceRead(job,ctx);
  if(adapter==='skill-analyze')return skillAnalyze(job,ctx);
  throw new Error('ADAPTER_NOT_IMPLEMENTED');
}

async function main(){
  const token=await oidcToken();let processed=0,failed=0;
  for(let batch=0;batch<MAX_BATCHES;batch++){
    let seededCount=0,batchProcessed=0;
    try{
      const seeded=await api('/api/tools/cloud/runner/seed-learning',{method:'POST',body:{limit:MAX_JOBS},token});
      seededCount=Number(seeded.queued||0);
      console.log(`Batch ${batch+1}/${MAX_BATCHES}: seeded ${seededCount} repository skill jobs.`);
    }catch(error){
      console.warn(`Batch ${batch+1}/${MAX_BATCHES}: skill seeding failed; continuing with existing queue:`,error?.message||error);
    }
    for(let index=0;index<MAX_JOBS;index++){
      let claimed;
      try{
        claimed=await api('/api/tools/cloud/runner/claim',{method:'POST',body:{},token});
      }catch(error){
        failed++;
        console.error(`Batch ${batch+1}/${MAX_BATCHES}: claim failed after retries; isolating batch:`,error?.message||error);
        break;
      }
      const job=claimed.job;
      if(!job){console.log(`Batch ${batch+1}/${MAX_BATCHES}: no more queued cloud tool jobs.`);break;}
      processed++;batchProcessed++;
      console.log(`Claimed ${job.id} ${job.adapter_id} ${job.repo}`);
      let ctx=null;
      try{
        ctx=job.adapter_id==='youtube-teaching'?null:await cloneJob(job);
        const result=await executeJob(job,ctx,token);
        await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:true,result},token});
        console.log(`Completed ${job.id}`);
      }catch(error){
        failed++;
        console.error(`Failed ${job.id}:`,error);
        await api(`/api/tools/cloud/runner/jobs/${encodeURIComponent(job.id)}/result`,{method:'POST',body:{ok:false,error:String(error?.message||error)},token}).catch(()=>{});
      }finally{
        if(ctx?.root)await rm(ctx.root,{recursive:true,force:true}).catch(()=>{});
      }
    }
    console.log(`Batch ${batch+1}/${MAX_BATCHES} finished. processed=${batchProcessed} seeded=${seededCount}.`);
    if(seededCount===0&&batchProcessed===0)break;
  }
  console.log(`Cloud runner finished. processed=${processed} failed=${failed} max_jobs_per_batch=${MAX_JOBS} max_batches=${MAX_BATCHES}`);
  if(failed>0)process.exitCode=1;
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)main();