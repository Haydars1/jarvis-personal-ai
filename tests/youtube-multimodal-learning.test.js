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

test('runner sends YouTube URL to Gemini Worker with no video download',()=>{
  const runner=read('.github/scripts/cloud-tool-runner.mjs');
  assert.match(runner,/\/api\/learning\/youtube\/direct\/analyze/);
  assert.match(runner,/YOUTUBE_TEACHING_REPO/);
  assert.doesNotMatch(runner,/downloadYouTubeMedia|transcribeAudioChunks|analyzeVisualFrames|yt-dlp|ffmpeg/);
});

test('cloud runner does not install media download tools',()=>{
  const workflow=read('.github/workflows/cloud-tool-runner.yml');
  assert.doesNotMatch(workflow,/yt-dlp|apt-get install -y ffmpeg/);
});

test('Worker accepts a secure direct-video request and does not use snapshots or ASR',()=>{
  const capability=read('src/application/capabilities/youtube-learning.js');
  assert.match(capability,/\/api\/learning\/youtube\/direct\/analyze/);
  assert.match(capability,/verifyRunnerJwt/);
  assert.match(capability,/buildYouTubeInsightRequest/);
  assert.match(capability,/parseYouTubeInsightResponse/);
  assert.doesNotMatch(capability,/WHISPER_MODEL|inlineData|transcribeAudio/);
});
