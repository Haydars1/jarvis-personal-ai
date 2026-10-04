import type { Env } from '../env';

export interface NativeAdminIdentity {
  email: string;
  sub: string;
}

const COOKIE_NAME = '6006_admin_session';
const SESSION_SECONDS = 24 * 60 * 60;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const raw = atob(padded);
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function cookieValue(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=') || null;
  }
  return null;
}

export function nativeAdminConfigured(env: Env): boolean {
  return Boolean(env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET);
}

export async function verifyAdminCredentials(email: string, password: string, env: Env): Promise<boolean> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !password) return false;
  if (email.trim().toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) return false;
  const actual = await sha256Hex(password);
  return safeEqual(actual, env.ADMIN_PASSWORD_HASH.trim().toLowerCase());
}

export async function createAdminSessionCookie(email: string, env: Env, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!env.ADMIN_SESSION_SECRET) throw new Error('admin_session_secret_missing');
  const payload = base64UrlEncode(JSON.stringify({ email: email.toLowerCase(), exp: nowSeconds + SESSION_SECONDS }));
  const signature = await sign(payload, env.ADMIN_SESSION_SECRET);
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function verifyAdminSession(
  request: Request,
  env: Env,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<NativeAdminIdentity | null> {
  if (!nativeAdminConfigured(env) || !env.ADMIN_SESSION_SECRET || !env.ADMIN_EMAIL) return null;
  const value = cookieValue(request);
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = await sign(payload, env.ADMIN_SESSION_SECRET);
  if (!safeEqual(signature, expected)) return null;

  const decoded = base64UrlDecode(payload);
  if (!decoded) return null;
  try {
    const data = JSON.parse(decoded) as { email?: unknown; exp?: unknown };
    if (typeof data.email !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp <= nowSeconds) return null;
    if (data.email.toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) return null;
    return { email: data.email, sub: `native:${data.email}` };
  } catch {
    return null;
  }
}
