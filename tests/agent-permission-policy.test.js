import test from 'node:test';
import assert from 'node:assert/strict';
import { decideAgentAction } from '../src/application/agent/permission-policy.js';

test('read-only actions run without confirmation', () => {
  assert.deepEqual(decideAgentAction({ name: 'search_web' }), { allowed: true, confirmation: false, reason: 'read_only' });
});

test('authorized normal effects can run without repeatedly asking', () => {
  assert.equal(decideAgentAction({ name: 'publish_video', capability: 'youtube_publish' }, { authorizedCapabilities: ['youtube_publish'] }).allowed, true);
});

test('high-risk effects still require explicit confirmation', () => {
  const result = decideAgentAction({ name: 'pay_invoice', capability: 'payments' }, { authorizedCapabilities: ['payments'] });
  assert.equal(result.allowed, false);
  assert.equal(result.confirmation, true);
});

test('unknown effectful capabilities fail closed', () => {
  const result = decideAgentAction({ name: 'send_email', capability: 'gmail_send' });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'capability_not_authorized');
});
