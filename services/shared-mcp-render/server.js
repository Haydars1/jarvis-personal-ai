import http from 'node:http';
import { handleMcp } from './protocol.js';
const port=Number(process.env.PORT||10000);
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health'){
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify({status:'ok',service:'hayirlievlad-shared-mcp-render',mcpAuthConfigured:Boolean(process.env.MCP_BEARER_TOKEN)}));return;
  }
  if(url.pathname!=='/mcp'){res.writeHead(404);res.end('Not found');return;}
  const token=process.env.MCP_BEARER_TOKEN;
  if(!token){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'authentication_not_configured'}));return;}
  const auth=req.headers.authorization||'';
  const {timingSafeEqual}=await import('node:crypto');
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  const a=Buffer.from(supplied),b=Buffer.from(token);
  if(a.length!==b.length||!timingSafeEqual(a,b)){res.writeHead(401,{'www-authenticate':'Bearer','cache-control':'no-store'});res.end('Unauthorized');return;}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413);res.end('Payload too large');return;}chunks.push(chunk);}
  const request=new Request('http://localhost/mcp',{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const response=await handleMcp(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error('MCP server request failed',e);if(!res.headersSent)res.writeHead(500);res.end('Internal error');}
});
server.listen(port,'0.0.0.0',()=>console.log('Shared MCP Render listening on '+port));
