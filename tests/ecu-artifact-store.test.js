import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuArtifactStore } from '../src/infrastructure/ecu/artifact-store.js';

class FakeBucket {
  constructor() { this.objects = new Map(); this.putCalls = 0; }
  async head(key) { return this.objects.has(key) ? { key } : null; }
  async put(key, value, options = {}) {
    this.putCalls++;
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.objects.set(key, { key, bytes: new Uint8Array(bytes), ...options });
  }
  async get(key) {
    const row = this.objects.get(key);
    if (!row) return null;
    return { arrayBuffer: async () => row.bytes.buffer.slice(row.bytes.byteOffset, row.bytes.byteOffset + row.bytes.byteLength) };
  }
}

test('stores originals content-addressed and never overwrites identical content', async () => {
  const bucket = new FakeBucket();
  const store = createEcuArtifactStore(bucket);
  const bytes = new TextEncoder().encode('ecu-original');

  const first = await store.putOriginal(bytes, { filename: 'car.bin', contentType: 'application/octet-stream' });
  const second = await store.putOriginal(bytes, { filename: 'renamed.bin' });

  assert.match(first.sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.key, `originals/${first.sha256}`);
  assert.equal(second.key, first.key);
  assert.equal(bucket.putCalls, 1);
  assert.equal(first.sizeBytes, bytes.byteLength);
});

test('reads back exact original bytes', async () => {
  const bucket = new FakeBucket();
  const store = createEcuArtifactStore(bucket);
  const bytes = Uint8Array.from([0, 1, 2, 3, 254, 255]);
  const meta = await store.putOriginal(bytes, { filename: 'x.bin' });
  const restored = await store.getOriginal(meta.sha256);
  assert.deepEqual([...restored], [...bytes]);
});

test('fails explicitly when object storage binding is missing', async () => {
  assert.throws(() => createEcuArtifactStore(null), /ECU_ARTIFACTS binding/);
});


test('stores dataset snapshots content-addressed and reads JSON back', async () => {
  const bucket = new FakeBucket();
  const store = createEcuArtifactStore(bucket);
  const snapshot = { version: 'dataset-1', digest: 'd'.repeat(64), examples: [{ semantic_label: 'torque_limiter' }] };
  const saved = await store.putDatasetSnapshot(snapshot);
  assert.equal(saved.key, 'datasets/' + 'd'.repeat(64) + '.json');
  const restored = await store.getDatasetSnapshot('d'.repeat(64));
  assert.deepEqual(restored, snapshot);
});


test('stores semantic model artifacts content-addressed and immutable', async () => {
  const bucket = new FakeBucket();
  const store = createEcuArtifactStore(bucket);
  const modelJson = '{"version":1,"labels":{}}';
  const first = await store.putModelArtifact(modelJson, { modelVersion: 'candidate-1' });
  const second = await store.putModelArtifact(modelJson, { modelVersion: 'candidate-2' });
  assert.match(first.sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.key, 'models/' + first.sha256 + '.json');
  assert.equal(second.key, first.key);
  assert.equal(bucket.putCalls, 1);
});


test('reads semantic model artifact back by digest', async () => {
  const bucket = new FakeBucket();
  const store = createEcuArtifactStore(bucket);
  const modelJson = '{"version":1,"labels":{"torque_limiter":{}}}';
  const saved = await store.putModelArtifact(modelJson, { modelVersion: 'model-1' });
  const restored = await store.getModelArtifact(saved.sha256);
  assert.equal(restored, modelJson);
});
