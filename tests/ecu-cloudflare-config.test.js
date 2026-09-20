import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// This config currently uses the JSON subset of JSONC. Wrangler also validates
// its complete schema and bundles the entry point in check:cloudflare.
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

test('ECU container has a SQLite Durable Object migration and matching binding', () => {
  const container = config.containers.find(item => item.class_name === 'EcuComputeContainer');
  assert.ok(container, 'ECU compute container must remain configured');
  const binding = config.durable_objects.bindings.find(item => item.name === 'ECU_COMPUTE_CONTAINER');
  assert.equal(binding?.class_name, container.class_name);
  assert.ok(config.migrations.some(item => item.new_sqlite_classes?.includes(container.class_name)),
    'Do not remove the migration to work around a versions upload failure');
  assert.ok(existsSync(new URL(`../${container.image}`, import.meta.url)), 'Container image source must exist');
});

test('Durable Object migration tags are nonempty and unique', () => {
  const tags = config.migrations.map(item => item.tag);
  assert.ok(tags.every(tag => typeof tag === 'string' && tag.trim().length > 0));
  assert.equal(new Set(tags).size, tags.length);
});
