import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script=readFileSync(new URL('../.github/scripts/run-local-coder-fallback.sh',import.meta.url),'utf8');

test('local autonomous coder imports backlog into an ignored workspace path',()=>{
  assert.match(script,/\.jarvis-runtime\/skill-backlog\.json/);
  assert.match(script,/\/tmp\/jarvis-skill-backlog\.json/);
  assert.match(script,/\.git\/info\/exclude/);
  assert.match(script,/cp .*jarvis-skill-backlog\.json/);
});

test('local autonomous coder rewrites external backlog references before OpenCode sees the prompt',()=>{
  assert.match(script,/sed .*\/tmp\/jarvis-skill-backlog\.json.*\.jarvis-runtime\/skill-backlog\.json/);
  assert.match(script,/LOCAL_PROMPT_PATH/);
});
