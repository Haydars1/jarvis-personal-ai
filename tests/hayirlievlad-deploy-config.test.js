import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml', import.meta.url), 'utf8');

test('Cloudflare deploy, production health probe and configured Worker use the same renamed script', () => {
  assert.equal(config.name, 'hayirlievlad');
  assert.match(workflow, /npx wrangler deploy --name hayirlievlad/);
  assert.match(workflow, /HEALTH_URL: https:\/\/hayirlievlad-live\.haydojarvis\.workers\.dev/);
  assert.doesNotMatch(workflow, /HEALTH_URL: .*secrets\.JARVIS_HEALTH_URL/);
});

test('renaming the Worker preserves the D1 database binding and assets', () => {
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_name, 'jarvis-db');
  assert.equal(config.d1_databases[0].database_id, '710f1325-af9a-4d03-acbf-d4c6862b7633');
  assert.equal(config.assets.directory, './public');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.main, 'src/app-entry.js');
});
