import {
  decryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  queryOne,
  readJson,
  settleWithin
} from '../../lib/runtime.js';

const decoder = new TextDecoder();
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

async function saveMessage(env, role, content, provider = null) {
  await execute(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', uid(), role, String(content || ''), provider, now());
}

async function notify(env, kind, title, bodyText = '', meta = {}) {
  await execute(env, 'INSERT INTO notifications(id,kind,title,body,read,meta,created_at) VALUES(?,?,?,?,0,?,?)', uid(), kind, title, String(bodyText || ''), JSON.stringify(meta || {}), now());
}

function fingerprint(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function recordMetric(env, provider, latencyMs, ok = true, error = '') {
  provider = String(provider || 'JARVIS').slice(0, 140);
  const row = await queryOne(env, 'SELECT * FROM provider_metrics WHERE provider=?', provider);
  if (!row) {
    await execute(env, 'INSERT INTO provider_metrics(provider,samples,successes,failures,avg_latency_ms,last_latency_ms,last_error,updated_at) VALUES(?,?,?,?,?,?,?,?)', provider, 1, ok ? 1 : 0, ok ? 0 : 1, latencyMs, latencyMs, error || null, now());
    return;
  }
  const samples = Number(row.samples || 0) + 1;
  const avg = ((Number(row.avg_latency_ms || 0) * Number(row.samples || 0)) + latencyMs) / samples;
  await execute(env, 'UPDATE provider_metrics SET samples=?,successes=?,failures=?,avg_latency_ms=?,last_latency_ms=?,last_error=?,updated_at=? WHERE provider=?', samples, Number(row.successes || 0) + (ok ? 1 : 0), Number(row.failures || 0) + (ok ? 0 : 1), avg, latencyMs, error || null, now(), provider);
}

function freshIntent(text = '') {
  return /(bugün|şu an|şimdi|güncel|son durum|son dakika|latest|today|current|haber|fiyatı|kaç euro|stokta|satılıyor mu|ne zaman açık|hava durumu|trafik)/i.test(String(text));
}
function agentIntent(text = '') {
  return /(agent mod|baştan sona|hepsini yap|bunu hallet|tamamını yap|araştır.*(ve|sonra).*(hazırla|yap|ekle)|bul.*(ve|sonra).*(ekle|kur|hazırla)|planla.*uygula)/i.test(String(text));
}
function watchIntent(text = '') { return /(takip et|haber ver|bildir|düşerse|çıkarsa|olursa|değişirse|bulunca)/i.test(String(text)); }
function taskIntent(text = '') { return /(görev ekle|yapılacaklara ekle|todo ekle)/i.test(String(text)); }

async function googleSearch(core, req, env, ctx, query) {
  const url = new URL('/api/google-search', req.url);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '8');
  const response = await settleWithin(core.fetch(new Request(url, { headers: req.headers }), env, ctx), 3500, null);
  if (!response?.ok) throw new Error(`GOOGLE_SEARCH_${response?.status || 'TIMEOUT'}`);
  const payload = await response.json();
  return payload.results || [];
}

async function synthesizeSearch(env, text, results) {
  const compact = results.slice(0, 6).map((row, index) => `[${index + 1}] ${row.title}\n${row.snippet}\n${row.url}`).join('\n\n');
  if (!env.AI) return compact;
  const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
    prompt: `Kullanıcı sorusu: ${text}\n\nGüncel web sonuçları:\n${compact}\n\nTürkçe, doğrudan cevap ver. Yalnız sonuçlarda olan bilgiyi kullan. Kaynakları [1], [2] diye işaretle.`,
    max_tokens: 800,
    temperature: 0.15
  });
  const result = await settleWithin(run, 1800, null);
  const output = String(result?.response || result?.result?.response || result?.text || '').trim();
  return output || compact;
}

async function liveWeb(core, req, env, ctx, text) {
  const results = await googleSearch(core, req, env, ctx, text);
  const reply = await synthesizeSearch(env, text, results);
  await saveMessage(env, 'user', text);
  await saveMessage(env, 'assistant', reply, 'Google Search');
  return jsonResponse({ reply, provider: 'Google Search', results, state: await state(core, req, env, ctx), history: await history(env) });
}

function cleanAttachments(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && String(item.base64 || '').length > 20)
    .slice(0, 4)
    .map(item => ({
      name: String(item.name || 'file').slice(0, 180),
      type: String(item.type || 'application/octet-stream'),
      base64: String(item.base64 || '')
    }));
}
function imageOnly(items) { return items.length > 0 && items.every(item => /^image\//i.test(item.type)); }
function textLike(type, name) { return /^text\//i.test(type) || /(json|csv|xml|javascript)/i.test(type) || /\.(txt|md|csv|json|log|xml|js|ts|py|sql)$/i.test(name); }
function decodeTextAttachment(item) {
  try { return decoder.decode(Uint8Array.from(atob(item.base64), char => char.charCodeAt(0))).slice(0, 50000); }
  catch { return ''; }
}

async function geminiDocument(env, text, files) {
  const credential = await queryOne(env, "SELECT * FROM credentials WHERE provider='gemini' AND enabled=1 AND last_status='ok' ORDER BY priority ASC LIMIT 1");
  if (!credential) throw new Error('GEMINI_MULTIMODAL_NOT_CONNECTED');
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const model = credential.model || 'gemini-2.5-flash';
  const parts = [{ text: text || 'Bu dosyaları incele, önemli bilgileri çıkar ve Türkçe cevap ver.' }];
  for (const file of files) {
    if (textLike(file.type, file.name)) parts.push({ text: `\nDOSYA: ${file.name}\n${decodeTextAttachment(file)}` });
    else parts.push({ inline_data: { mime_type: file.type, data: file.base64 } });
  }
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] })
  }, 18000);
  if (!response.ok) throw new Error(`GEMINI_FILE_${response.status}`);
  const payload = await response.json();
  const output = payload.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('') || '';
  if (!output) throw new Error('GEMINI_FILE_EMPTY');
  return { provider: 'Gemini Multimodal', text: output };
}

async function multimodal(core, req, env, ctx, text, files) {
  if (imageOnly(files)) {
    return core.fetch(new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ text, attachments: files }) }), env, ctx);
  }
  const answer = await geminiDocument(env, text, files);
  await saveMessage(env, 'user', `${text || 'Dosyayı incele'}\n${files.map(file => `[Dosya: ${file.name}]`).join(' ')}`);
  await saveMessage(env, 'assistant', answer.text, answer.provider);
  return jsonResponse({ reply: answer.text, provider: answer.provider, state: await state(core, req, env, ctx), history: await history(env) });
}

async function rememberAsync(env, userText, assistantText) {
  if (!env.AI || !userText) return;
  try {
    const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
      prompt: `Aşağıdaki kullanıcı mesajından gelecekte faydalı olacak kalıcı, açık ve kısa kullanıcı gerçeklerini çıkar. Şifre/API key/token, sağlık, din, siyaset, cinsellik gibi hassas bilgileri ASLA kaydetme. Geçici istekleri kaydetme. Sadece JSON dizi döndür, en fazla 3 kısa Türkçe cümle. Hiç yoksa [].\n\nKullanıcı: ${String(userText).slice(0,5000)}\nAsistan cevabı bağlamı: ${String(assistantText || '').slice(0,2500)}`,
      max_tokens: 260,
      temperature: 0
    });
    const result = await settleWithin(run, 1800, null);
    if (!result) return;
    let text = String(result?.response || result?.result?.response || result?.text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const facts = JSON.parse(text);
    if (!Array.isArray(facts)) return;
    for (const fact of facts.slice(0, 3)) {
      const value = String(fact || '').trim();
      if (value.length < 8 || value.length > 300) continue;
      const exists = await queryOne(env, 'SELECT id FROM memories WHERE text=? LIMIT 1', value);
      if (!exists) await execute(env, 'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)', uid(), value, JSON.stringify(['auto']), now());
    }
  } catch {}
}

async function createWatch(env, text) {
  const id = uid();
  await execute(env, 'INSERT INTO watches(id,title,query,condition_text,enabled,interval_minutes,last_checked_at,last_fingerprint,last_result,created_at,updated_at) VALUES(?,?,?,?,1,30,NULL,NULL,NULL,?,?)', id, text.slice(0,120), text, text, now(), now());
  await notify(env, 'watch', 'Takip başlatıldı', text, { watch_id: id });
  return id;
}
async function createTask(env, text) {
  const title = text.replace(/^(görev ekle|yapılacaklara ekle|todo ekle)\s*[:,-]?\s*/i, '').trim() || text;
  const id = uid();
  await execute(env, 'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', id, title, 'Orta', 'open', 'genel', now(), now());
  return id;
}

async function planAgent(env, text) {
  if (env.AI) {
    const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
      prompt: `İstek: ${text}\nBunu JARVIS agent işi olarak 2-6 adıma ayır. Sadece şu tipleri kullan: search,tool,task,watch,self_update,answer. JSON dizi döndür: [{"type":"search","instruction":"..."}]. Riskli dış işlemleri doğrudan yapma; self_update yalnız kullanıcı sisteme özellik eklenmesini istiyorsa kullan. Son adım answer olsun.`,
      max_tokens: 550,
      temperature: 0.1
    });
    const result = await settleWithin(run, 2200, null);
    if (result) {
      try {
        const value = String(result?.response || result?.result?.response || result?.text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        const plan = JSON.parse(value);
        if (Array.isArray(plan) && plan.length) return plan.slice(0, 6);
      } catch {}
    }
  }
  return [{ type: 'search', instruction: text }, { type: 'answer', instruction: 'Sonuçları özetle' }];
}

async function runAgent(core, req, env, ctx, text) {
  const id = uid(), plan = await planAgent(env, text);
  await execute(env, 'INSERT INTO agent_jobs(id,request,plan,status,current_step,result,error,created_at,updated_at) VALUES(?,?,?,?,0,NULL,NULL,?,?)', id, text, JSON.stringify(plan), 'running', now(), now());
  const outputs = [];
  try {
    for (let index = 0; index < plan.length; index++) {
      const step = plan[index] || {}, type = String(step.type || 'answer'), instruction = String(step.instruction || text);
      await execute(env, 'UPDATE agent_jobs SET current_step=?,updated_at=? WHERE id=?', index + 1, now(), id);
      if (type === 'search') {
        try { outputs.push({ type, results: (await googleSearch(core, req, env, ctx, instruction)).slice(0, 5) }); }
        catch (error) { outputs.push({ type, error: error.message }); }
      } else if (type === 'tool') {
        try {
          const url = new URL('/api/tools/discover', req.url); url.searchParams.set('capability', instruction);
          const response = await settleWithin(core.fetch(new Request(url, { headers: req.headers }), env, ctx), 2500, null);
          outputs.push({ type, data: response?.ok ? await response.json() : { error: `HTTP_${response?.status || 'TIMEOUT'}` } });
        } catch (error) { outputs.push({ type, error: error.message }); }
      } else if (type === 'task') {
        outputs.push({ type, id: await createTask(env, instruction), title: instruction });
      } else if (type === 'watch') {
        outputs.push({ type, id: await createWatch(env, instruction), title: instruction });
      } else if (type === 'self_update') {
        try {
          const response = await settleWithin(core.fetch(new Request(new URL('/api/self-update/request', req.url), { method: 'POST', headers: req.headers, body: JSON.stringify({ request: instruction }) }), env, ctx), 3000, null);
          outputs.push({ type, data: response?.ok ? await response.json() : { error: `HTTP_${response?.status || 'TIMEOUT'}` } });
        } catch (error) { outputs.push({ type, error: error.message }); }
      }
    }

    let reply = 'İşi tamamladım.';
    if (env.AI) {
      const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
        prompt: `Kullanıcı isteği: ${text}\nAgent çıktıları: ${JSON.stringify(outputs).slice(0,14000)}\nTürkçe kısa sonuç raporu ver. Yapılmayan şeyi yapılmış gibi söyleme.`,
        max_tokens: 900,
        temperature: 0.2
      });
      const result = await settleWithin(run, 2200, null);
      const output = String(result?.response || result?.result?.response || result?.text || '').trim();
      if (output) reply = output;
    }

    await execute(env, 'UPDATE agent_jobs SET status=?,result=?,updated_at=? WHERE id=?', 'completed', reply, now(), id);
    await notify(env, 'agent', 'Agent işi tamamlandı', text, { agent_id: id });
    await saveMessage(env, 'user', text);
    await saveMessage(env, 'assistant', reply, 'JARVIS Agent');
    return jsonResponse({ reply, provider: 'JARVIS Agent', agent: { id, plan, outputs }, state: await state(core, req, env, ctx), history: await history(env) });
  } catch (error) {
    await execute(env, 'UPDATE agent_jobs SET status=?,error=?,updated_at=? WHERE id=?', 'failed', error.message, now(), id);
    await notify(env, 'error', 'Agent işi başarısız', error.message, { agent_id: id });
    throw error;
  }
}

async function logRuntimeError(env, context, message) {
  const fp = fingerprint(`${context}|${message}`);
  await execute(env, 'INSERT INTO runtime_errors(id,ts,context,message,fingerprint,resolved) VALUES(?,?,?,?,?,0)', uid(), now(), context, message, fp);
  const row = await queryOne(env, 'SELECT COUNT(*) n FROM runtime_errors WHERE fingerprint=? AND resolved=0 AND ts>?', fp, now() - 86400000);
  if (Number(row?.n || 0) < 3) return;
  const existing = await queryOne(env, "SELECT id FROM change_requests WHERE status IN ('queued','running') AND request LIKE ? LIMIT 1", `%${fp}%`);
  if (!existing) {
    await execute(env, 'INSERT INTO change_requests(id,request,origin,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', uid(), `[auto-heal:${fp}] Tekrarlanan runtime hatasını incele ve güvenli düzeltme hazırla. Context: ${context}. Hata: ${message}`, 'auto-heal', 'queued', 'Tekrarlanan hata için self-heal', now(), now());
    await notify(env, 'error', 'Self-heal tetiklendi', message, { fingerprint: fp });
  }
}

async function osApi(req, env) {
  const url = new URL(req.url), path = url.pathname, method = req.method;
  if (path === '/api/os/notifications' && method === 'GET') return jsonResponse(await queryAll(env, 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'));
  if (path === '/api/os/notifications/read' && method === 'POST') { await execute(env, 'UPDATE notifications SET read=1 WHERE read=0'); return jsonResponse({ ok: true }); }
  if (path === '/api/os/performance' && method === 'GET') return jsonResponse(await queryAll(env, 'SELECT * FROM provider_metrics ORDER BY failures ASC,avg_latency_ms ASC'));
  if (path === '/api/os/watches' && method === 'GET') return jsonResponse(await queryAll(env, 'SELECT * FROM watches ORDER BY enabled DESC,created_at DESC'));
  if (path === '/api/os/watches' && method === 'POST') {
    const body = await readJson(req), text = String(body.query || body.title || '').trim();
    if (!text) return jsonResponse({ error: 'QUERY_REQUIRED' }, 400);
    return jsonResponse({ ok: true, id: await createWatch(env, text) });
  }
  if (path.startsWith('/api/os/watches/') && method === 'DELETE') {
    const id = decodeURIComponent(path.split('/').pop());
    await execute(env, 'UPDATE watches SET enabled=0,updated_at=? WHERE id=?', now(), id);
    return jsonResponse({ ok: true });
  }
  if (path === '/api/os/agents' && method === 'GET') return jsonResponse(await queryAll(env, 'SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT 50'));
  if (path === '/api/os/memories' && method === 'GET') return jsonResponse(await queryAll(env, 'SELECT * FROM memories ORDER BY created_at DESC LIMIT 100'));
  return null;
}

async function googleConfig(env) {
  const row = await queryOne(env, "SELECT value FROM kv WHERE key='google_search_cfg'");
  if (!row) return null;
  try {
    const value = JSON.parse(row.value);
    if (!value?.blob) return null;
    return JSON.parse(await decryptCredential(env, value.blob));
  } catch { return null; }
}

async function directGoogle(env, config, query) {
  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', config.key);
  url.searchParams.set('cx', config.cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  const response = await fetchWithTimeout(url, {}, 6000);
  if (!response.ok) throw new Error(`GOOGLE_SEARCH_${response.status}`);
  const payload = await response.json();
  return (payload.items || []).map(item => ({ title: item.title || '', url: item.link || '', snippet: item.snippet || '' }));
}

async function evaluateWatches(env) {
  const config = await googleConfig(env);
  if (!config) return;
  const timestamp = now();
  const rows = await queryAll(env, 'SELECT * FROM watches WHERE enabled=1 AND (last_checked_at IS NULL OR last_checked_at < ?)', timestamp - 30 * 60000);
  for (const watch of rows.slice(0, 8)) {
    try {
      const results = await directGoogle(env, config, watch.query);
      const text = results.map(row => `${row.title} ${row.snippet} ${row.url}`).join('\n');
      const fp = fingerprint(text);
      let matched = fp !== watch.last_fingerprint;
      if (env.AI && watch.condition_text) {
        const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
          prompt: `Takip koşulu: ${watch.condition_text}\nYeni arama sonuçları:\n${text.slice(0,9000)}\nKoşul gerçekleşmişse sadece YES, değilse NO yaz.`,
          max_tokens: 8,
          temperature: 0
        });
        const result = await settleWithin(run, 1500, null);
        if (result) matched = /YES/i.test(String(result?.response || result?.result?.response || ''));
      }
      if (matched && watch.last_fingerprint) await notify(env, 'watch', watch.title, results[0]?.title || 'Takip koşulunda değişiklik var', { watch_id: watch.id, results: results.slice(0, 3) });
      await execute(env, 'UPDATE watches SET last_checked_at=?,last_fingerprint=?,last_result=?,updated_at=? WHERE id=?', timestamp, fp, JSON.stringify(results.slice(0, 3)), timestamp, watch.id);
    } catch (error) {
      await execute(env, 'UPDATE watches SET last_checked_at=?,last_result=?,updated_at=? WHERE id=?', timestamp, JSON.stringify({ error: error.message }), timestamp, watch.id);
    }
  }
}

export function createJarvisOS(core) {
  if (!core?.fetch) throw new Error('JARVIS_OS_CORE_FETCH_REQUIRED');

  async function authed(req, env, ctx) {
    const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api/os/')) {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        const response = await osApi(req, env);
        if (response) return response;
      }

      if (url.pathname === '/api/chat/send' && req.method === 'POST') {
        if (!(await authed(req, env, ctx))) return core.fetch(req, env, ctx);
        const body = await readJson(req.clone());
        const text = String(body.text || '').trim();
        const attachments = cleanAttachments(body.attachments);
        const started = now();
        try {
          let response;
          if (attachments.length && !imageOnly(attachments)) response = await multimodal(core, req, env, ctx, text, attachments);
          else if (text && agentIntent(text)) response = await runAgent(core, req, env, ctx, text);
          else if (text && watchIntent(text)) {
            const id = await createWatch(env, text);
            const reply = 'Takibi başlattım. Değişiklik veya koşul gerçekleştiğinde Bildirim Merkezi’ne düşecek.';
            await saveMessage(env, 'user', text);
            await saveMessage(env, 'assistant', reply, 'JARVIS Watch');
            response = jsonResponse({ reply, provider: 'JARVIS Watch', watch: { id }, state: await state(core, req, env, ctx), history: await history(env) });
          } else if (text && taskIntent(text)) {
            const id = await createTask(env, text);
            const reply = 'Görevi ekledim.';
            await saveMessage(env, 'user', text);
            await saveMessage(env, 'assistant', reply, 'JARVIS Tasks');
            response = jsonResponse({ reply, provider: 'JARVIS Tasks', task: { id }, state: await state(core, req, env, ctx), history: await history(env) });
          } else if (text && freshIntent(text)) {
            try { response = await liveWeb(core, req, env, ctx, text); }
            catch { response = await core.fetch(req, env, ctx); }
          } else {
            response = await core.fetch(req, env, ctx);
          }

          const latency = now() - started;
          if (response.ok) {
            try {
              const payload = await response.clone().json();
              ctx.waitUntil(recordMetric(env, payload.provider || 'JARVIS', latency, true, ''));
              if (text) ctx.waitUntil(rememberAsync(env, text, payload.reply || ''));
            } catch {}
          } else {
            ctx.waitUntil(recordMetric(env, 'JARVIS', latency, false, `HTTP_${response.status}`));
          }
          return response;
        } catch (error) {
          const latency = now() - started;
          ctx.waitUntil(recordMetric(env, 'JARVIS', latency, false, error.message));
          ctx.waitUntil(logRuntimeError(env, 'chat', error.message));
          return jsonResponse({ error: error.message }, 500);
        }
      }

      return core.fetch(req, env, ctx);
    },

    async scheduled(event, env, ctx) {
      ctx.waitUntil(evaluateWatches(env));
      return core.scheduled?.(event, env, ctx);
    }
  };
}
