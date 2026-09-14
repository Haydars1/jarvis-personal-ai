import {
  decryptCredential,
  encryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryOne,
  readJson
} from '../../lib/runtime.js';

const encoder = new TextEncoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const GRAPH = 'https://graph.facebook.com/v24.0';
const FB_DIALOG = 'https://www.facebook.com/v24.0/dialog/oauth';
const META_SCOPES = ['pages_show_list','pages_read_engagement','pages_manage_posts','instagram_basic','instagram_content_publish'];
const YT_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.upload'];

const textResponse = (text, status = 200) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

async function kvGet(env, key, fallback = null) {
  const row = await queryOne(env, 'SELECT value FROM kv WHERE key=?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}
async function kvSet(env, key, value) {
  await execute(env, 'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', key, JSON.stringify(value), now());
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function sign(secret, payload) {
  const body = btoa(JSON.stringify(payload)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  return `${body}.${await hmac(secret, body)}`;
}
async function verify(secret, token) {
  try {
    const [body, signature] = String(token || '').split('.');
    if (!body || !signature || await hmac(secret, body) !== signature) return null;
    const payload = JSON.parse(atob(body.replaceAll('-','+').replaceAll('_','/')));
    return payload.exp > now() ? payload : null;
  } catch { return null; }
}

async function metaApp(env) {
  const value = await kvGet(env, 'meta_oauth_app', null);
  if (!value?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, value.blob)); } catch { return null; }
}
async function metaSetup(req, env) {
  const body = await readJson(req), appId = String(body.app_id || '').trim(), appSecret = String(body.app_secret || '').trim();
  if (!appId || !appSecret) return jsonResponse({ error: 'META_APP_ID_AND_SECRET_REQUIRED' }, 400);
  await kvSet(env, 'meta_oauth_app', { blob: await encryptCredential(env, JSON.stringify({ appId, appSecret })), updated_at: now() });
  return jsonResponse({ ok: true, redirect: `${new URL(req.url).origin}/api/meta/callback` });
}
async function metaConnect(req, env) {
  const app = await metaApp(env), origin = new URL(req.url).origin, redirect = `${origin}/api/meta/callback`;
  if (!app) return jsonResponse({ error: 'META_APP_SETUP_REQUIRED', setupRequired: true, redirect }, 400);
  const state = await sign(env.JARVIS_SECRET || 'CHANGE_ME', { sub: 'meta-oauth', exp: now() + 600000 });
  const url = `${FB_DIALOG}?${new URLSearchParams({ client_id: app.appId, redirect_uri: redirect, response_type: 'code', scope: META_SCOPES.join(','), state })}`;
  return jsonResponse({ url, redirect });
}

async function saveMetaCredential(env, page) {
  const timestamp = now();
  const existing = await queryOne(env, "SELECT id FROM credentials WHERE provider='meta' ORDER BY created_at DESC LIMIT 1");
  const blob = await encryptCredential(env, page.access_token);
  const instagramId = page.instagram_business_account?.id || null;
  const meta = JSON.stringify({ page_name: page.name || '', facebook_page_id: page.id, instagram_business_id: instagramId });
  if (existing) {
    await execute(env, "UPDATE credentials SET label=?,kind=?,encrypted_secret=?,capabilities=?,endpoint=?,model=?,priority=?,enabled=1,meta=?,last_status='ok',last_error=NULL,last_test_at=?,updated_at=? WHERE id=?", 'Meta / Facebook / Instagram', 'oauth', blob, JSON.stringify(['facebook','instagram']), page.id, instagramId, 15, meta, timestamp, timestamp, existing.id);
    return existing.id;
  }
  const id = uid();
  await execute(env, 'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,last_test_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, 'meta', 'Meta / Facebook / Instagram', 'oauth', blob, JSON.stringify(['facebook','instagram']), page.id, instagramId, 15, 1, meta, 'ok', timestamp, timestamp, timestamp);
  return id;
}

async function storeMetaPages(env, pages) {
  const safe = pages.map(page => ({ id: page.id, name: page.name, access_token: page.access_token, instagram_business_account: page.instagram_business_account || null }));
  await kvSet(env, 'meta_pages', { blob: await encryptCredential(env, JSON.stringify({ pages: safe })), updated_at: now() });
}
async function loadMetaPages(env) {
  const value = await kvGet(env, 'meta_pages', { pages: [] });
  if (value?.blob) {
    try { return JSON.parse(await decryptCredential(env, value.blob)).pages || []; } catch { return []; }
  }
  // Backward-compatible migration from the old plaintext KV representation.
  if (Array.isArray(value?.pages)) {
    const pages = value.pages;
    if (pages.some(page => page.access_token)) await storeMetaPages(env, pages).catch(() => {});
    return pages;
  }
  return [];
}

async function metaCallback(req, env) {
  const url = new URL(req.url);
  const state = await verify(env.JARVIS_SECRET || 'CHANGE_ME', url.searchParams.get('state'));
  if (!state || state.sub !== 'meta-oauth') return textResponse('Invalid Meta OAuth state', 400);
  const app = await metaApp(env);
  if (!app) return textResponse('Meta app setup missing', 400);
  const redirect = `${url.origin}/api/meta/callback`;
  const code = String(url.searchParams.get('code') || '');
  if (!code) return textResponse('Meta authorization code missing', 400);

  let response = await fetchWithTimeout(`${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: app.appId, client_secret: app.appSecret, redirect_uri: redirect, code })}`, {}, 10000);
  if (!response.ok) return textResponse(`Meta token exchange failed ${response.status}`, 400);
  let token = await response.json(), userToken = token.access_token;
  response = await fetchWithTimeout(`${GRAPH}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: userToken })}`, {}, 10000);
  if (response.ok) {
    const longLived = await response.json();
    if (longLived.access_token) userToken = longLived.access_token;
  }
  response = await fetchWithTimeout(`${GRAPH}/me/accounts?${new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account', access_token: userToken })}`, {}, 10000);
  if (!response.ok) return textResponse(`Meta pages request failed ${response.status}`, 400);
  const pages = (await response.json()).data || [];
  await storeMetaPages(env, pages);
  if (!pages.length) return Response.redirect(`${url.origin}/?meta=no_page`, 302);
  const chosen = pages.find(page => page.instagram_business_account?.id) || pages[0];
  await saveMetaCredential(env, chosen);
  return Response.redirect(`${url.origin}/?meta=connected`, 302);
}

async function metaPages(env) {
  return (await loadMetaPages(env)).map(page => ({ id: page.id, name: page.name, instagram_business_id: page.instagram_business_account?.id || null }));
}
async function selectMetaPage(req, env) {
  const body = await readJson(req), id = String(body.page_id || '').trim();
  const page = (await loadMetaPages(env)).find(item => String(item.id) === id);
  if (!page) return jsonResponse({ error: 'META_PAGE_NOT_FOUND' }, 404);
  await saveMetaCredential(env, page);
  return jsonResponse({ ok: true, page: { id: page.id, name: page.name, instagram_business_id: page.instagram_business_account?.id || null } });
}

async function integrationStatus(env) {
  const google = await kvGet(env, 'google_oauth', null), googleScope = String(google?.scope || '');
  const meta = await queryOne(env, "SELECT endpoint,model,meta,last_status,enabled FROM credentials WHERE provider='meta' ORDER BY created_at DESC LIMIT 1");
  const app = await metaApp(env), pages = await metaPages(env);
  let metaInfo = {}; try { metaInfo = JSON.parse(meta?.meta || '{}'); } catch {}
  const googleConfigured = !!(await queryOne(env, "SELECT id FROM credentials WHERE provider='google' AND enabled=1 LIMIT 1"));
  const metaConnected = !!meta && Number(meta.enabled) === 1;
  return jsonResponse({
    google: { configured: googleConfigured, connected: !!google, email: google?.email || '', youtube: googleScope.includes('youtube') },
    youtube: { connected: !!google && googleScope.includes('youtube') },
    meta: { configured: !!app, connected: metaConnected, status: meta?.last_status || null, page_id: meta?.endpoint || null, page_name: metaInfo.page_name || '', instagram_business_id: meta?.model || null, pages },
    facebook: { connected: metaConnected, page_id: meta?.endpoint || null, page_name: metaInfo.page_name || '' },
    instagram: { connected: metaConnected && !!meta.model, business_id: meta?.model || null }
  });
}

async function googleConnectWithYouTube(core, req, env, ctx) {
  const base = await core.fetch(req, env, ctx);
  if (!base.ok) return base;
  let payload; try { payload = await base.clone().json(); } catch { return base; }
  if (!payload?.url) return base;
  try {
    const url = new URL(payload.url);
    const scopes = new Set(String(url.searchParams.get('scope') || '').split(' ').filter(Boolean));
    for (const scope of YT_SCOPES) scopes.add(scope);
    url.searchParams.set('scope', [...scopes].join(' '));
    payload.url = url.toString();
    payload.youtube = true;
    return jsonResponse(payload);
  } catch { return base; }
}

export function createIntegrationHub(core) {
  if (!core?.fetch) throw new Error('INTEGRATION_HUB_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      try {
        const url = new URL(req.url), path = url.pathname, method = req.method;
        if (path === '/api/meta/callback' && method === 'GET') return metaCallback(req, env);
        if (path === '/api/google/connect' && method === 'GET') return googleConnectWithYouTube(core, req, env, ctx);
        if (path.startsWith('/api/integrations/') || path.startsWith('/api/meta/')) {
          if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
          if (path === '/api/integrations/status' && method === 'GET') return integrationStatus(env);
          if (path === '/api/meta/setup' && method === 'POST') return metaSetup(req, env);
          if (path === '/api/meta/connect' && method === 'GET') return metaConnect(req, env);
          if (path === '/api/meta/pages' && method === 'GET') return jsonResponse({ pages: await metaPages(env) });
          if (path === '/api/meta/select-page' && method === 'POST') return selectMetaPage(req, env);
        }
        return core.fetch(req, env, ctx);
      } catch (error) {
        console.error(error);
        return jsonResponse({ error: 'INTEGRATION_HUB_ERROR', detail: error.message }, 500);
      }
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
