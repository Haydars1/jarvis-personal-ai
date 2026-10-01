import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDiagnosticReport } from '../public/lib/diagnostic-report.js';
test('diagnostic report extracts all P/B/C/U codes with contexts and manufacturer subtypes', () => {
  const result = analyzeDiagnosticReport('Engine\nP0299 Turbo underboost\nP0401 EGR flow\nBCM\nB138F4B Heater\nABS\nC0035 wheel\nGateway\nU0100 lost communication\nP0299 intermittent');
  assert.equal(result.code_count, 5); assert.equal(result.codes.find(row => row.code === 'P0299').occurrences, 2); assert.equal(result.codes.find(row => row.code === 'B138F').subtype, '4B');
  assert.throws(() => analyzeDiagnosticReport('x'.repeat(200001)), /SIZE/);
});
