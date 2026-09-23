import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('web chat file picker accepts arbitrary file types without accept restrictions', () => {
  assert.match(html, /id="chatFile" type="file" multiple hidden/);
  assert.doesNotMatch(html, /id="chatFile"[^>]*accept=/);
  assert.match(html, /id="file" type="file" multiple/);
});

test('web chat forwards selected files as attachments and supports 50 MB each', () => {
  assert.match(app, /CHAT_ATTACHMENTS/);
  assert.match(app, /50\*1024\*1024/);
  assert.match(app, /attachments=await Promise\.all\(files\.map\(filePayload\)\)/);
  assert.match(app, /JSON\.stringify\(\{text:.*attachments\}\)/s);
});

test('web vault uploader handles multiple selected files', () => {
  assert.match(app, /const files=\[\.\.\.\$\('#file'\)\.files\]\.slice\(0,20\)/);
  assert.match(app, /for\(const f of files\)/);
});
