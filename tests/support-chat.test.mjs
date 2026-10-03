import test from 'node:test';
import assert from 'node:assert/strict';
import { getContextualGreeting, buildChatContext, chatLauncherMarkup } from '../js/support-chat.mjs';

test('P0299 page gets boost-context greeting', () => {
  const text = getContextualGreeting({faultCode:'P0299'});
  assert.match(text, /Ladedruck|Turbo/);
});

test('vehicle context is attached without exposing undefined fields', () => {
  assert.deepEqual(buildChatContext({pagePath:'/fehlercodes/P0299',faultCode:'P0299',vehicleProfileKey:'vw-passat-b8-crlb'}), {
    pagePath:'/fehlercodes/P0299', faultCode:'P0299', vehicleProfileKey:'vw-passat-b8-crlb'
  });
});

test('launcher markup is German and includes privacy note', () => {
  const html = chatLauncherMarkup({greeting:'Hallo'});
  assert.match(html, /Nachricht/);
  assert.match(html, /Datenschutz|Kontaktdaten/);
  assert.match(html, /6006/);
});
