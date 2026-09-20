import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('JARVIS ECU runtime uses the same compute dispatch instance for routing status', () => {
  const source = fs.readFileSync(new URL('../src/app-entry.js', import.meta.url), 'utf8');
  assert.match(source, /createComputeDispatch/);
  assert.match(source, /const ecuComputeDispatch\s*=\s*createComputeDispatch\(\)/);
  assert.match(source, /createEcuRuntime\(capabilityCore,\s*\{[\s\S]*computeDispatch:\s*ecuComputeDispatch[\s\S]*computeStatus:\s*env\s*=>\s*ecuComputeDispatch\.getRoutingStatus\(env\)/);
});
