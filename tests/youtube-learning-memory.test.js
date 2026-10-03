import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chunkTranscript, rankLearningChunks, learningContextText } from '../src/lib/youtube-learning-memory.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('YouTube transcripts are chunked into reusable learning units',()=>{
  const text=Array.from({length:80},(_,i)=>`EDC17 boost map lesson ${i}.`).join(' ');
  const chunks=chunkTranscript(text,{maxChars:420,overlapChars:70});
  assert.ok(chunks.length>2);
  assert.ok(chunks.every(chunk=>chunk.content.length<=430));
  assert.equal(chunks[0].ordinal,0);
  assert.ok(chunks[1].content.includes('lesson'));
});

test('learning retrieval ranks chunks that match the user question',()=>{
  const rows=[
    {id:'a',source_id:'s1',title:'DPF',source_url:'https://youtube.com/watch?v=aaaaaa',content:'DPF rejenerasyonunda egzoz sıcaklığı ve soot load kontrol edilir.'},
    {id:'b',source_id:'s2',title:'Turbo',source_url:'https://youtube.com/watch?v=bbbbbb',content:'Turbo actuator ve boost pressure log analizi yapılır.'}
  ];
  const ranked=rankLearningChunks(rows,'turbo boost pressure nasıl kontrol edilir');
  assert.equal(ranked[0].id,'b');
  const context=learningContextText(ranked.slice(0,1));
  assert.match(context,/Turbo/);
  assert.match(context,/youtube\.com\/watch/);
});

test('migration persists learned sources and transcript chunks',()=>{
  const schema=read('migrations/2026-10-03-youtube-learning.sql');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS learning_sources/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS learning_chunks/);
  assert.match(schema,/source_url TEXT NOT NULL UNIQUE/);
  const deploy=read('.github/workflows/deploy-cloudflare.yml');
  assert.match(deploy,/2026-10-03-youtube-learning\.sql/);
});

test('completed YouTube jobs persist learning and channel jobs fan out to videos',()=>{
  const capability=read('src/application/capabilities/youtube-learning.js');
  assert.match(capability,/persistYouTubeLearning/);
  assert.match(capability,/queueChannelVideoLearning/);
  assert.match(capability,/job\.adapter_id !== 'youtube-teaching'/);
  const app=read('src/app-entry.js');
  assert.match(app,/createYouTubeLearningCapability/);
});

test('normal JARVIS chat retrieves learned video context',()=>{
  const chat=read('src/application/chat/orchestrator.js');
  assert.match(chat,/searchLearningMemory/);
  assert.match(chat,/learningContextText/);
  assert.match(chat,/Öğrenilmiş video notları/);
});
