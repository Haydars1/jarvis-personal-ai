import test from "node:test";
import assert from "node:assert/strict";
import worker from "../mcp-worker/index.js";
const env={MCP_SHARED_TOKEN:"test-only-token"};
const send=(body,token="test-only-token")=>worker.fetch(new Request("https://example.com/mcp",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(body)}),env);
test("rejects unauthenticated calls",async()=>{assert.equal((await send({jsonrpc:"2.0",id:1,method:"tools/list"},"wrong")).status,401)});
test("lists only read-only tool",async()=>{const r=await send({jsonrpc:"2.0",id:1,method:"tools/list"});assert.deepEqual((await r.json()).result.tools.map(x=>x.name),["project_info"])});
test("initializes MCP",async()=>{const r=await send({jsonrpc:"2.0",id:1,method:"initialize"});assert.equal((await r.json()).result.serverInfo.name,"hayirlievlad-shared")});
test("denies unknown tools",async()=>{const r=await send({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"shell",arguments:{}}});assert.equal((await r.json()).error.code,-32602)});
