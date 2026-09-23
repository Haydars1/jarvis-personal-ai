import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentView = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const ecuView = fs.readFileSync(new URL('../ios/JARVIS/EcuBrainView.swift', import.meta.url), 'utf8');
const ecuApi = fs.readFileSync(new URL('../ios/JARVIS/EcuBrainAPI.swift', import.meta.url), 'utf8');

test('native chat importer explicitly accepts ECU BIN files', () => {
  assert.match(contentView, /UTType\(filenameExtension: "bin"\) \?\? \.data/);
  assert.match(contentView, /Dosya \/ BIN \/ PDF/);
});

test('native sidebar exposes ECU Brain like a first-class JARVIS area', () => {
  assert.match(contentView, /showSidebar/);
  assert.match(contentView, /Label\("ECU Brain"/);
  assert.match(contentView, /Yeni ECU dosyası/);
  assert.match(contentView, /EcuBrainView\(\)/);
});

test('ECU Brain can import binary files and call the ECU analysis endpoint', () => {
  assert.match(ecuView, /filenameExtension: "bin"/);
  assert.match(ecuApi, /\/api\/ecu\/analyze-file/);
  assert.match(ecuApi, /stage1_proposal/);
});
