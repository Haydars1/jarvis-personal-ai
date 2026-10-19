import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH=path.join(HERE,'cloud-tool-runner.mjs');
const MAX_RESTARTS=Math.max(0,Math.min(6,Number(process.env.JARVIS_CLOUD_RUNNER_RESTARTS||3)));
const ATTEMPT_TIMEOUT_MS=Math.max(60_000,Math.min(25*60_000,Number(process.env.JARVIS_CLOUD_ATTEMPT_TIMEOUT_MS||20*60_000)));
const RETRY_BASE_MS=Math.max(250,Math.min(10_000,Number(process.env.JARVIS_CLOUD_RETRY_BASE_MS||2_000)));
const RETRY_MAX_MS=30_000;

export function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

export function retryDelay(attempt){
  return Math.min(RETRY_MAX_MS,RETRY_BASE_MS*(2**Math.max(0,attempt-1)));
}

export function runCloudRunnerAttempt({spawnImpl=spawn}={}){
  return new Promise(resolve=>{
    const signal=AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
    let settled=false;
    const finish=result=>{
      if(settled)return;
      settled=true;
      resolve(result);
    };
    let child;
    try{
      child=spawnImpl(process.execPath,[RUNNER_PATH],{
        env:process.env,
        stdio:'inherit',
        windowsHide:true,
        signal
      });
    }catch(error){
      finish({ok:false,code:null,signal:null,error:String(error?.message||error)});
      return;
    }
    child.once('error',error=>finish({ok:false,code:null,signal:null,error:String(error?.message||error)}));
    child.once('exit',(code,exitSignal)=>finish({ok:code===0,code,signal:exitSignal,error:null}));
  });
}

export async function superviseCloudRunner(){
  const totalAttempts=MAX_RESTARTS+1;
  let restarts=0;
  for(let attempt=1;attempt<=totalAttempts;attempt++){
    console.log(`Cloud runner supervisor attempt ${attempt}/${totalAttempts}.`);
    const result=await runCloudRunnerAttempt();
    if(result.ok){
      console.log(`Cloud runner supervisor finished. attempts=${attempt} restarts=${restarts} status=success.`);
      return {attempts:attempt,restarts,status:'success'};
    }
    const reason=result.error||`exit_code=${result.code??'null'} signal=${result.signal??'none'}`;
    if(attempt>=totalAttempts){
      throw new Error(`CLOUD_RUNNER_RETRY_EXHAUSTED attempts=${attempt} restarts=${restarts} last=${reason}`);
    }
    restarts++;
    const delay=retryDelay(attempt);
    console.warn(`Cloud runner attempt ${attempt} failed (${reason}); restart ${restarts}/${MAX_RESTARTS} in ${delay}ms.`);
    await sleep(delay);
  }
  throw new Error('CLOUD_RUNNER_SUPERVISOR_UNREACHABLE');
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
  superviseCloudRunner().catch(error=>{
    console.error(error?.stack||error);
    process.exitCode=1;
  });
}
