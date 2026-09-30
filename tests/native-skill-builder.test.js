import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('worker exposes OIDC-protected native skill backlog for the autonomous builder',()=>{
  const source=read('src/application/capabilities/cloud-execution.js');
  assert.match(source,/\/api\/tools\/skills\/runner\/backlog/);
  assert.match(source,/jarvis-skill-builder/);
  assert.match(source,/jarvis-codex-agent\.yml@refs\/heads\/main/);
  assert.match(source,/adapter_status='unverified'/);
});

test('autonomous developer requests a GitHub OIDC token and fetches skill backlog before coding',()=>{
  const workflow=read('.github/workflows/jarvis-codex-agent.yml');
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/Fetch native skill backlog/);
  assert.match(workflow,/audience=jarvis-skill-builder/);
  assert.match(workflow,/\/api\/tools\/skills\/runner\/backlog/);
  assert.match(workflow,/\/tmp\/jarvis-skill-backlog\.json/);
});

test('autonomous skill builder is instructed to clean-room reimplement behavior instead of copying third-party source',()=>{
  const workflow=read('.github/workflows/jarvis-codex-agent.yml');
  assert.match(workflow,/clean-room/i);
  assert.match(workflow,/do not copy third-party source/i);
  assert.match(workflow,/adapter_status/i);
  assert.match(workflow,/repo_skills/i);
});

test('native adapter manifest maps already-existing JARVIS abilities to learned capabilities',()=>{
  const source=read('src/lib/native-skill-adapters.js');
  assert.match(source,/ecu-file-analysis/);
  assert.match(source,/vehicle-diagnostics/);
  assert.match(source,/social-automation/);
  assert.match(source,/binary-analysis/);
  assert.match(source,/device-bridge/);
});

test('skill discovery upgrades learned skills when JARVIS already has a matching native adapter',()=>{
  const source=read('src/application/capabilities/cloud-execution.js');
  assert.match(source,/resolveNativeSkillAdapter/);
  assert.match(source,/adapter_status.*ready/s);
});

test('chat orchestrator attempts a ready learned skill before paid provider experts',()=>{
  const source=read('src/application/chat/orchestrator.js');
  assert.match(source,/readySkillCandidate/);
  assert.match(source,/skillFirstResponse/);
  assert.match(source,/adapter_status\s*===\s*['"]ready['"]/);
  assert.match(source,/native_adapter/);
  assert.match(source,/kind:\s*['"]skill['"]/);
  const orchestrated=source.slice(source.indexOf('async function orchestratedChat'));
  const skillIndex=orchestrated.indexOf('skillFirstResponse(');
  const expertIndex=orchestrated.indexOf('getExperts(env,text');
  assert.ok(skillIndex>=0&&expertIndex>skillIndex);
  const simple=source.slice(source.indexOf('async function simpleChat'),source.indexOf('async function orchestratedChat'));
  assert.ok(simple.indexOf('skillFirstResponse(')>=0&&simple.indexOf('getExperts(env,text')>simple.indexOf('skillFirstResponse('));
});
