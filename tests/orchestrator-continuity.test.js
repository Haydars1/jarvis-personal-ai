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

test('workers fallback is lazy and only runs after core and expert paths fail', () => {
  assert.doesNotMatch(source, /aiPromise\s*=\s*workersAiFallback/);
  assert.match(source, /if\(expert\).*?return jsonResponse[\s\S]*?const ai=await workersAiFallback/);
});

test('learning metrics preserve the provider that actually produced the answer', () => {
  assert.match(source, /provider=String\(first\?\.provider\|\|'JARVIS'\)/);
  assert.match(source, /scheduleLearning\(ctx,env,\{text,provider:expert\.provider,started\}\)/);
  assert.match(source, /scheduleLearning\(ctx,env,\{text,webRows,provider:expert\.provider,started\}\)/);
  assert.match(source, /p\.provider=String\(p\.provider\|\|'JARVIS'\)/);
});
