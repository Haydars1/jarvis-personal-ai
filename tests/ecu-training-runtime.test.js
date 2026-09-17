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

test('scheduled ECU runtime runs both research and controlled training checks', async () => {
  const core = coreRecorder();
  const calls = [];
  const research = {
    async run(_env, timestamp) { calls.push(['research', timestamp]); },
    async status() { return { status: 'IDLE' }; },
  };
  const training = {
    async maybeRun(_env, timestamp) { calls.push(['training', timestamp]); return { scheduled: false }; },
    async status() { return { status: 'COLLECTING_DATA', paidApiRequired: false }; },
  };
  const runtime = createEcuRuntime(core, { research, training });

  await runtime.scheduled({ scheduledTime: 999 }, {}, {});

  assert.deepEqual(calls, [['research', 999], ['training', 999]]);
  assert.deepEqual(core.calls, [['core', 999]]);
});

test('training status route comes from controlled training service', async () => {
  const core = coreRecorder();
  const research = { async run() {}, async status() { return { status: 'IDLE' }; } };
  const training = {
    async maybeRun() {},
    async status() { return { status: 'READY_TO_TRAIN', verifiedExamples: 75, paidApiRequired: false }; },
  };
  const runtime = createEcuRuntime(core, { research, training });

  const response = await runtime.fetch(new Request('https://jarvis.test/api/ecu/training/status'), {}, {});
  const payload = await response.json();

  assert.equal(payload.status, 'READY_TO_TRAIN');
  assert.equal(payload.verifiedExamples, 75);
  assert.equal(payload.paidApiRequired, false);
});
