import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/jarvis-codex-agent.yml',import.meta.url),'utf8');

test('autonomous backlog is stored inside workspace for non-interactive local coder access',()=>{
  assert.match(source,/\.jarvis-runtime\/skill-backlog\.json/);
  assert.doesNotMatch(source,/\/tmp\/jarvis-skill-backlog\.json/);
  assert.match(source,/\.git\/info\/exclude/);
});

test('autonomous prompt points agents at workspace backlog instead of external tmp path',()=>{
  const promptSection=source.slice(source.indexOf('Write autonomous development prompt'));
  assert.match(promptSection,/\.jarvis-runtime\/skill-backlog\.json/);
  assert.doesNotMatch(promptSection,/\/tmp\/jarvis-skill-backlog\.json/);
});
