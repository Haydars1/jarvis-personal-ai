import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');

test('orchestrated chat turns discovered tools into bounded provider context', () => {
  assert.match(source, /function toolContext\(rows\)/);
  assert.match(source, /toolContext\(toolRows\)/);
  assert.match(source, /conversationContext=\[historyContext,learnedContext\(learnedRows\),webContext,toolsContext\]/);
});
