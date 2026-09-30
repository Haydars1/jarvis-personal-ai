import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/jarvis-codex-agent.yml',import.meta.url),'utf8');

test('autonomous dev workflow has off-peak quarter-hour schedule',()=>{
  assert.match(source,/cron:\s*'7,22,37,52 \* \* \* \*'/);
});

test('autonomous dev starts every run from current main',()=>{
  assert.match(source,/name: Checkout current main[\s\S]*ref: main/);
  assert.match(source,/jarvis\/auto-/);
});

test('verified autonomous work is promoted through a fresh PR',()=>{
  assert.match(source,/gh pr create/);
  assert.match(source,/--base main/);
  assert.match(source,/--head "\$BRANCH"/);
  assert.match(source,/pull-requests: write/);
});

test('runtime test trigger is isolated from autonomous output branches',()=>{
  assert.match(source,/test\/autonomy-runtime/);
  assert.doesNotMatch(source,/push:[\s\S]*feature\/learning-engine/);
});

test('agent never pushes its work back to the stale learning branch',()=>{
  assert.doesNotMatch(source,/git push origin HEAD:feature\/learning-engine/);
  assert.match(source,/git push origin "HEAD:\$BRANCH"/);
});

test('scheduled Codex fallback explicitly trusts only the GitHub Actions bot actor',()=>{
  assert.match(source,/allow-bot-users:\s*["']?github-actions\[bot\]["']?/);
  assert.doesNotMatch(source,/allow-users:\s*["']?\*["']?/);
});
