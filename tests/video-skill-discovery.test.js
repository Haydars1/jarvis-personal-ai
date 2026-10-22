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
