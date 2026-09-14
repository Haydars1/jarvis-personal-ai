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

const GRAPH = 'https://graph.facebook.com/v24.0';
const HF_API = 'https://api.higgsfield.ai';
const HF_OPENAPI = 'https://docs.higgsfield.ai/docs/openapi.json';
const encoder = new TextEncoder();
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
  await execute(env, 'INSERT INTO notifications(id,kind,title,body,read,meta,created_at) VALUES(?,?,?,?,0,?,?)', uid(), kind, title, String(text || ''), JSON.stringify(meta || {}), now());
}
async function history(env, limit = 160) {
  const rows = await queryAll(env, 'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', limit);
  return rows.reverse();
}
async function saveMessage(env, role, content, provider = null) {
  await execute(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', uid(), role, String(content || ''), provider, now());
}

function socialIntent(text = '') {
  return /(instagram|reels?|facebook|sosyal medya|takipçi|follower|içerik planı|content plan|reklam).*(yap|hazırla|paylaş|büyüt|kazan|otomatik|kampanya)|(?:para kazan|takipçi getir).*(instagram|reels?|facebook)/i.test(String(text));
}
function groupIntent(text = '') { return /(facebook|fb).*(grup|gruplar)|(grup|gruplar).*(facebook|fb)/i.test(String(text)); }
function platformsFrom(text = '') {
  const platforms = [];
  if (/instagram|reels?/i.test(text)) platforms.push('instagram');
  if (/facebook|fb/i.test(text)) platforms.push('facebook');
  return platforms.length ? platforms : ['instagram'];
}
function extractTopic(text = '') { return String(text).replace(/\s+/g, ' ').trim().slice(0, 700); }

async function googleIdeas(core, req, env, ctx, topic) {
  try {
    const url = new URL('/api/google-search', req.url);
    url.searchParams.set('q', `${topic} trend reels ideas`);
    url.searchParams.set('num', '6');
    const response = await core.fetch(new Request(url, { headers: req.headers }), env, ctx);
    if (!response.ok) return [];
    return (await response.json()).results || [];
  } catch { return []; }
}

async function aiContentPlan(env, topic, platforms, research = []) {
  const sources = research.slice(0, 5).map(item => `${item.title}: ${item.snippet}`).join('\n');
  if (env.AI) {
    try {
      const result = await env.AI.run('@cf/zai-org/glm-4.7-flash', {
        prompt: `Bir sosyal medya growth editörüsün. Konu/hedef: ${topic}\nPlatformlar: ${platforms.join(', ')}\nGüncel araştırma notları:\n${sources}\n\n3 adet yüksek kaliteli ama spam/deceptive olmayan içerik fikri üret. Her fikir için hook, caption, 5-10 hashtag ve 9:16 kısa video üretim promptu yaz. Yanıltıcı vaat, sahte etkileşim veya taklit insan davranışı kullanma. Sadece JSON dizi döndür: [{"topic":"...","hook":"...","caption":"...","hashtags":["#..."],"media_prompt":"..."}]`,
        max_tokens: 1200,
        temperature: 0.45
      });
      let text = String(result?.response || result?.result?.response || result?.text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 3);
    } catch {}
  }
  return [{ topic, hook: 'İlk 3 saniyede merak uyandıran giriş', caption: topic, hashtags: ['#reels','#keşfet','#içerik'], media_prompt: `9:16 dikey kısa video. Konu: ${topic}. İlk 2 saniyede güçlü görsel hook, hızlı tempo, temiz modern kurgu, okunabilir altyazılar.` }];
}

async function createCampaign(core, req, env, ctx, text, options = {}) {
  const platforms = options.platforms || platformsFrom(text), topic = options.topic || extractTopic(text), id = uid(), timestamp = now();
  const objective = /para kazan|satış|müşteri|reklam|gelir/i.test(text) ? 'monetization' : 'growth';
  await execute(env, 'INSERT INTO social_campaigns(id,name,objective,platforms,topic,audience,cadence,enabled,approval_mode,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, (options.name || topic).slice(0,100), objective, JSON.stringify(platforms), topic, String(options.audience || ''), 'daily', 1, 'auto_owned_accounts', JSON.stringify({ source:'chat', group_policy:'authorized_targets_only' }), timestamp, timestamp);
  const research = await googleIdeas(core, req, env, ctx, topic), plan = await aiContentPlan(env, topic, platforms, research);
  for (let index = 0; index < plan.length; index++) {
    for (const platform of platforms) {
      const item = plan[index] || {}, queueId = uid(), scheduled = timestamp + ((index + 1) * 24 * 60 * 60 * 1000);
      await execute(env, 'INSERT INTO social_content_queue(id,campaign_id,platform,content_type,topic,hook,caption,hashtags,media_prompt,status,scheduled_at,meta,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', queueId, id, platform, 'reel', String(item.topic || topic), String(item.hook || ''), String(item.caption || topic), JSON.stringify(item.hashtags || []), String(item.media_prompt || topic), 'planned', scheduled, JSON.stringify({ research:research.slice(0,3).map(row => ({ title:row.title, url:row.url })) }), timestamp, timestamp);
    }
  }
  await notify(env, 'social', 'Sosyal medya kampanyası oluşturuldu', topic, { campaign_id:id, platforms });
  return { id, platforms, topic, items:plan.length * platforms.length, group_policy:'Facebook gruplarında otomatik üyelik/insan gibi davranma yok; sadece açıkça yetkilendirilmiş hedefler ve platformun izin verdiği resmi API akışları.' };
}

let hfSpec = { ts:0, spec:null };
async function hfOpenapi() {
  if (hfSpec.spec && now() - hfSpec.ts < 15 * 60 * 1000) return hfSpec.spec;
  const response = await fetchWithTimeout(HF_OPENAPI, { headers:{ accept:'application/json' } }, 6000);
  if (!response.ok) throw new Error(`HF_OPENAPI_${response.status}`);
  const spec = await response.json(); hfSpec = { ts:now(), spec }; return spec;
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
  return resolveRef(spec, content['application/json']?.schema || Object.values(content)[0]?.schema || {});
}
async function hfEndpoint() {
  const spec = await hfOpenapi();
  for (const [path, item] of Object.entries(spec.paths || {})) {
    const operation = item?.post;
    if (!operation || path.startsWith('/requests/')) continue;
    const text = ([path, operation.operationId, operation.summary, operation.description, ...(operation.tags || [])].filter(Boolean).join(' ') + ' ' + JSON.stringify(requestSchema(spec, operation))).toLowerCase();
    if (/video/.test(text) && /(prompt|text)/.test(text)) return HF_API + path;
  }
  throw new Error('HF_NO_T2V_ENDPOINT');
}
async function hfCredential(env) {
  const credential = await queryOne(env, "SELECT * FROM credentials WHERE provider='higgsfield' AND enabled=1 ORDER BY priority ASC LIMIT 1");
  if (!credential) throw new Error('HIGGSFIELD_NOT_CONNECTED');
  return { ...credential, ...JSON.parse(await decryptCredential(env, credential.encrypted_secret)) };
}
const hfHeaders = credential => ({ Authorization:`Key ${credential.keyId}:${credential.keySecret}`, 'Content-Type':'application/json', Accept:'application/json' });
async function hfGenerate(env, prompt) {
  const credential = await hfCredential(env), endpoint = await hfEndpoint();
  const response = await fetchWithTimeout(endpoint, { method:'POST', headers:hfHeaders(credential), body:JSON.stringify({ prompt }) }, 15000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) throw new Error(`HF_${response.status}`);
  return payload;
}
async function hfStatus(env, id) {
  const credential = await hfCredential(env);
  const response = await fetchWithTimeout(`${HF_API}/requests/${encodeURIComponent(id)}/status`, { headers:hfHeaders(credential) }, 10000);
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = { raw:text }; }
  if (!response.ok) throw new Error(`HF_STATUS_${response.status}`);
  return payload;
}
function deepFind(obj, regex, depth = 0) {
  if (depth > 6 || obj == null) return null;
  if (typeof obj === 'string' && regex.test(obj)) return obj;
  if (Array.isArray(obj)) { for (const item of obj) { const result = deepFind(item, regex, depth + 1); if (result) return result; } }
  else if (typeof obj === 'object') { for (const [key, value] of Object.entries(obj)) { if (regex.test(key) && typeof value === 'string') return value; const result = deepFind(value, regex, depth + 1); if (result) return result; } }
  return null;
}
const jobId = payload => deepFind(payload, /^(request_?id|job_?id|id)$/i) || null;
const mediaUrl = payload => deepFind(payload, /^(video_?url|output_?url|url|download_?url)$/i) || deepFind(payload, /https?:\/\/.*\.(mp4|mov)(\?|$)/i) || null;

async function metaCredential(env) {
  const credential = await queryOne(env, "SELECT * FROM credentials WHERE provider='meta' AND enabled=1 AND last_status='ok' ORDER BY priority ASC LIMIT 1");
  if (!credential) throw new Error('META_NOT_CONNECTED');
  return { ...credential, token:await decryptCredential(env, credential.encrypted_secret) };
}
async function publishInstagram(env, item) {
  const credential = await metaCredential(env), instagramId = String(credential.model || '').trim();
  if (!instagramId) throw new Error('INSTAGRAM_BUSINESS_NOT_CONNECTED');
  const caption = `${item.caption || ''}\n\n${JSON.parse(item.hashtags || '[]').join(' ')}`;
  const response = await fetchWithTimeout(`${GRAPH}/${encodeURIComponent(instagramId)}/media`, { method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ media_type:'REELS', video_url:item.media_url, caption, share_to_feed:'true', access_token:credential.token }) }, 10000);
  const payload = await response.json();
  if (!response.ok) throw new Error(`IG_MEDIA_${response.status}:${String(payload?.error?.message || '')}`);
  return { container_id:payload.id };
}
async function finishInstagram(env, item) {
  const credential = await metaCredential(env), container = item.remote_id, instagramId = String(credential.model || '').trim();
  let response = await fetchWithTimeout(`${GRAPH}/${encodeURIComponent(container)}?fields=status_code,status&access_token=${encodeURIComponent(credential.token)}`, {}, 10000);
  let payload = await response.json();
  if (!response.ok) throw new Error(`IG_STATUS_${response.status}`);
  if (String(payload.status_code || '').toUpperCase() !== 'FINISHED') return { ready:false, status:payload.status_code || payload.status };
  response = await fetchWithTimeout(`${GRAPH}/${encodeURIComponent(instagramId)}/media_publish`, { method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ creation_id:container, access_token:credential.token }) }, 10000);
  payload = await response.json();
  if (!response.ok) throw new Error(`IG_PUBLISH_${response.status}:${String(payload?.error?.message || '')}`);
  return { ready:true, id:payload.id };
}
async function publishFacebook(env, item) {
  const credential = await metaCredential(env), page = String(credential.endpoint || '').trim();
  if (!page) throw new Error('FACEBOOK_PAGE_NOT_CONNECTED');
  const description = `${item.caption || ''}\n\n${JSON.parse(item.hashtags || '[]').join(' ')}`;
  const response = await fetchWithTimeout(`${GRAPH}/${encodeURIComponent(page)}/videos`, { method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ file_url:item.media_url, description, access_token:credential.token }) }, 10000);
  const payload = await response.json();
  if (!response.ok) throw new Error(`FB_VIDEO_${response.status}:${String(payload?.error?.message || '')}`);
  return { id:payload.id };
}

export async function processSocialQueue(env) {
  const due = await queryAll(env, "SELECT * FROM social_content_queue WHERE status IN ('planned','generating','ready','publishing') AND (scheduled_at IS NULL OR scheduled_at<=?) ORDER BY created_at ASC LIMIT 6", now());
  for (const item of due) {
    try {
      if (item.status === 'planned') {
        const payload = await hfGenerate(env, item.media_prompt || item.topic), id = jobId(payload), url = mediaUrl(payload);
        if (url) await execute(env, "UPDATE social_content_queue SET media_url=?,status='ready',updated_at=? WHERE id=?", url, now(), item.id);
        else if (id) await execute(env, "UPDATE social_content_queue SET external_job_id=?,status='generating',updated_at=? WHERE id=?", id, now(), item.id);
        else throw new Error('HF_NO_JOB_OR_URL');
      } else if (item.status === 'generating') {
        const payload = await hfStatus(env, item.external_job_id), url = mediaUrl(payload);
        if (url) await execute(env, "UPDATE social_content_queue SET media_url=?,status='ready',updated_at=? WHERE id=?", url, now(), item.id);
      } else if (item.status === 'ready') {
        if (item.platform === 'instagram') {
          const payload = await publishInstagram(env, item);
          await execute(env, "UPDATE social_content_queue SET remote_id=?,status='publishing',updated_at=? WHERE id=?", payload.container_id, now(), item.id);
        } else if (item.platform === 'facebook') {
          const payload = await publishFacebook(env, item);
          await execute(env, "UPDATE social_content_queue SET remote_id=?,status='published',published_at=?,updated_at=? WHERE id=?", payload.id, now(), now(), item.id);
          await notify(env, 'social', 'Facebook içeriği yayınlandı', item.caption, { queue_id:item.id, remote_id:payload.id });
        }
      } else if (item.status === 'publishing' && item.platform === 'instagram') {
        const payload = await finishInstagram(env, item);
        if (payload.ready) {
          await execute(env, "UPDATE social_content_queue SET remote_id=?,status='published',published_at=?,updated_at=? WHERE id=?", payload.id, now(), now(), item.id);
          await notify(env, 'social', 'Instagram Reel yayınlandı', item.caption, { queue_id:item.id, remote_id:payload.id });
        }
      }
    } catch (error) {
      await execute(env, 'UPDATE social_content_queue SET error=?,updated_at=? WHERE id=?', String(error.message || error).slice(0,500), now(), item.id);
    }
  }
}

async function webhookConfig(env) {
  const value = await kvGet(env, 'social_webhook_cfg', null);
  if (!value?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, value.blob)); } catch { return null; }
}
async function setupWebhook(req, env) {
  const body = await readJson(req), token = String(body.verify_token || '').trim();
  if (token.length < 12) return jsonResponse({ error:'VERIFY_TOKEN_MIN_12' }, 400);
  await kvSet(env, 'social_webhook_cfg', { blob:await encryptCredential(env, JSON.stringify({ token })), updated_at:now() });
  return jsonResponse({ ok:true, callback:`${new URL(req.url).origin}/api/social-growth/meta-webhook` });
}
async function metaAppSecret(env) {
  const value = await kvGet(env, 'meta_oauth_app', null);
  if (!value?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, value.blob)).appSecret || null; } catch { return null; }
}
async function verifySignature(req, env, raw) {
  const signature = req.headers.get('x-hub-signature-256'), secret = await metaAppSecret(env);
  if (!secret || !signature) return true;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(raw)));
  const hex = `sha256=${[...bytes].map(byte => byte.toString(16).padStart(2,'0')).join('')}`;
  return hex === signature;
}
async function webhookGet(req, env) {
  const url = new URL(req.url), config = await webhookConfig(env);
  if (!config) return new Response('not configured', { status:404 });
  if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === config.token) return new Response(url.searchParams.get('hub.challenge') || '', { status:200 });
  return new Response('forbidden', { status:403 });
}
async function webhookPost(req, env) {
  const raw = await req.text();
  if (!(await verifySignature(req, env, raw))) return new Response('bad signature', { status:403 });
  let payload = {}; try { payload = JSON.parse(raw); } catch { return new Response('bad json', { status:400 }); }
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {}, text = String(value.text || value.message || value.comment?.text || ''), externalId = String(value.id || value.comment_id || value.comment?.id || ''), actor = String(value.from?.username || value.from?.name || value.user?.username || '');
      if (text || externalId) {
        await execute(env, 'INSERT INTO social_events(id,platform,event_type,external_id,actor,text,payload,handled,created_at) VALUES(?,?,?,?,?,?,?,0,?)', uid(), String(payload.object || 'meta'), String(change.field || 'event'), externalId, actor, text, JSON.stringify(value), now());
        await notify(env, 'social-comment', 'Yeni sosyal medya yorumu', text || 'Yeni etkileşim', { actor, external_id:externalId, field:change.field });
      }
    }
  }
  return jsonResponse({ ok:true });
}

async function chatCampaign(core, req, env, ctx, text) {
  const campaign = await createCampaign(core, req, env, ctx, text);
  let reply = `Sosyal medya growth kampanyasını oluşturdum. ${campaign.items} içerik kuyruğa alındı. Konu araştırması, hook, açıklama, hashtag, Higgsfield video üretimi ve bağlı Instagram/Facebook Page hesabında yayınlama otomatik ilerleyecek.`;
  if (groupIntent(text)) reply += ' Facebook grupları tarafında rastgele gruplara otomatik katılıp insanmış gibi paylaşım yapmayacağım; bu spam/deceptive otomasyon olur. Yetkili olduğun/izinli hedefleri ekleyebilir, onlar için doğal metinleri hazırlayıp onaylı paylaşım kuyruğu yönetebilirim.';
  await saveMessage(env, 'user', text);
  await saveMessage(env, 'assistant', reply, 'JARVIS Social Growth');
  const stateResponse = await core.fetch(new Request(new URL('/api/state', req.url), { headers:req.headers }), env, ctx);
  let state = {}; try { state = await stateResponse.json(); } catch {}
  return jsonResponse({ reply, provider:'JARVIS Social Growth', campaign, state, history:await history(env) });
}

export function createSocialGrowth(core) {
  if (!core?.fetch) throw new Error('SOCIAL_GROWTH_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers:req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url), path = url.pathname, method = req.method;
      if (path === '/api/social-growth/meta-webhook' && method === 'GET') return webhookGet(req, env);
      if (path === '/api/social-growth/meta-webhook' && method === 'POST') return webhookPost(req, env);
      if (path.startsWith('/api/social-growth/')) {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        if (path === '/api/social-growth/campaigns' && method === 'GET') return jsonResponse({ campaigns:await queryAll(env, 'SELECT * FROM social_campaigns ORDER BY created_at DESC LIMIT 100'), queue:await queryAll(env, 'SELECT * FROM social_content_queue ORDER BY created_at DESC LIMIT 100'), events:await queryAll(env, 'SELECT * FROM social_events ORDER BY created_at DESC LIMIT 50') });
        if (path === '/api/social-growth/campaigns' && method === 'POST') { const body = await readJson(req); return jsonResponse(await createCampaign(core, req, env, ctx, String(body.topic || body.request || ''), body)); }
        if (path === '/api/social-growth/webhook/setup' && method === 'POST') return setupWebhook(req, env);
        if (path === '/api/social-growth/status' && method === 'GET') return jsonResponse({ meta:!!(await queryOne(env, "SELECT id FROM credentials WHERE provider='meta' AND enabled=1 AND last_status='ok' LIMIT 1")), higgsfield:!!(await queryOne(env, "SELECT id FROM credentials WHERE provider='higgsfield' AND enabled=1 AND last_status='ok' LIMIT 1")), webhook:!!(await webhookConfig(env)), campaigns:Number((await queryOne(env, 'SELECT COUNT(*) n FROM social_campaigns WHERE enabled=1'))?.n || 0), pending:Number((await queryOne(env, "SELECT COUNT(*) n FROM social_content_queue WHERE status!='published'"))?.n || 0) });
      }
      if (path === '/api/chat/send' && method === 'POST') {
        const body = await readJson(req.clone()), text = String(body.text || '').trim();
        if (text && socialIntent(text)) {
          if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
          try { return await chatCampaign(core, req, env, ctx, text); }
          catch (error) { return jsonResponse({ error:error.message }, 500); }
        }
      }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      try { await processSocialQueue(env); } catch (error) { console.error('social queue', error); }
      return core.scheduled?.(event, env, ctx);
    }
  };
}
