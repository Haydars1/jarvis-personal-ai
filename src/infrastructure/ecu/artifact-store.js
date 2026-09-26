import { createGoogleDriveBackend } from './google-drive-artifact-store.js';

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return toHex(await crypto.subtle.digest('SHA-256', view));
}

export function createEcuArtifactStore(bucket, db, googleDrive = null) {
  const hasBucket=Boolean(bucket&&typeof bucket.put==='function'&&typeof bucket.get==='function');
  const hasDrive=Boolean(googleDrive?.clientId&&googleDrive?.clientSecret&&googleDrive?.refreshToken);
  if(!hasBucket&&!hasDrive&&!db) throw new Error('ECU artifact storage is required');
  const backend = hasBucket ? bucket : hasDrive ? createGoogleDriveBackend(googleDrive) : {
    async head(key) {
      const row=await db.prepare('SELECT size_bytes FROM ecu_artifact_objects WHERE object_key=? LIMIT 1').bind(key).first();
      return row?{size:Number(row.size_bytes||0)}:null;
    },
    async put(key,value,options={}) {
      const bytes=value instanceof Uint8Array?value:new Uint8Array(value), chunkSize=512*1024, createdAt=Date.now();
      await db.prepare('DELETE FROM ecu_artifact_chunks WHERE object_key=?').bind(key).run();
      for(let offset=0,index=0;offset<bytes.byteLength;offset+=chunkSize,index++){
        await db.prepare('INSERT INTO ecu_artifact_chunks(object_key,chunk_index,data) VALUES(?,?,?)').bind(key,index,bytes.slice(offset,Math.min(offset+chunkSize,bytes.byteLength))).run();
      }
      await db.prepare(`INSERT INTO ecu_artifact_objects(object_key,size_bytes,content_type,metadata_json,created_at) VALUES(?,?,?,?,?)
        ON CONFLICT(object_key) DO UPDATE SET size_bytes=excluded.size_bytes,content_type=excluded.content_type,metadata_json=excluded.metadata_json`)
        .bind(key,bytes.byteLength,String(options?.httpMetadata?.contentType||'application/octet-stream'),JSON.stringify(options?.customMetadata||{}),createdAt).run();
    },
    async get(key) {
      const meta=await db.prepare('SELECT size_bytes FROM ecu_artifact_objects WHERE object_key=? LIMIT 1').bind(key).first(); if(!meta)return null;
      const rows=(await db.prepare('SELECT data FROM ecu_artifact_chunks WHERE object_key=? ORDER BY chunk_index ASC').bind(key).all()).results||[];
      const parts=rows.map(row=>new Uint8Array(row.data)),total=parts.reduce((n,p)=>n+p.byteLength,0),joined=new Uint8Array(total);let offset=0;
      for(const part of parts){joined.set(part,offset);offset+=part.byteLength;} return {arrayBuffer:async()=>joined.buffer};
    },
  };
  return {
    async putOriginal(bytes, { filename = 'original.bin', contentType = 'application/octet-stream' } = {}) {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const digest = await sha256(view);
      const key = `originals/${digest}`;
      const existing = typeof backend.head === 'function' ? await backend.head(key) : null;
      if (!existing) {
        await backend.put(key, view, {
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
      const object = await backend.get(`originals/${digest}`);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },

    async putValidatedMod(bytes, { jobId = '', checksumAlgorithm = '' } = {}) {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const digest = await sha256(view);
      const key = `mods/${digest}`;
      const existing = typeof backend.head === 'function' ? await backend.head(key) : null;
      if (!existing) {
        await backend.put(key, view, {
          httpMetadata: { contentType: 'application/octet-stream' },
          customMetadata: {
            sha256: digest,
            jobId: String(jobId),
            checksumAlgorithm: String(checksumAlgorithm),
            validated: 'true',
            immutable: 'true',
          },
        });
      }
      return { sha256: digest, key, sizeBytes: view.byteLength, existed: Boolean(existing) };
    },

    async getValidatedMod(digest) {
      const object = await backend.get(`mods/${String(digest).toLowerCase()}`);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },

    async putDatasetSnapshot(snapshot) {
      const digest = String(snapshot?.digest || '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('INVALID_DATASET_DIGEST');
      const key = `datasets/${digest}.json`;
      const existing = typeof backend.head === 'function' ? await backend.head(key) : null;
      if (!existing) {
        const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
        await backend.put(key, bytes, {
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
      const object = await backend.get(`datasets/${String(digest).toLowerCase()}.json`);
      if (!object) return null;
      const bytes = new Uint8Array(await object.arrayBuffer());
      return JSON.parse(new TextDecoder().decode(bytes));
    },

    async getModelArtifact(digest) {
      const object = await backend.get(`models/${String(digest).toLowerCase()}.json`);
      if (!object) return null;
      const bytes = new Uint8Array(await object.arrayBuffer());
      return new TextDecoder().decode(bytes);
    },

    async putModelArtifact(modelJson, { modelVersion = '' } = {}) {
      const bytes = new TextEncoder().encode(String(modelJson || ''));
      const digest = await sha256(bytes);
      const key = `models/${digest}.json`;
      const existing = typeof backend.head === 'function' ? await backend.head(key) : null;
      if (!existing) {
        await backend.put(key, bytes, {
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
