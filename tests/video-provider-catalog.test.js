import test from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO_PROVIDER_CATALOG, videoProviderOrder } from '../src/application/capabilities/video-provider-catalog.js';

test('animation pool includes requested generation providers', () => {
  for (const id of ['higgsfield','kling','runway','hailuo','veo']) assert.ok(VIDEO_PROVIDER_CATALOG[id]);
});

test('providers support portrait Shorts routing', () => {
  const ordered = videoProviderOrder({ format: 'shorts', animation: true });
  for (const id of ['higgsfield','kling','runway','hailuo','veo']) assert.ok(ordered.includes(id));
});


test('catalog distinguishes executable transports from configured-only providers', () => {
  assert.equal(VIDEO_PROVIDER_CATALOG.kling.transport, 'fal');
  assert.equal(VIDEO_PROVIDER_CATALOG.runway.transport, 'runway');
  assert.equal(VIDEO_PROVIDER_CATALOG.higgsfield.transport, 'higgsfield');
  assert.equal(VIDEO_PROVIDER_CATALOG.hailuo.transport, 'minimax');
  assert.equal(VIDEO_PROVIDER_CATALOG.veo.transport, 'vertex-ai');
});

test('current provider models use verified stable identifiers', () => {
  assert.equal(VIDEO_PROVIDER_CATALOG.veo.defaultModel, 'veo-3.1-generate-001');
  assert.equal(VIDEO_PROVIDER_CATALOG.kling.defaultModel, 'fal-ai/kling-video/v1/standard/text-to-video');
});
