import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const offlineDb = fs.readFileSync(new URL('../ios/JARVIS/OfflineDtcDatabase.swift', import.meta.url), 'utf8');
const reasoner = fs.readFileSync(new URL('../ios/JARVIS/OfflineDiagnosticReasoner.swift', import.meta.url), 'utf8');
const dtcCatalog = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticDtcCatalog.swift', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../ios/JARVIS/VehicleDiagnosticAI.swift', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../ios/JARVIS/OfflineVehicleDataStore.swift', import.meta.url), 'utf8');
const research = fs.readFileSync(new URL('../ios/JARVIS/VehicleCodingResearchStore.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const csv = fs.readFileSync(new URL('../ios/JARVIS/Resources/obd-trouble-codes.csv', import.meta.url), 'utf8');

test('generic DTC database is bundled into the iOS app for offline lookup', () => {
  assert.ok(csv.length > 100000);
  assert.match(csv, /"P0100"/);
  assert.match(offlineDb, /Bundle\.main\.url/);
  assert.match(dtcCatalog, /OfflineDtcDatabase\.shared\.lookup/);
});

test('DTC explanations are available before optional online AI enrichment', () => {
  assert.match(ai, /OfflineDiagnosticReasoner\.summary/);
  assert.match(reasoner, /Çevrimdışı teşhis/);
  assert.doesNotMatch(ai, /JARVIS teşhis yorumu alınamadı/);
  assert.match(diagnostics, /Çevrimdışı teşhis hazır/);
});

test('manufacturer and coding packs persist locally for later offline sessions', () => {
  assert.match(store, /manufacturer-packs/);
  assert.match(store, /feature-packs/);
  assert.match(store, /loadManufacturerPacks/);
  assert.match(store, /loadFeaturePacks/);
  assert.match(diagnostics, /OfflineVehicleDataStore\.bootstrap/);
});

test('coding research uses local cache when the internet is unavailable', () => {
  assert.match(store, /coding-research/);
  assert.match(research, /loadCodingResearch/);
  assert.match(research, /saveCodingResearch/);
});
