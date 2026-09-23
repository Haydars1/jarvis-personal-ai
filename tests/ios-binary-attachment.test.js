import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const attachment = fs.readFileSync(new URL('../ios/JARVIS/NativeAttachment.swift', import.meta.url), 'utf8');

test('native iOS file importer accepts arbitrary files including ECU BIN with direct single-select flow', () => {
  const source = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
  assert.match(source, /allowedContentTypes:\s*\[UTType\(filenameExtension: "bin"\)/);
  assert.match(source, /allowsMultipleSelection:\s*false/);
  assert.match(source, /Dosya \/ BIN \/ PDF/);
  assert.match(source, /Dosya eklendi:/);
});

test('native attachment coordinates iCloud/Files reads and falls back to binary MIME', () => {
  assert.match(attachment, /NSFileCoordinator/);
  assert.match(attachment, /mappedIfSafe/);
  assert.match(attachment, /application\/octet-stream/);
  assert.match(attachment, /10 \* 1024 \* 1024/);
});
