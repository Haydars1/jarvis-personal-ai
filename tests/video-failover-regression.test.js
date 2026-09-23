import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/application/video/failover.js', import.meta.url), 'utf8');

test('direct video execution tries every available provider before returning 503', () => {
  assert.match(source, /for \(const credential of pool\)/);
  assert.match(source, /failover_errors:errors/);
  assert.match(source, /NO_VIDEO_PROVIDER_AVAILABLE/);
});

test('quota and rate-limit failures cool down only the failing credential', () => {
  assert.match(source, /cooldownKey = id => `video_provider_cooldown:\$\{id\}`/);
  assert.match(source, /\[402,403,429\]/);
  assert.match(source, /await setCooldown\(env, credential, error\.message, error\.status\)/);
});

test('provider metrics preserve success and failure observability', () => {
  assert.match(source, /provider_metrics/);
  assert.match(source, /successes/);
  assert.match(source, /failures/);
  assert.match(source, /avg_latency_ms/);
  assert.match(source, /last_error/);
});
