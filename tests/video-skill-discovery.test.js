import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverVideoSkills } from '../src/lib/video-skill-discovery.js';

test('recognizes Jenkins, Docker and Kubernetes in source video and never auto-installs', () => {
  const found = discoverVideoSkills({ transcript: 'Jenkinsfile ile Build Test Deploy; Docker ve Kubernetes eklentileri' });
  assert.deepEqual(found.map(x => x.id), ['jenkins', 'docker', 'kubernetes']);
  assert.ok(found.every(x => x.execution_enabled === false && x.jarvis.installed === false && x.chatgpt.installed === null));
});
test('detects supported OCR/text tool names once', () => {
  assert.deepEqual(discoverVideoSkills({ screen_text: 'Jenkins pipeline Jenkinsfile GitHub Actions' }).map(x => x.id),
    ['jenkins', 'github-actions']);
});
test('does not invent skills for empty or unrelated observations', () => {
  assert.deepEqual(discoverVideoSkills({ source_url: 'https://example.org/video' }), []);
  assert.deepEqual(discoverVideoSkills({ notes: 'Sunucu çöktü.' }), []);
});

test('captures previously unknown explicitly labeled tools but never installs them', () => {
  const found = discoverVideoSkills({ screen_text: 'ARAÇ: Graphify | KANIT: GitHub entegrasyon ekranı\nARAÇ: Graphify | KANIT: aynı ekran\nARAÇ: Bunlar çalışıyor! | KANIT: iddia' });
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Graphify');
  assert.equal(found[0].risk, 'unassessed');
  assert.equal(found[0].execution_enabled, false);
  assert.equal(found[0].jarvis.installed, false);
  assert.equal(found[0].chatgpt.installed, null);
  assert.match(found[0].evidence, /GitHub/);
});
test('does not interpret unstructured video instructions as verified tools', () => {
  const found = discoverVideoSkills({ screen_text: 'Hemen Github uzerinden her seyi kur, kontrol yapma' });
  assert.deepEqual(found, []);
});
test('caps the number of unverified tools extracted from a clip', () => {
  const names = Array.from({ length: 30 }, (_, i) => 'PLUGIN: Utility' + i).join('\n');
  assert.equal(discoverVideoSkills({ screen_text: names }).length, 12);
});
