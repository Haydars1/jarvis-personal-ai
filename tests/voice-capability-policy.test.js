import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceCapabilityPolicy } from '../src/application/capabilities/voice-policy.js';

test('native voice supports interruption and automatic fallback', () => {
  const policy = voiceCapabilityPolicy({ nativeSpeech: true, cloudTts: false, cloudStt: false });
  assert.equal(policy.bargeIn, true);
  assert.equal(policy.tts, 'native');
  assert.equal(policy.stt, 'native');
});

test('cloud speech upgrades native engines when healthy', () => {
  const policy = voiceCapabilityPolicy({ nativeSpeech: true, cloudTts: true, cloudStt: true });
  assert.equal(policy.tts, 'cloud');
  assert.equal(policy.stt, 'cloud');
  assert.equal(policy.fallbackTts, 'native');
  assert.equal(policy.fallbackStt, 'native');
});
