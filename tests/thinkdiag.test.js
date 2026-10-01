import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseThinkcarTc, summarizeRecording, recordingCsv } from '../public/lib/thinkcar-tc.js';
import { createThinkdiagImport } from '../src/application/ecu/thinkdiag.js';

const fixture = () => new Uint8Array(Buffer.from(readFileSync(new URL('fixtures/thinkcar-subaru.tc.base64', import.meta.url), 'utf8'), 'base64'));
test('real upstream TC sample preserves 203 records, 32 columns, duplicate names and positional units', () => {
  const data = parseThinkcarTc(fixture()); assert.equal(data.record_count, 203); assert.equal(data.parameters.length, 32);
  assert.equal(data.parameters[13].name, data.parameters[14].name); assert.equal(data.parameters[13].unit, 'km/h'); assert.equal(data.parameters[14].unit, 'rpm');
  const rpm = summarizeRecording(data)[12]; assert.equal(rpm.name, 'Engine Speed'); assert.equal(rpm.min, 851); assert.equal(rpm.max, 3762);
  assert.equal(data.records[0][12], '976.00'); assert.equal(data.timing, 'sample-index');
});
test('malformed pointers, strings, indices and oversized records are rejected', () => {
  for (const [offset, value] of [[12, 0xffffffff], [0x118, 0xffffffff]]) { const bytes = fixture(); new DataView(bytes.buffer).setUint32(offset, value, true); assert.throws(() => parseThinkcarTc(bytes), /TC_/); }
  assert.throws(() => parseThinkcarTc(fixture().subarray(0, 200)), /TC_FILE_SIZE/);
  const bytes = fixture(); bytes[0] = 0; assert.throws(() => parseThinkcarTc(bytes), /TC_SIGNATURE/);
  const badIndex = fixture(); new DataView(badIndex.buffer).setUint32(0x348, 0xffffffff, true); assert.throws(() => parseThinkcarTc(badIndex), /TC_STRING_INDEX/);
});
test('CSV retains units and duplicate parameter columns, neutralizes spreadsheet formulas', () => {
  const data = { parameters: [{ column: 0, name: '=cmd', unit: 'rpm' }], records: [['=1+1'], ['-3']] };
  const csv = recordingCsv(data); assert.match(csv, /"'=cmd"/); assert.match(csv, /"'=1\+1"/); assert.match(csv, /"-3"/); assert.match(csv, /"Unit","rpm"/);
});
test('TC imports require a session and invalid imports return a clear 400', async () => {
  let authenticated = false; const core = { fetch: async () => Response.json({ authenticated }) }; const api = createThinkdiagImport(core);
  assert.equal((await api.fetch(new Request('https://test/api/ecu/thinkdiag/profile'), {}, {})).status, 401);
  authenticated = true; const profile = await (await api.fetch(new Request('https://test/api/ecu/thinkdiag/profile'), {}, {})).json(); assert.equal(profile.model, 'THINKDIAG2'); assert.equal(profile.direct_bluetooth, false);
  const invalid = await api.fetch(new Request('https://test/api/ecu/thinkdiag/import', { method: 'POST', body: JSON.stringify({ base64: '!!!' }) }), {}, {}); assert.equal(invalid.status, 400);
});
