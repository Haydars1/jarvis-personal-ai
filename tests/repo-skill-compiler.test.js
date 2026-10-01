import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRepositorySkill, skillMatchesTask } from '../src/lib/repo-skill-compiler.js';

function inspect({repo='owner/tool',readme='',packageJson='',pyproject='',requirements='',files=[]}={}){
  return {
    repo,
    commit:'0123456789abcdef0123456789abcdef01234567',
    file_count:files.length,
    files,
    extensions:{'.py':files.filter(x=>x.endsWith('.py')).length},
    snippets:{
      'README.md':readme,
      ...(packageJson?{'package.json':packageJson}:{}),
      ...(pyproject?{'pyproject.toml':pyproject}:{}),
      ...(requirements?{'requirements.txt':requirements}:{})
    }
  };
}

test('compiler learns speech-to-text skill from Whisper-style repository',()=>{
  const skill=compileRepositorySkill(inspect({repo:'ggerganov/whisper.cpp',readme:'High-performance inference of OpenAI Whisper automatic speech recognition. Transcribe audio to text locally.',files:['README.md','examples/main/main.cpp']}));
  assert.equal(skill.repo,'ggerganov/whisper.cpp');
  assert.ok(skill.capabilities.includes('speech-to-text'));
  assert.ok(skill.capabilities.includes('audio-processing'));
  assert.equal(skill.source_commit.length,40);
  assert.equal(skill.execution_lane,'cloud-runner');
  assert.equal(skill.status,'learned');
});

test('compiler learns browser automation from Playwright/browser repositories',()=>{
  const skill=compileRepositorySkill(inspect({repo:'browser-use/browser-use',readme:'AI browser automation. Control Chromium, navigate pages, click elements and fill forms using Playwright.',requirements:'playwright\n',files:['README.md','browser_use/browser.py']}));
  assert.ok(skill.capabilities.includes('browser-automation'));
  assert.ok(skill.capabilities.includes('web-navigation'));
  assert.equal(skill.risk,'medium');
});

test('compiler learns video processing without requiring an AI API',()=>{
  const skill=compileRepositorySkill(inspect({repo:'Zulko/moviepy',readme:'Video editing with Python. Cut, concatenate, composite, resize and encode video. Uses ffmpeg.',files:['README.md','moviepy/video/VideoClip.py']}));
  assert.ok(skill.capabilities.includes('video-processing'));
  assert.ok(skill.capabilities.includes('media-conversion'));
  assert.equal(skill.requires_paid_api,false);
});

test('compiler identifies vehicle diagnostics but marks physical-device work as device-bound',()=>{
  const skill=compileRepositorySkill(inspect({repo:'mdabrowski1990/uds',readme:'Unified Diagnostic Services ISO 14229 over CAN, DoIP, LIN and K-Line. Read DTC and diagnostic services.',files:['README.md','uds/client.py']}));
  assert.ok(skill.capabilities.includes('vehicle-diagnostics'));
  assert.ok(skill.capabilities.includes('uds'));
  assert.equal(skill.execution_lane,'device-bridge');
  assert.equal(skill.risk,'high');
});

test('repository identity keeps rembg primarily in image processing despite broad README media mentions',()=>{
  const skill=compileRepositorySkill(inspect({repo:'danielgatis/rembg',readme:'Remove image backgrounds. Documentation also mentions ffmpeg video workflows and audio examples.',files:['README.md','rembg/bg.py']}));
  assert.equal(skill.primary_capability,'image-processing');
  assert.ok(skill.capabilities.includes('image-processing'));
});

test('repository identity recognizes openWakeWord as wake-word detection instead of text-to-speech',()=>{
  const skill=compileRepositorySkill(inspect({repo:'dscripka/openWakeWord',readme:'Open-source wake word and keyword spotting models for real-time audio. Documentation compares speech synthesis and RAG integrations.',files:['README.md','openwakeword/model.py']}));
  assert.equal(skill.primary_capability,'wake-word-detection');
  assert.ok(skill.capabilities.includes('audio-processing'));
});

test('repository identity recognizes prompt engineering guide instead of incidental video and image topics',()=>{
  const skill=compileRepositorySkill(inspect({repo:'dair-ai/Prompt-Engineering-Guide',readme:'Prompt engineering guide covering prompting techniques for language, image, video, RAG and workflows.',files:['README.md','pages/guides/prompts.md']}));
  assert.equal(skill.primary_capability,'prompt-engineering');
  assert.ok(skill.capabilities.includes('document-processing'));
});

test('skill matching prefers learned capability over unrelated skill',()=>{
  const video=compileRepositorySkill(inspect({repo:'video/tool',readme:'ffmpeg video editing, transcode and concatenate media'}));
  const speech=compileRepositorySkill(inspect({repo:'speech/tool',readme:'speech recognition and transcription from audio'}));
  assert.ok(skillMatchesTask(video,'video_creation') > skillMatchesTask(speech,'video_creation'));
  assert.ok(skillMatchesTask(speech,'audio') > skillMatchesTask(video,'audio'));
});
