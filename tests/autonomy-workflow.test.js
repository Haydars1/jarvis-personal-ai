import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/jarvis-codex-agent.yml',import.meta.url),'utf8');
const selfUpdate=readFileSync(new URL('../.github/workflows/jarvis-self-update.yml',import.meta.url),'utf8');

test('autonomous dev workflow has off-peak quarter-hour schedule',()=>{
  assert.match(source,/cron:\s*'7,22,37,52 \* \* \* \*'/);
});

test('autonomous dev starts every run from current main',()=>{
  assert.match(source,/name: Checkout current main[\s\S]*ref: main/);
  assert.match(source,/jarvis\/auto-/);
});

test('skill builder fetches backlog from the canonical production worker',()=>{
  assert.match(source,/JARVIS_URL:\s*https:\/\/jarvis-personal-ai\.haydojarvis\.workers\.dev/);
  assert.doesNotMatch(source,/JARVIS_URL:\s*https:\/\/haydojarvis\.workers\.dev/);
  assert.match(source,/\/api\/tools\/skills\/runner\/backlog\?limit=8/);
});

test('self-update CI tests fix branches as well as feature and autonomous branches',()=>{
  assert.match(selfUpdate,/startsWith\(github\.head_ref, 'fix\/'\)/);
  assert.match(selfUpdate,/startsWith\(github\.head_ref, 'feature\/'\)/);
  assert.match(selfUpdate,/startsWith\(github\.head_ref, 'jarvis\/'\)/);
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

test('scheduled Codex fallback explicitly trusts the exact GitHub Actions scheduled actor only',()=>{
  assert.match(source,/allow-bots:\s*true/);
  assert.match(source,/allow-users:\s*["']?github-actions["']?/);
  assert.doesNotMatch(source,/allow-users:\s*["']?\*["']?/);
});

test('autonomous workflow tries keyless local coding before paid Codex fallback',()=>{
  const hosted=source.indexOf('Run best available coding specialist');
  const local=source.indexOf('Run keyless local coding fallback');
  const codex=source.indexOf('Run Codex fallback');
  assert.ok(hosted>=0&&local>hosted&&codex>local,'expected hosted -> local -> Codex order');
  assert.match(source,/name: Run keyless local coding fallback[\s\S]*timeout-minutes:\s*15/);
  assert.match(source,/uses:\s*actions\/cache\/restore@v4[\s\S]*key:\s*jarvis-local-coder-v5-\$\{\{ runner\.os \}\}-qwen3-4b-instruct-2507-q4/);
  assert.match(source,/name: Save keyless local coder cache[\s\S]*uses:\s*actions\/cache\/save@v4/);
  assert.match(source,/name: Save keyless local coder cache[\s\S]*if:\s*\$\{\{ always\(\)/);
});

test('autonomous workflow falls back to a keyless local coding model after hosted providers fail',()=>{
  assert.match(source,/Run keyless local coding fallback/);
  assert.match(source,/steps\.localcoder\.outcome/);
  assert.match(source,/run-local-coder-fallback\.sh/);
  assert.match(source,/actions\/cache\/restore@v4/);
  assert.match(source,/actions\/cache\/save@v4/);
});

test('keyless local coder uses Qwen3 4B Instruct with llama.cpp native tool parsing and probes tool calling',()=>{
  const scriptUrl=new URL('../.github/scripts/run-local-coder-fallback.sh',import.meta.url);
  assert.equal(existsSync(scriptUrl),true,'local fallback script must exist');
  const script=readFileSync(scriptUrl,'utf8');
  assert.match(script,/bartowski\/Qwen_Qwen3-4B-Instruct-2507-GGUF:Q4_K_M/);
  assert.doesNotMatch(script,/Qwen2\.5-Coder-1\.5B/);
  assert.match(script,/"context": 8192/);
  assert.match(script,/"output": 2048/);
  assert.match(script,/--ctx-size 8192/);
  assert.match(script,/--temp 0/);
  assert.match(script,/--jinja/);
  assert.match(script,/\/v1\/chat\/completions/);
  assert.match(script,/"tool_choice":"required"/);
  assert.match(script,/tool_calls/);
  assert.match(script,/local llama\.cpp tool-call probe failed/);
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
