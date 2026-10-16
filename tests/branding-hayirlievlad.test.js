import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const brand = 'hayırlıevlad';

test('web app and legacy entrypoint display requested name', () => {
  for (const path of ['public/index.html', 'public/public/index.html']) {
    const html = file(path);
    assert.ok(html.includes(brand), path);
    assert.ok(!/Personal AI/i.test(html), path);
  }
  assert.match(file('public/index.html'), /<title>hayırlıevlad<\/title>/);
});

test('installable web app has no brand suffix', () => {
  for (const path of ['public/manifest.webmanifest', 'public/public/manifest.webmanifest']) {
    const manifest = JSON.parse(file(path));
    assert.equal(manifest.name, brand);
    assert.equal(manifest.short_name, brand);
  }
});

test('native app display names and shortcut strings are rebranded', () => {
  assert.ok(file('ios/JARVIS/Info.plist').includes('<string>' + brand + '</string>'));
  assert.ok(file('ios/ShareExtension/Info.plist').includes('<string>' + brand + '</string>'));
  assert.equal((file('ios/project.yml').match(/CFBundleDisplayName: hayırlıevlad/g) || []).length, 2);
  assert.ok(file('ios/JARVIS/JarvisIntents.swift').includes(brand));
});

test('existing native app identity remains compatible', () => {
  const project = file('ios/project.yml');
  assert.ok(project.includes('PRODUCT_BUNDLE_IDENTIFIER: com.haydojarvis.jarvis'));
  assert.ok(project.includes('group.com.haydojarvis') === false);
  const appState = file('ios/JARVIS/AppState.swift');
  assert.ok(appState.includes('group.com.haydojarvis.jarvis'));
});

test('AI request headers use ASCII-safe technical label', () => {
  for (const path of ['src/application/chat/smart-router.js', 'src/lib/ai-router.js']) {
    const code = file(path);
    assert.ok(code.includes("'X-Title': 'hayirlievlad'"), path);
    assert.ok(!code.includes("'X-Title': 'hayırlıevlad'"), path);
  }
});
