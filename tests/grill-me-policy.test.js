import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRILL_ME_POLICY } from '../src/lib/grill-me-policy.js';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('grill-me policy limits questions and reserves high-impact actions for approval', () => {
  assert.match(GRILL_ME_POLICY, /en fazla 3/);
  assert.match(GRILL_ME_POLICY, /kullanıcının önceki kararlarını/);
  assert.match(GRILL_ME_POLICY, /Production deploy/);
  assert.match(GRILL_ME_POLICY, /uzun sorgu başlatma/);
});

test('orchestrated expert and Workers fallback both receive grill-me policy', () => {
  const source = file('src/application/chat/orchestrator.js');
  assert.match(source, /import \{ GRILL_ME_POLICY \} from '..\/..\/lib\/grill-me-policy.js'/);
  assert.match(source, /function expertSystemPrompt\(kind\).*GRILL_ME_POLICY/);
  assert.match(source, /workersRun\(env,\[\{role:'system',content:.*GRILL_ME_POLICY/);
});

test('normal chat and selected expert provider receive the same policy', () => {
  const source = file('src/application/chat/smart-router.js');
  assert.match(source, /import \{ GRILL_ME_POLICY \} from '..\/..\/lib\/grill-me-policy.js'/);
  assert.match(source, /\$\{expertPrompt\}\$\{projectPrompt\}.*GRILL_ME_POLICY/);
});
