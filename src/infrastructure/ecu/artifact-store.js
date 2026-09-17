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
  };
}
