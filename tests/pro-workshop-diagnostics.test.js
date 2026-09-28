import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const safety = fs.readFileSync(new URL('../ios/JARVIS/VehicleWriteSafetyGate.swift', import.meta.url), 'utf8');
const sessions = fs.readFileSync(new URL('../ios/JARVIS/WorkshopSessionStore.swift', import.meta.url), 'utf8');
const backups = fs.readFileSync(new URL('../ios/JARVIS/CodingBackupVault.swift', import.meta.url), 'utf8');
const favorites = fs.readFileSync(new URL('../ios/JARVIS/CodingFavoritesStore.swift', import.meta.url), 'utf8');
const comparison = fs.readFileSync(new URL('../ios/JARVIS/WorkshopComparisonEngine.swift', import.meta.url), 'utf8');
const packetEvent = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagPacketEvent.swift', import.meta.url), 'utf8');
const triage = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticTriageEngine.swift', import.meta.url), 'utf8');
const prefs = fs.readFileSync(new URL('../ios/JARVIS/WorkshopPreferences.swift', import.meta.url), 'utf8');
const learner = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerProtocolLearner.swift', import.meta.url), 'utf8');

test('professional workshop flow can run a one-touch diagnostic and save a report', () => {
  assert.match(diagnostics, /Atölye Hızlı İşlemler/);
  assert.match(diagnostics, /Tek tuş tam teşhis/);
  assert.match(diagnostics, /runWorkshopAutoDiagnosis/);
  assert.match(diagnostics, /scanGenericDtcStates/);
  assert.match(diagnostics, /moduleScanner\.scan/);
  assert.match(diagnostics, /WorkshopSessionRecord/);
  assert.match(sessions, /JARVIS ARAÇ TEŞHİS RAPORU/);
});

test('coding writes are gated by a local voltage preflight', () => {
  assert.match(safety, /PID 0x42/);
  assert.match(safety, /11\.8/);
  assert.match(safety, /12\.2/);
  assert.match(diagnostics, /Kodlama ön kontrolü/);
  assert.match(diagnostics, /vehicleWriteSafety\.canWrite/);
});

test('coding backups persist by VIN and favorites improve workshop speed', () => {
  assert.match(backups, /coding-backups\.json/);
  assert.match(backups, /func backups\(for vin/);
  assert.match(diagnostics, /Kodlama Yedekleri/);
  assert.match(favorites, /UserDefaults/);
  assert.match(diagnostics, /Özellik ara: ayna, kilit, ışık/);
  assert.match(diagnostics, /star\.fill/);
});

test('workshop history highlights new resolved and persistent DTCs', () => {
  assert.match(comparison, /newCodes/);
  assert.match(comparison, /resolvedCodes/);
  assert.match(comparison, /persistentCodes/);
  assert.match(diagnostics, /Önceki taramayla karşılaştır/);
});

test('ThinkDiag transport logs timestamped RX TX packets and write limits', () => {
  assert.match(packetEvent, /ThinkDiagPacketDirection/);
  assert.match(bluetooth, /packetEvents/);
  assert.match(bluetooth, /maxWriteWithResponse/);
  assert.match(bluetooth, /writeCharacteristicScore/);
  assert.match(bluetooth, /notifyCharacteristicScore/);
});

test('workshop can auto-run on adapter connect and prioritize likely root causes offline', () => {
  assert.match(prefs, /autoDiagnoseOnConnect/);
  assert.match(prefs, /autoStartProtocolLearning/);
  assert.match(diagnostics, /ThinkDiag bağlanınca otomatik tam teşhis/);
  assert.match(diagnostics, /Arıza Öncelik Sırası/);
  assert.match(triage, /P0299/);
  assert.match(triage, /P0401/);
  assert.match(triage, /P030/);
});

test('manufacturer learning ignores checksum-invalid traffic and request path pauses generic polling', () => {
  assert.match(learner, /guard frame\.checksumValid/);
  assert.match(bluetooth, /exclusiveRequestDepth/);
  assert.match(bluetooth, /stale traffic/);
});

test('ThinkDiag remembers the last adapter and reconnects automatically', () => {
  assert.match(bluetooth, /lastPeripheralKey/);
  assert.match(bluetooth, /reconnectLastDevice/);
  assert.match(bluetooth, /retrievePeripherals/);
  assert.match(bluetooth, /autoReconnectEnabled/);
});

test('protocol header is persisted only after repeated checksum-valid Mode 03 evidence', () => {
  assert.match(bluetooth, /confirmations >= 2/);
  assert.match(bluetooth, /frame\.checksumValid/);
  assert.match(bluetooth, /frame\.header == header/);
  assert.match(bluetooth, /isStructurallyValidMode03/);
  assert.doesNotMatch(bluetooth, /frame\.payload\.contains\(0x43\)/);
});
