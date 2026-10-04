import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/integrations-ui.js', import.meta.url), 'utf8');

test('web integration hub exposes free catalog filters and truthful Turkish state labels', () => {
  assert.match(source, /Ücretsiz Entegrasyonlar/);
  assert.match(source, /\/api\/integrations\/catalog/);
  for (const team of ['Build','Design','Growth','Operations','Scale']) assert.match(source, new RegExp(team));
  for (const label of ['Aktif','Bağlantı gerekli','Ücretsiz \/ adapter bekliyor','Sadece kaynak','Ücretli \/ hariç','Kullanılamıyor']) assert.match(source, new RegExp(label));
});

test('paid and excluded cards never render an activation action', () => {
  assert.match(source, /runtimeState === 'excluded'/);
  assert.match(source, /pricing === 'paid'/);
  assert.match(source, /canRun/);
  assert.match(source, /autoExecutable/);
});

test('existing account connection cards remain in the same hub', () => {
  for (const name of ['Google','YouTube','Facebook','Instagram']) assert.match(source, new RegExp(`>${name}<`));
  assert.match(source, /metaSetupBox/);
  assert.match(source, /googleAction/);
});
