import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile = fs.readFileSync(new URL('../ios/JARVIS/VehicleProfileCache.swift', import.meta.url), 'utf8');
const prefetch = fs.readFileSync(new URL('../ios/JARVIS/OfflineCatalogPrefetcher.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');

test('VIN profiles persist module part software platform and equipment identities', () => {
  assert.match(profile, /vehicle-profiles\.json/);
  assert.match(profile, /CachedVehicleProfile/);
  assert.match(profile, /partNumber/);
  assert.match(profile, /softwareVersion/);
  assert.match(profile, /equipmentTokens/);
  assert.match(diagnostics, /vehicleProfiles\.profile\(for: detectedVIN\)/);
  assert.match(diagnostics, /saveCurrentVehicleProfile/);
});

test('coding applicability falls back to cached vehicle identity when no live module scan exists', () => {
  assert.match(diagnostics, /if liveIdentities\.isEmpty, let cached/);
  assert.match(diagnostics, /cached\.modules\.map/);
  assert.match(diagnostics, /cached\?\.equipmentTokens/);
  assert.match(diagnostics, /inferredModelName \?\? cached\?\.modelName/);
});

test('all-brand catalogs are prefetched online and counted locally offline', () => {
  assert.match(prefetch, /for brand in VehicleBrand\.allCases where brand != \.generic/);
  assert.match(prefetch, /vehicleCodingResearchCatalog/);
  assert.match(prefetch, /saveCodingResearch/);
  assert.match(prefetch, /refreshCacheCount/);
  assert.match(diagnostics, /Offline katalog/);
  assert.match(diagnostics, /offlinePrefetch\.refreshIfNeeded/);
  assert.match(diagnostics, /offlinePrefetch\.refreshCacheCount/);
});

test('catalog prefetch does not need a manual per-car update operation', () => {
  assert.match(diagnostics, /onChange\(of: networkMonitor\.isOnline\)/);
  assert.doesNotMatch(diagnostics, /İnternetten araştır \/ güncelle/);
});
