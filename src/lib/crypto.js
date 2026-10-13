// JARVIS Crypto — HMAC, JWT-like tokens, AES-GCM credential encryption, CBOR, SHA-256
// Language: JavaScript (Cloudflare Workers ESM)

import { te, td } from './core.js';

export async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, te.encode(data)))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sign(secret, p) {
  const b = btoa(JSON.stringify(p)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${b}.${await hmac(secret, b)}`;
}

export async function verify(secret, t) {
  try {
    const [b, s] = String(t || '').split('.');
    if (!b || !s || await hmac(secret, b) !== s) return null;
    const p = JSON.parse(atob(b.replaceAll('-', '+').replaceAll('_', '/')));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export async function hashPassword(p, s) {
  const key = await crypto.subtle.importKey('raw', te.encode(p), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(s), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function masterKey(env) {
  const raw = String(env.CREDENTIAL_MASTER_KEY || '').trim();
  if (raw.length < 24) throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');
  let keyBytes = null;
  try {
    const decoded = Uint8Array.from(atob(raw.replace(/\s+/g, '')), c => c.charCodeAt(0));
    if (decoded.length === 16 || decoded.length === 24 || decoded.length === 32) keyBytes = decoded;
  } catch {}
  if (!keyBytes) keyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(raw)));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function b64u(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function fromB64u(s) {
  s = s.replaceAll('-', '+').replaceAll('_', '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

export async function encSecret(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await masterKey(env);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, te.encode(String(plain))));
  return b64u(iv) + '.' + b64u(ct);
}

export async function decSecret(env, blob) {
  const [a, b] = String(blob || '').split('.');
  if (!a || !b) throw Error('INVALID_CREDENTIAL_BLOB');
  const k = await masterKey(env);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(a) }, k, fromB64u(b));
  return td.decode(pt);
}

export function randB64u(n = 32) {
  return b64u(crypto.getRandomValues(new Uint8Array(n)));
}

export function bytesEq(a, b) {
  a = new Uint8Array(a);
  b = new Uint8Array(b);
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i];
  return x === 0;
}

export async function sha256(x) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', x instanceof Uint8Array ? x : te.encode(String(x))));
}

export function readCbor(data, off = 0) {
  const a = data instanceof Uint8Array ? data : new Uint8Array(data);
  const h = a[off++], major = h >> 5, add = h & 31;
  let len;
  if (add < 24) len = add;
  else if (add === 24) len = a[off++];
  else if (add === 25) { len = (a[off] << 8) | a[off + 1]; off += 2; }
  else if (add === 26) { len = (a[off] * 2 ** 24) + (a[off + 1] << 16) + (a[off + 2] << 8) + a[off + 3]; off += 4; }
  else throw Error('CBOR_UNSUPPORTED');
  if (major === 0) return [len, off];
  if (major === 1) return [-1 - len, off];
  if (major === 2) { const v = a.slice(off, off + len); return [v, off + len]; }
  if (major === 3) { const v = td.decode(a.slice(off, off + len)); return [v, off + len]; }
  if (major === 4) { const arr = []; for (let i = 0; i < len; i++) { const [v, n] = readCbor(a, off); arr.push(v); off = n; } return [arr, off]; }
  if (major === 5) { const m = new Map(); for (let i = 0; i < len; i++) { let k, v; [k, off] = readCbor(a, off); [v, off] = readCbor(a, off); m.set(k, v); } return [m, off]; }
  if (major === 7 && len === 20) return [false, off];
  if (major === 7 && len === 21) return [true, off];
  if (major === 7 && len === 22) return [null, off];
  throw Error('CBOR_TYPE_UNSUPPORTED');
}
