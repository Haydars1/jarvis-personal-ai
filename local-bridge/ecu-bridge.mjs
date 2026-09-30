import { syncSourcePool } from './source-pool-sync.mjs';

const JARVIS_URL=String(process.env.JARVIS_URL||'').replace(/\/$/,'');
const TOKEN=String(process.env.JARVIS_BRIDGE_TOKEN||'');
const ADAPTER_URL=String(process.env.ECU_ADAPTER_URL||'').replace(/\/$/,'');
const POLL_MS=Math.max(800,Number(process.env.ECU_BRIDGE_POLL_MS||1500));
const HEARTBEAT_MS=Math.max(5000,Number(process.env.ECU_BRIDGE_HEARTBEAT_MS||15000));
const SOURCE_SYNC_ENABLED=String(process.env.JARVIS_SOURCE_SYNC||'1')!=='0';
const SOURCE_SYNC_INTERVAL_MS=Math.max(60*60*1000,Number(process.env.JARVIS_SOURCE_SYNC_INTERVAL_MS||24*60*60*1000));

if(!JARVIS_URL||!TOKEN){
  console.error('JARVIS_URL and JARVIS_BRIDGE_TOKEN are required.');
  process.exit(2);
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const headers=()=>({authorization:`Bearer ${TOKEN}`,'content-type':'application/json'});

async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  if(!response.ok)throw new Error(payload.error||`HTTP_${response.status}`);
  return payload;
}

async function adapterCapabilities(){
  if(!ADAPTER_URL)return [];
  try{
    const response=await fetch(ADAPTER_URL+'/capabilities',{headers:{accept:'application/json'}});
    if(!response.ok)return [];
    const payload=await response.json();
    return Array.isArray(payload.capabilities)?payload.capabilities.map(String):[];
  }catch{return []}
}

let sourcePool={status:SOURCE_SYNC_ENABLED?'pending':'disabled',requested:0,ready:0,failed:0,root:String(process.env.JARVIS_SOURCE_ROOT||''),startedAt:null,completedAt:null,error:null};
let sourceSyncPromise=null;
let lastSourceSync=0;
async function refreshSourcePool(){
  if(!SOURCE_SYNC_ENABLED||sourceSyncPromise)return sourceSyncPromise;
  const startedAt=Date.now();
  lastSourceSync=startedAt;
  sourcePool={...sourcePool,status:'syncing',startedAt,completedAt:null,error:null};
  sourceSyncPromise=syncSourcePool().then(manifest=>{
    sourcePool={
      status:manifest.failed>0?'partial':'ready',
      root:manifest.root,
      requested:manifest.requestedRepositories,
      ready:manifest.ready,
      failed:manifest.failed,
      dryRun:manifest.dryRun,
      startedAt,
      completedAt:Date.now(),
      error:null
    };
    console.log('source pool sync complete',JSON.stringify({requested:sourcePool.requested,ready:sourcePool.ready,failed:sourcePool.failed}));
    return manifest;
  }).catch(error=>{
    sourcePool={...sourcePool,status:'error',completedAt:Date.now(),error:String(error?.message||error)};
    console.error('source pool sync failed:',error?.message||error);
    return null;
  }).finally(()=>{sourceSyncPromise=null;});
  return sourceSyncPromise;
}

async function heartbeat(capabilities){
  return jsonFetch(JARVIS_URL+'/api/ecu/device/heartbeat',{method:'POST',body:JSON.stringify({
    capabilities,adapter_url:ADAPTER_URL||null,agent:'jarvis-ecu-local-bridge/2',source_pool:sourcePool
  })});
}

async function nextJob(){
  const payload=await jsonFetch(JARVIS_URL+'/api/ecu/device/jobs/next');
  return payload.job||null;
}

async function executeAdapter(job){
  if(!ADAPTER_URL)throw new Error('LOCAL_ADAPTER_NOT_CONFIGURED');
  const response=await fetch(ADAPTER_URL+'/execute',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({job})
  });
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  if(!response.ok||payload.ok===false)throw new Error(payload.error||`ADAPTER_HTTP_${response.status}`);
  return payload.result??payload;
}

async function report(jobId,ok,result=null,error=null){
  return jsonFetch(JARVIS_URL+`/api/ecu/device/jobs/${encodeURIComponent(jobId)}/result`,{
    method:'POST',body:JSON.stringify({ok,result,error})
  });
}

let capabilities=[];
let lastHeartbeat=0;
console.log('JARVIS ECU local bridge started.');
console.log('Cloud:',JARVIS_URL);
console.log('Adapter:',ADAPTER_URL||'not configured');
console.log('Source pool auto sync:',SOURCE_SYNC_ENABLED?'enabled':'disabled');
if(SOURCE_SYNC_ENABLED)void refreshSourcePool();

for(;;){
  try{
    const now=Date.now();
    if(SOURCE_SYNC_ENABLED&&!sourceSyncPromise&&now-lastSourceSync>=SOURCE_SYNC_INTERVAL_MS)void refreshSourcePool();
    if(now-lastHeartbeat>=HEARTBEAT_MS){
      capabilities=await adapterCapabilities();
      await heartbeat(capabilities);
      lastHeartbeat=now;
      console.log('heartbeat',new Date(now).toISOString(),'capabilities=',capabilities.join(',')||'none','source_pool=',sourcePool.status);
    }
    if(capabilities.length){
      const job=await nextJob();
      if(job){
        console.log('job',job.id,job.action,job.module||'');
        try{
          const result=await executeAdapter(job);
          await report(job.id,true,result,null);
          console.log('completed',job.id);
        }catch(error){
          await report(job.id,false,null,String(error?.message||error));
          console.error('failed',job.id,error?.message||error);
        }
        continue;
      }
    }
  }catch(error){
    console.error('bridge loop error:',error?.message||error);
  }
  await sleep(POLL_MS);
}
