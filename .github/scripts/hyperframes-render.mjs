// Trusted GitHub runner; accepts only validated fields and renders a template
// authored in the JARVIS repository. Does not execute incoming HTML or JS.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeHyperframesBrief, buildHyperframesProject } from '../../src/application/video/hyperframes-project.js';

export function hyperframesWorkflowInput(env = process.env) {
  const id = String(env.HF_JOB_ID || '').trim();
  if (!/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(id)) throw Error('INVALID_HYPERFRAMES_JOB_ID');
  const brief = normalizeHyperframesBrief({
    brand:env.HF_BRAND,title:env.HF_TITLE,subtitle:env.HF_SUBTITLE,
    format:env.HF_FORMAT,duration:env.HF_DURATION
  });
  return {id, brief};
}
function run(command,args,cwd,ms) {
  return new Promise((resolve,reject) => {
    const child = spawn(command,args,{
      cwd,env:{...process.env,HYPERFRAMES_NO_UPDATE_CHECK:'1'},
      stdio:'inherit',windowsHide:true
    });
    const timer = setTimeout(()=>{child.kill('SIGKILL');reject(Error('RENDER_TIMEOUT'));},ms);
    child.once('error',e=>{clearTimeout(timer);reject(e)});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(command+'_EXIT_'+code))});
  });
}
export async function renderCloudVideo(env=process.env, root=process.cwd()) {
  const {brief}=hyperframesWorkflowInput(env);
  const project=buildHyperframesProject(brief);
  const cwd=path.join(root,'.wrangler','hyperframes-render');
  await mkdir(cwd,{recursive:true});
  await writeFile(path.join(cwd,'index.html'),project.html,'utf8');
  // Approved dependency already installed by the pinned, reviewed workflow.
  const cli=path.join(root,'node_modules','.bin','hyperframes');
  await stat(cli);
  for(const action of ['lint','check']) await run(cli,[action],cwd,2*60*1000);
  await run(cli,['render','--output','final.mp4','--workers','2'],cwd,15*60*1000);
  const target=path.join(cwd,'final.mp4');
  const output=await stat(target);
  if (!output.size || output.size>20*1024*1024) throw Error('INVALID_RENDER_SIZE');
  console.log('HYPERFRAMES_MP4_OK bytes='+output.size);
  return {file:target,bytes:output.size};
}
if(process.argv[1] && process.argv[1].endsWith('hyperframes-render.mjs')) {
  renderCloudVideo().catch(e=>{console.error(e);process.exitCode=1});
}
