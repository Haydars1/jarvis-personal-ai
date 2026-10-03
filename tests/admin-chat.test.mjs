import test from 'node:test';
import assert from 'node:assert/strict';
import { adminConversationCard, adminChatMarkup } from '../js/admin-chat.mjs';

test('conversation card shows vehicle, fault and human status', () => {
  const html=adminConversationCard({id:'c1',faultCode:'P0299',vehicleLabel:'VW Passat B8',status:'human_active',unread:2});
  assert.match(html,/P0299/); assert.match(html,/VW Passat B8/); assert.match(html,/Übernommen/); assert.match(html,/2/);
});

test('admin view exposes takeover and release controls', () => {
  const html=adminChatMarkup({id:'c1',faultCode:'P0299',vehicleLabel:'BMW G20',status:'ai_active'});
  assert.match(html,/Chat übernehmen/); assert.match(html,/AI wieder aktivieren/); assert.match(html,/Fahrzeugkontext/);
});
