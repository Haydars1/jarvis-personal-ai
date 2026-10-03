import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fuseYouTubeLearning } from '../src/lib/youtube-teaching-runtime.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('YouTube learning prefers its own audio transcription and keeps visual evidence',()=>{
  const fused=fuseYouTubeLearning({
    captionTranscript:'otomatik altyazı yanlış kelime',
    asrTranscript:'Bosch EDC17 boost map burada açılıyor',
    visualNotes:[{timestamp_sec:42,text:'WinOLS ekranında boost pressure map ve eksen değerleri görünüyor.'}]
  });
  assert.equal(fused.primary_transcript,'audio-asr');
  assert.ok(fused.modalities.includes('audio'));
  assert.ok(fused.modalities.includes('vision'));
  assert.ok(fused.modalities.includes('captions'));
  assert.match(fused.transcript,/EDC17 boost map/);
  assert.match(fused.transcript,/\[00:42\]/);
  assert.match(fused.transcript,/otomatik altyazı/);
});

test('videos without captions can still become learned sources through audio and vision',()=>{
  const fused=fuseYouTubeLearning({
    captionTranscript:'',
    asrTranscript:'Checksum düzeltmesi yazmadan önce doğrulanır.',
    visualNotes:[{timestamp_sec:10,text:'Checksum penceresi açık.'}]
  });
  assert.equal(fused.primary_transcript,'audio-asr');
  assert.ok(fused.transcript.length>40);
  assert.equal(fused.captions_used,false);
});

test('cloud runner downloads bounded media and sends audio plus frames for analysis',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.match(runner,/downloadYouTubeMedia/);
  assert.match(runner,/transcribeAudioChunks/);
  assert.match(runner,/analyzeVisualFrames/);
  assert.match(runner,/\/api\/learning\/youtube\/media\/analyze/);
  assert.match(runner,/yt-dlp/);
  assert.match(runner,/ffmpeg/);
});

test('runner workflow really installs and verifies media tools',()=>{
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  assert.match(workflow,/yt-dlp/);
  assert.match(workflow,/apt-get[\s\S]{0,180}install[\s\S]{0,80}ffmpeg/);
  assert.match(workflow,/command -v ffmpeg/);
  assert.match(workflow,/command -v ffprobe/);
});

test('Worker media endpoint uses ASR and vision rather than trusting captions alone',()=>{
  const capability=read('src/application/capabilities/youtube-learning.js');
  assert.match(capability,/@cf\/openai\/whisper-large-v3-turbo/);
  assert.match(capability,/inlineData/);
  assert.match(capability,/verifyRunnerJwt/);
  assert.match(capability,/media\/analyze/);
});
