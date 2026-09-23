import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');

test('chat orchestrator composes bounded learning context before provider execution', () => {
  assert.match(source, /learningContext/);
  assert.match(source, /src\/application\/learning|\.\.\/learning\/service\.js/);
  assert.match(source, /learningContext\(env\s*,\s*text/);
  assert.match(source, /learnedContext\(learnedRows\)/);
});

test('post-response learning remains asynchronous and non-blocking', () => {
  assert.match(source, /ctx\.waitUntil/);
  assert.match(source, /learnSearchResults/);
  assert.match(source, /learnProviderOutcome/);
  assert.match(source, /Promise\.allSettled\(jobs\)/);
});

test('research-backed knowledge is scheduled on successful orchestrated responses', () => {
  assert.match(source, /scheduleLearning\(ctx,env,\{text,webRows,provider:'JARVIS',started\}\)/);
});

test('terminal response failures are recorded without blocking the reply', () => {
  assert.match(source, /all_response_paths_failed/);
  assert.match(source, /clean_synthesis_failed/);
  assert.match(source, /ok:false/);
});
