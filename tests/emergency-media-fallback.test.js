import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaFallbackIntent, mediaCapabilityFallback } from '../src/application/chat/emergency-fallback.js';

test('YouTube Shorts animation generation is a video action', () => {
  assert.equal(mediaFallbackIntent('Bana çocuk animasyonuyla ilgili youtube shorts atacağım video üret'), 'video');
});

test('video actions never fall back to generic failure text', () => {
  const reply = mediaCapabilityFallback('Bana çocuk animasyonuyla ilgili youtube shorts atacağım video üret');
  assert.match(reply, /video|animasyon/i);
  assert.doesNotMatch(reply, /yanıt üretemedi/i);
});
