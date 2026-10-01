import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntelHex, validateDefinition, readMap, writeMapCell } from '../public/lib/calibration.js';
const hash = 'a'.repeat(64);
const definition = () => ({ version: 1, original_sha256: hash, maps: [{ id: 'demo', name: 'Demo', type: 'u16', endian: 'le', address: 0, rows: 1, columns: 2, factor: 0.5, offset: 0, min: 0, max: 300 }] });
test('named calibration maps require exact original hash and explicit limits', () => {
  assert.throws(() => validateDefinition(definition(), 4, 'b'.repeat(64)), /HASH/);
  const bad = definition(); bad.maps[0].address = 3; assert.throws(() => validateDefinition(bad, 4, hash), /LAYOUT/);
  const limitless = definition(); delete limitless.maps[0].min; assert.throws(() => validateDefinition(limitless, 4, hash), /LIMITS/);
});
test('calibration writes preserve original bytes, endian and scale, refuse wrapping and imprecise values', () => {
  const data = new Uint8Array([100, 0, 200, 0]); const map = validateDefinition(definition(), 4, hash).maps[0];
  assert.deepEqual(readMap(data, map), [50, 100]); const result = writeMapCell(data, map, 1, 125);
  assert.deepEqual([...data], [100, 0, 200, 0]); assert.deepEqual([...result], [100, 0, 250, 0]);
  assert.throws(() => writeMapCell(data, map, 0, 0.1), /REPRESENTABLE/); assert.throws(() => writeMapCell(data, map, 0, 301), /OUT_OF_RANGE/);
  const be = { ...map, endian: 'be' }; assert.deepEqual(readMap(new Uint8Array([0, 100, 0, 200]), be), [50, 100]);
});
test('Intel HEX checks record checksum, extended addresses, EOF and overlapping regions', () => {
  const parsed = parseIntelHex(':020000040001F9\n:0400100001020304E2\n:00000001FF');
  assert.equal(parsed.base_address, 0x10010); assert.deepEqual([...parsed.bytes], [1, 2, 3, 4]);
  assert.throws(() => parseIntelHex(':0400100001020304E3\n:00000001FF'), /CHECKSUM/);
  assert.throws(() => parseIntelHex(':0400100001020304E2'), /INCOMPLETE/);
  assert.throws(() => parseIntelHex(':0400100001020304E2\n:0400100001020304E2\n:00000001FF'), /OVERLAP/);
});
