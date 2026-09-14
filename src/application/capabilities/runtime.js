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

const RUNWAY = 'https://api.dev.runwayml.com/v1';
const FAL_API = 'https://api.fal.ai/v1';
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
  try {
    await execute(env, 'INSERT INTO notifications(id,kind,title,body,read,meta,created_at) VALUES(?,?,?,?,0,?,?)', uid(), kind, title, String(text || ''), JSON.stringify(meta || {}), now());
  } catch {}
}

async function metric(env, provider, ms, ok, error = '') {
  try {
    const row = await queryOne(env, 'SELECT * FROM provider_metrics WHERE provider=?', provider);
    if (!row) {
      await execute(env, 'INSERT INTO provider_metrics(provider,samples,successes,failures,avg_latency_ms,last_latency_ms,last_error,updated_at) VALUES(?,?,?,?,?,?,?,?)', provider, 1, ok ? 1 : 0, ok ? 0 : 1, ms, ms, error || null, now());
      return;
    }
    const n = Number(row.samples || 0), samples = n + 1;
    const avg = ((Number(row.avg_latency_ms || 0) * n) + ms) / samples;
    await execute(env, 'UPDATE provider_metrics SET samples=?,successes=?,failures=?,avg_latency_ms=?,last_latency_ms=?,last_error=?,updated_at=? WHERE provider=?', samples, Number(row.successes || 0) + (ok ? 1 : 0), Number(row.failures || 0) + (ok ? 0 : 1), avg, ms, error || null, now(), provider);
  } catch {}
}

const cooldownKey = id => `video_provider_cooldown:${id}`;
async function cooldown(env, id) { const value = await kvGet(env, cooldownKey(id), null); return value && Number(value.until || 0) > now() ? value : null; }
async function clearCooldown(env, id) { await kvSet(env, cooldownKey(id), { until: 0 }); }
async function setCooldown(env, credential, reason, status) {
  const minutes = status === 402 || /quota|credit|billing|payment|insufficient/i.test(reason) ? 360 : status === 429 ? 30 : 10;
  const value = { provider: credential.provider, credential_id: credential.id, until: now() + minutes * 60000, reason: String(reason || ''), status: status || null };
  await kvSet(env, cooldownKey(credential.id), value);
  await notify(env, 'video', 'Video sağlayıcısı cooldown', `${credential.label || credential.provider}: ${reason}`, value);
  return value;
}
function quotaError(error) { return [402, 403, 429].includes(Number(error?.status)) || /quota|credit|billing|payment|rate.?limit|insufficient/i.test(String(error?.message || '')); }

function mediaUrl(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^https?:\/\//.test(value) && /\.(mp4|mov|webm)(\?|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) { const found = mediaUrl(item); if (found) return found; }
  } else if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/video|output|url|file/i.test(key)) { const found = mediaUrl(item); if (found) return found; }
      const found = mediaUrl(item); if (found) return found;
    }
  }
  return null;
}

async function setupProvider(env, provider, body) {
  const token = String(body.token || body.secret || '').trim();
  if (!token) throw new Error('API_KEY_REQUIRED');
  const normalized = String(provider).toLowerCase(), id = uid(), timestamp = now();
  const model = String(body.model || '').trim() || (normalized === 'runway' ? 'gen4.5' : 'fal-ai/kling-video/v1/standard/text-to-video');
  const endpoint = normalized === 'runway' ? RUNWAY : 'https://queue.fal.run';
  const encrypted = await encryptCredential(env, token);
  await execute(env, 'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, normalized, normalized === 'runway' ? 'Runway' : 'fal.ai', 'api_key', encrypted, JSON.stringify(['video-generation','text-to-video','reels-video']), endpoint, model, Number(body.priority || (normalized === 'runway' ? 45 : 55)), 1, JSON.stringify({ official: true }), 'untested', timestamp, timestamp);
  return { id, provider: normalized, model };
}

async function testRunway(env, credential) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const response = await fetchWithTimeout(`${RUNWAY}/tasks/00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${secret}`, 'X-Runway-Version': '2024-11-06', Accept: 'application/json' } }, 5000);
  if (response.status === 401 || response.status === 403) { const error = new Error(`RUNWAY_AUTH_${response.status}`); error.status = response.status; throw error; }
  return true;
}
async function testFal(env, credential) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const response = await fetchWithTimeout(`${FAL_API}/models?limit=1`, { headers: { Authorization: `Key ${secret}`, Accept: 'application/json' } }, 5000);
  if (!response.ok) { const error = new Error(`FAL_AUTH_${response.status}`); error.status = response.status; throw error; }
  return true;
}
async function testProvider(env, provider) {
  const credential = await queryOne(env, 'SELECT * FROM credentials WHERE provider=? AND enabled=1 ORDER BY priority ASC LIMIT 1', provider);
  if (!credential) throw new Error('PROVIDER_NOT_CONNECTED');
  const started = now();
  try {
    if (provider === 'runway') await testRunway(env, credential); else await testFal(env, credential);
    await execute(env, "UPDATE credentials SET last_status='ok',last_error=NULL,last_test_at=?,updated_at=? WHERE id=?", now(), now(), credential.id);
    await clearCooldown(env, credential.id);
    await metric(env, `video:${provider}`, now() - started, true);
    return { ok: true, provider };
  } catch (error) {
    await execute(env, "UPDATE credentials SET last_status='error',last_error=?,last_test_at=?,updated_at=? WHERE id=?", error.message, now(), now(), credential.id);
    await metric(env, `video:${provider}`, now() - started, false, error.message);
    throw error;
  }
}

async function runwayStart(env, credential, prompt) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const response = await fetchWithTimeout(`${RUNWAY}/image_to_video`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ model: credential.model || 'gen4.5', promptText: String(prompt).slice(0, 4000), ratio: '768:1280', duration: 5 }) }, 15000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok) { const error = new Error(`RUNWAY_${response.status}:${String(payload?.error || payload?.message || text).slice(0, 200)}`); error.status = response.status; throw error; }
  return { job: String(payload.id || ''), status_url: payload.id ? `${RUNWAY}/tasks/${encodeURIComponent(payload.id)}` : null, url: mediaUrl(payload), provider: 'runway', model: credential.model || 'gen4.5' };
}
async function runwayPoll(env, credential, meta) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const response = await fetchWithTimeout(meta.video_status_url, { headers: { Authorization: `Bearer ${secret}`, 'X-Runway-Version': '2024-11-06', Accept: 'application/json' } }, 10000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok) { const error = new Error(`RUNWAY_STATUS_${response.status}`); error.status = response.status; throw error; }
  const status = String(payload.status || '').toUpperCase();
  return { done: status === 'SUCCEEDED' && !!mediaUrl(payload.output || payload), failed: ['FAILED','CANCELED'].includes(status), url: mediaUrl(payload.output || payload), raw: payload };
}
async function falStart(env, credential, prompt) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const model = String(credential.model || 'fal-ai/kling-video/v1/standard/text-to-video').replace(/^\/+|\/+$/g, '');
  const response = await fetchWithTimeout(`https://queue.fal.run/${model}`, { method: 'POST', headers: { Authorization: `Key ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ prompt: String(prompt).slice(0, 5000) }) }, 15000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok) { const error = new Error(`FAL_${response.status}:${String(payload?.detail || payload?.error || text).slice(0, 200)}`); error.status = response.status; throw error; }
  return { job: String(payload.request_id || ''), status_url: payload.status_url || null, response_url: payload.response_url || null, url: mediaUrl(payload), provider: 'fal', model };
}
async function falPoll(env, credential, meta) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  let response = await fetchWithTimeout(meta.video_status_url, { headers: { Authorization: `Key ${secret}`, Accept: 'application/json' } }, 10000);
  let text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok) { const error = new Error(`FAL_STATUS_${response.status}`); error.status = response.status; throw error; }
  const status = String(payload.status || '').toUpperCase();
  if (status === 'COMPLETED' && meta.video_response_url) {
    response = await fetchWithTimeout(meta.video_response_url, { headers: { Authorization: `Key ${secret}`, Accept: 'application/json' } }, 10000);
    text = await response.text(); try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    if (!response.ok) { const error = new Error(`FAL_RESULT_${response.status}`); error.status = response.status; throw error; }
    return { done: !!mediaUrl(payload), failed: false, url: mediaUrl(payload), raw: payload };
  }
  return { done: false, failed: /FAILED|ERROR|CANCEL/.test(status), url: null, raw: payload };
}

async function extraProviders(env) {
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE provider IN ('runway','fal') AND enabled=1 ORDER BY priority ASC,created_at ASC");
  return Promise.all(rows.map(async credential => ({ ...credential, cooldown: await cooldown(env, credential.id) })));
}
async function coreProvidersAvailable(env) {
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE provider IN ('higgsfield','replicate') AND enabled=1 ORDER BY priority ASC");
  for (const credential of rows) if (!(await cooldown(env, credential.id))) return true;
  return false;
}
async function patchMeta(env, item, patch) {
  let meta = {}; try { meta = JSON.parse(item.meta || '{}'); } catch {}
  meta = { ...meta, ...patch };
  await execute(env, 'UPDATE social_content_queue SET meta=?,updated_at=? WHERE id=?', JSON.stringify(meta), now(), item.id);
  return meta;
}
async function startExtra(env, item) {
  const pool = (await extraProviders(env)).filter(credential => !credential.cooldown);
  for (const credential of pool) {
    const started = now();
    try {
      const result = credential.provider === 'runway' ? await runwayStart(env, credential, item.media_prompt || item.topic) : await falStart(env, credential, item.media_prompt || item.topic);
      await metric(env, `video:${credential.provider}`, now() - started, true);
      await clearCooldown(env, credential.id);
      const meta = await patchMeta(env, item, { video_provider: credential.provider, video_credential_id: credential.id, video_job_id: result.job || null, video_status_url: result.status_url || null, video_response_url: result.response_url || null, video_model: result.model || credential.model || null });
      if (result.url) await execute(env, "UPDATE social_content_queue SET media_url=?,status='ready',external_job_id=?,meta=?,updated_at=? WHERE id=?", result.url, result.job || null, JSON.stringify(meta), now(), item.id);
      else await execute(env, "UPDATE social_content_queue SET status='video_external_plus',external_job_id=?,meta=?,updated_at=? WHERE id=?", result.job || null, JSON.stringify(meta), now(), item.id);
      await notify(env, 'video', 'Video yedek sağlayıcıya geçti', `${credential.label || credential.provider} kullanılıyor.`, { queue_id: item.id, provider: credential.provider });
      return true;
    } catch (error) {
      await metric(env, `video:${credential.provider}`, now() - started, false, error.message);
      if (quotaError(error)) await setCooldown(env, credential, error.message, error.status);
    }
  }
  return false;
}
async function pollExtra(env, item) {
  let meta = {}; try { meta = JSON.parse(item.meta || '{}'); } catch {}
  const credential = await queryOne(env, 'SELECT * FROM credentials WHERE id=?', meta.video_credential_id);
  if (!credential) { await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); return; }
  try {
    const result = credential.provider === 'runway' ? await runwayPoll(env, credential, meta) : await falPoll(env, credential, meta);
    if (result.url) await execute(env, "UPDATE social_content_queue SET media_url=?,status='ready',updated_at=? WHERE id=?", result.url, now(), item.id);
    else if (result.failed) { await setCooldown(env, credential, 'generation_failed', null); await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); }
  } catch (error) {
    if (quotaError(error)) { await setCooldown(env, credential, error.message, error.status); await execute(env, "UPDATE social_content_queue SET status='planned',scheduled_at=?,updated_at=? WHERE id=?", now(), now(), item.id); }
    else await patchMeta(env, item, { last_video_error: error.message });
  }
}

export async function processExtraVideoFallback(env) {
  const external = await queryAll(env, "SELECT * FROM social_content_queue WHERE status='video_external_plus' ORDER BY updated_at ASC LIMIT 6");
  for (const item of external) await pollExtra(env, item);
  if (await coreProvidersAvailable(env)) return;
  const planned = await queryAll(env, "SELECT * FROM social_content_queue WHERE status='planned' ORDER BY created_at ASC LIMIT 6");
  for (const item of planned) await startExtra(env, item);
}

function publicTrace(payload) {
  const trace = [];
  if (payload?.provider) trace.push({ kind:'model', label:'Yanıt sağlayıcısı', value:String(payload.provider) });
  if (Array.isArray(payload?.results)) trace.push({ kind:'search', label:'Web araştırması', value:`${payload.results.length} sonuç işlendi` });
  if (Array.isArray(payload?.tools)) trace.push({ kind:'tool', label:'Araç keşfi', value:`${payload.tools.length} araç değerlendirildi` });
  if (payload?.agent?.plan) trace.push({ kind:'agent', label:'Agent akışı', value:payload.agent.plan.map(step => String(step.type || 'adım')).join(' → ') });
  if (Array.isArray(payload?.media) && payload.media.length) trace.push({ kind:'media', label:'Medya üretimi', value:payload.media.map(item => item.type).join(', ') });
  return trace;
}

export function createCapabilityRuntime(core) {
  if (!core?.fetch) throw new Error('CAPABILITY_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers:req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url), path = url.pathname, method = req.method;
      if (path === '/api/video-pool/runway/setup' && method === 'POST') { if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx); try { return jsonResponse({ ok:true, ...await setupProvider(env, 'runway', await readJson(req)) }); } catch (error) { return jsonResponse({ error:error.message }, 400); } }
      if (path === '/api/video-pool/fal/setup' && method === 'POST') { if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx); try { return jsonResponse({ ok:true, ...await setupProvider(env, 'fal', await readJson(req)) }); } catch (error) { return jsonResponse({ error:error.message }, 400); } }
      if (path === '/api/video-pool/runway/test' && method === 'POST') { if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx); try { return jsonResponse(await testProvider(env, 'runway')); } catch (error) { return jsonResponse({ ok:false, error:error.message }, 400); } }
      if (path === '/api/video-pool/fal/test' && method === 'POST') { if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx); try { return jsonResponse(await testProvider(env, 'fal')); } catch (error) { return jsonResponse({ ok:false, error:error.message }, 400); } }
      if (path === '/api/video-pool/status' && method === 'GET') {
        const response = await core.fetch(req, env, ctx); if (!response.ok) return response;
        try { const payload = await response.clone().json(); const extras = await extraProviders(env); payload.providers = [...(payload.providers || []), ...extras.map(c => ({ id:c.id, provider:c.provider, label:c.label, model:c.model, priority:c.priority, status:c.last_status, cooldown:c.cooldown }))].sort((a,b) => Number(a.priority || 100)-Number(b.priority || 100)); return jsonResponse(payload); } catch { return response; }
      }
      if (path === '/api/video-pool/run' && method === 'POST') { const response = await core.fetch(req, env, ctx); try { await processExtraVideoFallback(env); } catch {} return response; }
      if (path === '/api/chat/send' && method === 'POST') { const response = await core.fetch(req, env, ctx); if (!response.ok) return response; try { const payload = await response.clone().json(); payload.trace = publicTrace(payload); return jsonResponse(payload, response.status); } catch { return response; } }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) { if (core.scheduled) await core.scheduled(event, env, ctx); try { await processExtraVideoFallback(env); } catch (error) { console.error('extra video failover', error); } }
  };
}
