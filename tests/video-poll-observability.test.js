import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/application/video/failover.js', import.meta.url), 'utf8');

test('external video polling records provider metrics for success and failure paths', () => {
  assert.match(source, /async function pollWithMetrics\(/);
  assert.match(source, /await metric\(env, `video:\$\{credential\.provider\}:poll`,/);
  assert.match(source, /const result = await pollWithMetrics\(env, credential, meta\)/);
});
