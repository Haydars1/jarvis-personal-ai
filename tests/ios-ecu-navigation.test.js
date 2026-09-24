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
  assert.match(contentView, /EcuChatView\(\)/);
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
  assert.match(ecuView, /title: "Stage 1"/);
  assert.match(ecuView, /Seçili İşlemleri Çalıştır/);
  assert.match(ecuView, /api\.runOperation\(fileId: fileId, operation: option\.operation\)/);
  assert.match(ecuView, /api\.runComposite\(/);
  assert.match(ecuView, /MOD Dosyasını Hazırla/);
  assert.match(ecuView, /MOD Dosyasını Kaydet \/ Paylaş/);
  assert.match(ecuApi, /\/api\/ecu\/jobs\/.*\/mod/);
  assert.match(ecuApi, /downloadMod\(jobId:/);
});

test('ECU service selector exposes site-style operation choices', () => {
  assert.match(ecuView, /DTC OFF/);
  assert.match(ecuView, /EGR OFF/);
  assert.match(ecuView, /DPF OFF/);
  assert.match(ecuView, /AdBlue \/ SCR OFF/);
  assert.match(ecuView, /VMAX OFF/);
  assert.match(ecuView, /Start\/Stop OFF/);
  assert.match(ecuView, /Seçili İşlemleri Çalıştır/);
});


test('selected service options map to backend operation identifiers', () => {
  for (const operation of [
    'stage1_proposal',
    'dtc_off_proposal',
    'egr_off_proposal',
    'dpf_off_proposal',
    'adblue_off_proposal',
    'vmax_off_proposal',
    'startstop_off_proposal',
  ]) {
    assert.match(ecuView, new RegExp(operation));
  }
  assert.match(ecuApi, /func runOperation\(fileId: String, operation: String\)/);
});


test('ECU research UI shows GitHub coverage and manual trigger', () => {
  assert.match(ecuView, /Araştırma \/ GitHub/);
  assert.match(ecuView, /Şimdi İnternet \+ GitHub Araştır/);
  assert.match(ecuView, /github_sources/);
  assert.match(ecuView, /api\.runResearch\(\)/);
  assert.match(ecuApi, /\/api\/ecu\/research\/run/);
  assert.match(ecuApi, /func researchStatus\(\)/);
});


test('multi-selection creates one composite MOD job', () => {
  assert.match(ecuApi, /func runComposite\(fileId: String, operations: \[String\]\)/);
  assert.match(ecuApi, /\/api\/ecu\/jobs\/composite/);
  assert.match(ecuView, /selected\.count == 1/);
  assert.match(ecuView, /operations: selected\.map\(\\\.operation\)/);
  assert.match(ecuView, /Tek MOD işi oluşturuldu/);
});


test('ECU sidebar opens dedicated ECU chat channel',()=>{const s=fs.readFileSync(new URL('../ios/JARVIS/EcuChatView.swift',import.meta.url),'utf8');const a=fs.readFileSync(new URL('../ios/JARVIS/JarvisAPI.swift',import.meta.url),'utf8');assert.match(contentView,/EcuChatView\(\)/);assert.match(s,/ECU Brain Sohbeti/);assert.match(s,/channel:"ecu"/);assert.match(a,/payload\["channel"\] = channel/);});
