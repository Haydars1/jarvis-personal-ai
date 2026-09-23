import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentView = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const ecuView = fs.readFileSync(new URL('../ios/JARVIS/EcuBrainView.swift', import.meta.url), 'utf8');
const ecuApi = fs.readFileSync(new URL('../ios/JARVIS/EcuBrainAPI.swift', import.meta.url), 'utf8');

test('native chat importer uses the universal document picker', () => {
  assert.match(contentView, /UniversalDocumentPicker\(allowsMultipleSelection: true\)/);
  assert.match(contentView, /Dosya \/ BIN \/ PDF/);
});

test('native sidebar exposes ECU Brain like a first-class JARVIS area', () => {
  assert.match(contentView, /showSidebar/);
  assert.match(contentView, /Label\("ECU Brain"/);
  assert.match(contentView, /Yeni ECU dosyası/);
  assert.match(contentView, /EcuBrainView\(\)/);
});

test('ECU Brain uses the same universal picker and calls the ECU analysis endpoint', () => {
  assert.match(ecuView, /UniversalDocumentPicker\(allowsMultipleSelection: false\)/);
  assert.match(ecuApi, /\/api\/ecu\/analyze-file/);
  assert.match(ecuApi, /stage1_proposal/);
});


test('login button remains tappable and delegates empty-password feedback to AppState', () => {
  assert.match(contentView, /Button \{\s*loginPasswordFocused = false\s*Task \{ await state\.login\(\) \}/s);
  assert.match(contentView, /contentShape\(Rectangle\(\)\)/);
  assert.doesNotMatch(contentView, /\.disabled\(!loginCanSubmit\)/);
});


test('ECU native UI exposes Stage1 mutation status and validated MOD download', () => {
  assert.match(ecuView, /Stage1 Çalıştır/);
  assert.match(ecuView, /MOD Dosyasını Hazırla/);
  assert.match(ecuView, /MOD Dosyasını Kaydet \/ Paylaş/);
  assert.match(ecuApi, /\/api\/ecu\/jobs\/.*\/mod/);
  assert.match(ecuApi, /downloadMod\(jobId:/);
});
