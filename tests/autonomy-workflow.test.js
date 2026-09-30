import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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

test('autonomous workflow falls back to a keyless local coding model after hosted providers fail',()=>{
  assert.match(source,/Run keyless local coding fallback/);
  assert.match(source,/steps\.localcoder\.outcome/);
  assert.match(source,/run-local-coder-fallback\.sh/);
  assert.match(source,/actions\/cache@v4/);
});

test('keyless local coder is conservative, local and test gated',()=>{
  const scriptUrl=new URL('../.github/scripts/run-local-coder-fallback.sh',import.meta.url);
  assert.equal(existsSync(scriptUrl),true,'local fallback script must exist');
  const script=readFileSync(scriptUrl,'utf8');
  assert.match(script,/Qwen\/Qwen3-1\.7B-GGUF:Q4_K_M/);
  assert.match(script,/llama-server/);
  assert.match(script,/127\.0\.0\.1:8080\/v1/);
  assert.match(script,/opencode run/);
  assert.match(script,/npm run check/);
  assert.match(script,/git reset --hard HEAD/);
  assert.doesNotMatch(script,/https?:\/\/api\.(openai|anthropic|mistral|groq|x\.ai)/);
});

test('local coder bootstraps from pinned verified llama.cpp binary instead of compiling it',()=>{
  const script=readFileSync(new URL('../.github/scripts/run-local-coder-fallback.sh',import.meta.url),'utf8');
  assert.match(script,/b11146/);
  assert.match(script,/llama-b11146-bin-ubuntu-x64\.tar\.gz/);
  assert.match(script,/c150306eb16b5ab696f76a8bdf810c35fd98a24e82158742e6fa28f420ff8410/);
  assert.match(script,/sha256sum/);
  assert.doesNotMatch(script,/cmake --build/);
  assert.doesNotMatch(script,/git clone --depth=1 --branch/);
});

test('runtime verification pushes supersede stale runtime tests without cancelling scheduled development',()=>{
  assert.match(source,/cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'push'\s*&&\s*github\.ref\s*==\s*'refs\/heads\/test\/autonomy-runtime'\s*\}\}/);
  assert.doesNotMatch(source,/cancel-in-progress:\s*true/);
});
