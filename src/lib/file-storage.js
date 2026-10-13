// JARVIS D1-backed File Storage — auto-chunks files >1.5MB
// Language: JavaScript (Cloudflare Workers ESM)

import { te, td } from './core.js';
import { q1, qall, run } from './d1.js';

export const FILE_CHUNK = 1536 * 1024; // 1.5MB per chunk (D1 row limit ~2MB)

export async function filePut(env, key, data, opts = {}) {
  const ct = opts?.httpMetadata?.contentType || opts?.contentType || 'application/octet-stream';
  const buf = data instanceof ArrayBuffer ? new Uint8Array(data)
    : data instanceof Uint8Array ? data
    : typeof data === 'string' ? te.encode(data)
    : new Uint8Array(await new Response(data).arrayBuffer());
  if (buf.byteLength <= FILE_CHUNK) {
    await run(env, 'DELETE FROM file_chunks WHERE key=?', key);
    await run(env, 'INSERT INTO files(key,data,content_type,size,total_chunks) VALUES(?,?,?,?,0) ON CONFLICT(key) DO UPDATE SET data=excluded.data,content_type=excluded.content_type,size=excluded.size,total_chunks=0,created_at=CURRENT_TIMESTAMP', key, buf, ct, buf.byteLength);
  } else {
    const chunks = Math.ceil(buf.byteLength / FILE_CHUNK);
    await run(env, 'DELETE FROM file_chunks WHERE key=?', key);
    for (let i = 0; i < chunks; i++) {
      const slice = buf.slice(i * FILE_CHUNK, Math.min((i + 1) * FILE_CHUNK, buf.byteLength));
      await run(env, 'INSERT INTO file_chunks(key,chunk_index,data) VALUES(?,?,?) ON CONFLICT(key,chunk_index) DO UPDATE SET data=excluded.data', key, i, slice);
    }
    await run(env, 'INSERT INTO files(key,data,content_type,size,total_chunks) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,content_type=excluded.content_type,size=excluded.size,total_chunks=excluded.total_chunks,created_at=CURRENT_TIMESTAMP', key, new Uint8Array(0), ct, buf.byteLength, chunks);
  }
}

export function d1Bytes(v) {
  return v instanceof ArrayBuffer ? new Uint8Array(v)
    : v instanceof Uint8Array ? v
    : typeof v === 'string' ? Uint8Array.from(atob(v), c => c.charCodeAt(0))
    : new Uint8Array(0);
}

export async function fileGet(env, key) {
  const r = await q1(env, 'SELECT data,content_type,size,total_chunks,created_at FROM files WHERE key=?', key);
  if (!r) return null;
  let bytes;
  if (!r.total_chunks || r.total_chunks === 0) {
    bytes = d1Bytes(r.data);
  } else {
    const rows = await qall(env, 'SELECT data FROM file_chunks WHERE key=? ORDER BY chunk_index', key);
    const parts = rows.map(r => d1Bytes(r.data));
    const total = parts.reduce((s, p) => s + p.byteLength, 0);
    bytes = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { bytes.set(p, off); off += p.byteLength; }
  }
  return {
    body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }),
    httpMetadata: { contentType: r.content_type },
    size: r.size,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

export async function fileList(env, opts = {}) {
  const limit = Math.min(opts.limit || 100, 500);
  const rows = await qall(env, 'SELECT key,content_type,size,created_at FROM files ORDER BY created_at DESC LIMIT ?', limit);
  return { objects: rows.map(r => ({ key: r.key, size: r.size, uploaded: r.created_at })) };
}

export async function fileDelete(env, key) {
  await run(env, 'DELETE FROM file_chunks WHERE key=?', key);
  await run(env, 'DELETE FROM files WHERE key=?', key);
}
