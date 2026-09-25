import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceBackedKnowledge, synthesizeResearchEvidence } from '../src/application/learning/service.js';

test('research synthesis clusters near-duplicate evidence and rewards independent corroboration', () => {
  const rows = synthesizeResearchEvidence([
    { title:'Docs A', url:'https://docs.example/a', snippet:'Cloudflare Workers supports durable execution with bounded request handling.' },
    { title:'Docs B', url:'https://reference.example/b', snippet:'Cloudflare Workers supports durable execution with bounded request handling today.' },
    { title:'Same host', url:'https://docs.example/c', snippet:'Cloudflare Workers supports durable execution with bounded request handling in production.' },
    { title:'Different fact', url:'https://third.example/d', snippet:'A separate sufficiently long research statement about another capability.' }
  ]);
  assert.equal(rows.length, 2);
  const corroborated = rows.find(row => row.support === 3);
  assert.ok(corroborated);
  assert.equal(corroborated.independentSources, 2);
  assert.equal(corroborated.confidence, 0.8);
  assert.equal(rows[0], corroborated);
});

test('knowledge records inherit corroboration confidence without inventing merged prose', () => {
  const rows = sourceBackedKnowledge('software', [
    { title:'Primary', url:'https://one.example/a', snippet:'A sufficiently long stable statement about a software capability and behavior.' },
    { title:'Independent', url:'https://two.example/b', snippet:'A sufficiently long stable statement about a software capability and behavior today.' }
  ], 1000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].confidence, 0.8);
  assert.match(rows[0].source_url, /^https:\/\//);
  assert.doesNotMatch(rows[0].text, /two sources|consensus|corroborated/i);
});
