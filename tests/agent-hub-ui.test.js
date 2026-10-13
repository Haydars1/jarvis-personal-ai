import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Agent Hub is mounted in Settings, not obsolete Tools navigation',()=>{
 const html=source('public/index.html'),ui=source('public/agent-hub-ui.js');
 assert.match(html,/data-page="settings"/);
 assert.match(html,/src="\/agent-hub-ui\.js"/);
 assert.match(ui,/getElementById\('settings'\)/);
 assert.match(ui,/document\.querySelectorAll\('\[data-page="settings"\]'\)/);
 assert.match(ui,/button\.addEventListener\('click',refreshHubAfterLogin\)/);
 assert.doesNotMatch(ui,/\n    refresh\(\);\n  }/);
});
test('browser end-to-end test uses actual Settings Agent Hub controls',()=>{
 const integration=source('scripts/integration-check.mjs');
 assert.match(integration,/\[data-page="settings"\]:visible/);
 assert.match(integration,/#jarvisAgentHub/);
 assert.match(integration,/#agentHubStats/);
 assert.doesNotMatch(integration,/\[data-page="tools"\]:visible/);
 assert.doesNotMatch(integration,/#ecuMeta/);
 assert.doesNotMatch(integration,/#repositoryRefresh/);
});
