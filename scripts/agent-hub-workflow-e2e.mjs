import { cloneJob, executeJob } from '../.github/scripts/cloud-tool-runner.mjs';
import { rm as rmAsync } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
 assert.equal((await req('/api/tools/agent-hub/durable','POST',{repo:'Haydars1/jarvis-personal-ai',task:'6006 web sitesi SEO ve ECU BIN analizi yap'})).status,401);
 const login=await req('/api/auth/setup','POST',{password:'workflow-e2e-test-only-password'});
 assert.equal(login.status,200,JSON.stringify(login.data));
 cookie=login.headers.get('set-cookie').split(';')[0];
 // Browser-equivalent file API test against the isolated Cloudflare Worker.
 const binaryOriginal=Uint8Array.of(0,1,2,3,4),binaryModified=Uint8Array.of(0,9,2,3,4);
 const inspectResponse=await fetch(base+'/api/tools/agent-hub/ecu-file-inspect',{
   method:'POST',headers:{cookie,'content-type':'application/octet-stream','x-ecu-filename':'ecu-test.bin'},body:binaryOriginal
 });
 assert.equal(inspectResponse.status,200,'ECU upload endpoint failed: '+await inspectResponse.text());
 const compareForm=new FormData();
 compareForm.set('original',new Blob([binaryOriginal]),'orig.bin');
 compareForm.set('modified',new Blob([binaryModified]),'mod.bin');
 const compareResponse=await fetch(base+'/api/tools/agent-hub/ecu-compare',{method:'POST',headers:{cookie},body:compareForm});
 const compareJson=await compareResponse.json();
 assert.equal(compareResponse.status,200,'ECU compare endpoint failed: '+JSON.stringify(compareJson));
 assert.equal(compareJson.comparison.changed_bytes,1);
 assert.equal(compareJson.comparison.ranges[0].start_hex,'0x00000001');
 assert.equal(compareJson.comparison.persisted,false);
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(compareJson.comparison.original.sha256,sha(binaryOriginal));
 assert.equal(compareJson.comparison.modified.sha256,sha(binaryModified));
 assert.equal(compareJson.comparison.file_fingerprints_only,true);
 assert.equal(compareJson.comparison.ecu_firmware_checksum_verified,false);

 // Verify auth and actual Intel HEX multipart uploads through Cloudflare, not only unit tests.
 const unauthorized=await fetch(base+'/api/tools/agent-hub/ecu-file-inspect',{method:'POST',headers:{'content-type':'application/octet-stream','x-ecu-filename':'secret.bin'},body:binaryOriginal});
 assert.equal(unauthorized.status,401,'ECU files must not be processed anonymously');
 const record=(type,address,data=[])=>{
   const values=[data.length,address>>>8,address&255,type,...data];
   return ':'+[...values,(-values.reduce((sum,value)=>sum+value,0))&255].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join('');
 };
 const originalHex=[record(4,0,[0,1]),record(0,0x20,[1,2,3]),record(1,0)].join('\n');
 const modifiedHex=[record(4,0,[0,1]),record(0,0x20,[1,9,3]),record(1,0)].join('\n');
 const originalHexInspect=await fetch(base+'/api/tools/agent-hub/ecu-file-inspect',{
   method:'POST',headers:{cookie,'content-type':'application/octet-stream','x-ecu-filename':'stock.hex'},body:new TextEncoder().encode(originalHex)
 });
 const hexInspectJson=await originalHexInspect.json();
 assert.equal(originalHexInspect.status,200,JSON.stringify(hexInspectJson));
 assert.equal(hexInspectJson.analysis.record_checksums_valid,true);
 assert.equal(hexInspectJson.analysis.address_start_hex,'0x00010020');
 const hexForm=new FormData();
 hexForm.set('original',new Blob([originalHex]),'stock.hex');
 hexForm.set('modified',new Blob([modifiedHex]),'modified.hex');
 const hexCompare=await fetch(base+'/api/tools/agent-hub/ecu-compare',{method:'POST',headers:{cookie},body:hexForm});
 const hexResult=await hexCompare.json();
 assert.equal(hexCompare.status,200,JSON.stringify(hexResult));
 assert.equal(hexResult.comparison.changed_bytes,1);
 assert.equal(hexResult.comparison.ranges[0].start_hex,'0x00010021');
 assert.equal(hexResult.comparison.intel_hex_record_checksums_valid,true);
 assert.equal(hexResult.comparison.original.sha256,sha(Buffer.from(originalHex)));
 assert.equal(hexResult.comparison.modified.sha256,sha(Buffer.from(modifiedHex)));
 assert.equal(hexResult.comparison.ecu_firmware_checksum_verified,false);
 const invalidHex=new TextEncoder().encode(originalHex.replace('010203','010204'));
 const invalidResponse=await fetch(base+'/api/tools/agent-hub/ecu-file-inspect',{
   method:'POST',headers:{cookie,'content-type':'application/octet-stream','x-ecu-filename':'corrupted.hex'},body:invalidHex
 });
 assert.equal(invalidResponse.status,400,'Bad Intel HEX checksum must return 400, not a Worker failure');
 const invalidJson=await invalidResponse.json();
 assert.equal(invalidJson.error,'HEX_RECORD_CHECKSUM_INVALID');
 console.log('Authenticated Intel HEX checksum, address-aware comparison and invalid upload E2E passed');
 console.log('Authenticated ECU original/modified upload and byte comparison E2E passed');

 const plan=await req('/api/tools/agent-hub/durable','POST',{repo:'Haydars1/jarvis-personal-ai',task:'6006 web sitesi SEO ve ECU BIN analizi yap'});
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
 const stages=['repo-inspect','source-search','skill-analyze','ecu-bin-inspect','source-audit'];
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
 assert.equal(finished.output.progress.current_step,5);
 assert.equal(finished.output.progress.jobs.length,5);
 assert.ok(Array.isArray(finished.output.progress.audit_findings),'Source audit findings missing from completed Workflow');
 console.log('REAL GitHub Actions OIDC runner → local Cloudflare Workflow → D1 → completion E2E passed:',plan.data.workflow_id);

 // Real native skills pipeline: authenticated UI API -> D1 queue -> signed GitHub OIDC
 // runner -> JARVIS's read-only source analyzer -> D1 completion -> owner result API.
 const nativeList=await req('/api/tools/agent-hub/skill-executors');
 assert.equal(nativeList.status,200,JSON.stringify(nativeList.data));
 assert.equal(nativeList.data.executors.length,4);
 assert.equal(nativeList.data.third_party_instructions_executed,false);
 const nativeChecks=[
   {repo:'openai/skills',path:'skills/.curated/security-best-practices/SKILL.md',profile:'security'},
   {repo:'cloudflare/skills',path:'skills/workers-best-practices/SKILL.md',profile:'cloudflare'}
 ];
 for(const entry of nativeChecks){
   const requestBody={skill_repo:entry.repo,skill_path:entry.path,target_repo:'Haydars1/jarvis-personal-ai'};
   const enqueue=await req('/api/tools/agent-hub/skill-run','POST',requestBody);
   assert.equal(enqueue.status,202,'Native skill job enqueue: '+JSON.stringify(enqueue.data));
   assert.equal(enqueue.data.audit_profile,entry.profile);
   assert.equal(enqueue.data.external_instructions_executed,false);
   const jobId=enqueue.data.job.id;
   let claimed=null;
   for(let i=0;i<20;i++){
     const result=await runnerPost('/api/tools/cloud/runner/claim',{});
     if(result.job){claimed=result.job;break;}
     await new Promise(r=>setTimeout(r,250));
   }
   assert.ok(claimed,'Native skill job was not claimable by OIDC runner');
   assert.equal(claimed.id,jobId);
   assert.equal(claimed.adapter_id,'source-audit');
   assert.deepEqual(claimed.input.skill_reference,{repo:entry.repo,path:entry.path});
   assert.equal(claimed.input.audit_profile,entry.profile);
   let jobContext=null;
   try{
     jobContext=await cloneJob(claimed);
     const report=await executeJob(claimed,jobContext,token);
     assert.equal(report.engine,'jarvis-owned-static-source-audit');
     assert.equal(report.audit_profile,entry.profile);
     assert.equal(report.third_party_code_executed,false);
     assert.equal(report.read_only,true);
     assert.ok(report.scanned_files>0,'No repository files scanned');
     assert.ok(Array.isArray(report.findings));
     const callback=await runnerPost('/api/tools/cloud/runner/jobs/'+encodeURIComponent(jobId)+'/result',{ok:true,result:report});
     assert.equal(callback.job.status,'completed');
     const ownerStatus=await req('/api/tools/cloud/jobs/'+encodeURIComponent(jobId));
     assert.equal(ownerStatus.status,200);
     assert.equal(ownerStatus.data.job.status,'completed');
     assert.equal(ownerStatus.data.job.result.audit_profile,entry.profile);
     assert.equal(ownerStatus.data.job.result.total_findings,report.findings.length);
     assert.equal(ownerStatus.data.job.result.third_party_code_executed,false);
     console.log('Native GitHub skill audited by real OIDC runner, persisted and retrieved:',entry.repo,entry.profile,jobId);
   }finally{if(jobContext?.root)await rmAsync(jobContext.root,{recursive:true,force:true});}
 }
 // Never treat an unreviewed community SKILL.md as a runnable plugin.
 const rejected=await req('/api/tools/agent-hub/skill-run','POST',{
   skill_repo:'random/unreviewed',skill_path:'skills/execute/SKILL.md',target_repo:'Haydars1/jarvis-personal-ai'
 });
 assert.equal(rejected.status,400);
 assert.equal(rejected.data.error,'SKILL_NATIVE_ADAPTER_UNAVAILABLE');

}finally{
 if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));if(server.exitCode===null)server.kill('SIGKILL');}
 rmSync(dir,{recursive:true,force:true});
}
