import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const attachment = fs.readFileSync(new URL('../ios/JARVIS/NativeAttachment.swift', import.meta.url), 'utf8');

test('native iOS file importer accepts arbitrary files including ECU BIN', () => {
  assert.match(source, /allowedContentTypes:\s*\[\.item\]/);
  assert.match(source, /Dosya \/ BIN \/ PDF/);
});

test('native attachment falls back to binary MIME and keeps ECU-sized files under limit', () => {
  assert.match(attachment, /application\/octet-stream/);
  assert.match(attachment, /10 \* 1024 \* 1024/);
});
