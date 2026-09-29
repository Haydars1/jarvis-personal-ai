import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const family = fs.readFileSync(new URL('../ios/JARVIS/DtcFamilyDiagnosticEngine.swift', import.meta.url), 'utf8');
const planner = fs.readFileSync(new URL('../ios/JARVIS/DtcSignalPlanner.swift', import.meta.url), 'utf8');
const modules = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerModuleDiagnosticEngine.swift', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../ios/JARVIS/DtcFamilyDiagnosticPanel.swift', import.meta.url), 'utf8');
const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const livePanel = fs.readFileSync(new URL('../ios/JARVIS/GenericObdLivePanel.swift', import.meta.url), 'utf8');

test('diagnostic engine covers broad DTC families instead of one P0299 special case', () => {
  for (const token of [
    'fuelMixture','misfire','egrDpf','temperature','electrical',
    'network','transmission','chassis','body','boostAir'
  ]) {
    assert.match(family, new RegExp(token));
  }
  assert.match(family, /P0171/);
  assert.match(family, /P0300/);
  assert.match(family, /P040/);
  assert.match(family, /P2002/);
  assert.match(family, /P0128/);
  assert.match(family, /P07/);
});

test('each DTC family declares relevant live PIDs and the planner filters by ECU support', () => {
  assert.match(family, /requestedPids/);
  assert.match(planner, /supportedPids\.contains/);
  assert.match(planner, /DtcFamilyDiagnosticEngine\.requestedPids/);
  assert.match(bluetooth, /collectDiagnosticSignals/);
  assert.match(bluetooth, /requestGenericRead/);
});

test('manufacturer module DTCs are triaged by actual module role', () => {
  assert.match(modules, /airbag/);
  assert.match(modules, /abs/);
  assert.match(modules, /trans/);
  assert.match(modules, /gateway/);
  assert.match(modules, /body/);
});

test('diagnostics UI shows unified smart diagnosis and every DTC scan gathers evidence', () => {
  assert.match(panel, /Akıllı Arıza Teşhisi/);
  assert.match(diagnostics, /DtcFamilyDiagnosticPanel/);
  assert.match(diagnostics, /currentFamilyAssessments/);
  assert.match(diagnostics, /collectDiagnosticSignals/);
});

test('generic live panel no longer contains a P0299-only diagnostic section', () => {
  assert.doesNotMatch(livePanel, /P0299 sürüş verisi analizi/);
  assert.doesNotMatch(livePanel, /p0299Active/);
});
