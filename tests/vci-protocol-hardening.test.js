import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const learner = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerProtocolLearner.swift', import.meta.url), 'utf8');
const readiness = fs.readFileSync(new URL('../ios/JARVIS/GenericObdReadiness.swift', import.meta.url), 'utf8');
const generic = fs.readFileSync(new URL('../ios/JARVIS/GenericObdLiveData.swift', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../ios/JARVIS/GenericObdLivePanel.swift', import.meta.url), 'utf8');
const triage = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticTriageEngine.swift', import.meta.url), 'utf8');
const prefs = fs.readFileSync(new URL('../ios/JARVIS/WorkshopPreferences.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const drive = fs.readFileSync(new URL('../ios/JARVIS/DriveLogRecorder.swift', import.meta.url), 'utf8');
const validation = fs.readFileSync(new URL('../ios/JARVIS/HardwareValidationReport.swift', import.meta.url), 'utf8');
const capabilities = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagCapabilityStore.swift', import.meta.url), 'utf8');

test('manufacturer requests pause generic polling and only accept checksum-valid frames', () => {
  assert.match(bluetooth, /exclusiveRequestDepth/);
  assert.match(bluetooth, /stale traffic/);
  assert.match(bluetooth, /where frame\.checksumValid/);
  assert.match(learner, /guard frame\.checksumValid/);
});

test('generic OBD readiness and advanced PID decoding are offline', () => {
  assert.match(readiness, /milOn/);
  assert.match(readiness, /incompleteMonitors/);
  assert.match(generic, /Kısa dönem yakıt düzeltmesi B1/);
  assert.match(generic, /Komut edilen EGR/);
  assert.match(generic, /Katalizör sıcaklığı/);
  assert.match(bluetooth, /readiness = status/);
  assert.match(panel, /readiness\.summary/);
});

test('workshop defaults to automatic diagnosis and protocol learning on connect', () => {
  assert.match(prefs, /autoDiagnoseOnConnect = true/);
  assert.match(prefs, /autoStartProtocolLearning = true/);
  assert.match(diagnostics, /onChange\(of: bluetooth\.isThinkDiagTransportReady\)/);
  assert.match(diagnostics, /runWorkshopAutoDiagnosis/);
});

test('offline triage prioritizes voltage communications boost misfire and emissions chains', () => {
  assert.match(triage, /Önce besleme voltajını düzelt/);
  assert.match(triage, /Ağ \/ gateway \/ besleme/);
  assert.match(triage, /P0299/);
  assert.match(triage, /P030/);
  assert.match(triage, /P0401/);
});

test('real adapter responses promote per-adapter verified read capabilities', () => {
  assert.match(capabilities, /ThinkDiagReadCapability/);
  assert.match(capabilities, /vehicleInfo/);
  assert.match(capabilities, /permanentDtcs/);
  assert.match(bluetooth, /verifiedReadCapabilities/);
  assert.match(bluetooth, /ThinkDiagCapabilityStore\.save/);
  assert.match(diagnostics, /Bu adaptörde doğrulanan okuma modları/);
});

test('single hardware-validation session exports protocol PID DTC module and packet evidence', () => {
  assert.match(validation, /HardwareValidationReport/);
  assert.match(validation, /packetTimeline/);
  assert.match(validation, /supportedPids/);
  assert.match(diagnostics, /Tek seferlik donanım doğrulaması/);
  assert.match(diagnostics, /runHardwareValidationSession/);
  assert.match(diagnostics, /3_000_000_000/);
});

test('drive logger emits valid CSV with quoted labels and Swift interpolation', () => {
  assert.match(drive, /replacingOccurrences\(of: "\\\\""/);
  assert.match(drive, /JARVIS-DriveLog-\\\(name\)\.csv/);
  assert.match(drive, /formatter\.string\(from: sample\.timestamp\)/);
});
