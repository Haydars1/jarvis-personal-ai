// hayırlıevlad D1 Database Helpers
// Language: JavaScript (Cloudflare Workers ESM)

import { now, id } from './core.js';

export async function q1(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).first();
}

export async function qall(env, sql, ...bind) {
  return (await env.DB.prepare(sql).bind(...bind).all()).results || [];
}

export async function run(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).run();
}

export async function kvGet(env, key, fb = null) {
  const r = await q1(env, 'SELECT value FROM kv WHERE key=?', key);
  if (!r) return fb;
  try { return JSON.parse(r.value); } catch { return r.value; }
}

export async function kvSet(env, key, val) {
  await run(env, 'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', key, JSON.stringify(val), now());
}

export async function log(env, kind, text, meta = {}) {
  await run(env, 'INSERT INTO logs(id,ts,kind,text,meta) VALUES(?,?,?,?,?)', id(), now(), kind, text, JSON.stringify(meta));
  await run(env, 'DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY ts DESC LIMIT -1 OFFSET 1000)');
}
