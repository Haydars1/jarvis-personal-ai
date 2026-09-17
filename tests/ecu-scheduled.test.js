import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function coreRecorder() {
  const calls = [];
  return {
    calls,
    async fetch() { return new Response('ok'); },
    async scheduled(event) { calls.push(['core', event.scheduledTime]); },
  };
}

test('scheduled event runs continuous ECU research and preserves existing scheduler', async () => {
  const core = coreRecorder();
  const calls = [];
  const research = {
    async run(_env, timestamp) { calls.push(['research', timestamp]); return { skipped: false }; },
    async status() { return { status: 'IDLE', mode: 'continuous-research', paidApiRequired: false }; },
  };
  const runtime = createEcuRuntime(core, { research });
  const event = { scheduledTime: 123456 };

  await runtime.scheduled(event, {}, { waitUntil() {} });

  assert.deepEqual(calls, [['research', 123456]]);
  assert.deepEqual(core.calls, [['core', 123456]]);
});

test('research status route comes from the continuous research service', async () => {
  const core = coreRecorder();
  const research = {
    async run() {},
    async status() { return { status: 'COMPLETE', mode: 'continuous-research', paidApiRequired: false, counts: { sources: 12 } }; },
  };
  const runtime = createEcuRuntime(core, { research });
  const response = await runtime.fetch(new Request('https://jarvis.test/api/ecu/research/status'), {}, {});
  const payload = await response.json();

  assert.equal(payload.mode, 'continuous-research');
  assert.equal(payload.counts.sources, 12);
});
