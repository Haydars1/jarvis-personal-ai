import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/application/chat/attachments.js', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../src/app-entry.js', import.meta.url), 'utf8');

test('chat attachment ingress decodes, hashes, stores and forwards internal attachment context', () => {
  assert.match(source, /decodeBase64/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source, /env\.FILES\.put/);
  assert.match(source, /JARVIS_ATTACHMENT_CONTEXT/);
  assert.match(source, /attachmentContext/);
  assert.match(source, /attachmentMeta/);
  assert.doesNotMatch(source, /text:\s*`\$\{text\}\\n\\n\$\{attachmentContext\}/);
  assert.match(entry, /prepareChatAttachments/);
  assert.match(entry, /handleChat\(prepared\.request/);
});

test('binary comparison reports byte-level ranges when two files are attached', () => {
  assert.match(source, /function binaryDiff/);
  assert.match(source, /changedBytes/);
  assert.match(source, /changedPercent/);
  assert.match(source, /İlk değişim aralıkları/);
});

test('single-file compare request explicitly reports that an ORI or previous version is required', () => {
  assert.match(source, /Yalnızca tek dosya eklendi/);
  assert.match(source, /referans\/ORI\/eski sürüm/);
});


test('binary compare requests produce deterministic clean replies instead of depending on an AI provider', () => {
  assert.match(source, /attachmentDirectReply/);
  assert.match(source, /İki dosyayı gerçekten aldım ve byte-byte karşılaştırdım/);
  assert.match(source, /Bu tek dosyadan “hangi byte değişmiş” kesin olarak çıkarılamaz/);
});
