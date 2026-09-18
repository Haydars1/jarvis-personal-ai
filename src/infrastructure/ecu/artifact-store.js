function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return toHex(await crypto.subtle.digest('SHA-256', view));
}

export function createEcuArtifactStore(bucket) {
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function') {
    throw new Error('ECU_ARTIFACTS binding is required');
  }

  return {
    async putOriginal(bytes, { filename = 'original.bin', contentType = 'application/octet-stream' } = {}) {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const digest = await sha256(view);
      const key = `originals/${digest}`;
      const existing = typeof bucket.head === 'function' ? await bucket.head(key) : null;
      if (!existing) {
        await bucket.put(key, view, {
          httpMetadata: { contentType },
          customMetadata: {
            sha256: digest,
            originalName: String(filename).slice(0, 180),
            immutable: 'true',
          },
        });
      }
      return { sha256: digest, key, sizeBytes: view.byteLength, existed: Boolean(existing) };
    },

    async getOriginal(digest) {
      const object = await bucket.get(`originals/${digest}`);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },

    async putDatasetSnapshot(snapshot) {
      const digest = String(snapshot?.digest || '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('INVALID_DATASET_DIGEST');
      const key = `datasets/${digest}.json`;
      const existing = typeof bucket.head === 'function' ? await bucket.head(key) : null;
      if (!existing) {
        const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
        await bucket.put(key, bytes, {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            digest,
            version: String(snapshot?.version || ''),
            immutable: 'true',
          },
        });
      }
      return { digest, key, existed: Boolean(existing) };
    },

    async getDatasetSnapshot(digest) {
      const object = await bucket.get(`datasets/${String(digest).toLowerCase()}.json`);
      if (!object) return null;
      const bytes = new Uint8Array(await object.arrayBuffer());
      return JSON.parse(new TextDecoder().decode(bytes));
    },

    async putModelArtifact(modelJson, { modelVersion = '' } = {}) {
      const bytes = new TextEncoder().encode(String(modelJson || ''));
      const digest = await sha256(bytes);
      const key = `models/${digest}.json`;
      const existing = typeof bucket.head === 'function' ? await bucket.head(key) : null;
      if (!existing) {
        await bucket.put(key, bytes, {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            sha256: digest,
            modelVersion: String(modelVersion),
            immutable: 'true',
          },
        });
      }
      return { sha256: digest, key, existed: Boolean(existing) };
    },
  };
}
