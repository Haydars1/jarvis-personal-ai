import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentView = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const importer = fs.readFileSync(new URL('../ios/JARVIS/ThinkCarImport.swift', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../ios/project.yml', import.meta.url), 'utf8');
const vciFrame = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagVciFrame.swift', import.meta.url), 'utf8');
const assembler = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagFrameAssembler.swift', import.meta.url), 'utf8');
const passive = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagPassiveDecoder.swift', import.meta.url), 'utf8');
const analyzer = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagProtocolAnalyzer.swift', import.meta.url), 'utf8');

test('native sidebar exposes vehicle diagnostics workspace', () => {
  assert.match(contentView, /Label\("Araç Teşhis"/);
  assert.match(contentView, /DiagnosticView\(\)/);
});

test('diagnostics workspace can scan and connect Bluetooth OBD devices', () => {
  assert.match(diagnostics, /Bluetooth Tara/);
  assert.match(bluetooth, /CBCentralManager/);
  assert.match(bluetooth, /discoverServices\(nil\)/);
  assert.match(bluetooth, /setNotifyValue\(true/);
});

test('ThinkCar exports can be imported for DTC and live-data extraction', () => {
  assert.match(diagnostics, /Rapor veya canlı veri dosyası içe aktar/);
  assert.match(importer, /\\b\[PCBU\]/);
  assert.match(importer, /Turbo basıncı/);
  assert.match(importer, /DPF diferansiyel basınç/);
  assert.match(importer, /LSX8/);
  assert.match(importer, /parseTCStrings/);
});

test('ThinkDiag transport fingerprints Launch BLE services and decodes VCI frames', () => {
  assert.match(bluetooth, /preferredServiceDetected/);
  assert.match(bluetooth, /ThinkDiagVciFrame\.decode/);
  assert.match(vciFrame, /0000FFF0-0000-1000-8000-00805F9B34FB/);
  assert.match(vciFrame, /49535343-FE7D-4AE5-8FA9-9FAFD205E455/);
  assert.match(vciFrame, /checksumValid/);
});

test('ThinkDiag stream assembler handles fragmented notifications', () => {
  assert.match(assembler, /append\(_ chunk: Data\)/);
  assert.match(assembler, /payloadLength/);
  assert.match(assembler, /checksumValid/);
  assert.match(bluetooth, /assembler\.append\(data\)/);
});

test('passive decoder recognizes standard read-only OBD responses', () => {
  assert.match(passive, /case 0x41/);
  assert.match(passive, /case 0x43/);
  assert.match(passive, /case 0x47/);
  assert.match(passive, /case 0x49/);
  assert.match(passive, /Motor devri/);
  assert.match(passive, /Manifold basıncı/);
  assert.match(bluetooth, /passiveObservations/);
});

test('captured frames are fingerprinted without sending vehicle commands', () => {
  assert.match(analyzer, /dominantHeader/);
  assert.match(analyzer, /checksumValidCount/);
  assert.match(diagnostics, /protocolFingerprint\.summary/);
});

test('iOS declares Bluetooth privacy usage descriptions', () => {
  assert.match(project, /NSBluetoothAlwaysUsageDescription/);
  assert.match(project, /NSBluetoothPeripheralUsageDescription/);
});
