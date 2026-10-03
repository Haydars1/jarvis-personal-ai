import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('native YT Öğretisi only says learned from backend learning metadata',()=>{
  const models=read('ios/JARVIS/Models.swift');
  const view=read('ios/JARVIS/YouTubeTeachingView.swift');
  assert.match(models,/learningStatus/);
  assert.match(models,/learning_chunks/);
  assert.match(view,/case "learned": return "Öğrenildi"/);
  assert.match(view,/learningChunks/);
  assert.match(view,/queuedVideos/);
  assert.match(view,/kalıcı bilgi hafızasına ekledi/);
  assert.match(view,/kalıcı öğrenme doğrulanmadı/);
});
