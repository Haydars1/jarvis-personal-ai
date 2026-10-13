// JARVIS Auth — session helpers + WebAuthn/Passkey (Face ID)
// Language: JavaScript (Cloudflare Workers ESM)

import { te, td, now, parseCookies, safeJsonParse, body } from './core.js';
import { q1, qall, run, kvGet, kvSet, log } from './d1.js';
import { sign, verify, b64u, fromB64u, randB64u, bytesEq, sha256, readCbor } from './crypto.js';

// --- Session auth ---

export async function isAuthed(req, env) {
  const c = parseCookies(req);
  return !!(await verify(env.JARVIS_SECRET || 'CHANGE_ME', c.jarvis_session));
}

export function cookie(v, max = 2592000) {
  return `jarvis_session=${encodeURIComponent(v)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${max}`;
}

// --- Passkey / WebAuthn ---

export async function passkeyCount(env) {
  const r = await q1(env, 'SELECT COUNT(*) n FROM passkeys');
  return Number(r?.n || 0);
}

export async function passkeys(env) {
  return qall(env, 'SELECT id,counter,transports,device_type,backed_up,created_at,last_used_at FROM passkeys ORDER BY created_at DESC');
}

export function rpFrom(req) {
  const u = new URL(req.url);
  return { rpID: u.hostname, origin: u.origin, rpName: 'JARVIS Personal AI' };
}

export async function registrationOptions(req, env) {
  const rp = rpFrom(req), challenge = randB64u(), existing = await passkeys(env);
  await kvSet(env, 'passkey_reg_challenge', { challenge, ts: now() });
  return {
    challenge,
    rp: { name: rp.rpName, id: rp.rpID },
    user: { id: b64u(te.encode('jarvis-owner')), name: 'jarvis-owner', displayName: 'JARVIS Owner' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: existing.map(x => ({ type: 'public-key', id: x.id, transports: safeJsonParse(x.transports, []) })),
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required', authenticatorAttachment: 'platform' }
  };
}

export function coseToJwk(cose) {
  const [m] = readCbor(cose, 0);
  if (!(m instanceof Map)) throw Error('COSE_INVALID');
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && m.get(-1) === 1) {
    return { jwk: { kty: 'EC', crv: 'P-256', x: b64u(m.get(-2)), y: b64u(m.get(-3)), ext: true }, alg: alg || -7 };
  }
  if (kty === 3) {
    return { jwk: { kty: 'RSA', n: b64u(m.get(-1)), e: b64u(m.get(-2)), ext: true }, alg: alg || -257 };
  }
  throw Error('COSE_KEY_UNSUPPORTED');
}

export async function verifyClient(clientDataB64, expectedChallenge, expectedOrigin, type) {
  const raw = fromB64u(clientDataB64), d = JSON.parse(td.decode(raw));
  if (d.type !== type || d.challenge !== expectedChallenge || d.origin !== expectedOrigin) throw Error('PASSKEY_CLIENT_DATA_INVALID');
  return { raw, hash: await sha256(raw) };
}

export async function parseAuthData(authData, rpID) {
  const a = authData instanceof Uint8Array ? authData : new Uint8Array(authData);
  if (a.length < 37) throw Error('AUTH_DATA_SHORT');
  const expected = await sha256(rpID);
  if (!bytesEq(a.slice(0, 32), expected)) throw Error('RPID_HASH_MISMATCH');
  const flags = a[32], counter = (a[33] * 2 ** 24) + (a[34] << 16) + (a[35] << 8) + a[36];
  if (!(flags & 0x04)) throw Error('USER_VERIFICATION_REQUIRED');
  return { a, flags, counter };
}

export async function verifyRegistration(req, env) {
  const b = await body(req), rp = rpFrom(req), ch = await kvGet(env, 'passkey_reg_challenge', null);
  if (!ch?.challenge || now() - ch.ts > 120000) return { ok: false, error: 'PASSKEY_CHALLENGE_EXPIRED' };
  try {
    await verifyClient(b.response.clientDataJSON, ch.challenge, rp.origin, 'webauthn.create');
    const [att] = readCbor(fromB64u(b.response.attestationObject), 0);
    const authData = att.get('authData');
    const parsed = await parseAuthData(authData, rp.rpID);
    if (!(parsed.flags & 0x40)) throw Error('ATTESTED_CREDENTIAL_MISSING');
    let o = 37 + 16;
    const idLen = (parsed.a[o] << 8) | parsed.a[o + 1]; o += 2;
    const credId = b64u(parsed.a.slice(o, o + idLen)); o += idLen;
    const { jwk, alg } = coseToJwk(parsed.a.slice(o));
    if (credId !== b.id) throw Error('CREDENTIAL_ID_MISMATCH');
    await run(env, 'INSERT OR REPLACE INTO passkeys(id,public_key,counter,transports,device_type,backed_up,created_at,last_used_at) VALUES(?,?,?,?,?,?,?,?)',
      credId, JSON.stringify({ jwk, alg }), parsed.counter, JSON.stringify(b.response.transports || []),
      b.authenticatorAttachment || 'platform', 1, now(), null);
    await kvSet(env, 'passkey_reg_challenge', null);
    await log(env, 'auth', 'Face ID / Passkey kaydedildi', { credential: credId.slice(0, 10) });
    return { ok: true, verified: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function authenticationOptions(req, env) {
  const rp = rpFrom(req), keys = await passkeys(env);
  if (!keys.length) return { error: 'NO_PASSKEY', status: 404 };
  const challenge = randB64u();
  await kvSet(env, 'passkey_auth_challenge', { challenge, ts: now() });
  return {
    challenge, rpId: rp.rpID, timeout: 60000, userVerification: 'required',
    allowCredentials: keys.map(x => ({ type: 'public-key', id: x.id, transports: safeJsonParse(x.transports, []) }))
  };
}

export function derToRawEcdsa(sig, size = 32) {
  const a = sig instanceof Uint8Array ? sig : new Uint8Array(sig);
  if (a[0] !== 0x30) return a;
  let o = 1;
  let seq = a[o++]; if (seq & 0x80) { const n = seq & 0x7f; o += n; }
  if (a[o++] !== 0x02) throw Error('ECDSA_DER_R');
  let rl = a[o++]; let r = a.slice(o, o + rl); o += rl;
  if (a[o++] !== 0x02) throw Error('ECDSA_DER_S');
  let sl = a[o++]; let ss = a.slice(o, o + sl);
  while (r.length > size && r[0] === 0) r = r.slice(1);
  while (ss.length > size && ss[0] === 0) ss = ss.slice(1);
  const out = new Uint8Array(size * 2);
  out.set(r.slice(-size), size - r.slice(-size).length);
  out.set(ss.slice(-size), size * 2 - ss.slice(-size).length);
  return out;
}

export async function verifyAuthentication(req, env) {
  const b = await body(req), rp = rpFrom(req), ch = await kvGet(env, 'passkey_auth_challenge', null);
  if (!ch?.challenge || now() - ch.ts > 120000) return { ok: false, error: 'PASSKEY_CHALLENGE_EXPIRED' };
  const pk = await q1(env, 'SELECT * FROM passkeys WHERE id=?', b.id);
  if (!pk) return { ok: false, error: 'PASSKEY_NOT_FOUND' };
  try {
    const client = await verifyClient(b.response.clientDataJSON, ch.challenge, rp.origin, 'webauthn.get'),
      authData = fromB64u(b.response.authenticatorData),
      parsed = await parseAuthData(authData, rp.rpID),
      sig = fromB64u(b.response.signature),
      stored = safeJsonParse(pk.public_key, {}),
      signed = new Uint8Array(authData.length + client.hash.length);
    signed.set(authData);
    signed.set(client.hash, authData.length);
    let key, ok;
    if (stored.jwk?.kty === 'EC') {
      key = await crypto.subtle.importKey('jwk', stored.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRawEcdsa(sig), signed);
    } else if (stored.jwk?.kty === 'RSA') {
      key = await crypto.subtle.importKey('jwk', stored.jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed);
    } else throw Error('PASSKEY_KEY_UNSUPPORTED');
    if (!ok) throw Error('PASSKEY_SIGNATURE_INVALID');
    if (Number(pk.counter || 0) > 0 && parsed.counter > 0 && parsed.counter <= Number(pk.counter)) throw Error('PASSKEY_COUNTER_INVALID');
    await run(env, 'UPDATE passkeys SET counter=?,last_used_at=? WHERE id=?', parsed.counter, now(), pk.id);
    await kvSet(env, 'passkey_auth_challenge', null);
    const tok = await sign(env.JARVIS_SECRET || 'CHANGE_ME', { sub: 'owner', exp: now() + 2592e6 });
    await log(env, 'auth', 'Face ID / Passkey ile giriş yapıldı');
    return { ok: true, verified: true, cookie: cookie(tok) };
  } catch (e) { return { ok: false, error: e.message }; }
}
