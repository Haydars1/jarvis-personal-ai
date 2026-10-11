import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'jarvis-hub-workflow-'));
const config=join(dir,'wrangler.json');
const persistence=join(dir,'state');
const cli=resolve('node_modules/wrangler/bin/wrangler.js');
const port=18789, base='http://127.0.0.1:'+port;
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
writeFileSync(config,JSON.stringify({
 name:'jarvis-agent-hub-test',main:resolve('src/app-entry.js'),compatibility_date:'2026-09-12',
 compatibility_flags:['nodejs_compat'],
 assets:{directory:resolve('public'),binding:'ASSETS',not_found_handling:'single-page-application'},
 d1_databases:[{binding:'DB',database_name:'jarvis-hub-test',database_id:'00000000-0000-0000-0000-000000000002'}],
 workflows:[{name:'jarvis-agent-hub-test',binding:'AGENT_HUB_WORKFLOW',class_name:'JarvisAgentWorkflow'}],
 vars:{JARVIS_SECRET:'workflow-test-only-secret',CREDENTIAL_MASTER_KEY:'workflow-test-only-master'}
}));
let server,output='';
try{
 const schema=spawnSync(process.execPath,[cli,'d1','execute','jarvis-hub-test','--local','--config',config,'--persist-to',persistence,'--file',resolve('schema.sql')],{env,encoding:'utf8',timeout:60000});
 assert.equal(schema.status,0,schema.stderr||schema.stdout);
 server=spawn(process.execPath,[cli,'dev','--local','--config',config,'--persist-to',persistence,'--ip','127.0.0.1','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',part=>{output+=part;});server.stderr.on('data',part=>{output+=part;});
 let ready=false;
 for(let i=0;i<60;i++){
   if(server.exitCode!==null)throw Error(output);
   try{ready=(await fetch(base+'/api/health',{signal:AbortSignal.timeout(400)})).ok;}catch{}
   if(ready)break;
   await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,'Worker startup failed: '+output.slice(-4000));
 let cookie='';
 async function req(path,method='GET',body){
   const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   return {status:response.status,data,headers:response.headers};
 }
 assert.equal((await req('/api/tools/agent-hub/durable','POST',{repo:'Haydars1/jarvis-personal-ai',task:'ECU upload'})).status,401);
 const login=await req('/api/auth/setup','POST',{password:'workflow-e2e-test-only-password'});
 assert.equal(login.status,200,JSON.stringify(login.data));
 cookie=login.headers.get('set-cookie').split(';')[0];
 const plan=await req('/api/tools/agent-hub/durable','POST',{repo:'Haydars1/jarvis-personal-ai',task:'ECU upload'});
 assert.equal(plan.status,202,'Workflow launch: '+JSON.stringify(plan.data)+' logs '+output.slice(-1500));
 assert.match(plan.data.workflow_id,/^[0-9a-f-]{36}$/i);
 let found=false;
 for(let i=0;i<35;i++){
   const result=spawnSync(process.execPath,[cli,'d1','execute','jarvis-hub-test','--local','--config',config,'--persist-to',persistence,'--command',
   "SELECT adapter_id,repo,status,input_json FROM cloud_tool_jobs WHERE id='"+plan.data.workflow_id+"'"],{env,encoding:'utf8',timeout:15000});
   if(result.status===0&&result.stdout.includes('repo-inspect')&&result.stdout.includes(plan.data.workflow_id)){found=true;break;}
   await new Promise(r=>setTimeout(r,350));
 }
 assert.ok(found,'Durable workflow failed to enqueue initial D1 job. Logs: '+output.slice(-2600));
 const status=await req('/api/tools/agent-hub/durable/'+plan.data.workflow_id);
 assert.equal(status.status,200,JSON.stringify(status.data));
 assert.ok(status.data.status,'Workflow instance state missing');
 console.log('Cloudflare local Workflows + D1 e2e passed:',plan.data.workflow_id,status.data.status);
}finally{
 if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));if(server.exitCode===null)server.kill('SIGKILL');}
 rmSync(dir,{recursive:true,force:true});
}
