import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createCloudCapabilityExecution} from '../src/application/capabilities/cloud-execution.js';
import {NATIVE_SKILL_AUDITS,resolveNativeSkillAudit,nativeSkillAuditJobInput} from '../src/lib/agent-hub-native-skill-audits.js';
import {reviewSourceFile} from '../src/lib/agent-hub-source-audit.js';

function dbEnvironment(t){
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  return {db,DB:{prepare(sql){
    const statement=db.prepare(sql);
    const bind=(values=[])=>({
      first:async()=>statement.get(...values)||null,
      all:async()=>({results:statement.all(...values)}),
      run:async()=>statement.run(...values)
    });
    return {...bind(),bind:(...args)=>bind(args)};
  }}};
}
function app(){
  return createCloudCapabilityExecution({fetch:async request=>{
    const path=new URL(request.url).pathname;
    return new Response(JSON.stringify({authenticated:path==='/api/auth/status'&&request.headers.has('cookie')}));
  }});
}
function call(handler,env,path,body,{session=true}={}){
  return handler.fetch(new Request('https://jarvis.test'+path,{
    method:body===undefined?'GET':'POST',
    headers:{...(session?{cookie:'session=fixture'}:{}),'content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  }),env,{});
}

test('only explicitly reviewed skill references map to built-in read-only analyzers',()=>{
  assert.equal(NATIVE_SKILL_AUDITS.length,4);
  for(const entry of NATIVE_SKILL_AUDITS){
    const input=nativeSkillAuditJobInput(entry.repo,entry.path);
    assert.equal(input.audit_profile,entry.profile);
    assert.equal(input.external_instructions_executed,false);
    assert.equal(resolveNativeSkillAudit(entry.repo,entry.path),entry);
  }
  assert.equal(resolveNativeSkillAudit('random/community','skills/run/SKILL.md'),null);
  assert.throws(()=>nativeSkillAuditJobInput('github/awesome-copilot','skills/unverified/SKILL.md'),/SKILL_NATIVE_ADAPTER_UNAVAILABLE/);
});

test('native source-audit profiles produce separate real findings without evaluating remote code',()=>{
  const js='eval(userCode);\nnode.innerHTML=raw;\nconsole.log(env);\nconst x=process.env.SECRET;\nreadFileSync("config");\ndebugger;';
  const web=reviewSourceFile('public/unsafe.js',js,{profile:'web'});
  assert.ok(web.some(f=>f.rule==='innerhtml-write'));
  assert.ok(web.every(f=>f.rule!=='dynamic-eval'));
  const security=reviewSourceFile('public/unsafe.js',js,{profile:'security'});
  assert.ok(security.some(f=>f.rule==='dynamic-eval'&&f.severity==='high'));
  assert.ok(security.some(f=>f.rule==='sensitive-console'));
  assert.ok(security.every(f=>f.rule!=='workers-sync-io'));
  const workers=reviewSourceFile('src/worker.js',js,{profile:'cloudflare'});
  assert.ok(workers.some(f=>f.rule==='workers-process-env'));
  assert.ok(workers.some(f=>f.rule==='workers-sync-io'));
  assert.ok(workers.every(f=>f.rule!=='innerhtml-write'));
  const all=reviewSourceFile('src/worker.js',js);
  assert.ok(all.length>workers.length);
  assert.throws(()=>reviewSourceFile('a.js',js,{profile:'untrusted'}),/SOURCE_AUDIT_PROFILE_NOT_ALLOWED/);
});

test('authenticated owner can queue a native skill audit with actual D1-compatible schema',async t=>{
  const env=dbEnvironment(t),handler=app();
  assert.equal((await call(handler,env,'/api/tools/agent-hub/skill-executors',undefined,{session:false})).status,401);
  const list=await (await call(handler,env,'/api/tools/agent-hub/skill-executors')).json();
  assert.equal(list.executors.length,4);
  assert.equal(list.third_party_instructions_executed,false);
  const skill=NATIVE_SKILL_AUDITS[1];
  const payload={skill_repo:skill.repo,skill_path:skill.path,target_repo:'Haydars1/jarvis-personal-ai'};
  const started=await call(handler,env,'/api/tools/agent-hub/skill-run',payload);
  assert.equal(started.status,202);
  const body=await started.json();
  assert.equal(body.job.adapter_id,'source-audit');
  assert.equal(body.job.status,'queued');
  assert.equal(body.audit_profile,'security');
  assert.equal(body.external_instructions_executed,false);
  const actual=env.db.prepare('SELECT * FROM cloud_tool_jobs WHERE id=?').get(body.job.id);
  assert.equal(actual.repo,'Haydars1/jarvis-personal-ai');
  assert.equal(JSON.parse(actual.input_json).audit_profile,'security');
  assert.equal(JSON.parse(actual.input_json).skill_reference.path,skill.path);
  const queued=await (await call(handler,env,'/api/tools/cloud/jobs/'+body.job.id)).json();
  assert.equal(queued.job.status,'queued');
  assert.equal(queued.job.result,null);
  const unauth=await call(handler,env,'/api/tools/agent-hub/skill-run',payload,{session:false});
  assert.equal(unauth.status,401);
  assert.equal((await call(handler,env,'/api/tools/agent-hub/skill-run',{...payload,skill_path:'skills/unapproved/SKILL.md'})).status,400);
  assert.equal((await call(handler,env,'/api/tools/agent-hub/skill-run',{...payload,target_repo:'unknown/untrusted'})).status,400);
  assert.equal((await call(handler,env,'/api/tools/agent-hub/skill-run',{...payload,commit:'nope'})).status,400);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS total FROM cloud_tool_jobs').get().total,1);
});

test('GitHub runner and UI are wired to native skill execution with no third-party shell execution',()=>{
  const runner=readFileSync(new URL('../.github/scripts/cloud-tool-runner.mjs',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
  assert.match(runner,/resolveNativeSkillAudit\(ref\.repo,ref\.path\)/);
  assert.match(runner,/reviewSourceFile\(file,content,\{limit:Math\.min\(20,80-findings\.length\),profile\}\)/);
  assert.match(runner,/third_party_code_executed:false/);
  assert.match(ui,/hubNativeStart/);
  assert.match(ui,/\/api\/tools\/agent-hub\/skill-run/);
  assert.match(ui,/hubNativeCheck/);
  assert.match(ui,/\/api\/tools\/cloud\/jobs\//);
});
