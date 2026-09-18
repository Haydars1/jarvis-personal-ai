import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function request(path, init = {}) { return new Request(`https://jarvis.test${path}`, init); }
function coreFallback() { return { async fetch(){ return new Response('core',{status:299}); } }; }

test('verified map labels become training examples through injected verifier', async () => {
  const calls = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async verifyMap(_env, mapId, input) {
      calls.push([mapId, input]);
      return {
        exampleId: 'train-1',
        mapId,
        semanticLabel: input.semanticLabel,
        humanVerified: true,
      };
    },
  });

  const response = await runtime.fetch(request('/api/ecu/maps/map-1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ semanticLabel: 'torque_limiter' }),
  }), {}, {});

  assert.equal(response.status, 201);
  assert.deepEqual(calls, [['map-1', { semanticLabel: 'torque_limiter' }]]);
  assert.deepEqual(await response.json(), {
    example: {
      exampleId: 'train-1',
      mapId: 'map-1',
      semanticLabel: 'torque_limiter',
      humanVerified: true,
    },
  });
});

test('map verification rejects empty semantic labels', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async verifyMap() { throw new Error('should not run'); },
  });
  const response = await runtime.fetch(request('/api/ecu/maps/map-1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ semanticLabel: '   ' }),
  }), {}, {});
  assert.equal(response.status, 400);
});
