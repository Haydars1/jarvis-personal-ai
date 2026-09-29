import http from 'node:http';

/**
 * JARVIS ECU local adapter template.
 *
 * Implement only the capabilities your physical interface truly supports.
 * Never advertise a capability until its implementation returns a real,
 * verified result from the connected device/vehicle.
 */
const PORT=Number(process.env.ECU_ADAPTER_PORT||8765);
const HOST=process.env.ECU_ADAPTER_HOST||'127.0.0.1';

const capabilities=[]; // Example: ['read_dtc','read_live_data']

async function execute(job){
  switch(job.action){
    // case 'read_dtc':
    //   return await yourHardwareLibrary.readDtc(job.module,job.request);
    default:
      throw new Error('ADAPTER_ACTION_NOT_IMPLEMENTED');
  }
}

function json(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)});
  res.end(body);
}
async function readBody(req){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/capabilities')return json(res,200,{capabilities});
  if(req.method==='POST'&&url.pathname==='/execute'){
    try{
      const payload=JSON.parse(await readBody(req)||'{}');
      const job=payload.job||{};
      if(!capabilities.includes(String(job.action||'')))return json(res,400,{ok:false,error:'CAPABILITY_NOT_ADVERTISED'});
      return json(res,200,{ok:true,result:await execute(job)});
    }catch(error){
      return json(res,500,{ok:false,error:String(error?.message||error)});
    }
  }
  return json(res,404,{ok:false,error:'NOT_FOUND'});
}).listen(PORT,HOST,()=>console.log(`ECU adapter listening on http://${HOST}:${PORT}`));
