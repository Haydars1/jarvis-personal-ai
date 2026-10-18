import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAudience } from '../src/lib/synthetic-simulation.js';
const input = { idea: 'Car diagnostic website', personas: [{ name: 'Driver', skepticism: 0.2 }, { name: 'Mechanic', skepticism: 0.8 }], rounds: 3, seed: 'demo' };
test('deterministic, multi-round and explicitly synthetic', () => {
  const a = simulateAudience(input);
  assert.deepEqual(a, simulateAudience(input));
  assert.equal(a.history.length, 3);
  assert.equal(a.kind, 'synthetic_simulation');
  assert.equal(a.history[0].decisions.length, 2);
});
test('rejects invalid inputs', () => {
  assert.throws(() => simulateAudience({ ...input, rounds: 21 }));
  assert.throws(() => simulateAudience({ ...input, personas: [] }));
  assert.throws(() => simulateAudience({ ...input, personas: [{ name: 'x', skepticism: 2 }] }));
});
