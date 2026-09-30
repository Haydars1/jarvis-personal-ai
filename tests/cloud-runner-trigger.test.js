import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/cloud-tool-runner.yml',import.meta.url),'utf8');

test('cloud runner can run immediately after relevant main changes',()=>{
  assert.match(workflow,/push:/);
  assert.match(workflow,/branches:\s*\n\s*- main/);
  assert.match(workflow,/src\/application\/capabilities\/\*\*/);
  assert.match(workflow,/\.github\/scripts\/cloud-tool-runner\.mjs/);
  assert.match(workflow,/docs\/releases\/\*\*/);
});

test('cloud runner remains scheduled every five minutes',()=>{
  assert.match(workflow,/cron:\s*'\*\/5 \* \* \* \*'/);
});
