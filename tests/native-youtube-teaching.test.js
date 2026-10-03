import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentView=fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../ios/JARVIS/JarvisAPI.swift',import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../ios/JARVIS/YouTubeStudioView.swift',import.meta.url),'utf8');
const teachingPath=new URL('../ios/JARVIS/YouTubeTeachingView.swift',import.meta.url);
const teaching=fs.existsSync(teachingPath)?fs.readFileSync(teachingPath,'utf8'):'';

test('native sidebar keeps Creator YouTube and exposes a separate YT Öğretisi channel',()=>{
  assert.match(contentView,/Label\("YouTube"/);
  assert.match(contentView,/Label\("YT Öğretisi"/);
  assert.match(contentView,/YouTubeTeachingView\(\)/);
  assert.doesNotMatch(studio,/YT Öğretisi/);
});

test('YT Öğretisi directly queues the clean-room teaching adapter instead of pretending chat learned it',()=>{
  assert.match(api,/func queueYouTubeTeaching/);
  assert.match(api,/"adapter_id":\s*"youtube-teaching"/);
  assert.match(api,/"repo":\s*"artemnovitckii\/notebooklm-coach"/);
  assert.match(teaching,/queueYouTubeTeaching/);
  assert.match(teaching,/cloudToolJob/);
});

test('YT Öğretisi validates a YouTube URL and persists truthful learning history with backend status',()=>{
  assert.match(teaching,/YouTube|youtu\.be/);
  assert.match(teaching,/UserDefaults/);
  assert.match(teaching,/Öğrenme Geçmişi/);
  assert.match(teaching,/learningStatus/);
  assert.match(teaching,/Analiz ediliyor|Öğrenildi|İşlendi/);
});
