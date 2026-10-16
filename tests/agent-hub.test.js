import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('Agent Hub endpoints require existing JARVIS session',()=>{
  const source = read('src/application/capabilities/cloud-execution.js');
  assert.match(source, /path==='\/api\/tools\/agent-hub'&&method==='GET'/);
  assert.match(source, /path==='\/api\/tools\/agent-hub\/plan'&&method==='POST'/);
  assert.match(source, /if\(!\(await appAuthed\(core,req,env,ctx\)\)\)return jsonResponse\(\{error:'AUTH_REQUIRED'\},401\)/);
  assert.match(source, /automatic_execution:false/);
});
test('existing Cloudflare app-entry integrates Cloud capability execution',()=>{
  const source=read('src/app-entry.js');
  assert.match(source,/createCloudCapabilityExecution\(capabilityCore\)/);
});
test('Agent Hub dashboard is loaded in Turkish interface',()=>{
  assert.match(read('public/index.html'), /agent-hub-ui\.js/);
  const ui=read('public/agent-hub-ui.js');
  assert.match(ui, /\/api\/tools\/agent-hub\/plan/);
  assert.match(ui, /Görev Merkezi/);
});
