import test from 'node:test';
import assert from 'node:assert/strict';

import { USER_CURATED_CAPABILITY_SEEDS } from '../src/lib/user-curated-capability-seeds.js';
import { CURATED_CAPABILITY_SEEDS } from '../src/lib/open-source-capabilities.js';

const byRepo = new Map(USER_CURATED_CAPABILITY_SEEDS.map(row => [row.repo.toLowerCase(), row]));

const representativeRepos = [
  'Leonxlnx/unlazy',
  'furkankly/zoetrope',
  'Ryze-AI-Agent/open-seo-mcp-skills',
  'tigerless-labs/agent-memory',
  'nateherk/scroll-craft',
  'lexmount/moli',
  'ShawnPana/phone-harness',
  'Nanako0129/sepia',
  'krillinai/OpenCreator',
  'NVIDIA/SkillSpector',
  'google/artemis',
  'dzhng/jevgrep',
  'pacifio/atlas',
  'mobile-next/mobile-mcp',
  'every-app/open-seo',
  'anthropics/skills',
  'zarazhangrui/frontend-slides',
  'browserbase/stagehand',
  'tt-ali/archify',
  'sanjay3290/ai-skills',
  'mhattingpete/claude-skills-marketplace',
  'michalparkola/tapestry-skills',
  '2akouwu/reverify',
  'google-gemini/gemini-cli',
  'Graphify-Labs/graphify',
  'yetone/magpie',
  'zeronsh/zeron',
  'davila7/claude-code-templates',
  'totec448-spec/chat-on-steroids',
  'Asymptote-Labs/agent-beacon',
  'OthmanAdi/planning-with-files',
  'microsoft/mcp-for-beginners',
  'Egonex-AI/Understand-Anything',
  'farion1231/cc-switch',
  'mikehasa/golive-skill',
  'nexu-io/open-design',
  'decolua/9router',
  'wanshuiyin/Auto-claude-code-research-in-sleep',
  'ahmedkhaleel2004/gitdiagram',
  'duty1g/x64dbg-mcp-server',
  'TencentCloud/Octop',
  'VectifyAI/PageIndex',
  'feder-cr/dots',
  'bytedance/deer-flow',
  'microsoft/ai-agents-for-beginners',
  'pydantic/monty',
  'ApodexAI/FrontierAgent',
  'CopilotKit/OpenBot',
  'cathrynlavery/diagram-design',
  'career-ops-hq/career-ops',
  'headroomlabs-ai/headroom',
  'xzf-thu/VoiceMem',
  'synthetic-sciences/openscience',
  'anthropics/claude-plugins-official',
  'upstash/context7',
  'gastownhall/beads',
  'anthropics/claude-code-action',
  'trycua/cua',
  'NVIDIA/OpenShell',
  'dream-num/univer',
  'vectorize-io/hindsight',
  'diegosouzapw/OmniRoute',
  'pbakaus/impeccable',
  'ruvnet/ruflo',
  'kharmanskiy/open-steps',
  'undefined-ui/second-brain-os',
  'monid-ai/monid',
  'XiaoDuoYa/codex-with-chatgpt',
  'rehan-remade/universal-modder',
  'router-for-me/CLIProxyAPI',
  'MemPalace/mempalace',
  'JuliusBrussee/caveman',
  'adtexterry-lgtm/unigit-ecosystem',
  'Jakeschincariol/linkedin-agent-skill',
  'rohitg00/ai-engineering-from-scratch',
  'obra/superpowers'
];

test('screenshot repository pack is complete enough to cover every supplied batch', () => {
  for (const repo of representativeRepos) {
    assert.ok(byRepo.has(repo.toLowerCase()), `missing ${repo}`);
  }
});

test('screenshot repository pack has no case-insensitive duplicate repositories', () => {
  const keys = USER_CURATED_CAPABILITY_SEEDS.map(row => row.repo.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
});

test('every screenshot seed declares routing and provenance metadata', () => {
  for (const row of USER_CURATED_CAPABILITY_SEEDS) {
    assert.ok(row.repo.includes('/'), `invalid repo ${row.repo}`);
    assert.ok(row.category, `missing category for ${row.repo}`);
    assert.ok(row.executionTarget, `missing execution target for ${row.repo}`);
    assert.equal(row.source, 'user-screenshot-pack');
  }
});

test('capability fabric contains screenshot seeds once while retaining existing base seeds', () => {
  const keys = CURATED_CAPABILITY_SEEDS.map(row => row.repo.toLowerCase());
  assert.ok(keys.includes('ollama/ollama'));
  assert.ok(keys.includes('artemnovitckii/notebooklm-coach'));
  assert.ok(keys.includes('leonxlnx/unlazy'));
  assert.equal(keys.filter(key => key === 'browser-use/browser-use').length, 1);
  assert.equal(keys.filter(key => key === 'ryze-ai-agent/open-seo-mcp-skills').length, 1);
});

test('high-risk and prerequisite-heavy screenshot repos are not blindly auto executable', () => {
  const policy = repo => byRepo.get(repo.toLowerCase());
  assert.equal(policy('rohitg00/ai-engineering-from-scratch').executionTarget, 'catalog-only');
  assert.equal(policy('microsoft/mcp-for-beginners').executionTarget, 'catalog-only');
  assert.equal(policy('duty1g/x64dbg-mcp-server').autoExecute, false);
  assert.match(policy('duty1g/x64dbg-mcp-server').restriction, /analysis|debug/i);
  assert.equal(policy('ShawnPana/phone-harness').autoExecute, false);
  assert.match(policy('ShawnPana/phone-harness').restriction, /mac|adb|device|host/i);
  assert.equal(policy('Ryze-AI-Agent/open-seo-mcp-skills').autoExecute, false);
  assert.match(policy('Ryze-AI-Agent/open-seo-mcp-skills').restriction, /credential|service|mcp|external/i);
});
