import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');

test('chat orchestrator composes bounded learning context before provider execution', () => {
  assert.match(source, /learningContext/);
  assert.match(source, /src\/application\/learning|\.\.\/learning\/service\.js/);
  assert.match(source, /learningContext\(env\s*,\s*text/);
});

test('post-response learning remains asynchronous and non-blocking', () => {
  assert.match(source, /ctx\.waitUntil/);
  assert.match(source, /learn(SearchResults|ProviderOutcome)/);
});
