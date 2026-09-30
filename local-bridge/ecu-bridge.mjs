const JARVIS_URL=String(process.env.JARVIS_URL||'').replace(/\/$/,'');
const TOKEN=String(process.env.JARVIS_BRIDGE_TOKEN||'');
const ADAPTER_URL=String(process.env.ECU_ADAPTER_URL||'').replace(/\/$/,'');
const POLL_MS=Math.max(800,Number(process.env.ECU_BRIDGE_POLL_MS||1500));
const HEARTBEAT_MS=Math.max(5000,Number(process.env.ECU_BRIDGE_HEARTBEAT_MS||15000));

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

async function heartbeat(capabilities){
  return jsonFetch(JARVIS_URL+'/api/ecu/device/heartbeat',{method:'POST',body:JSON.stringify({
    capabilities,adapter_url:ADAPTER_URL||null,agent:'jarvis-ecu-local-bridge/3'
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
console.log('General JARVIS capabilities run in cloud; this bridge is only for physical vehicle hardware.');

for(;;){
  try{
    const now=Date.now();
    if(now-lastHeartbeat>=HEARTBEAT_MS){
      capabilities=await adapterCapabilities();
      await heartbeat(capabilities);
      lastHeartbeat=now;
      console.log('heartbeat',new Date(now).toISOString(),'capabilities=',capabilities.join(',')||'none');
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
