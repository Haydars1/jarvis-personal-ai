import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('coding fallback uses current Gemini and OpenRouter Auto',()=>{
  const source=read('.github/scripts/run-coding-provider-fallback.sh');
  assert.match(source,/google\/gemini-3\.8-flash/);
  assert.match(source,/openrouter\/openrouter\/auto/);
  assert.doesNotMatch(source,/google\/gemini-3\.5-flash/);
});

test('scheduled development tries task-aware specialist pool before Codex fallback',()=>{
  const source=read('.github/workflows/jarvis-codex-agent.yml');
  const pool=source.indexOf('Run best available coding specialist');
  const codex=source.indexOf('Run Codex fallback');
  assert.ok(pool>=0&&codex>pool);
  assert.match(source,/steps\.multiprovider\.outcome != 'success'/);
});

test('ECU Studio exposes local bridge status and job controls',()=>{
  const source=read('public/ecu-studio.js');
  assert.match(source,/data-ecu-channel="device"/);
  assert.match(source,/\/api\/ecu\/device\/bridges/);
  assert.match(source,/\/api\/ecu\/device\/jobs/);
  assert.match(source,/dpf_service_regen|ecuDeviceAction/);
});
