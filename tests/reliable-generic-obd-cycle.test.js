import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const passive = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagPassiveDecoder.swift', import.meta.url), 'utf8');

test('generic OBD reads correlate replies by positive response mode and PID', () => {
  assert.match(bluetooth, /requestGenericRead/);
  assert.match(bluetooth, /responseMode: UInt8/);
  assert.match(bluetooth, /responsePid: UInt8\?/);
  assert.match(bluetooth, /frame\.checksumValid && frame\.header == profile\.header/);
  assert.match(bluetooth, /bytes\[index \+ 1\] == responsePid/);
});

test('capability discovery waits for actual Mode 01 02 and 09 replies instead of fixed sleeps', () => {
  assert.match(bluetooth, /responseMode: 0x41/);
  assert.match(bluetooth, /responseMode: 0x42/);
  assert.match(bluetooth, /responseMode: 0x49/);
  assert.match(bluetooth, /responsePid: 0x02/);
});

test('each DTC scan cycle removes stale stored pending and permanent observations first', () => {
  assert.match(bluetooth, /genericDtcCycleStartedAt = Date\(\)/);
  assert.match(bluetooth, /passiveObservations\.removeAll/);
  assert.match(bluetooth, /\$0\.kind == "DTC"/);
  assert.match(bluetooth, /responseMode: 0x43/);
  assert.match(bluetooth, /responseMode: 0x47/);
  assert.match(bluetooth, /responseMode: 0x4A/);
});

test('passive observations carry timestamps for scan-cycle auditing', () => {
  assert.match(passive, /let timestamp = Date\(\)/);
});
