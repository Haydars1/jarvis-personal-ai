import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENSHOT_INTEGRATION_SEEDS } from '../src/lib/screenshot-integration-matrix.js';
import { buildFreeIntegrationCatalog } from '../src/lib/repository-integrations.js';

const MUST_HAVE = [
  'NVIDIA/SkillSpector','browserbase/stagehand','krillinai/OpenCreator','every-app/open-seo','mobile-next/mobile-mcp',
  'pacifio/atlas','dzhng/jevgrep','google/artemis','zarazhangrui/frontend-slides','anthropics/skills',
  'tt-a1i/archify','Ryze-AI-Agent/open-seo-mcp-skills','Graphify-Labs/graphify','google-gemini/gemini-cli','browser-use/browser-use',
  '2akouwu/reverify','tigerless-labs/agent-memory','mikehasa/golive-skill','farion1231/cc-switch','Egonex-AI/Understand-Anything',
  'microsoft/mcp-for-beginners','OthmanAdi/planning-with-files','Asymptote-Labs/agent-beacon','totec448-spec/chat-on-steroids','davila7/claude-code-templates',
  'zeronsh/zeron','yetone/magpie','nexu-io/open-design','decolua/9router','wanshuiyin/Auto-claude-code-research-in-sleep',
  'ahmedkhaleel2004/gitdiagram','duty1g/x64dbg-mcp-server','TencentCloud/Octop','VectifyAI/PageIndex','feder-cr/dots',
  'bytedance/deer-flow','microsoft/ai-agents-for-beginners','pydantic/monty','ApodexAI/FrontierAgent','CopilotKit/OpenBot',
  'cathrynlavery/diagram-design','career-ops-hq/career-ops','headroomlabs-ai/headroom','xzf-thu/VoiceMem','synthetic-sciences/openscience',
  'anthropics/claude-plugins-official','upstash/context7','gastownhall/beads','anthropics/claude-code-action','trycua/cua',
  'NVIDIA/OpenShell','dream-num/univer','vectorize-io/hindsight','diegosouzapw/OmniRoute','pbakaus/impeccable',
  'ruvnet/ruflo','kharmanskyi/open-steps','undefined-ui/second-brain-os','monid-ai/monid','XiaoDuoYa/codex-with-chatgpt',
  'rehan-remade/universal-modder','router-for-me/CLIProxyAPI','MemPalace/mempalace','JuliusBrussee/caveman','adtexterry-lgtm/unigit-ecosystem',
  'Jakeschincariol/linkedin-agent-skill','Nanako0129/sepia','obra/superpowers','rohitg00/ai-engineering-from-scratch','Leonxlnx/unlazy',
  'furkankly/zoetrope','nateherkai/scroll-craft','lexmount/moli','ShawnPana/phone-harness'
];

test('final screenshot inventory is represented once and stays non-executable until adapted', () => {
  const repos = SCREENSHOT_INTEGRATION_SEEDS.map(x => x.provenance?.repo).filter(Boolean);
  assert.equal(new Set(repos.map(x => x.toLowerCase())).size, repos.length);
  for (const repo of MUST_HAVE) assert.ok(repos.some(x => x.toLowerCase() === repo.toLowerCase()), repo);
  assert.ok(SCREENSHOT_INTEGRATION_SEEDS.length >= MUST_HAVE.length);
  assert.equal(SCREENSHOT_INTEGRATION_SEEDS.every(x => x.autoExecutable === false), true);
  assert.equal(SCREENSHOT_INTEGRATION_SEEDS.every(x => x.runtimeState === 'reference-only'), true);
});

test('existing verified repository row overrides the screenshot-only seed without duplication', () => {
  const catalog = buildFreeIntegrationCatalog({
    repositoryIntegrations:[{
      repo:'browser-use/browser-use', canonical_repo:'browser-use/browser-use', url:'https://github.com/browser-use/browser-use',
      category:'browser-automation', license:'MIT', source_commit:'verified123', source_verification:'source-verified',
      integration:{ status:'ready', mode:'native-adapter', route:'/api/tools/cloud/jobs', detail:'verified adapter' }
    }],
    providerState:{}
  });
  const matches = catalog.filter(x => x.provenance?.repo?.toLowerCase() === 'browser-use/browser-use');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].runtimeState, 'ready');
  assert.equal(matches[0].provenance.sourceCommit, 'verified123');
});

test('reverse-engineering and device-control screenshot repos are reference-only by default', () => {
  for (const repo of ['duty1g/x64dbg-mcp-server','rehan-remade/universal-modder','ShawnPana/phone-harness','mobile-next/mobile-mcp','google/artemis']) {
    const item = SCREENSHOT_INTEGRATION_SEEDS.find(x => x.provenance?.repo?.toLowerCase() === repo.toLowerCase());
    assert.ok(item, repo);
    assert.equal(item.runtimeState, 'reference-only');
    assert.equal(item.autoExecutable, false);
  }
});
