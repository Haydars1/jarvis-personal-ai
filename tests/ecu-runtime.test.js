import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuRuntime } from '../src/application/ecu/runtime.js';

function request(path, init = {}) {
  return new Request(`https://jarvis.test${path}`, init);
}

function coreFallback() {
  return {
    async fetch() { return new Response('core', { status: 299 }); },
    async scheduled() { return 'scheduled-core'; },
  };
}

test('creates an ECU analysis job through injected repository', async () => {
  const created = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async createJob(_env, input) {
      created.push(input);
      return { id: 'job-1', fileId: input.fileId, operation: input.operation, state: 'QUEUED' };
    },
  });

  const response = await runtime.fetch(request('/api/ecu/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileId: 'file-1', operation: 'analyze' }),
  }), {}, {});

  assert.equal(response.status, 202);
  assert.deepEqual(created, [{ fileId: 'file-1', operation: 'analyze', callbackBaseUrl: 'https://jarvis.test' }]);
  assert.deepEqual(await response.json(), {
    job: { id: 'job-1', fileId: 'file-1', operation: 'analyze', state: 'QUEUED' },
  });
});

test('rejects missing file id', async () => {
  const runtime = createEcuRuntime(coreFallback(), { async createJob() { throw new Error('should not run'); } });
  const response = await runtime.fetch(request('/api/ecu/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }), {}, {});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /fileId/);
});

test('returns ECU job status and history', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async getJob(_env, id) { return id === 'job-1' ? { id, state: 'RUNNING' } : null; },
    async listJobs() { return [{ id: 'job-1', state: 'RUNNING' }]; },
  });

  let response = await runtime.fetch(request('/api/ecu/jobs/job-1'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { job: { id: 'job-1', state: 'RUNNING' } });

  response = await runtime.fetch(request('/api/ecu/jobs?limit=20'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { jobs: [{ id: 'job-1', state: 'RUNNING' }] });
});

test('exposes research/training/upload status without consuming a paid model', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async researchStatus() { return { status: 'IDLE', paidApiRequired: false }; },
    async trainingStatus() { return { status: 'IDLE', paidApiRequired: false }; },
    async uploadStatus() { return { ready: false, storage: 'unconfigured' }; },
  });

  for (const [path, expected] of [
    ['/api/ecu/research/status', { status: 'IDLE', paidApiRequired: false }],
    ['/api/ecu/training/status', { status: 'IDLE', paidApiRequired: false }],
    ['/api/ecu/upload-session', { ready: false, storage: 'unconfigured' }],
  ]) {
    const response = await runtime.fetch(request(path, { method: path.endsWith('upload-session') ? 'POST' : 'GET' }), {}, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  }
});

test('delegates unknown routes and scheduled events to core', async () => {
  const runtime = createEcuRuntime(coreFallback(), {});
  const response = await runtime.fetch(request('/api/other'), {}, {});
  assert.equal(response.status, 299);
  assert.equal(await runtime.scheduled({}, {}, {}), 'scheduled-core');
});

test('uploads an immutable ECU original and returns its content-addressed file id', async () => {
  const uploaded = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal(_env, input) {
      uploaded.push(input);
      return {
        id: 'a'.repeat(64),
        sha256: 'a'.repeat(64),
        artifactUri: 'r2://ecu-artifacts/originals/' + 'a'.repeat(64),
        originalName: input.filename,
        sizeBytes: input.bytes.byteLength,
        existed: false,
      };
    },
  });

  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-ecu-filename': 'passat-original.bin',
    },
    body: bytes,
  }), {}, {});

  assert.equal(response.status, 201);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].filename, 'passat-original.bin');
  assert.deepEqual([...uploaded[0].bytes], [...bytes]);
  const payload = await response.json();
  assert.equal(payload.file.id, 'a'.repeat(64));
  assert.equal(payload.file.sha256, 'a'.repeat(64));
  assert.equal(payload.file.sizeBytes, 4);
});

test('rejects empty or oversized ECU uploads before storage', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal() { throw new Error('should not run'); },
    maxUploadBytes: 4,
  });

  let response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Uint8Array([]),
  }), {}, {});
  assert.equal(response.status, 400);

  response = await runtime.fetch(request('/api/ecu/files', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: Uint8Array.from([1, 2, 3, 4, 5]),
  }), {}, {});
  assert.equal(response.status, 413);
});

test('upload-and-analyze pipeline stores the original first and queues analysis by immutable file id', async () => {
  const calls = [];
  const runtime = createEcuRuntime(coreFallback(), {
    async uploadOriginal(_env, input) {
      calls.push(['upload', input.filename, input.bytes.byteLength]);
      return { id: 'b'.repeat(64), sha256: 'b'.repeat(64), sizeBytes: input.bytes.byteLength, existed: false };
    },
    async createJob(_env, input) {
      calls.push(['job', input.fileId, input.operation]);
      return { id: 'job-analysis-1', fileId: input.fileId, operation: input.operation, state: 'QUEUED' };
    },
  });

  const response = await runtime.fetch(request('/api/ecu/analyze-file', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-ecu-filename': 'ori.bin' },
    body: Uint8Array.from([9, 8, 7]),
  }), {}, {});

  assert.equal(response.status, 202);
  assert.deepEqual(calls, [
    ['upload', 'ori.bin', 3],
    ['job', 'b'.repeat(64), 'analyze'],
  ]);
  const payload = await response.json();
  assert.equal(payload.file.id, 'b'.repeat(64));
  assert.equal(payload.job.id, 'job-analysis-1');
  assert.equal(payload.job.state, 'QUEUED');
});


test('manual training endpoint triggers controlled retraining check', async () => {
  const calls = [];
  const training = {
    async maybeRun(_env, timestamp) {
      calls.push(timestamp);
      return { scheduled: true, job: { id: 'training-1' } };
    },
    async status() { return { status: 'READY_TO_TRAIN' }; },
  };
  const runtime = createEcuRuntime(coreFallback(), { training });
  const response = await runtime.fetch(request('/api/ecu/training/run', { method: 'POST' }), {}, {});
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.scheduled, true);
  assert.equal(calls.length, 1);
});


test('lists persisted map candidates for an analysis job', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async listMaps(_env, jobId) {
      assert.equal(jobId, 'job-1');
      return [{ id: 'job-1-map-0', offset: 128, rows: 8, cols: 8, semanticLabel: 'UNKNOWN', confidence: .91 }];
    },
  });
  const response = await runtime.fetch(request('/api/ecu/jobs/job-1/maps'), {}, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.maps[0].id, 'job-1-map-0');
  assert.equal(body.maps[0].offset, 128);
});


test('exposes compute availability status without requiring the laptop', async () => {
  const runtime = createEcuRuntime(coreFallback(), {
    async computeStatus() {
      return { localOnline: false, cloudContainerReady: true, cloudUrlReady: false, preferred: 'cloud-container' };
    },
  });
  const response = await runtime.fetch(request('/api/ecu/compute/status'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    localOnline: false,
    cloudContainerReady: true,
    cloudUrlReady: false,
    preferred: 'cloud-container',
  });
});
