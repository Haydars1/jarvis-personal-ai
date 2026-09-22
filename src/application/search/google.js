import {
  decryptCredential,
  encryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  queryOne,
  readJson,
  settleWithin
} from '../../lib/runtime.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function kvGet(env, key, fallback = null) {
  const row = await queryOne(env, 'SELECT value FROM kv WHERE key=?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}
async function kvSet(env, key, value) {
  await execute(env, 'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', key, JSON.stringify(value), now());
}
async function config(env) {
  const value = await kvGet(env, 'google_search_cfg', null);
  if (!value?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, value.blob)); } catch { return null; }
}

async function searchGoogle(env, query, { num = 10, start = 1, searchType = '' } = {}) {
  const cfg = await config(env);
  if (!cfg) throw new Error('GOOGLE_SEARCH_NOT_CONFIGURED');
  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', cfg.key);
  url.searchParams.set('cx', cfg.cx);
  url.searchParams.set('q', String(query || ''));
  url.searchParams.set('num', String(Math.min(10, Math.max(1, num))));
  url.searchParams.set('start', String(Math.max(1, start)));
  if (searchType === 'image') url.searchParams.set('searchType', 'image');
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, 6000);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GOOGLE_SEARCH_${response.status}${text ? `:${text.slice(0,240)}` : ''}`);
  }
  const payload = await response.json();
  return (payload.items || []).map(item => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    displayLink: item.displayLink || '',
    source: 'Google',
    type: searchType || 'web',
    thumbnail: item.image?.thumbnailLink || null,
    contextUrl: item.image?.contextLink || null,
    mime: item.mime || null
  }));
}

async function setup(req, env) {
  const body = await readJson(req), key = String(body.api_key || '').trim(), cx = String(body.cx || '').trim();
  if (!key || !cx) return jsonResponse({ error: 'GOOGLE_SEARCH_API_KEY_AND_CX_REQUIRED' }, 400);
  await kvSet(env, 'google_search_cfg', { blob: await encryptCredential(env, JSON.stringify({ key, cx })), updated_at: now() });
  const test = await searchGoogle(env, 'OpenAI', { num: 1 });
  return jsonResponse({ ok: true, test: !!test.length });
}
async function status(env) {
  return jsonResponse({ configured: !!(await config(env)), provider: 'Google Programmable Search JSON API' });
}
async function apiSearch(req, env) {
  const url = new URL(req.url), query = String(url.searchParams.get('q') || '').trim();
  if (!query) return jsonResponse({ error: 'QUERY_REQUIRED' }, 400);
  const type = String(url.searchParams.get('type') || '').toLowerCase() === 'image' ? 'image' : '';
  const results = await searchGoogle(env, query, { num: Number(url.searchParams.get('num') || 10), searchType: type });
  return jsonResponse({ provider: 'Google', type: type || 'web', results });
}
function isGoogleIntent(text = '') {
  return /(google'?da|google’da|google dan|google’dan|googledan|google ara|google.?da ara|google search)/i.test(String(text));
}
async function saveMessage(env, role, content, provider = null) {
  await execute(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', uid(), role, String(content || ''), provider, now());
}
async function state(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/state', req.url), { headers: req.headers }), env, ctx);
  try { return await response.json(); } catch { return {}; }
}
async function fullHistory(env, limit = 160) {
  const rows = await queryAll(env, 'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', limit);
  return rows.reverse();
}
async function answerFromGoogle(env, query, results) {
  const compact = results.slice(0, 6).map((row, index) => `[${index + 1}] ${row.title}\n${row.snippet}\n${row.contextUrl || row.url}`).join('\n\n');
  if (!env.AI) return 'Arama sonuçlarını aldım ancak şu anda güvenilir bir özet üretemiyorum. Ham sonuçları sohbet cevabı olarak göstermeyeceğim.';
  const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
    prompt: `Kullanıcı sorusu: ${query}\n\nGoogle arama sonuçları:\n${compact}\n\nYalnız bu sonuçlara dayanarak Türkçe, kısa ve net cevap ver. Kaynakları [1], [2] diye belirt.`,
    max_tokens: 700,
    temperature: 0.2
  });
  const result = await settleWithin(run, 1800, null);
  const text = String(result?.response || result?.result?.response || result?.text || '').trim();
  return text || 'Arama sonuçlarını aldım ancak şu anda güvenilir bir özet üretemiyorum. Ham sonuçları sohbet cevabı olarak göstermeyeceğim.';
}
async function chatGoogle(core, req, env, ctx, text) {
  const results = await searchGoogle(env, text, { num: 8 });
  await saveMessage(env, 'user', text);
  const reply = await answerFromGoogle(env, text, results);
  await saveMessage(env, 'assistant', reply, 'Google Search');
  return jsonResponse({ reply, provider: 'Google Search', results, state: await state(core, req, env, ctx), history: await fullHistory(env) });
}

export function createGoogleSearch(core) {
  if (!core?.fetch) throw new Error('GOOGLE_SEARCH_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url), path = url.pathname, method = req.method;
      if (path === '/api/google-search/status' && method === 'GET') {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        return status(env);
      }
      if (path === '/api/google-search/setup' && method === 'POST') {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        try { return await setup(req, env); }
        catch (error) { return jsonResponse({ error: error.message }, 400); }
      }
      if (path === '/api/google-search' && method === 'GET') {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        try { return await apiSearch(req, env); }
        catch (error) { return jsonResponse({ error: error.message }, 400); }
      }
      if (path === '/api/research' && method === 'GET' && await config(env)) {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        try { return await apiSearch(req, env); } catch {}
      }
      if (path === '/api/chat/send' && method === 'POST') {
        const body = await readJson(req.clone()), text = String(body.text || '').trim();
        if (text && isGoogleIntent(text) && await config(env)) {
          if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
          try { return await chatGoogle(core, req, env, ctx, text); }
          catch (error) { return jsonResponse({ error: error.message }, 500); }
        }
      }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
