import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');

test('chat orchestrator supplies bounded recent conversation context to provider fallbacks', () => {
  assert.match(source, /recentConversationContext/);
  assert.match(source, /\/api\/chat\/history\?limit=/);
  assert.match(source, /conversationContext/);
  assert.match(source, /getExperts\(env,text,[^)]*conversationContext/);
  assert.match(source, /workersAiFallback\(env,text,[^)]*conversationContext/);
});

test('tool discovery results are bounded and included in provider context', () => {
  assert.match(source, /function toolContext\(/);
  assert.match(source, /toolContext\(toolRows\)/);
  assert.match(source, /conversationContext=\[historyContext,learnedContext\(learnedRows\),webContext,toolsContext\]/);
});
