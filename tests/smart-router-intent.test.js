import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyIntent } from '../src/application/chat/smart-router.js';

test('routes explicit recurring video creation/publishing to video capability', () => {
  assert.equal(classifyIntent('Sen video yapıp düzenli atabilirmisin'), 'video');
  assert.equal(classifyIntent('YouTube için her gün video üret ve paylaş'), 'video');
});

test('does not turn general YouTube discussion into a video action', () => {
  assert.equal(classifyIntent('YouTubedan para kazanmak istiyorum'), 'chat');
  assert.equal(classifyIntent('video hakkında bilgi ver'), 'chat');
});

test('keeps short follow-up commands attached to recent video context', async () => {
  const source = await readFile(new URL('../src/application/chat/smart-router.js', import.meta.url), 'utf8');
  assert.match(source, /mediaContextIntent\(text, priorHistory\)/);
  assert.match(source, /yaşında\|gerisini sen\|kendin ayarla/);
  assert.match(source, /Önceki konuşma bağlamı/);
  assert.match(source, /Eksik yaratıcı ayrıntıları kullanıcıdan tekrar istemeden/);
});
