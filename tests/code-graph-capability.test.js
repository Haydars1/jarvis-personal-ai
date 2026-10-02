import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { graphCapabilities, getCodeGraphStatus } from '../src/lib/code-graph.js';
import { compileRepositorySkill } from '../src/lib/repo-skill-compiler.js';
import { repositoryCodeGraphIntegration } from '../src/lib/repository-integrations.js';

const graph = JSON.parse(fs.readFileSync(new URL('./fixtures/code-graph.json', import.meta.url)));
const expected = ['code-graph', 'dependency-trace', 'impact-analysis', 'symbol-neighborhood'];

test('exposes_graph_capabilities_for_current_graph', () => {
  assert.deepEqual(graphCapabilities(graph, graph.source_commit), expected);
  const skill = compileRepositorySkill(
    { repo: 'owner/repository-agent', files: ['README.md'], snippets: { readme: 'coding agent' } },
    { codeGraphStatus: 'ready' }
  );
  for (const capability of expected) assert.ok(skill.capabilities.includes(capability));
  assert.equal(skill.evidence.code_graph_status, 'ready');
});

test('does_not_expose_graph_capabilities_for_stale_graph', () => {
  assert.equal(getCodeGraphStatus(graph, 'different'), 'stale');
  assert.deepEqual(graphCapabilities(graph, 'different'), []);
  const skill = compileRepositorySkill(
    { repo: 'owner/repository-agent', files: ['README.md'], snippets: { readme: 'coding agent' } },
    { codeGraphStatus: 'stale' }
  );
  for (const capability of expected) assert.equal(skill.capabilities.includes(capability), false);
  assert.equal(skill.evidence.code_graph_status, 'stale');
});

test('repository_integration_surfaces_graph_state_without_claiming_stale_capabilities', () => {
  assert.deepEqual(repositoryCodeGraphIntegration('ready').capabilities, expected);
  assert.deepEqual(repositoryCodeGraphIntegration('stale').capabilities, []);
  assert.equal(repositoryCodeGraphIntegration('stale').status, 'stale');
});

test('does_not_require_graph_for_existing_repository_skills', () => {
  const skill = compileRepositorySkill({ repo: 'owner/repository-agent', files: ['README.md'], snippets: { readme: 'coding agent' } });
  assert.ok(skill.capabilities.includes('coding-agent'));
  assert.equal(skill.evidence.code_graph_status, 'unavailable');
});
