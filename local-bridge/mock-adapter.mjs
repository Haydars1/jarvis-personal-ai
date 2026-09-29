import http from 'node:http';

const PORT=Number(process.env.ECU_MOCK_PORT||8765);
const HOST=process.env.ECU_MOCK_HOST||'127.0.0.1';

const capabilities=[
  'read_dtc',
  'read_live_data',
  'long_coding_read',
  'adaptation_read'
];

function json(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)});
  res.end(body);
}
async function body(req){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
function simulatedResult(job){
  switch(job.action){
    case 'read_dtc':
      return {simulated:true,module:job.module||'01 Engine',dtcs:[
        {code:'P0000',status:'mock',description:'Simulation only — no vehicle was queried.'}
      ]};
    case 'read_live_data':
      return {simulated:true,module:job.module||'01 Engine',values:[
        {name:'Engine speed',value:0,unit:'rpm'},
        {name:'Coolant temperature',value:20,unit:'°C'}
      ]};
    case 'long_coding_read':
      return {simulated:true,module:job.module||'09 BCM',coding:'0000000000000000',note:'Mock coding; not read from a vehicle.'};
    case 'adaptation_read':
      return {simulated:true,module:job.module||'01 Engine',channels:[],note:'Mock adaptation list.'};
    default:
      throw new Error('MOCK_UNSUPPORTED_ACTION');
  }
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,adapter:'jarvis-mock-adapter',simulated:true});
  if(req.method==='GET'&&url.pathname==='/capabilities')return json(res,200,{adapter:'jarvis-mock-adapter',simulated:true,capabilities});
  if(req.method==='POST'&&url.pathname==='/execute'){
    try{
      const payload=JSON.parse(await body(req)||'{}');
      const job=payload.job||{};
      if(!capabilities.includes(String(job.action||'')))return json(res,400,{ok:false,error:'MOCK_UNSUPPORTED_ACTION'});
      return json(res,200,{ok:true,result:simulatedResult(job)});
    }catch(error){
      return json(res,400,{ok:false,error:String(error?.message||error)});
    }
  }
  return json(res,404,{ok:false,error:'NOT_FOUND'});
});

server.listen(PORT,HOST,()=>{
  console.log(`JARVIS ECU mock adapter listening at http://${HOST}:${PORT}`);
  console.log('SIMULATION ONLY — no vehicle interface is accessed.');
  console.log('Capabilities:',capabilities.join(', '));
});
