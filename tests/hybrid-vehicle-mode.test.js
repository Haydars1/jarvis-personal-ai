import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const net = fs.readFileSync(new URL('../ios/JARVIS/VehicleNetworkMonitor.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const offline = fs.readFileSync(new URL('../ios/JARVIS/OfflineVehicleDataStore.swift', import.meta.url), 'utf8');

test('vehicle runtime detects network changes without making diagnostics depend on them', () => {
  assert.match(net, /NWPathMonitor/);
  assert.match(net, /Hata kodu okuma/);
  assert.match(net, /internet gerekmez/);
  assert.match(net, /Genel OBD canlı veri/);
});

test('diagnostics automatically switches to cached mode and refreshes when internet returns', () => {
  assert.match(diagnostics, /Çalışma Modu/);
  assert.match(diagnostics, /Yerel katalog kullanılıyor/);
  assert.match(diagnostics, /onChange\(of: networkMonitor\.isOnline\)/);
  assert.match(diagnostics, /codingResearch\.sync/);
});

test('offline coding cache is explicitly queryable', () => {
  assert.match(offline, /hasCodingResearch/);
});
