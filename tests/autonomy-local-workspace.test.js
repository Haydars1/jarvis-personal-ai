import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script=readFileSync(new URL('../.github/scripts/run-local-coder-fallback.sh',import.meta.url),'utf8');

test('local autonomous coder imports backlog into an ignored workspace path',()=>{
  assert.match(script,/SOURCE_BACKLOG_PATH="\/tmp\/jarvis-skill-backlog\.json"/);
  assert.match(script,/WORKSPACE_RUNTIME_DIR="\.jarvis-runtime"/);
  assert.match(script,/WORKSPACE_BACKLOG_PATH="\$WORKSPACE_RUNTIME_DIR\/skill-backlog\.json"/);
  assert.match(script,/\.git\/info\/exclude/);
  assert.match(script,/cp "\$SOURCE_BACKLOG_PATH" "\$WORKSPACE_BACKLOG_PATH"/);
});

test('local autonomous coder rewrites external backlog references before OpenCode sees the prompt',()=>{
  assert.match(script,/sed "s#\$\{SOURCE_BACKLOG_PATH\}#\$\{WORKSPACE_BACKLOG_PATH\}#g" "\$PROMPT_PATH" > "\$LOCAL_PROMPT_PATH"/);
  assert.match(script,/The repository skill backlog is read-only reference material at \.jarvis-runtime\/skill-backlog\.json/);
  assert.match(script,/Never edit it\./);
});
