import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('native API exposes truthful repository skill execution summary',()=>{
  const api=read('ios/JARVIS/JarvisAPI.swift');
  assert.match(api,/struct SkillExecutionSummary:\s*Decodable/);
  assert.match(api,/func skillExecutionSummary\(\) async throws -> SkillExecutionSummary/);
  assert.match(api,/\/api\/tools\/skills\/execution-summary/);
  assert.match(api,/case curatedRepositories = "curated_repositories"/);
  assert.match(api,/case recentlySuccessfulExecutions = "recently_successful_executions"/);
});

test('settings show executable skills separately from raw catalog count',()=>{
  const settings=read('ios/JARVIS/SettingsView.swift');
  assert.match(settings,/JARVIS Skill Motoru/);
  assert.match(settings,/Gerçekten çalışabilir/);
  assert.match(settings,/Cihaz\/çalışma ortamı gerekli/);
  assert.match(settings,/Sorunlu\/degraded/);
  assert.match(settings,/Sadece katalogda/);
  assert.match(settings,/skillExecutionSummary\(\)/);
  assert.doesNotMatch(settings,/\"\d+ repo hazır\"/);
});
