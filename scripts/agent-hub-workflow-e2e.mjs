import { cloneJob, executeJob } from '../.github/scripts/cloud-tool-runner.mjs';
import { rm as rmAsync } from 'node:fs/promises';
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
 vars:{JARVIS_SECRET:'workflow-test-only-secret',CREDENTIAL_MASTER_KEY:'workflow-test-only-master',AGENT_HUB_E2E_LOCAL:'true',AGENT_HUB_E2E_WORKFLOW_REF:process.env.GITHUB_WORKFLOW_REF||''}
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
 assert.ok(process.env.ACTIONS_ID_TOKEN_REQUEST_URL&&process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,'GitHub-hosted OIDC identity is required for real runner validation');
 const oidcUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
 oidcUrl.searchParams.set('audience','jarvis-cloud-tool-runner');
 const oidcResponse=await fetch(oidcUrl,{headers:{Authorization:'bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 assert.equal(oidcResponse.status,200,'Unable to obtain real GitHub Actions OIDC token');
 const token=(await oidcResponse.json()).value;
 assert.ok(token,'Signed OIDC token missing');
 async function runnerPost(path,body){
   const response=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   assert.equal(response.status,200,path+': '+JSON.stringify(result));
   return result;
 }
 const stages=['repo-inspect','source-search','skill-analyze'];
 for(const stage of stages){
   let claimed=null;
   for(let retry=0;retry<25;retry++){
     const response=await runnerPost('/api/tools/cloud/runner/claim',{});
     if(response.job){claimed=response.job;break;}
     await new Promise(r=>setTimeout(r,400));
   }
   assert.ok(claimed,'GitHub runner did not claim stage '+stage);
   assert.equal(claimed.adapter_id,stage,'Wrong queued stage');
   assert.equal(claimed.repo.toLowerCase(),'haydars1/jarvis-personal-ai');
   let ctx=null;
   try{
     ctx=await cloneJob(claimed);
     const result=await executeJob(claimed,ctx,token);
     const callback=await runnerPost('/api/tools/cloud/runner/jobs/'+encodeURIComponent(claimed.id)+'/result',{ok:true,result});
     assert.equal(callback.job.status,'completed');
     assert.equal(callback.already_processed,undefined,'Unexpected duplicate callback');
     console.log('GitHub-hosted runner stage completed:',stage);
   }finally{if(ctx?.root)await rmAsync(ctx.root,{recursive:true,force:true});}
 }
 let finished=null;
 for(let retry=0;retry<40;retry++){
   const current=await req('/api/tools/agent-hub/durable/'+plan.data.workflow_id);
   assert.equal(current.status,200,'Workflow status unavailable');
   if(current.data.status==='complete'){finished=current.data;break;}
   if(current.data.status==='errored'||current.data.status==='terminated')throw Error('Workflow failed: '+JSON.stringify(current.data));
   await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(finished,'Workflow did not finish after authenticated GitHub runner callbacks. Logs: '+output.slice(-3500));
 assert.equal(finished.output.status,'completed');
 assert.equal(finished.output.progress.current_step,3);
 assert.equal(finished.output.progress.jobs.length,3);
 console.log('REAL GitHub Actions OIDC runner → local Cloudflare Workflow → D1 → completion E2E passed:',plan.data.workflow_id);
}finally{
 if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));if(server.exitCode===null)server.kill('SIGKILL');}
 rmSync(dir,{recursive:true,force:true});
}
