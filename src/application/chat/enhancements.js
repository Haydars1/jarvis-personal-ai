import {
  decryptCredential,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  readJson,
  execute,
  settleWithin
} from '../../lib/runtime.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function state(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/state', req.url), { headers: req.headers }), env, ctx);
  try { return await response.json(); } catch { return {}; }
}
async function history(env, limit = 160) {
  const rows = await queryAll(env, 'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', limit);
  return rows.reverse();
}
async function save(env, role, content, provider = null) {
  await execute(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', uid(), role, String(content || ''), provider, now());
}

function toolIntent(text = '') {
  return /(ai aracı|araç bul|tool bul|plugin bul|hangi ai|hangi araç|bunu yapacak ai|bunu yapabilen ai|uygun ai|sisteme ekle|jarvis.?e ekle|entegre et)/i.test(String(text));
}
function addIntent(text = '') { return /(sisteme ekle|jarvis.?e ekle|entegre et|bağla|kur)/i.test(String(text)); }
function limitation(text = '') { return /(yeteneğim yok|yapamıyorum|yapamam|bu özelliğe sahip değilim|cannot (generate|create|do)|i can.?t (generate|create|do))/i.test(String(text)); }
function inferCapability(text = '') {
  const value = String(text).toLowerCase();
  if (/video|reels|klip/.test(value)) return 'video-generation';
  if (/görsel|resim|foto|image|logo|poster/.test(value)) return 'image-generation';
  if (/müzik|music|şarkı|beat|ses/.test(value)) return 'music-generation';
  if (/voice|seslendir|tts/.test(value)) return 'tts';
  if (/kod|code|yazılım/.test(value)) return 'coding';
  return String(text).slice(0, 180);
}

async function discover(core, req, env, ctx, text) {
  const url = new URL('/api/tools/discover', req.url);
  url.searchParams.set('capability', inferCapability(text));
  const response = await settleWithin(core.fetch(new Request(url, { headers: req.headers }), env, ctx), 2500, null);
  if (!response?.ok) throw new Error(`TOOL_DISCOVERY_${response?.status || 'TIMEOUT'}`);
  const payload = await response.json();
  const tools = (payload.results || []).slice(0, 5);
  let queued = false, change = null;

  if (addIntent(text) && tools.length) {
    try {
      const top = tools[0];
      const request = `${text}\n\nAI Tool Scout sonucu: ${top.title || ''} ${top.url || ''}. Önce mevcut provider/capability sistemine uyumunu kontrol et; resmi API ve auth yöntemini kullan; uydurma endpoint/model kullanma; test edip güvenli şekilde entegre et.`;
      const updateResponse = await settleWithin(core.fetch(new Request(new URL('/api/self-update/request', req.url), {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ request })
      }), env, ctx), 3000, null);
      if (updateResponse?.ok) {
        change = await updateResponse.json().catch(() => null);
        queued = true;
      }
    } catch {}
  }

  const lines = tools.map((tool, index) => `${index + 1}. ${tool.title || 'Araç'}${tool.url ? ` — ${tool.url}` : ''}`).join('\n');
  const reply = tools.length
    ? `${queued ? 'Uygun aracı buldum ve entegrasyon isteğini Self Update hattına gönderdim.' : 'Uygun araçları buldum.'}\n\n${lines}`
    : 'Bu iş için uygun bir araç bulamadım.';
  await save(env, 'user', text);
  await save(env, 'assistant', reply, 'AI Tool Scout');
  return jsonResponse({ reply, provider: 'AI Tool Scout', tools, change, state: await state(core, req, env, ctx), history: await history(env) });
}

function cleanAttachments(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && /^image\//i.test(String(item.type || '')) && String(item.base64 || '').length > 20)
    .slice(0, 3)
    .map(item => ({ name: String(item.name || 'image'), type: String(item.type || 'image/jpeg'), base64: String(item.base64 || '') }));
}

async function geminiVision(env, credential, text, images) {
  const secret = await decryptCredential(env, credential.encrypted_secret), model = credential.model || 'gemini-2.5-flash';
  const parts = [{ text: text || 'Bu görseli ayrıntılı şekilde incele ve Türkçe cevap ver.' }, ...images.map(image => ({ inline_data: { mime_type: image.type, data: image.base64 } }))];
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] })
  }, 9000);
  if (!response.ok) throw new Error(`GEMINI_VISION_${response.status}`);
  const payload = await response.json();
  const output = payload.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('') || '';
  if (!output) throw new Error('GEMINI_VISION_EMPTY');
  return { provider: 'Gemini Vision', text: output };
}

async function nvidiaModels(base, secret) {
  try {
    const response = await fetchWithTimeout(`${base}/models`, { headers: { authorization: `Bearer ${secret}`, accept: 'application/json' } }, 1800);
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.data || payload.models || []).map(model => String(model.id || model.name || '')).filter(Boolean);
  } catch { return []; }
}
function visionScore(id) {
  const value = String(id).toLowerCase(); let score = 0;
  if (/vision|vlm|multimodal/.test(value)) score += 120;
  if (/kimi/.test(value)) score += 90;
  if (/muse/.test(value)) score += 85;
  if (/cosmos/.test(value)) score += 80;
  if (/nemotron/.test(value) && /vision|vl/.test(value)) score += 75;
  return score;
}
async function nvidiaVision(env, credential, text, images) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const base = String(credential.endpoint || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const ids = await nvidiaModels(base, secret);
  const ranked = ids.map(id => ({ id, score: visionScore(id) })).filter(item => item.score > 0).sort((a,b) => b.score - a.score).map(item => item.id);
  const candidates = [...new Set([...ranked, String(credential.model || '').trim()].filter(Boolean))].slice(0, 4);
  let last = 'NVIDIA_VISION_NO_MODEL';
  for (const model of candidates) {
    try {
      const content = [{ type: 'text', text: text || 'Bu görseli ayrıntılı şekilde incele ve Türkçe cevap ver.' }, ...images.map(image => ({ type: 'image_url', image_url: { url: `data:${image.type};base64,${image.base64}` } }))];
      const response = await fetchWithTimeout(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.2, max_tokens: 900 })
      }, 8500);
      if (!response.ok) { last = `NVIDIA_VISION_${response.status}`; continue; }
      const payload = await response.json();
      const output = payload.choices?.[0]?.message?.content || '';
      if (output) return { provider: `NVIDIA NIM Vision · ${model.split('/').pop()}`, text: output };
    } catch (error) { last = error?.message || String(error); }
  }
  throw new Error(last);
}

async function vision(core, req, env, ctx, text, items) {
  const images = cleanAttachments(items);
  if (!images.length) throw new Error('IMAGE_ATTACHMENT_REQUIRED');
  const note = `${text || 'Bu fotoğrafı incele'}\n${images.map(image => `[Fotoğraf: ${image.name}]`).join(' ')}`;
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE enabled=1 AND last_status='ok' AND provider IN ('gemini','nvidia') ORDER BY priority ASC,created_at ASC");
  let answer = null, last = 'VISION_PROVIDER_NOT_CONNECTED';
  for (const credential of rows) {
    try {
      answer = String(credential.provider).toLowerCase() === 'gemini'
        ? await geminiVision(env, credential, text, images)
        : await nvidiaVision(env, credential, text, images);
      if (answer) break;
    } catch (error) { last = error?.message || String(error); }
  }
  if (!answer) throw new Error(last);
  await save(env, 'user', note);
  await save(env, 'assistant', answer.text, answer.provider);
  return jsonResponse({ reply: answer.text, provider: answer.provider, state: await state(core, req, env, ctx), history: await history(env) });
}

export function createChatEnhancements(core) {
  if (!core?.fetch) throw new Error('CHAT_ENHANCEMENTS_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/chat/send' && req.method === 'POST') {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        const body = await readJson(req.clone()), text = String(body.text || '').trim(), attachments = cleanAttachments(body.attachments);
        if (attachments.length) {
          try { return await vision(core, req, env, ctx, text, attachments); }
          catch (error) { return jsonResponse({ error: error.message }, 400); }
        }
        if (text && toolIntent(text)) {
          try { return await discover(core, req, env, ctx, text); } catch {}
        }
        const response = await core.fetch(req, env, ctx);
        if (response.ok && text) {
          try {
            const payload = await response.clone().json();
            if (limitation(payload?.reply || '')) {
              try { return await discover(core, req, env, ctx, text); } catch {}
            }
          } catch {}
        }
        return response;
      }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
