import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const picker = fs.readFileSync(new URL('../ios/JARVIS/UniversalDocumentPicker.swift', import.meta.url), 'utf8');
const attachment = fs.readFileSync(new URL('../ios/JARVIS/NativeAttachment.swift', import.meta.url), 'utf8');
const share = fs.readFileSync(new URL('../ios/ShareExtension/ShareViewController.swift', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../ios/project.yml', import.meta.url), 'utf8');

test('native chat uses a universal copy-based picker for arbitrary file types', () => {
  assert.match(source, /UniversalDocumentPicker\(allowsMultipleSelection: true\)/);
  assert.match(picker, /forOpeningContentTypes: \[UTType\.item\], asCopy: true/);
  assert.match(picker, /allowsMultipleSelection = allowsMultipleSelection/);
  assert.match(source, /Dosya \/ BIN \/ PDF/);
});

test('native attachment reads copied Files\/iCloud documents and allows up to 50 MB', () => {
  assert.match(attachment, /NSFileCoordinator/);
  assert.match(attachment, /mappedIfSafe/);
  assert.match(attachment, /application\/octet-stream/);
  assert.match(attachment, /50 \* 1024 \* 1024/);
});

test('share extension accepts and forwards arbitrary files to the main app', () => {
  assert.match(project, /NSExtensionActivationSupportsFileWithMaxCount: 4/);
  assert.match(project, /NSExtensionActivationSupportsImageWithMaxCount: 4/);
  assert.match(project, /NSExtensionActivationSupportsMovieWithMaxCount: 4/);
  assert.match(share, /registeredTypeIdentifiers\.first/);
  assert.match(share, /loadFileRepresentation/);
  assert.match(share, /pendingShareFiles/);
});
