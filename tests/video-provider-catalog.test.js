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
