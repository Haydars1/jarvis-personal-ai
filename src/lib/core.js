// JARVIS Core Utilities — zero-dependency foundation
// Language: JavaScript (Cloudflare Workers ESM)

export const te = new TextEncoder();
export const td = new TextDecoder();
export const nativeFetch = fetch;

export async function fetchT(input, init = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await nativeFetch(input, { ...init, signal: init.signal || c.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function withTimeout(promise, ms, label = 'TIMEOUT') {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { t = setTimeout(() => reject(Error(label)), ms); })
    ]);
  } finally {
    clearTimeout(t);
  }
}

export const now = () => Date.now();
export const id = () => crypto.randomUUID();

export const j = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

export const txt = (s, status = 200) => new Response(s, {
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8' }
});

export const parseCookies = req => Object.fromEntries(
  (req.headers.get('cookie') || '').split(';').filter(Boolean).map(x => {
    const [k, ...v] = x.trim().split('=');
    return [k, decodeURIComponent(v.join('='))];
  })
);

export function safeJsonParse(s, fb = null) {
  try { return JSON.parse(s); } catch { return fb; }
}

export async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

export function privateHost(host) {
  host = host.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host.endsWith('.local') || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
