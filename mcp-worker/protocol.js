const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const ok=(id,result)=>({jsonrpc:"2.0",id,result});
const fail=(id,code,message)=>({jsonrpc:"2.0",id,error:{code,message}});
export async function handleMcp(request){
 if(request.method!=="POST")return json({error:"method_not_allowed"},405);
 if(!(request.headers.get("content-type")||"").includes("application/json"))return json({error:"unsupported_media_type"},415);
 const raw=await request.text();if(raw.length>32768)return json({error:"payload_too_large"},413);
 let msg;try{msg=JSON.parse(raw)}catch{return json(fail(null,-32700,"Parse error"),400)}
 if(!msg||Array.isArray(msg)||msg.jsonrpc!=="2.0"||typeof msg.method!=="string")return json(fail(msg?.id??null,-32600,"Invalid Request"),400);
 if(msg.method==="notifications/initialized")return new Response(null,{status:202});
 const id=msg.id;if(id===undefined)return new Response(null,{status:202});
 if(msg.method==="initialize")return json(ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"hayirlievlad-shared",version:"0.2.0"}}));
 if(msg.method==="ping")return json(ok(id,{}));
 if(msg.method==="tools/list")return json(ok(id,{tools:[{name:"project_info",description:"Read static project integration metadata",inputSchema:{type:"object",properties:{},additionalProperties:false}}]}));
 if(msg.method==="tools/call"){
  if(msg.params?.name!=="project_info"||!msg.params.arguments||Array.isArray(msg.params.arguments)||typeof msg.params.arguments!=="object"||Object.keys(msg.params.arguments).length)return json(fail(id,-32602,"Invalid params"));
  return json(ok(id,{content:[{type:"text",text:JSON.stringify({project:"hayirlievlad",mode:"read-only"})}]}));
 }
 return json(fail(id,-32601,"Method not found"));
}
