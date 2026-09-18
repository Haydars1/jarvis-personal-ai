import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/application/chat/smart-router.js';

test('routes explicit recurring video creation/publishing to video capability', () => {
  assert.equal(classifyIntent('Sen video yapıp düzenli atabilirmisin'), 'video');
  assert.equal(classifyIntent('YouTube için her gün video üret ve paylaş'), 'video');
});

test('does not turn general YouTube discussion into a video action', () => {
  assert.equal(classifyIntent('YouTubedan para kazanmak istiyorum'), 'chat');
  assert.equal(classifyIntent('video hakkında bilgi ver'), 'chat');
});
