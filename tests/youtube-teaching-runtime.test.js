import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURATED_CAPABILITY_SEEDS } from '../src/lib/open-source-capabilities.js';
import { compileRepositorySkill, skillMatchesTask } from '../src/lib/repo-skill-compiler.js';
import { resolveNativeSkillAdapter } from '../src/lib/native-skill-adapters.js';
import { canExecuteNativeSkill } from '../src/application/capabilities/native-skill-executor.js';
import { ALLOWED_ADAPTERS } from '../.github/scripts/cloud-tool-runner.mjs';

const REPO='artemnovitckii/notebooklm-coach';

function learnedSkill(){
  return compileRepositorySkill({
    repo:REPO,
    commit:'0123456789abcdef0123456789abcdef01234567',
    file_count:3,
    files:['SKILL.md','README.md','scripts/load_channel.py'],
    snippets:{
      'README.md':'Turn an expert YouTube library into a source-cited coach. Bulk channel ingestion, NotebookLM sources, grounded citations and video transcript research.'
    }
  });
}

test('notebooklm-coach is curated as a non-auto-executed YouTube teaching reference',()=>{
  const seed=CURATED_CAPABILITY_SEEDS.find(item=>String(item.repo).toLowerCase()===REPO);
  assert.ok(seed,'video-discovered repository must be in the curated source pool');
  assert.equal(seed.category,'youtube-teaching');
  assert.equal(seed.autoExecute,false);
  assert.match(String(seed.restriction||''),/license|lisans/i);
});

test('repository skill compiler recognizes YouTube teaching as a first-class capability',()=>{
  const skill=learnedSkill();
  assert.equal(skill.primary_capability,'youtube-teaching');
  assert.ok(skill.capabilities.includes('youtube-teaching'));
  assert.ok(skillMatchesTask(skill,'youtube_teaching')>0);
  const adapter=resolveNativeSkillAdapter(skill);
  assert.equal(adapter?.id,'youtube-teaching');
  assert.match(String(adapter?.notes||''),/JARVIS/i);
});

test('YouTube teaching adapter only runs for explicit teaching intent plus a YouTube URL',()=>{
  const skill={
    adapter_status:'ready',requires_paid_api:false,repo:REPO,
    primary_capability:'youtube-teaching',native_adapter:{id:'youtube-teaching'}
  };
  assert.equal(canExecuteNativeSkill(skill,'YT Öğretisi: https://www.youtube.com/watch?v=dQw4w9WgXcQ bu videodan öğren'),true);
  assert.equal(canExecuteNativeSkill(skill,'YouTube için reels video üret'),false);
  assert.equal(canExecuteNativeSkill(skill,'YT Öğretisi aç ama link yok'),false);
});

test('cloud runner has a JARVIS-owned YouTube teaching adapter and never executes third-party loader code',()=>{
  assert.equal(ALLOWED_ADAPTERS['youtube-teaching'],true);
  const runner=readFileSync(new URL('../.github/scripts/cloud-tool-runner.mjs',import.meta.url),'utf8');
  assert.match(runner,/fetchYouTubeTranscript/);
  assert.match(runner,/fetchYouTubeChannelIndex/);
  assert.match(runner,/YOUTUBE_TEACHING_REPO/);
  assert.doesNotMatch(runner,/load_channel\.py[^\n]*spawn|spawn\([^\n]*load_channel\.py/);
});
