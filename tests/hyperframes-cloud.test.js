import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hyperframesWorkflowInput } from '../.github/scripts/hyperframes-render.mjs';
import { buildHyperframesProject } from '../src/application/video/hyperframes-project.js';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const valid={
  HF_JOB_ID:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  HF_BRAND:'6006 PERFORMANCE', HF_TITLE:'Stage 1',
  HF_SUBTITLE:'Diagnose · Codierung', HF_FORMAT:'reels', HF_DURATION:'8'
};

test('Cloud job uses only a bounded validated composition',()=>{
  const {id,brief}=hyperframesWorkflowInput(valid);
  assert.equal(id,valid.HF_JOB_ID);
  const p=buildHyperframesProject(brief);
  assert.match(p.html,/Stage 1/);
  assert.equal(p.renderer,'hyperframes-local');
});
test('Cloud job blocks unknown formats, oversized fields and invalid job IDs',()=>{
  assert.throws(()=>hyperframesWorkflowInput({...valid,HF_JOB_ID:'$(cat /etc/passwd)'}),/INVALID_HYPERFRAMES_JOB_ID/);
  assert.throws(()=>hyperframesWorkflowInput({...valid,HF_FORMAT:'evil'}),/HYPERFRAMES_INVALID_FORMAT/);
  assert.throws(()=>hyperframesWorkflowInput({...valid,HF_TITLE:'x'.repeat(150)}),/HYPERFRAMES_TEXT_TOO_LONG/);
});
test('Workflow cannot run automatically on pushes and does not gain write permissions',()=>{
  const flow=read('.github/workflows/hyperframes-render.yml');
  assert.match(flow,/workflow_dispatch:/);
  assert.doesNotMatch(flow,/^\s+push:|^\s+schedule:/m);
  assert.match(flow,/permissions:\s*\n\s*contents: read/);
  assert.match(flow,/timeout-minutes: 20/);
  assert.match(flow,/retention-days: 3/);
  assert.match(flow,/compression-level: 0/);
});
test('Cloud rendering is protected by existing authenticated video-pool routes',()=>{
  const api=read('src/application/video/failover.js');
  assert.match(api,/if \(path.startsWith\('\/api\/video-pool\/'\)\)/);
  assert.match(api,/if \(!\(await authed\(req, env, ctx\)\)\)/);
  assert.match(api,/hyperframes\/render-status/);
  assert.match(api,/hyperframes\/render-download/);
  const handler=read('src/application/video/hyperframes-cloud.js');
  assert.match(handler,/GITHUB_REPOSITORY_MUST_BE_/);
  assert.match(handler,/HYPERFRAMES_HOURLY_LIMIT_3/);
  assert.match(handler,/RENDER_NOT_READY/);
});
test('UI offers MP4 render, status and MP4 preview',()=>{
  const ui=read('public/video-pool-ui.js');
  assert.match(ui,/id="hfRenderCloud"/);
  assert.match(ui,/id="hfCloudPreview"/);
  assert.match(ui,/extractCloudMp4/);
  assert.match(ui,/MP4 BULUTTA OLUŞTUR/);
});
