import test from "node:test";import assert from "node:assert/strict";import {handleMcp} from "../protocol.js";
const send=(method,params)=>handleMcp(new Request("https://example.test/mcp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}));
test("initialize",async()=>assert.equal((await(await send("initialize")).json()).result.serverInfo.name,"hayirlievlad-shared"));
test("read-only tools",async()=>assert.deepEqual((await(await send("tools/list")).json()).result.tools.map(t=>t.name),["project_info"]));
test("reject arbitrary tool",async()=>assert.equal((await(await send("tools/call",{name:"shell",arguments:{}})).json()).error.code,-32602));
