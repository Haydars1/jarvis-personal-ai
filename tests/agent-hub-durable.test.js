import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hubWorkflowProgress,deterministicHubReport,HUB_WORKFLOW_LIMITS} from '../src/lib/agent-hub-durable-report.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const row=(workflowId,position,status,attempts=0)=>({
  adapter_id:'repo-inspect',repo:'Haydars1/jarvis-personal-ai',status,
  input_json:JSON.stringify({__agent_hub:{workflow_id:workflowId,position,attempts}}),
  created_at:position*100+attempts,
  result_json:JSON.stringify({inspected:true})
});
test('job progress never mixes workflows and completes only final stage',()=>{
  const rows=[row('one',0,'completed'),row('other',2,'completed'),row('one',1,'completed')];
  const pending=hubWorkflowProgress(rows,'one',3);
  assert.equal(pending.finished,false);
  assert.equal(pending.current_step,2);
  assert.equal(hubWorkflowProgress([...rows,row('one',2,'completed')],'one',3).status,'completed');
});
test('bounded retry state is reflected in Cloudflare workflow reporting',()=>{
  assert.equal(hubWorkflowProgress([row('w',1,'failed',0)],'w',3).finished,false);
  assert.equal(hubWorkflowProgress([row('w',1,'failed',1)],'w',3).status,'failed');
  assert.deepEqual(hubWorkflowProgress([],'w',3),{status:'queued',finished:false,steps:0});
});
test('reporting never returns unlimited job data or raw secret tokens',()=>{
  const entries=Array.from({length:22},(_,i)=>({...row('a',i,'completed'),result_json:JSON.stringify({secret:'ghp_abcdefghijklmnop1234567890'})}));
  const result=deterministicHubReport(entries,'a',23);
  assert.ok(result.jobs.length<=16);
  assert.ok(!JSON.stringify(result).includes('ghp_abcdefghijklmnop'));
});
test('Cloudflare Workflows binding and class export are wired',()=>{
  const config=JSON.parse(source('wrangler.jsonc'));
  assert.ok(config.workflows.some(x=>x.binding==='AGENT_HUB_WORKFLOW' && x.class_name==='JarvisAgentWorkflow'));
  assert.match(source('src/app-entry.js'),/export \{ JarvisAgentWorkflow \}/);
  assert.match(source('src/application/capabilities/agent-hub-workflow.js'),/extends WorkflowEntrypoint/);
  assert.equal(HUB_WORKFLOW_LIMITS.maxChecks,12);
});
test('authenticated durable launch and status APIs are present',()=>{
  const api=source('src/application/capabilities/cloud-execution.js');
  assert.ok(api.includes('/api/tools/agent-hub/durable'));
  assert.match(api,/env\.AGENT_HUB_WORKFLOW\.create/);
  assert.match(api,/env\.AGENT_HUB_WORKFLOW\.get/);
  assert.match(api,/appAuthed\(core,req,env,ctx\)/);
});

test('out-of-order GitHub callbacks cannot regress durable stage progress',()=>{
 const rows=[row('wf',2,'completed'),row('wf',0,'completed'),row('wf',1,'completed')];
 assert.equal(hubWorkflowProgress(rows,'wf',3).status,'completed');
});
test('nullable result payload from a failed GitHub job never crashes reporting',()=>{
 const rows=[{...row('wf',0,'failed',1),result_json:'null',error:null}];
 const report=deterministicHubReport(rows,'wf',3);
 assert.equal(report.status,'failed');
 assert.equal(typeof report.jobs[0].result,'string');
 assert.equal(typeof report.jobs[0].error,'string');
});
