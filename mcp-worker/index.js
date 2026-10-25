// Isolated read-only MCP endpoint. Deploy separately from the main application.
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}});
const fail=(id,code,message)=>({jsonrpc:"2.0",id,error:{code,message}});
const ok=(id,result)=>({jsonrpc:"2.0",id,result});
const tools=[{name:"project_info",description:"Read public project integration metadata (no secrets).",inputSchema:{type:"object",properties:{},additionalProperties:false}}];
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/mcp")return json({error:"not_found"},404);
  if(request.method!=="POST")return json({error:"method_not_allowed"},405,{"allow":"POST"});
  const expected=env.MCP_SHARED_TOKEN;
  if(!expected || request.headers.get("authorization")!==`Bearer ${expected}`)return json({error:"unauthorized"},401,{"www-authenticate":"Bearer"});
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))return json({error:"unsupported_media_type"},415);
  const size=Number(request.headers.get("content-length")||0);
  if(size>32768)return json({error:"payload_too_large"},413);
  let raw;try{raw=await request.text();if(raw.length>32768)return json({error:"payload_too_large"},413);}catch{return json({error:"bad_request"},400);}
  let msg;try{msg=JSON.parse(raw);}catch{return json(fail(null,-32700,"Parse error"),400);}
  if(!msg||Array.isArray(msg)||typeof msg!=="object"||msg.jsonrpc!=="2.0"||typeof msg.method!=="string")return json(fail(msg?.id??null,-32600,"Invalid Request"),400);
  const id=msg.id??null;
  if(msg.method==="notifications/initialized")return new Response(null,{status:202});
  if(id===null)return new Response(null,{status:202});
  if(msg.method==="initialize")return json(ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{listChanged:false}},serverInfo:{name:"hayirlievlad-shared",version:"0.1.0"}}));
  if(msg.method==="ping")return json(ok(id,{}));
  if(msg.method==="tools/list")return json(ok(id,{tools}));
  if(msg.method==="tools/call"){
    if(msg.params?.name!=="project_info"||!msg.params?.arguments||typeof msg.params.arguments!=="object"||Array.isArray(msg.params.arguments)||Object.keys(msg.params.arguments).length!==0)return json(fail(id,-32602,"Invalid params"));
    return json(ok(id,{content:[{type:"text",text:JSON.stringify({project:"hayirlievlad",integration:"shared-mcp",mode:"read-only",status:"configured"})}]}));
  }
  return json(fail(id,-32601,"Method not found"));
}};