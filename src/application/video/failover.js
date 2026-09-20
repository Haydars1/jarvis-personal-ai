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
const HF_OPENAPI = 'https://docs.higgsfield.ai/docs/openapi.json';
const REPLICATE_API = 'https://api.replicate.com/v1';
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
async function notify(env, kind, title, text = '', meta = {}) {
  try { await execute(env, 'INSERT INTO notifications(id,kind,title,body,read,meta,created_at) VALUES(?,?,?,?,0,?,?)', uid(), kind, title, String(text || ''), JSON.stringify(meta || {}), now()); } catch {}
}
async function metric(env, provider, ms, ok, error = '') {
  try {
    const row = await queryOne(env, 'SELECT * FROM provider_metrics WHERE provider=?', provider);
    if (!row) {
      await execute(env, 'INSERT INTO provider_metrics(provider,samples,successes,failures,avg_latency_ms,last_latency_ms,last_error,updated_at) VALUES(?,?,?,?,?,?,?,?)', provider, 1, ok ? 1 : 0, ok ? 0 : 1, ms, ms, error || null, now());
      return;
    }
    const n = Number(row.samples || 0), samples = n + 1, avg = ((Number(row.avg_latency_ms || 0) * n) + ms) / samples;
    await execute(env, 'UPDATE provider_metrics SET samples=?,successes=?,failures=?,avg_latency_ms=?,last_latency_ms=?,last_error=?,updated_at=? WHERE provider=?', samples, Number(row.successes || 0) + (ok ? 1 : 0), Number(row.failures || 0) + (ok ? 0 : 1), avg, ms, error || null, now(), provider);
  } catch {}
}

function parseCaps(credential) { try { return JSON.parse(credential.capabilities || '[]'); } catch { return []; } }
function isVideoCredential(credential) {
  const provider = String(credential.provider || '').toLowerCase(), caps = parseCaps(credential);
  return ['higgsfield', 'replicate'].includes(provider) && (caps.some(item => /video|reels/i.test(item)) || provider === 'higgsfield' || provider === 'replicate');
}
const cooldownKey = id => `video_provider_cooldown:${id}`;
async function cooldown(env, id) { const value = await kvGet(env, cooldownKey(id), null); return value && Number(value.until || 0) > now() ? value : null; }
async function clearCooldown(env, id) { await kvSet(env, cooldownKey(id), { until: 0 }); }
async function setCooldown(env, credential, reason, status) {
  const minutes = status === 402 || /quota|credit|billing|payment/i.test(reason) ? 360 : status === 429 ? 30 : 10;
  const value = { provider: credential.provider, credential_id: credential.id, until: now() + minutes * 60000, reason: String(reason || ''), status: status || null };
  await kvSet(env, cooldownKey(credential.id), value);
  await notify(env, 'video', 'Video sağlayıcısı geçici olarak pas geçildi', `${credential.label || credential.provider}: ${reason}`, value);
  return value;
}
function quotaError(error) { return [402,403,429].includes(Number(error?.status)) || /quota|credit|billing|payment|rate.?limit/i.test(String(error?.message || '')); }

function deepFind(obj, regex, depth = 0) {
  if (depth > 7 || obj == null) return null;
  if (typeof obj === 'string' && regex.test(obj)) return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) { const result = deepFind(item, regex, depth + 1); if (result) return result; }
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (regex.test(key) && typeof value === 'string') return value;
      const result = deepFind(value, regex, depth + 1); if (result) return result;
    }
  }
  return null;
}
function mediaUrl(value) {
  const direct = deepFind(value, /^(video_?url|output_?url|download_?url|file_?url)$/i);
  if (direct) return direct;
  const any = deepFind(value, /^https?:\/\/.+/i);
  return any && /\.(mp4|mov|webm)(\?|$)/i.test(any) ? any : null;
}
function jobId(value) { return String(value?.id || deepFind(value, /^(request_?id|job_?id|prediction_?id)$/i) || '') || null; }

let hfSpec = { ts: 0, spec: null };
async function hfOpenapi() {
  if (hfSpec.spec && now() - hfSpec.ts < 15 * 60 * 1000) return hfSpec.spec;
  const response = await fetchWithTimeout(HF_OPENAPI, { headers: { accept: 'application/json' } }, 6000);
  if (!response.ok) throw Object.assign(new Error(`HIGGSFIELD_OPENAPI_${response.status}`), { status: response.status });
  const spec = await response.json(); hfSpec = { ts: now(), spec }; return spec;
}
function resolveRef(spec, node, seen = new Set()) {
  if (!node || typeof node !== 'object') return node;
  if (node.$ref && String(node.$ref).startsWith('#/')) {
    if (seen.has(node.$ref)) return {};
    seen.add(node.$ref); let current = spec;
    for (const part of node.$ref.slice(2).split('/')) current = current?.[part.replaceAll('~1','/').replaceAll('~0','~')];
    return resolveRef(spec, current, seen);
  }
  if (Array.isArray(node)) return node.map(item => resolveRef(spec, item, new Set(seen)));
  const output = {}; for (const [key, value] of Object.entries(node)) output[key] = resolveRef(spec, value, new Set(seen));
  return output;
}
function requestSchema(spec, operation) {
  const content = operation?.requestBody?.content || {};
  const schema = content['application/json']?.schema || Object.values(content)[0]?.schema || {};
  return resolveRef(spec, schema);
}
async function hfEndpoint() {
  const spec = await hfOpenapi();
  for (const [path, item] of Object.entries(spec.paths || {})) {
    const operation = item?.post;
    if (!operation || path.startsWith('/requests/')) continue;
    const text = ([path, operation.operationId, operation.summary, operation.description, ...(operation.tags || [])].filter(Boolean).join(' ') + ' ' + JSON.stringify(requestSchema(spec, operation))).toLowerCase();
    if (/video/.test(text) && /(prompt|text)/.test(text)) return HF_API + path;
  }
  throw new Error('HIGGSFIELD_NO_TEXT_TO_VIDEO_ENDPOINT');
}
async function higgsfieldStart(env, credential, prompt) {
  const pair = JSON.parse(await decryptCredential(env, credential.encrypted_secret)), endpoint = await hfEndpoint();
  const response = await fetchWithTimeout(endpoint, { method:'POST', headers:{ Authorization:`Key ${pair.keyId}:${pair.keySecret}`, 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({ prompt }) }, 15000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) { const error = new Error(`HIGGSFIELD_${response.status}:${String(payload?.detail || payload?.error || text).slice(0,180)}`); error.status = response.status; throw error; }
  return { raw:payload, url:mediaUrl(payload), job:jobId(payload), status_url:jobId(payload) ? `${HF_API}/requests/${encodeURIComponent(jobId(payload))}/status` : null };
}
async function higgsfieldPoll(env, credential, meta) {
  const pair = JSON.parse(await decryptCredential(env, credential.encrypted_secret));
  const response = await fetchWithTimeout(meta.status_url, { headers:{ Authorization:`Key ${pair.keyId}:${pair.keySecret}`, Accept:'application/json' } }, 10000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) { const error = new Error(`HIGGSFIELD_STATUS_${response.status}`); error.status = response.status; throw error; }
  return { done:!!mediaUrl(payload), failed:/fail|error|cancel/i.test(String(payload?.status || '')), url:mediaUrl(payload), raw:payload };
}

let replicateSearch = { ts:0, model:null };
async function replicatePickModel(secret, credential) {
  if (credential.model) return String(credential.model).trim();
  if (replicateSearch.model && now() - replicateSearch.ts < 30 * 60 * 1000) return replicateSearch.model;
  const response = await fetchWithTimeout(`${REPLICATE_API}/search?query=${encodeURIComponent('text to video')}`, { headers:{ Authorization:`Bearer ${secret}`, Accept:'application/json' } }, 6000);
  if (!response.ok) { const error = new Error(`REPLICATE_SEARCH_${response.status}`); error.status = response.status; throw error; }
  const payload = await response.json(), rows = payload.results || payload.models || [];
  let chosen = null;
  for (const model of rows) {
    const owner = model.owner?.username || model.owner || model.namespace || '', name = model.name || model.slug || '';
    const id = String(model.model || model.id || (owner && name ? `${owner}/${name}` : '')).trim();
    if (id.includes('/') && /video/.test(JSON.stringify(model).toLowerCase())) { chosen = id; break; }
  }
  if (!chosen) throw new Error('REPLICATE_NO_VIDEO_MODEL_FOUND');
  replicateSearch = { ts:now(), model:chosen }; return chosen;
}
async function replicateStart(env, credential, prompt) {
  const secret = await decryptCredential(env, credential.encrypted_secret), model = await replicatePickModel(secret, credential);
  const response = await fetchWithTimeout(`${REPLICATE_API}/predictions`, { method:'POST', headers:{ Authorization:`Bearer ${secret}`, 'Content-Type':'application/json', Accept:'application/json', Prefer:'wait=10' }, body:JSON.stringify({ version:model, input:{ prompt } }) }, 15000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) { const error = new Error(`REPLICATE_${response.status}:${String(payload?.detail || payload?.error || text).slice(0,180)}`); error.status = response.status; throw error; }
  return { raw:payload, url:mediaUrl(payload?.output) || mediaUrl(payload), job:jobId(payload), status_url:payload?.urls?.get || (jobId(payload) ? `${REPLICATE_API}/predictions/${encodeURIComponent(jobId(payload))}` : null), model };
}
async function replicatePoll(env, credential, meta) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const response = await fetchWithTimeout(meta.status_url, { headers:{ Authorization:`Bearer ${secret}`, Accept:'application/json' } }, 10000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) { const error = new Error(`REPLICATE_STATUS_${response.status}`); error.status = response.status; throw error; }
  const status = String(payload.status || '').toLowerCase();
  return { done:status === 'succeeded' && !!(mediaUrl(payload?.output) || mediaUrl(payload)), failed:['failed','canceled'].includes(status), url:mediaUrl(payload?.output) || mediaUrl(payload), raw:payload };
}

async function providers(env) {
  const rows = await queryAll(env, 'SELECT * FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC');
  return Promise.all(rows.filter(isVideoCredential).map(async credential => ({ ...credential, cooldown:await cooldown(env, credential.id) })));
}
async function startWithProvider(env, credential, prompt) {
  const started = now();
  try {
    let result;
    if (String(credential.provider).toLowerCase() === 'higgsfield') result = await higgsfieldStart(env, credential, prompt);
    else if (String(credential.provider).toLowerCase() === 'replicate') result = await replicateStart(env, credential, prompt);
    else throw new Error('VIDEO_PROVIDER_UNSUPPORTED');
    await metric(env, `video:${credential.provider}`, now() - started, true); await clearCooldown(env, credential.id); return result;
  } catch (error) {
    await metric(env, `video:${credential.provider}`, now() - started, false, error.message);
    if (quotaError(error)) await setCooldown(env, credential, error.message, error.status);
    throw error;
  }
}
async function runDirectVideo(req, env) {
  const body = await readJson(req), prompt = String(body.prompt || body.input?.prompt || '').trim();
  if (!prompt) return jsonResponse({ error:'VIDEO_PROMPT_REQUIRED' }, 400);
  const pool = (await providers(env)).filter(credential => !credential.cooldown), errors = [];
  for (const credential of pool) {
    try {
      const result = await startWithProvider(env, credential, prompt);
      return jsonResponse({ ok:true, provider:credential.provider, credential_id:credential.id, ...result, failover_errors:errors });
    } catch (error) {
      errors.push({ provider:credential.provider, error:error.message });
    }
  }
  return jsonResponse({ ok:false, error:'NO_VIDEO_PROVIDER_AVAILABLE', errors }, 503);
}
async function pollProvider(env, credential, meta) {
  if (String(credential.provider).toLowerCase() === 'higgsfield') return higgsfieldPoll(env, credential, meta);
  if (String(credential.provider).toLowerCase() === 'replicate') return replicatePoll(env, credential, meta);
  throw new Error('VIDEO_PROVIDER_UNSUPPORTED');
}
async function updateMeta(env, item, patch) {
  let meta = {}; try { meta = JSON.parse(item.meta || '{}'); } catch {}
  meta = { ...meta, ...patch };
  await execute(env, 'UPDATE social_content_queue SET meta=?,updated_at=? WHERE id=?', JSON.stringify(meta), now(), item.id); return meta;
}
async function generatePlanned(env, item) {
  const pool = (await providers(env)).filter(credential => !credential.cooldown), errors = [];
  for (const credential of pool) {
    try {
      const result = await startWithProvider(env, credential, item.media_prompt || item.topic);
      const meta = await updateMeta(env, item, { video_provider:credential.provider, video_credential_id:credential.id, video_job_id:result.job || null, video_status_url:result.status_url || null, video_model:result.model || credential.model || null, video_failover_errors:errors });
      if (result.url) await execute(env, "UPDATE social_content_queue SET media_url=?,external_job_id=?,status='ready',meta=?,updated_at=? WHERE id=?", result.url, result.job || null, JSON.stringify(meta), now(), item.id);
      else if (result.status_url || result.job) await execute(env, "UPDATE social_content_queue SET external_job_id=?,status='video_external',meta=?,updated_at=? WHERE id=?", result.job || null, JSON.stringify(meta), now(), item.id);
      else throw new Error('VIDEO_PROVIDER_NO_JOB_OR_URL');
      if (errors.length) await notify(env, 'video', 'Video sağlayıcısı otomatik değiştirildi', `${errors.map(error => error.provider).join(', ')} başarısız oldu; ${credential.provider} kullanılıyor.`, { queue_id:item.id, provider:credential.provider });
      return true;
    } catch (error) { errors.push({ provider:credential.provider, error:error.message }); }
  }
  const meta = await updateMeta(env, item, { video_failover_errors:errors, last_video_error:errors.at(-1)?.error || 'NO_VIDEO_PROVIDER' });
  await execute(env, 'UPDATE social_content_queue SET scheduled_at=?,meta=?,updated_at=? WHERE id=?', now() + 30 * 60 * 1000, JSON.stringify(meta), now(), item.id);
  await notify(env, 'video', 'Video üretimi beklemeye alındı', 'Bağlı ve kullanılabilir video sağlayıcısı kalmadı. JARVIS 30 dakika sonra tekrar deneyecek.', { queue_id:item.id, errors });
  return false;
}
async function pollExternal(env, item) {
  let meta = {}; try { meta = JSON.parse(item.meta || '{}'); } catch {}
  const credential = await queryOne(env, 'SELECT * FROM credentials WHERE id=?', meta.video_credential_id);
  if (!credential) { await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); return; }
  try {
    const result = await pollProvider(env, credential, meta);
    if (result.url) { await execute(env, "UPDATE social_content_queue SET media_url=?,status='ready',updated_at=? WHERE id=?", result.url, now(), item.id); return; }
    if (result.failed) { await setCooldown(env, credential, 'generation_failed', null); await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); }
  } catch (error) {
    if (quotaError(error)) { await setCooldown(env, credential, error.message, error.status); await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); }
    else await updateMeta(env, item, { last_video_error:error.message });
  }
}
export async function processVideoQueue(env) {
  const items = await queryAll(env, "SELECT * FROM social_content_queue WHERE status IN ('planned','video_external') AND (scheduled_at IS NULL OR scheduled_at<=?) ORDER BY created_at ASC LIMIT 6", now());
  for (const item of items) { if (item.status === 'planned') await generatePlanned(env, item); else await pollExternal(env, item); }
}

async function setupReplicate(req, env) {
  const body = await readJson(req), token = String(body.token || '').trim(), model = String(body.model || '').trim();
  if (!token) return jsonResponse({ error:'REPLICATE_TOKEN_REQUIRED' }, 400);
  const timestamp = now(), existing = await queryOne(env, "SELECT id FROM credentials WHERE provider='replicate' ORDER BY created_at DESC LIMIT 1"), blob = await encryptCredential(env, token), caps = JSON.stringify(['video-generation','text-to-video','reels-video']);
  if (existing) {
    await execute(env, "UPDATE credentials SET label=?,kind=?,encrypted_secret=?,capabilities=?,endpoint=?,model=?,priority=?,enabled=1,last_status='ok',last_error=NULL,last_test_at=?,updated_at=? WHERE id=?", 'Replicate Video','api_key',blob,caps,REPLICATE_API,model || null,35,timestamp,timestamp,existing.id);
    return jsonResponse({ ok:true, id:existing.id });
  }
  const id = uid();
  await execute(env, 'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,last_test_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id,'replicate','Replicate Video','api_key',blob,caps,REPLICATE_API,model || null,35,1,JSON.stringify({ official:true, docs:'https://replicate.com/docs/reference/http' }),'ok',timestamp,timestamp,timestamp);
  return jsonResponse({ ok:true, id });
}
async function testReplicate(env) {
  const credential = await queryOne(env, "SELECT * FROM credentials WHERE provider='replicate' AND enabled=1 ORDER BY priority ASC LIMIT 1");
  if (!credential) return jsonResponse({ ok:false, error:'REPLICATE_NOT_CONNECTED' }, 404);
  try {
    const secret = await decryptCredential(env, credential.encrypted_secret), response = await fetchWithTimeout(`${REPLICATE_API}/search?query=video`, { headers:{ Authorization:`Bearer ${secret}`, Accept:'application/json' } }, 6000);
    if (!response.ok) throw new Error(`REPLICATE_${response.status}`);
    await execute(env, "UPDATE credentials SET last_status='ok',last_error=NULL,last_test_at=?,updated_at=? WHERE id=?", now(), now(), credential.id);
    return jsonResponse({ ok:true });
  } catch (error) {
    await execute(env, "UPDATE credentials SET last_status='error',last_error=?,last_test_at=?,updated_at=? WHERE id=?", error.message, now(), now(), credential.id);
    return jsonResponse({ ok:false, error:error.message }, 400);
  }
}
async function poolStatus(env) {
  const rows = await providers(env);
  return jsonResponse({ providers:rows.map(c => ({ id:c.id, provider:c.provider, label:c.label, priority:c.priority, status:c.last_status, model:c.model || null, cooldown:c.cooldown ? { until:c.cooldown.until, reason:c.cooldown.reason } : null })), policy:{ order:'priority', quota_failover:true, cooldown:true, retry_minutes:30 } });
}

export function createVideoFailover(core) {
  if (!core?.fetch) throw new Error('VIDEO_FAILOVER_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers:req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url), path = url.pathname, method = req.method;
      if (path.startsWith('/api/video-pool/')) {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        if (path === '/api/video-pool/status' && method === 'GET') return poolStatus(env);
        if (path === '/api/video-pool/replicate/setup' && method === 'POST') return setupReplicate(req, env);
        if (path === '/api/video-pool/replicate/test' && method === 'POST') return testReplicate(env);
        if (path === '/api/video-pool/run' && method === 'POST') return runDirectVideo(req, env);
      }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      await processVideoQueue(env);
      return core.scheduled?.(event, env, ctx);
    }
  };
}
