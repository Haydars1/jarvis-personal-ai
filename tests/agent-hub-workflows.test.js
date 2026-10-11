import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHubSteps,nextHubStep,createAgentPlan } from '../src/lib/agent-hub-workflow.js';
import {readFileSync} from 'node:fs';
const repo=new Set(['owner/sample']);
test('validates curated read-only steps',()=>{
 const steps=validateHubSteps([{adapter_id:'repo-inspect',repo:'owner/sample'},{adapter_id:'source-search',repo:'owner/sample',input:{term:'hello'}}],repo);
 assert.equal(steps.length,2);
 assert.throws(()=>validateHubSteps([{adapter_id:'shell',repo:'owner/sample'}],repo),/ADAPTER_NOT_ALLOWED/);
 assert.throws(()=>validateHubSteps([{adapter_id:'repo-inspect',repo:'unknown/tool'}],repo),/REPOSITORY_NOT_CURATED/);
 assert.throws(()=>validateHubSteps(Array(9).fill({adapter_id:'repo-inspect',repo:'owner/sample'}),repo),/STEPS_MUST_BE/);
});
test('sequential workflow and bounded retry',()=>{
 const steps=validateHubSteps([{adapter_id:'repo-inspect',repo:'owner/sample'},{adapter_id:'source-search',repo:'owner/sample'}],repo);
 const meta={workflow_id:'wf',steps,position:0,attempts:0};
 const second=nextHubStep(meta,true);
 assert.equal(second.adapter_id,'source-search');
 assert.equal(second.meta.position,1);
 assert.equal(nextHubStep({...meta,position:1},true),null);
 const retry=nextHubStep(meta,false);
 assert.equal(retry.meta.attempts,1);
 assert.equal(nextHubStep(retry.meta,false),null);
});
test('Cloudflare existing entrypoint routes authenticated hub API',()=>{
 const src=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 assert.match(src,/\/api\/tools\/agent-hub\/workflows/);
 assert.match(src,/appAuthed\(core,req,env,ctx\)/);
 assert.match(src,/nextHubStep\(input.__agent_hub,ok\)/);
});

test('task-to-agent plan is bounded and uses allowlisted adapters',()=>{
 const plan=createAgentPlan({repo:'owner/sample',task:'Examine payment error'},repo);
 assert.equal(plan.steps.length,3);
 assert.deepEqual(plan.steps.map(s=>s.adapter_id),['repo-inspect','source-search','skill-analyze']);
 assert.throws(()=>createAgentPlan({repo:'unknown/tool',task:'inspect'},repo),/REPOSITORY_NOT_CURATED/);
});
test('authenticated agent launch appears in existing Cloudflare API',()=>{
 const src=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 assert.match(src,/\/api\/tools\/agent-hub\/agent/);
 assert.match(src,/createAgentPlan\(body,CURATED_REPOS\)/);
});
