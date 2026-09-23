import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat orchestrator supplies bounded recent conversation context to provider fallbacks', async () => {
  const source = await readFile(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');
  assert.match(source, /recentConversationContext/);
  assert.match(source, /\/api\/chat\/history\?limit=/);
  assert.match(source, /conversationContext/);
  assert.match(source, /getExperts\(env,text,[^)]*conversationContext/);
  assert.match(source, /workersAiFallback\(env,text,[^)]*conversationContext/);
});
