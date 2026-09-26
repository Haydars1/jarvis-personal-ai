import {
  decryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  readJson,
  settleWithin
} from '../../lib/runtime.js';

const FAST_CF_MODEL = '@cf/zai-org/glm-4.7-flash';
const IMAGE_CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const EXPERT_PROMPTS = Object.freeze({
  general: 'Genel kişisel asistan olarak kullanıcının amacını tamamla.',
  coding: 'Kıdemli yazılım mühendisi gibi kod, mimari, test ve hata ayıklamaya odaklan.',
  research: 'Araştırma uzmanı gibi güncellik, kaynak kalitesi ve doğrulamaya odaklan.',
  ecu: 'ECU/tuning uzmanı gibi dosya analizi, teşhis ve güvenli test akışlarına odaklan. Yasal ve güvenlik sınırlarını koru.',
  documents: 'Belge uzmanı gibi metin, özet, çeviri ve dosya iş akışlarına odaklan.',
  automotive: 'Otomotiv teşhis ve bakım uzmanı gibi belirtiler, ölçümler ve adım adım kontrole odaklan.',
  youtube: 'YouTube içerik stratejisti, senaryo yazarı ve kanal analisti gibi çalış. Hook, başlık-thumbnail paketi, retention, Shorts, SEO, yorum, edit ve içerik planını tek sistemde yönet. Uydurma metrik üretme; kullanıcı verisi varsa ona dayan. Yayınlama işlemi yapma, yayın öncesi çıktıyı hazırla.'
});
const NVIDIA_CATALOG_TTL = 15 * 60 * 1000;
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let nvidiaCatalogCache = { ts: 0, base: '', ids: [] };

function intent(text = '') {
  const value = String(text).toLowerCase();
  if (/(video|reels?|klip|animasyon|hareketli|text.?to.?video|image.?to.?video)/i.test(value) && /(oluştur|yap|üret|hazırla|çiz|generate|create|göster)/i.test(value)) return 'video';
  if (/(resim|görsel|foto|fotoğraf|logo|amblem|emblem|poster|kapak|afiş|image)/i.test(value) && /(oluştur|çiz|yap|üret|hazırla|generate|create|göster)/i.test(value)) return 'image';
  if (/(kod|code|javascript|typescript|python|sql|debug|hata düzelt|refactor)/i.test(value)) return 'coding';
  if (/(araştır|internette|güncel|son durum|kaynak|webde|web'de|haber)/i.test(value)) return 'research';
  if (/(neden|analiz|karşılaştır|hesapla|mantık|planla|strateji)/i.test(value)) return 'reasoning';
  return 'chat';
}
function parseCapabilities(row) { try { return JSON.parse(row.capabilities || '[]'); } catch { return []; } }
function limitation(text = '') {
  return /(yeteneğim yok|yapamıyorum|yapamam|doğrudan .* yapamam|görsel .* yok|cannot (generate|create|draw)|i can.?t (generate|create|draw)|bu özelliğe sahip değilim)/i.test(String(text));
}

async function history(env, limit = 24) {
  const rows = await queryAll(env, 'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', limit);
  return rows.reverse();
}
async function fullHistory(env, limit = 160) {
  const rows = await queryAll(env, 'SELECT role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', limit);
  return rows.reverse();
}
async function saveMessage(env, role, content, provider = null) {
  await execute(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', uid(), role, String(content || ''), provider, now());
  await execute(env, 'DELETE FROM chat_messages WHERE id IN (SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT -1 OFFSET 1000)');
}
async function state(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/state', req.url), { headers: req.headers }), env, ctx);
  try { return await response.json(); } catch { return {}; }
}
function messagesFor(hist, text, expert = 'general', project = '') {
  const expertPrompt = EXPERT_PROMPTS[expert] || EXPERT_PROMPTS.general;
  const projectPrompt = project ? ` Aktif proje: ${String(project).slice(0,120)}. Bu proje bağlamını cevap boyunca koru.` : '';
  const system = { role: 'system', content: `Sen JARVIS kişisel asistansın. Türkçe yanıt ver. Kısa, doğrudan ve eylem odaklı ol. Kullanıcı bir şey yapılmasını istediğinde gereksiz izin isteme veya "istersen" deme. Modalite/yetenek eksikliği söyleme; görsel ve video işleri capability router tarafından ayrı yürütülür. ${expertPrompt}${projectPrompt}` };
  const recent = (hist || []).slice(-14).map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content }));
  return [system, ...recent, { role: 'user', content: text }];
}

async function cfText(env, messages) {
  if (!env.AI) throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  const prompt = `${messages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n')}\n\nASSISTANT:`;
  const result = await settleWithin(env.AI.run(FAST_CF_MODEL, { prompt, max_tokens: 900, temperature: 0.25 }), 4500, null);
  const text = String(result?.response || result?.result?.response || result?.text || '').trim();
  if (!text) throw new Error('CLOUDFLARE_AI_EMPTY');
  return { provider: 'Cloudflare AI · GLM 4.7 Flash', text };
}

async function vaultRows(env, capability) {
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE enabled=1 AND last_status='ok' ORDER BY priority ASC,created_at ASC");
  const supported = ['gemini','groq','openrouter','nvidia','deepseek','mistral','xai','together','fireworks','openai','anthropic','perplexity','cerebras','sambanova','openai-compatible'];
  return rows.filter(row => {
    if (!supported.includes(String(row.provider || '').toLowerCase())) return false;
    const caps = parseCapabilities(row);
    if (capability === 'coding') return caps.includes('coding') || caps.includes('reasoning') || caps.includes('chat');
    if (capability === 'reasoning') return caps.includes('reasoning') || caps.includes('chat');
    return caps.includes('chat') || caps.length === 0;
  });
}

async function nvidiaCatalog(base, secret, timeoutMs = 1600) {
  base = String(base || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  if (nvidiaCatalogCache.ids.length && nvidiaCatalogCache.base === base && now() - nvidiaCatalogCache.ts < NVIDIA_CATALOG_TTL) return nvidiaCatalogCache.ids;
  const response = await fetchWithTimeout(`${base}/models`, { headers: { authorization: `Bearer ${secret}`, accept: 'application/json' } }, timeoutMs);
  if (!response.ok) throw new Error(`NVIDIA_MODELS_${response.status}`);
  const payload = await response.json();
  const ids = (payload.data || payload.models || []).map(model => String(model.id || model.name || '').trim()).filter(Boolean);
  if (ids.length) nvidiaCatalogCache = { ts: now(), base, ids: [...new Set(ids)] };
  return ids;
}
function nvidiaScore(id, capability) {
  const value = String(id).toLowerCase(); let score = 0;
  const boost = (regex, points) => { if (regex.test(value)) score += points; };
  if (capability === 'coding') {
    boost(/deepseek.*v4.*pro|deepseek-v4-pro/,120); boost(/kimi-k3/,105); boost(/muse-glimmer-30b/,95); boost(/gpt-oss-120b/,90); boost(/nemotron-3\.5-lightning/,80); boost(/gemma-4-31b-it/,75);
  } else if (capability === 'reasoning') {
    boost(/deepseek.*v4.*pro|deepseek-v4-pro/,120); boost(/muse-glimmer-30b/,110); boost(/kimi-k3/,105); boost(/gpt-oss-120b/,92); boost(/nemotron-3\.5-lightning/,85); boost(/gemma-4-31b-it/,80);
  } else if (capability === 'vision') {
    boost(/muse-glimmer-30b/,130); boost(/kimi-k3/,120); boost(/cosmos3-nano-reasoner/,110); boost(/vision|vlm|multimodal/,60);
  } else {
    boost(/nemotron-3\.5-lightning/,130); boost(/muse-glimmer-30b/,105); boost(/kimi-k3/,100); boost(/gpt-oss-120b/,88); boost(/gemma-4-31b-it/,82); boost(/deepseek.*v4.*pro|deepseek-v4-pro/,78);
  }
  if (/deprecated|preview/.test(value)) score -= 50;
  return score;
}
function nvidiaCandidates(ids, capability, fallbackModel) {
  const ranked = [...(ids || [])].map(id => ({ id, score: nvidiaScore(id, capability) })).sort((a,b) => b.score - a.score).filter(item => item.score > 0).map(item => item.id);
  const output = [];
  for (const id of [fallbackModel, ...ranked]) if (id && !output.includes(id)) output.push(id);
  return output.slice(0, 5);
}
async function nvidiaCall(env, credential, messages, capability, timeoutMs = 6500) {
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const base = String(credential.endpoint || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  let ids = []; try { ids = await nvidiaCatalog(base, secret); } catch {}
  const candidates = nvidiaCandidates(ids, capability, String(credential.model || 'nvidia/nemotron-3.5-lightning-30b-a3b').trim());
  let lastError = 'NVIDIA_NO_MODEL';
  for (const model of candidates.slice(0, 3)) {
    try {
      const response = await fetchWithTimeout(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, 'HTTP-Referer': 'https://jarvis-personal-ai.haydojarvis.workers.dev', 'X-Title': 'JARVIS' },
        body: JSON.stringify({ model, messages, temperature: 0.25, max_tokens: 900 })
      }, timeoutMs);
      if (!response.ok) { lastError = `NVIDIA_${response.status}_${model}`; continue; }
      const payload = await response.json(), text = payload.choices?.[0]?.message?.content || '';
      if (!text) { lastError = `NVIDIA_EMPTY_${model}`; continue; }
      return { provider: `NVIDIA NIM · ${model.split('/').pop()}`, text, model };
    } catch (error) { lastError = error?.message || String(error); }
  }
  throw new Error(lastError);
}

async function callVault(env, credential, messages, timeoutMs = 8500, capability = 'chat') {
  const provider = String(credential.provider || '').toLowerCase();
  if (provider === 'nvidia') return nvidiaCall(env, credential, messages, capability, Math.min(timeoutMs, 7000));
  const secret = await decryptCredential(env, credential.encrypted_secret);
  if (provider === 'gemini') {
    const model = credential.model || 'gemini-2.5-flash';
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: messages.filter(item => item.role !== 'system').map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
        systemInstruction: { parts: [{ text: messages.find(item => item.role === 'system')?.content || '' }] }
      })
    }, timeoutMs);
    if (!response.ok) throw new Error(`GEMINI_${response.status}`);
    const payload = await response.json(), text = payload.candidates?.[0]?.content?.parts?.map(item => item.text).join('') || '';
    if (!text) throw new Error('GEMINI_EMPTY');
    return { provider: credential.label || 'Gemini', text };
  }
  const base = String(credential.endpoint || '').replace(/\/$/, ''), model = String(credential.model || '').trim();
  if (!base) throw new Error('NO_ENDPOINT');
  if (!model) throw new Error('NO_MODEL');
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, 'HTTP-Referer': 'https://jarvis-personal-ai.haydojarvis.workers.dev', 'X-Title': 'JARVIS' },
    body: JSON.stringify({ model, messages, temperature: 0.25, max_tokens: 900 })
  }, timeoutMs);
  if (!response.ok) throw new Error(`${(provider || 'AI').toUpperCase()}_${response.status}`);
  const payload = await response.json(), text = payload.choices?.[0]?.message?.content || '';
  if (!text) throw new Error(`${(provider || 'AI').toUpperCase()}_EMPTY`);
  return { provider: credential.label || credential.provider, text };
}

async function fastText(env, capability, messages, preferred = 'auto') {
  let rows = await vaultRows(env, capability);
  if (preferred && preferred !== 'auto' && preferred !== 'cloudflare') {
    const index = rows.findIndex(row => String(row.id) === String(preferred) || String(row.provider).toLowerCase() === String(preferred).toLowerCase() || String(row.label).toLowerCase() === String(preferred).toLowerCase());
    if (index > 0) rows = [rows[index], ...rows.slice(0,index), ...rows.slice(index + 1)];
  }
  if (preferred === 'cloudflare') rows = [];
  let settled = false;
  const jobs = [], external = rows.slice(0, 3);
  if (capability === 'coding' || capability === 'reasoning') {
    if (external[0]) jobs.push(callVault(env, external[0], messages, 7000, capability));
    if (env.AI) jobs.push(sleep(350).then(() => { if (settled) throw new Error('SKIP'); return cfText(env, messages); }));
    if (external[1]) jobs.push(sleep(700).then(() => { if (settled) throw new Error('SKIP'); return callVault(env, external[1], messages, 6500, capability); }));
    if (external[2]) jobs.push(sleep(1100).then(() => { if (settled) throw new Error('SKIP'); return callVault(env, external[2], messages, 6000, capability); }));
  } else {
    if (env.AI) jobs.push(cfText(env, messages));
    if (external[0]) jobs.push(sleep(350).then(() => { if (settled) throw new Error('SKIP'); return callVault(env, external[0], messages, 6500, capability); }));
    if (external[1]) jobs.push(sleep(750).then(() => { if (settled) throw new Error('SKIP'); return callVault(env, external[1], messages, 6000, capability); }));
  }
  if (!jobs.length) throw new Error('NO_FAST_PROVIDER');
  const first = await Promise.any(jobs); settled = true;
  if (!limitation(first.text)) return first;
  for (const credential of external) {
    try { const alt = await callVault(env, credential, messages, 5500, capability); if (!limitation(alt.text)) return alt; }
    catch {}
  }
  return first;
}

async function imageGenerate(env, text) {
  if (!env.AI) throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  const result = await settleWithin(env.AI.run(IMAGE_CF_MODEL, { prompt: String(text).slice(0, 2048), steps: 4 }), 12000, null);
  const image = result?.image;
  if (!image) throw new Error('IMAGE_GENERATION_EMPTY');
  return { provider: 'Cloudflare Workers AI · FLUX.1 schnell', dataURI: `data:image/jpeg;base64,${image}` };
}
async function tryVideo(core, req, env, ctx, text) {
  const response = await settleWithin(core.fetch(new Request(new URL('/api/higgsfield/generate', req.url), {
    method: 'POST', headers: req.headers, body: JSON.stringify({ capability: 'text-to-video', input: { prompt: text } })
  }), env, ctx), 8000, null);
  if (!response?.ok) throw new Error(`HIGGSFIELD_${response?.status || 'TIMEOUT'}`);
  return response.json();
}
async function synthetic(core, req, env, ctx, reply, provider, media = []) {
  await saveMessage(env, 'assistant', reply, provider);
  return jsonResponse({ reply, provider, media, state: await state(core, req, env, ctx), history: await fullHistory(env) });
}
async function aiCatalog(env) {
  const rows = await queryAll(env, "SELECT id,provider,label,model,capabilities,last_status,enabled,priority FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC");
  return {
    default: 'auto',
    experts: Object.keys(EXPERT_PROMPTS),
    models: [
      { id: 'auto', provider: 'jarvis', label: 'AUTO · JARVIS RouteLLM', model: 'automatic', healthy: true },
      ...(env.AI ? [{ id: 'cloudflare', provider: 'cloudflare', label: 'Cloudflare AI · GLM 4.7 Flash', model: FAST_CF_MODEL, healthy: true }] : []),
      ...rows.map(row => ({
        id: String(row.id),
        provider: row.provider,
        label: row.label || row.provider,
        model: row.model || '',
        capabilities: parseCapabilities(row),
        healthy: row.last_status === 'ok'
      }))
    ]
  };
}

async function nvidiaPoolInfo(env) {
  const rows = await queryAll(env, "SELECT * FROM credentials WHERE enabled=1 AND provider='nvidia' ORDER BY priority ASC,created_at ASC LIMIT 1");
  if (!rows.length) return { connected: false, models: [], selected: {} };
  const credential = rows[0], secret = await decryptCredential(env, credential.encrypted_secret), base = String(credential.endpoint || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const ids = await nvidiaCatalog(base, secret, 3500), selected = {};
  for (const capability of ['chat','coding','reasoning','vision']) selected[capability] = nvidiaCandidates(ids, capability, credential.model)[0] || null;
  return { connected: true, total: ids.length, models: ids, selected, source: `${base}/models`, refreshed_at: nvidiaCatalogCache.ts };
}

export function createSmartRouter(core) {
  if (!core?.fetch) throw new Error('SMART_ROUTER_CORE_FETCH_REQUIRED');
  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/ai/models' && req.method === 'GET') {
        if (!(await authed(req, env, ctx))) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
        try { return jsonResponse(await aiCatalog(env)); }
        catch (error) { return jsonResponse({ error: error.message }, 500); }
      }
      if (url.pathname === '/api/nvidia/pool' && req.method === 'GET') {
        if (!(await authed(req, env, ctx))) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
        try { return jsonResponse(await nvidiaPoolInfo(env)); }
        catch (error) { return jsonResponse({ error: error.message }, 502); }
      }
      if (url.pathname !== '/api/chat/send' || req.method !== 'POST') return core.fetch(req, env, ctx);
      if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
      const body = await readJson(req.clone()), text = String(body.text || '').trim();
      if (!text) return core.fetch(req, env, ctx);
      const preferred = String(body.model || 'auto').trim() || 'auto';
      const expert = String(body.expert || 'general').trim().toLowerCase();
      const project = String(body.project || '').trim();
      const capability = expert === 'coding' ? 'coding' : expert === 'research' ? 'research' : intent(text);
      if (capability === 'research') return core.fetch(req, env, ctx);

      await saveMessage(env, 'user', text);
      try {
        if (capability === 'image') {
          const image = await imageGenerate(env, text);
          return synthetic(core, req, env, ctx, 'Görseli doğrudan oluşturdum.', image.provider, [{ type: 'image', src: image.dataURI, alt: text }]);
        }
        if (capability === 'video') {
          try {
            const video = await tryVideo(core, req, env, ctx, text), requestId = video.request_id || video.id || video.requestId || null;
            return synthetic(core, req, env, ctx, requestId ? `Videoyu Higgsfield'a gönderdim. İş ID: ${requestId}` : 'Video üretimini Higgsfield üzerinden başlattım.', 'Higgsfield', [{ type: 'video-job', data: video }]);
          } catch {}
        }
        const hist = await history(env, 20);
        const answer = await fastText(env, capability, messagesFor(hist.slice(0, -1), text, expert, project), preferred);
        const route = { mode: preferred === 'auto' ? 'auto' : 'manual', requested: preferred, expert, project: project || null, capability, selected: answer.provider };
        await saveMessage(env, 'assistant', answer.text, answer.provider);
        return jsonResponse({ reply: answer.text, provider: answer.provider, route, state: await state(core, req, env, ctx), history: await fullHistory(env) });
      } catch {
        try { await execute(env, "DELETE FROM chat_messages WHERE id=(SELECT id FROM chat_messages WHERE role='user' AND content=? ORDER BY created_at DESC LIMIT 1)", text); } catch {}
        return core.fetch(req, env, ctx);
      }
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
