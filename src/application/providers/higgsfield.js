import {
  decryptCredential,
  encryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  queryOne,
  readJson
} from '../../lib/runtime.js';

const HF_API = 'https://api.higgsfield.ai';
const HF_DOCS = 'https://docs.higgsfield.ai/docs';
const HF_OPENAPI = 'https://docs.higgsfield.ai/docs/openapi.json';
const HF_CLOUD = 'https://cloud.higgsfield.ai';
const HF_CAPS = ['video-generation', 'reels-video', 'image-to-video', 'text-to-video'];
const now = () => Date.now();
const uid = () => crypto.randomUUID();

function normalizeCap(value) {
  const cap = String(value || '').toLowerCase().trim();
  if (['reels','reel','reels-video'].includes(cap)) return 'reels-video';
  if (['video','video-generation'].includes(cap)) return 'video-generation';
  if (['image-to-video','img2video','i2v'].includes(cap)) return 'image-to-video';
  if (['text-to-video','txt2video','t2v'].includes(cap)) return 'text-to-video';
  return cap;
}

function registry() {
  return {
    id: 'higgsfield',
    name: 'Higgsfield',
    base_url: HF_API,
    cloud_url: HF_CLOUD,
    docs_url: HF_DOCS,
    openapi_url: HF_OPENAPI,
    auth: { type: 'api_key_pair', header: 'Authorization: Key <KEY_ID>:<KEY_SECRET>' },
    capabilities: HF_CAPS,
    endpoint_policy: 'Generation endpoints are discovered from the official Higgsfield OpenAPI document at runtime.'
  };
}

let specCache = { ts: 0, spec: null };
async function openapi() {
  if (specCache.spec && now() - specCache.ts < 15 * 60 * 1000) return specCache.spec;
  const response = await fetchWithTimeout(HF_OPENAPI, { headers: { accept: 'application/json' } }, 5000);
  if (!response.ok) throw new Error(`HIGGSFIELD_OPENAPI_${response.status}`);
  const spec = await response.json();
  specCache = { ts: now(), spec };
  return spec;
}
function resolveRef(spec, node, seen = new Set()) {
  if (!node || typeof node !== 'object') return node;
  if (node.$ref && String(node.$ref).startsWith('#/')) {
    if (seen.has(node.$ref)) return {};
    seen.add(node.$ref);
    let current = spec;
    for (const part of node.$ref.slice(2).split('/')) current = current?.[part.replaceAll('~1','/').replaceAll('~0','~')];
    return resolveRef(spec, current, seen);
  }
  if (Array.isArray(node)) return node.map(item => resolveRef(spec, item, new Set(seen)));
  const output = {};
  for (const [key, value] of Object.entries(node)) output[key] = resolveRef(spec, value, new Set(seen));
  return output;
}
function requestSchema(spec, operation) {
  const content = operation?.requestBody?.content || {};
  const schema = content['application/json']?.schema || Object.values(content)[0]?.schema || {};
  return resolveRef(spec, schema);
}
function classify(spec, path, operation) {
  const schemaText = JSON.stringify(requestSchema(spec, operation)).toLowerCase();
  const text = [path, operation?.operationId, operation?.summary, operation?.description, ...(operation?.tags || [])].filter(Boolean).join(' ').toLowerCase();
  const capabilities = [];
  if (/video|motion|animate|animation|camera/.test(text) || /video/.test(schemaText)) {
    capabilities.push('video-generation', 'reels-video');
    if (/image/.test(schemaText)) capabilities.push('image-to-video');
    if (/prompt|text/.test(schemaText)) capabilities.push('text-to-video');
  }
  return [...new Set(capabilities)];
}
async function endpoints() {
  const spec = await openapi(), output = [];
  for (const [path, item] of Object.entries(spec.paths || {})) {
    const operation = item?.post;
    if (!operation || path.startsWith('/requests/')) continue;
    const capabilities = classify(spec, path, operation);
    if (!capabilities.length) continue;
    output.push({
      path,
      url: HF_API + path,
      operationId: operation.operationId || null,
      summary: operation.summary || null,
      tags: operation.tags || [],
      capabilities
    });
  }
  return output;
}

async function credential(env, capability = null) {
  let rows = await queryAll(env, "SELECT * FROM credentials WHERE provider='higgsfield' AND enabled=1 ORDER BY priority ASC,created_at ASC");
  if (capability) rows = rows.filter(row => {
    try {
      const capabilities = JSON.parse(row.capabilities || '[]');
      return capabilities.includes(capability) || capabilities.includes('video-generation');
    } catch { return false; }
  });
  if (!rows.length) return null;
  const row = rows[0], pair = JSON.parse(await decryptCredential(env, row.encrypted_secret));
  return { ...row, keyId: pair.keyId, keySecret: pair.keySecret };
}
function headers(row) {
  return {
    Authorization: `Key ${row.keyId}:${row.keySecret}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function saveCredential(env, body) {
  let keyId = String(body.keyId || '').trim(), keySecret = String(body.keySecret || '').trim();
  if ((!keyId || !keySecret) && body.secret) {
    const source = String(body.secret).trim(), index = source.indexOf(':');
    if (index > 0) {
      keyId = source.slice(0, index).trim();
      keySecret = source.slice(index + 1).trim();
    }
  }
  if (!keyId || !keySecret) return jsonResponse({ error: 'HIGGSFIELD_KEY_ID_AND_SECRET_REQUIRED' }, 400);
  const timestamp = now(), id = uid();
  const capabilities = Array.isArray(body.capabilities) && body.capabilities.length ? body.capabilities.map(normalizeCap) : HF_CAPS;
  const encrypted = await encryptCredential(env, JSON.stringify({ keyId, keySecret }));
  await execute(env,
    'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id, 'higgsfield', String(body.label || 'Higgsfield').trim() || 'Higgsfield', 'api_key_pair', encrypted,
    JSON.stringify(capabilities), HF_API, null, Number(body.priority || 25), 1,
    JSON.stringify({ docs: HF_DOCS, cloud: HF_CLOUD, openapi: HF_OPENAPI }), 'untested', timestamp, timestamp
  );
  return jsonResponse({ ok: true, id, provider: 'higgsfield', capabilities });
}

async function testCredential(env, row) {
  try {
    const probe = '00000000-0000-0000-0000-000000000000';
    const response = await fetchWithTimeout(`${HF_API}/requests/${probe}/status`, { headers: headers(row) }, 6000);
    if (response.status === 401) throw new Error('HIGGSFIELD_INVALID_CREDENTIALS');
    if (response.status >= 500) throw new Error(`HIGGSFIELD_API_${response.status}`);
    await execute(env, 'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?', 'ok', now(), now(), row.id);
    return { ok: true, status: response.status };
  } catch (error) {
    await execute(env, 'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?', 'error', error.message, now(), now(), row.id);
    return { ok: false, error: error.message };
  }
}

async function route(env, capability) {
  const normalized = normalizeCap(capability);
  if (!HF_CAPS.includes(normalized)) throw new Error('HIGGSFIELD_CAPABILITY_UNSUPPORTED');
  const row = await credential(env, normalized);
  const candidates = (await endpoints()).filter(item => item.capabilities.includes(normalized));
  return {
    provider: 'higgsfield',
    capability: normalized,
    credential: row ? { id: row.id, label: row.label, status: row.last_status } : null,
    selected: candidates[0] || null,
    candidates,
    registry: registry()
  };
}

async function generate(env, body) {
  const capability = normalizeCap(body.capability || 'video-generation');
  const selectedRoute = await route(env, capability);
  if (!selectedRoute.credential) throw new Error('HIGGSFIELD_CREDENTIAL_REQUIRED');
  const row = await credential(env, capability);
  let endpoint = selectedRoute.selected;
  if (body.endpoint) {
    const wanted = String(body.endpoint).trim();
    endpoint = selectedRoute.candidates.find(item => item.path === wanted || item.url === wanted);
    if (!endpoint) throw new Error('HIGGSFIELD_ENDPOINT_NOT_IN_OFFICIAL_OPENAPI');
  }
  if (!endpoint) throw new Error('HIGGSFIELD_NO_OFFICIAL_ENDPOINT_FOR_CAPABILITY');
  const response = await fetchWithTimeout(endpoint.url, {
    method: 'POST',
    headers: headers(row),
    body: JSON.stringify(body.input && typeof body.input === 'object' ? body.input : {})
  }, 20000);
  const text = await response.text();
  let output; try { output = JSON.parse(text); } catch { output = { raw: text }; }
  if (!response.ok) throw new Error(`HIGGSFIELD_${response.status}:${String(output?.detail || output?.error || text).slice(0,300)}`);
  return { ok: true, provider: 'higgsfield', capability, endpoint: endpoint.path, ...output };
}

async function requestStatus(env, requestId, cancel = false) {
  const row = await credential(env);
  if (!row) throw new Error('HIGGSFIELD_CREDENTIAL_REQUIRED');
  const suffix = cancel ? 'cancel' : 'status';
  const response = await fetchWithTimeout(`${HF_API}/requests/${encodeURIComponent(requestId)}/${suffix}`, {
    method: cancel ? 'POST' : 'GET',
    headers: headers(row)
  }, 8000);
  if (cancel && response.status === 204) return { ok: true, canceled: true };
  const text = await response.text();
  let output; try { output = JSON.parse(text); } catch { output = { raw: text }; }
  if (!response.ok) throw new Error(`HIGGSFIELD_${response.status}:${String(output?.detail || output?.error || text).slice(0,300)}`);
  return output;
}

async function scout(core, req, env, ctx, capability) {
  const base = await core.fetch(req, env, ctx);
  let payload = { results: [] };
  try { payload = await base.clone().json(); } catch {}
  let routed = null;
  try { routed = await route(env, capability); } catch {}
  const official = {
    title: 'Higgsfield — Official API',
    url: HF_DOCS,
    snippet: `Official Higgsfield provider • ${capability} • ${routed?.candidates?.length || 0} matching endpoint(s) from the official OpenAPI specification.`,
    provider: 'higgsfield',
    official: true,
    capability
  };
  return jsonResponse({
    capability,
    results: [official, ...(payload.results || []).filter(item => !String(item.url || '').includes('higgsfield.ai'))],
    route: routed
  });
}

export function createHiggsfieldIntegration(core) {
  if (!core?.fetch) throw new Error('HIGGSFIELD_CORE_FETCH_REQUIRED');

  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  async function routeRequest(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname, method = req.method;
    if (path === '/api/providers/higgsfield' && method === 'GET') return jsonResponse(registry());
    if (path === '/api/higgsfield/openapi/endpoints' && method === 'GET') return jsonResponse({ provider: 'higgsfield', source: HF_OPENAPI, endpoints: await endpoints() });
    if (path === '/api/higgsfield/setup' && method === 'POST') return saveCredential(env, await readJson(req));
    if (path === '/api/credentials' && method === 'POST') {
      const body = await readJson(req.clone());
      if (String(body.provider || '').toLowerCase() === 'higgsfield') return saveCredential(env, body);
      return null;
    }
    let match = path.match(/^\/api\/credentials\/([^/]+)\/test$/);
    if (match && method === 'POST') {
      const row = await queryOne(env, 'SELECT * FROM credentials WHERE id=?', match[1]);
      if (row && String(row.provider).toLowerCase() === 'higgsfield') {
        const pair = JSON.parse(await decryptCredential(env, row.encrypted_secret));
        return jsonResponse(await testCredential(env, { ...row, ...pair }));
      }
      return null;
    }
    if (path === '/api/capabilities/route' && method === 'GET' && String(url.searchParams.get('provider') || 'higgsfield').toLowerCase() === 'higgsfield') {
      return jsonResponse(await route(env, url.searchParams.get('capability') || 'video-generation'));
    }
    if (path === '/api/higgsfield/generate' && method === 'POST') return jsonResponse(await generate(env, await readJson(req)));
    match = path.match(/^\/api\/higgsfield\/requests\/([^/]+)$/);
    if (match && method === 'GET') return jsonResponse(await requestStatus(env, match[1], false));
    match = path.match(/^\/api\/higgsfield\/requests\/([^/]+)\/cancel$/);
    if (match && method === 'POST') return jsonResponse(await requestStatus(env, match[1], true));
    if (path === '/api/tools/discover' && method === 'GET') {
      const capability = normalizeCap(url.searchParams.get('capability') || '');
      if (HF_CAPS.includes(capability)) return scout(core, req, env, ctx, capability);
    }
    return null;
  }

  return {
    async fetch(req, env, ctx) {
      try {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/') && env.DB) {
          const candidate = /^\/api\/(providers\/higgsfield|higgsfield|capabilities\/route|tools\/discover|credentials)/.test(url.pathname);
          if (candidate) {
            if (!(await authed(req, env, ctx)) && !url.pathname.startsWith('/api/providers/higgsfield')) return core.fetch(req, env, ctx);
            const response = await routeRequest(req, env, ctx);
            if (response) return response;
          }
        }
        return core.fetch(req, env, ctx);
      } catch (error) {
        return jsonResponse({ error: 'HIGGSFIELD_INTEGRATION_ERROR', detail: error.message }, 500);
      }
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
