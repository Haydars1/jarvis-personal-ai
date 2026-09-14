const encoder = new TextEncoder();
const decoder = new TextDecoder();

let credentialKeyCache = { source: '', key: null };

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export async function readJson(request, fallback = {}) {
  try { return await request.json(); } catch { return fallback; }
}

export async function queryAll(env, sql, ...bind) {
  return (await env.DB.prepare(sql).bind(...bind).all()).results || [];
}

export async function queryOne(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).first();
}

export async function execute(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).run();
}

export async function settleWithin(promise, ms, fallback) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithTimeout(input, init = {}, ms = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function fromBase64Url(value) {
  let source = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
  while (source.length % 4) source += '=';
  return Uint8Array.from(atob(source), char => char.charCodeAt(0));
}

async function credentialKey(env) {
  const source = String(env.CREDENTIAL_MASTER_KEY || '').trim();
  if (source.length < 24) throw new Error('CREDENTIAL_MASTER_KEY_NOT_SET');
  if (credentialKeyCache.source === source && credentialKeyCache.key) return credentialKeyCache.key;

  let bytes = null;
  try {
    const decoded = Uint8Array.from(atob(source.replace(/\s+/g, '')), char => char.charCodeAt(0));
    if ([16, 24, 32].includes(decoded.length)) bytes = decoded;
  } catch {}

  if (!bytes) bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(source)));

  const key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  credentialKeyCache = { source, key };
  return key;
}

export async function encryptCredential(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await credentialKey(env);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(String(value))
  ));
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptCredential(env, blob) {
  const [iv, ciphertext] = String(blob || '').split('.');
  if (!iv || !ciphertext) throw new Error('INVALID_CREDENTIAL_BLOB');
  const key = await credentialKey(env);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    key,
    fromBase64Url(ciphertext)
  );
  return decoder.decode(plaintext);
}
