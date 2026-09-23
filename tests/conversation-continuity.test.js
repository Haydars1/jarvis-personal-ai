import test from 'node:test';
import assert from 'node:assert/strict';
import { recentConversationContext } from '../src/application/chat/continuity.js';

test('conversation continuity keeps only recent bounded user/assistant turns', () => {
  const history = [
    { role: 'system', content: 'ignore system' },
    { role: 'user', content: 'first question' },
    { role: 'assistant', content: 'first answer' },
    { role: 'user', content: 'second question' },
    { role: 'assistant', content: 'second answer' },
    { role: 'tool', content: 'ignore tool' },
    { role: 'user', content: 'latest question' },
  ];
  const context = recentConversationContext(history, { maxTurns: 2, maxChars: 200 });
  assert.doesNotMatch(context, /first question|first answer|ignore system|ignore tool/);
  assert.match(context, /Kullanıcı: second question/);
  assert.match(context, /JARVIS: second answer/);
  assert.match(context, /Kullanıcı: latest question/);
});

test('conversation continuity strips empty and oversized content without throwing', () => {
  const context = recentConversationContext([
    { role: 'user', content: '' },
    { role: 'assistant', content: 'x'.repeat(5000) },
  ], { maxTurns: 4, maxChars: 120 });
  assert.ok(context.length <= 120);
  assert.match(context, /^JARVIS: /);
});
