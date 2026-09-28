import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeCheck = fs.readFileSync(new URL('../.github/workflows/ios-native-check.yml', import.meta.url), 'utf8');
const beta = fs.readFileSync(new URL('../.github/workflows/ios-workshop-beta.yml', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../docs/ios-test-build-policy.md', import.meta.url), 'utf8');

test('normal iOS validation does not publish a fresh IPA artifact', () => {
  assert.match(nativeCheck, /Build iPhone Release app without signing/);
  assert.doesNotMatch(nativeCheck, /actions\/upload-artifact/);
  assert.match(nativeCheck, /No IPA artifact is uploaded from normal development builds/);
});

test('workshop beta IPA is manual and gated by full validation plus native compiles', () => {
  assert.match(beta, /workflow_dispatch/);
  assert.match(beta, /npm run check/);
  assert.match(beta, /Simulator compile gate/);
  assert.match(beta, /Build consolidated unsigned IPA/);
  assert.match(beta, /actions\/upload-artifact/);
});

test('physical installs are reserved for consolidated milestones', () => {
  assert.match(policy, /Small UI tweaks/);
  assert.match(policy, /should not create a new IPA/);
  assert.match(policy, /specific hardware question/);
});
