// Optional FreeLLMAPI adapter. Gateway credentials remain in hayırlıevlad's
// encrypted vault; this module never installs FreeLLMAPI or stores upstream keys.
// https://github.com/tashfeenahmed/freellmapi
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.test', '.invalid'];
const PRIVATE_V4 = /^(?:0|10|127|169\.254|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./;

export function normalizeFreeLlmApiEndpoint(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    const host = url.hostname.toLowerCase();
    // Workers must never send the unified key to local/LAN/non-TLS endpoints.
    // IPv6 literals and all IP literals are deliberately disallowed.
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !host.includes('.') || /^\[.*\]$/.test(host) ||
        PRIVATE_V4.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix)) ||
        ['/v1','/v1/'].includes(url.pathname) === false) {
      throw new Error('INVALID_ENDPOINT');
    }
    return url.origin + '/v1';
  } catch {
    throw new Error('FREELLMAPI_HTTPS_PUBLIC_V1_URL_REQUIRED');
  }
}

export async function listFreeLlmApiModels(endpoint, key, { transport = fetch, timeoutMs = 6500 } = {}) {
  const base = normalizeFreeLlmApiEndpoint(endpoint);
  const token = String(key || '').trim();
  if (!token) throw new Error('FREELLMAPI_KEY_REQUIRED');
  const response = await transport(base + '/models', {
    method: 'GET',
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error'
  });
  if (!response.ok) throw new Error('FREELLMAPI_HTTP_' + response.status);
  const content = await response.text();
  if (content.length > 512_000) throw new Error('FREELLMAPI_CATALOG_TOO_LARGE');
  let data;
  try { data = JSON.parse(content); } catch { throw new Error('FREELLMAPI_INVALID_MODELS_JSON'); }
  if (!Array.isArray(data?.data)) throw new Error('FREELLMAPI_INVALID_MODELS_RESPONSE');
  return data.data.filter(m => typeof m?.id === 'string').map(m => m.id).slice(0, 1000);
}
