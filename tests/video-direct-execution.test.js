import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('video pool run accepts a direct prompt and executes an available provider', async () => {
  const source = await readFile(new URL('../src/application/video/failover.js', import.meta.url), 'utf8');
  assert.match(source, /async function runDirectVideo/);
  assert.match(source, /readJson\(req/);
  assert.match(source, /startWithProvider\(env, credential, prompt\)/);
  assert.match(source, /path === '\/api\/video-pool\/run'[\s\S]*runDirectVideo\(req, env\)/);
});

test('direct video execution preserves provider failover and cooldown filtering', async () => {
  const source = await readFile(new URL('../src/application/video/failover.js', import.meta.url), 'utf8');
  assert.match(source, /runDirectVideo[\s\S]*providers\(env\)/);
  assert.match(source, /runDirectVideo[\s\S]*!credential\.cooldown/);
  assert.match(source, /runDirectVideo[\s\S]*for \(const credential of pool\)/);
});
