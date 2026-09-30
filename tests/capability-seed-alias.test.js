import test from 'node:test';
import assert from 'node:assert/strict';
import { harvestCapabilities } from '../.github/scripts/harvest-capabilities.mjs';

const NOW = Date.parse('2026-09-30T10:00:00Z');

test('curated seed keeps its requested repo id when GitHub resolves it to a renamed canonical repository', async () => {
  const fetchImpl = async url => {
    const value = String(url);
    if (value.includes('/search/repositories')) {
      return { ok:true, status:200, async json(){ return {items:[]}; }, async text(){ return ''; } };
    }
    const marker = '/repos/ollama/ollama';
    if (value.includes(marker)) {
      return {
        ok:true, status:200,
        async json(){ return { full_name:'ollama-renamed/ollama', name:'ollama', html_url:'https://github.com/ollama-renamed/ollama', description:'renamed', archived:false, disabled:false, fork:false, stargazers_count:1, forks_count:1, pushed_at:'2026-09-30T09:00:00Z', topics:[], license:{spdx_id:'MIT'} }; },
        async text(){ return ''; }
      };
    }
    return { ok:false, status:404, async json(){ return {}; }, async text(){ return ''; } };
  };

  const registry = await harvestCapabilities({ fetchImpl, token:'', limit:1, delayMs:0, now:NOW });
  const entry = registry.entries.find(item => item.repo === 'ollama/ollama');
  assert.ok(entry, 'requested curated repo id must remain addressable after GitHub rename');
  assert.equal(entry.canonicalRepo, 'ollama-renamed/ollama');
  assert.equal(entry.canonicalUrl, 'https://github.com/ollama-renamed/ollama');
});
