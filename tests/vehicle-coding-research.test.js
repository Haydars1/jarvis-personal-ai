import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../src/application/vehicle/coding-research.js', import.meta.url), 'utf8');
const appEntry = fs.readFileSync(new URL('../src/app-entry.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../ios/JARVIS/JarvisAPI.swift', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../ios/JARVIS/VehicleCodingResearchStore.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');

test('all-brand research runtime covers major coding ecosystems', () => {
  for (const token of [
    'bmw-mini','mercedes','ford-mazda','toyota-lexus','hyundai-kia',
    'renault-dacia','psa-stellantis','volvo','honda','nissan','mitsubishi','jlr','gm'
  ]) {
    assert.match(runtime, new RegExp(token));
  }
});

test('research runtime uses paged Google and GitHub searches and persists candidates', () => {
  assert.match(runtime, /for \(let page = 0;/);
  assert.match(runtime, /for \(let page = 1;/);
  assert.match(runtime, /per_page', '30'/);
  assert.match(runtime, /vehicle_coding_research:/);
  assert.match(runtime, /status:'research_only'/);
});

test('research API exposes status catalog brand sync and sync-all routes', () => {
  assert.match(runtime, /\/api\/vehicle\/coding-research\/status/);
  assert.match(runtime, /\/api\/vehicle\/coding-research\/catalog/);
  assert.match(runtime, /\/api\/vehicle\/coding-research\/sync'/);
  assert.match(runtime, /\/api\/vehicle\/coding-research\/sync-all/);
  assert.match(appEntry, /createVehicleCodingResearch/);
});

test('iOS automatically syncs and caches coding research for the connected brand', () => {
  assert.match(api, /syncVehicleCodingResearch/);
  assert.match(api, /vehicleCodingResearchCatalog/);
  assert.match(store, /func sync\(brand: VehicleBrand/);
  assert.match(diagnostics, /Kodlama Araştırması/);
  assert.match(diagnostics, /Katalog otomatik güncellenir|Yerel katalog kullanılıyor/);
  assert.match(diagnostics, /onChange\(of: effectiveBrand\)/);
  assert.doesNotMatch(diagnostics, /İnternetten araştır \/ güncelle/);
});

test('research candidates are not directly treated as executable writes', () => {
  assert.match(runtime, /research_only/);
  assert.match(diagnostics, /exact eşleşme doğrulanmadan yazma butonu açılmaz/);
});
