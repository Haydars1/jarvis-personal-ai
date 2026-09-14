import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Meta page tokens are encrypted before KV persistence', () => {
  const source = read('src/application/integrations/hub.js');
  assert.match(source, /storeMetaPages/);
  assert.match(source, /encryptCredential\(env, JSON\.stringify\(\{ pages: safe \}\)\)/);
  assert.match(source, /value\?\.blob/);
  assert.match(source, /decryptCredential\(env, value\.blob\)/);
  assert.doesNotMatch(source, /kvSet\(env, 'meta_pages', \{ pages:/);
});

test('Higgsfield provider uses shared encrypted credentials and bounded fetches', () => {
  const source = read('src/application/providers/higgsfield.js');
  assert.match(source, /encryptCredential/);
  assert.match(source, /decryptCredential/);
  assert.match(source, /fetchWithTimeout/);
  assert.doesNotMatch(source, /async function masterKey/);
});
