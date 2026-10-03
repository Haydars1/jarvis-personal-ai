import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportPrompt, createSafeFallbackReply } from '../js/ai-support.mjs';

test('prompt contains vehicle and fault context and forbids definitive diagnosis', () => {
  const prompt = buildSupportPrompt({ faultCode:'P0299', vehicleLabel:'VW Passat B8 2.0 TDI CRLB', pagePath:'/fehlercodes/P0299' });
  assert.match(prompt, /P0299/);
  assert.match(prompt, /VW Passat B8/);
  assert.match(prompt, /nicht als sicher defekt/);
});

test('fallback reply is German and requests symptoms rather than claiming broken part', () => {
  const text = createSafeFallbackReply({ faultCode:'P0299', vehicleLabel:'VW Passat B8' });
  assert.match(text, /P0299/);
  assert.match(text, /Symptom/i);
  assert.doesNotMatch(text, /ist defekt/i);
});

test('AdBlue context uses SCR wording', () => {
  const text = createSafeFallbackReply({ faultCode:'ADBLUE', vehicleLabel:'Mercedes W213' });
  assert.match(text, /AdBlue|SCR/);
});
