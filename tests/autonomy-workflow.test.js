import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/jarvis-codex-agent.yml',import.meta.url),'utf8');

test('autonomous dev workflow has off-peak quarter-hour schedule',()=>{
  assert.match(source,/cron:\s*'7,22,37,52 \* \* \* \*'/);
});

test('autonomous dev workflow can be test-triggered from learning branch',()=>{
  assert.match(source,/push:[\s\S]*feature\/learning-engine/);
  assert.match(source,/github\.actor != 'github-actions\[bot\]'/);
});

test('manual dispatch is not blocked by branch-only condition',()=>{
  assert.match(source,/github\.event_name == 'workflow_dispatch'/);
});
