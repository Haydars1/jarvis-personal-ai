import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const orchestrator = fs.readFileSync(new URL('../src/application/chat/orchestrator.js', import.meta.url), 'utf8');

test('assistant replies render headings, lists, paragraphs and inline emphasis safely', () => {
  assert.match(app, /function chatMarkup\(/);
  assert.match(app, /function chatInlineMarkup\(/);
  assert.match(app, /chatMessageMarkup\(role,text,provider/);
  assert.match(app, /\^\[-\*•\]\\s\+/);
  assert.match(app, /\^\\d\+\[\.\)\]\\s\+/);
  assert.match(app, /chatInlineMarkup\(m\[1\]\)/);
  assert.match(app, /esc\(text\)/);
});

test('chat styles provide readable visual hierarchy', () => {
  assert.match(css, /\.chatMsg p\{/);
  assert.match(css, /\.chatMsg li\{/);
  assert.match(css, /\.chatMsg blockquote\{/);
  assert.match(css, /\.chatMsg code\{/);
});

test('assistant policy requests structured readable output', () => {
  assert.match(orchestrator, /uzun metni kısa paragraflara ayır/);
  assert.match(orchestrator, /her maddeyi ayrı satıra yaz/);
  assert.match(orchestrator, /tek blok halinde sıkışık metin verme/);
});
