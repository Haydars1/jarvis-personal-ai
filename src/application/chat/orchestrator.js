import {
  decryptCredential,
  fetchWithTimeout,
  jsonResponse,
  queryAll,
  settleWithin
} from '../../lib/runtime.js';
import {
  cleanReply,
  directUrl,
  needsOrchestration,
  safeFallbackPayload,
  scoreProvider,
  taskKind,
  wantsResearch,
  wantsTools
} from '../../lib/orchestration.js';

const LIMITS = Object.freeze({
  simpleCoreMs: 4200,
  complexCoreMs: 5600,
  expertMs: 1700,
  providerFetchMs: 2200,
  researchMs: 1500,
  toolsMs: 1200,
  synthesisMs: 1800,
  fallbackAiMs: 2800,
  expertRowsTtlMs: 10_000
});

const ANSWER_POLICY = `Kullanıcıya doğrudan, doğal ve doğru Türkçe cevap ver. Varsayılan cevap yüzeysel olmasın: önce net sonucu söyle, sonra anlamı veya nedeni açıkla; yararlıysa örnek, kullanım bağlamı, önemli fark veya pratik ayrıntı ekle. Kullanıcı özellikle kısa cevap istemedikçe tek kelimelik/tek cümlelik sözlük cevabıyla yetinme. Yabancı kelime sorularında Türkçe karşılık + tekil/çoğul veya dilbilgisi bilgisi (uygunsa) + örnek cümle ve Türkçesi + yakın kelimelerden önemli farkı ver. Teknik sorularda ne olduğu + neden olduğu + kullanıcı açısından sonucu ver. Güncel/canlı bilgi gerektiren sorularda doğrulanmamış güncel bilgi uydurma. Ham arama sonucu, DuckDuckGo yönlendirmesi, yüzde kodlu URL, sağlayıcı/timeout/hata gibi iç teknik ayrıntıları kullanıcıya dökme.`;

let expertRowsCache = { expiresAt: 0, rows: [] };

async function loadExpertRows(env) {
  const now = Date.now();
  if (expertRowsCache.expiresAt > now && expertRowsCache.rows.length) return expertRowsCache.rows;
  const rows = await queryAll(env, `SELECT c.*, m.avg_latency_ms, m.samples, m.successes, m.failures FROM credentials c LEFT JOIN provider_metrics m ON m.provider=c.label OR m.provider=c.provider WHERE c.enabled=1 AND c.last_status='ok' ORDER BY c.priority ASC`);
  expertRowsCache = { expiresAt: now + LIMITS.expertRowsTtlMs, rows };
  return rows;
}

async function expertPool(env, kind) {
  const rows = await loadExpertRows(env);
  return rows.map(row => ({ row, score: scoreProvider(row, kind) })).filter(item => item.score !== null).map(({ row, score }) => ({ ...row, score })).sort((a, b) => b.score - a.score);
}

function expertSystemPrompt(kind) {
  return `Sen JARVIS'in arka plandaki ${kind} uzmanısın. ${ANSWER_POLICY} En fazla 6 kısa madde kullan; yalnız doğrulanabilir bilgi ver.`;
}

async function callExpert(env, credential, text, kind) {
  const provider = String(credential.provider || '').toLowerCase();
  const secret = await decryptCredential(env, credential.encrypted_secret);
  const system = expertSystemPrompt(kind);
  if (provider === 'gemini') {
    const model = credential.model || 'gemini-2.5-flash';
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { maxOutputTokens: 520, temperature: 0.1 } }) }, LIMITS.providerFetchMs);
    if (!response.ok) throw new Error(`GEMINI_${response.status}`);
    const payload = await response.json();
    return String(payload.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '').trim();
  }
  const base = String(credential.endpoint || (provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : '')).replace(/\/$/, '');
  if (!base || !credential.model) throw new Error('EXPERT_CONFIG_MISSING');
  const response = await fetchWithTimeout(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, 'HTTP-Referer': 'https://jarvis-personal-ai.haydojarvis.workers.dev', 'X-Title': 'JARVIS' }, body: JSON.stringify({ model: credential.model, messages: [{ role: 'system', content: system }, { role: 'user', content: text }], temperature: 0.1, max_tokens: 520 }) }, LIMITS.providerFetchMs);
  if (!response.ok) throw new Error(`EXPERT_${provider}_${response.status}`);
  const payload = await response.json();
  return String(payload.choices?.[0]?.message?.content || '').trim();
}

async function getExperts(env, text) {
  const kind = taskKind(text);
  const pool = await expertPool(env, kind);
  const picks = pool.slice(0, 1);
  if (!picks.length) return { kind, picks: [], answers: [] };
  const credential = picks[0];
  const value = await settleWithin(callExpert(env, credential, text, kind), LIMITS.expertMs, '');
  return { kind, picks: picks.map(item => ({ provider: item.label || item.provider, score: Math.round(item.score) })), answers: value ? [{ provider: credential.label || credential.provider, kind, text: value, score: Math.round(credential.score) }] : [] };
}

async function callJson(core, request, env, ctx) { const response = await core.fetch(request, env, ctx); if (!response.ok) return null; try { return await response.json(); } catch { return null; } }
async function research(core, req, env, ctx, text) { const url = new URL('/api/google-search', req.url); url.searchParams.set('q', text); url.searchParams.set('num', '4'); const payload = await settleWithin(callJson(core, new Request(url, { headers: req.headers }), env, ctx), LIMITS.researchMs, null); return payload?.results || []; }
async function tools(core, req, env, ctx, text) { const url = new URL('/api/tools/discover', req.url); url.searchParams.set('capability', text); const payload = await settleWithin(callJson(core, new Request(url, { headers: req.headers }), env, ctx), LIMITS.toolsMs, null); return payload?.results || []; }

async function workersAiFallback(env, text) {
  if (!env.AI) return null;
  try {
    const run = env.AI.run('@cf/zai-org/glm-4.7-flash', { prompt: `Sen JARVIS'sin. ${ANSWER_POLICY}\n\nKULLANICI:\n${text}`, max_tokens: 700, temperature: 0.15 });
    const result = await settleWithin(run, LIMITS.fallbackAiMs, null);
    const answer = cleanReply(String(result?.response || result?.result?.response || result?.text || ''));
    if (!answer) return null;
    return { reply: answer, history: [{ role: 'user', content: text }, { role: 'assistant', content: answer, provider: 'JARVIS' }], provider: 'JARVIS', trace: [{ kind: 'fallback', label: 'JARVIS hızlı yedek AI', value: 'Ana sağlayıcı geciktiği için Workers AI yedeği kullanıldı' }] };
  } catch { return null; }
}

async function synthesize(env, text, base, researchRows, toolRows, experts) {
  if (!env.AI) return cleanReply(base);
  const web = researchRows.slice(0, 4).map((row, index) => `[${index + 1}] ${row.title}\n${String(row.snippet || '').slice(0, 180)}\n${directUrl(row.url || '')}`).join('\n\n');
  const toolText = toolRows.slice(0, 3).map((row, index) => `[T${index + 1}] ${row.title}\n${String(row.snippet || '').slice(0, 150)}\n${directUrl(row.url || '')}`).join('\n\n');
  const expertText = (experts.answers || []).map((answer, index) => `[AI${index + 1}] ${answer.text}`).join('\n\n');
  const run = env.AI.run('@cf/zai-org/glm-4.7-flash', { prompt: `Sen JARVIS'sin. ${ANSWER_POLICY} Elindeki ana cevap, uzman, web ve araç bilgisini tek tutarlı cevapta birleştir. Kaynak gerekiyorsa en fazla 3 doğrudan Markdown bağlantısı kullan.\n\nKULLANICI:\n${text}\n\nMEVCUT CEVAP:\n${String(base || '').slice(0, 3600)}\n\nUZMAN:\n${expertText}\n\nWEB:\n${web}\n\nARAÇLAR:\n${toolText}`, max_tokens: 850, temperature: 0.1 });
  const result = await settleWithin(run, LIMITS.synthesisMs, null);
  if (!result) return cleanReply(base);
  return cleanReply(String(result?.response || result?.result?.response || result?.text || base)) || cleanReply(base);
}

function expertFallback(text, experts) { const answer = cleanReply(experts?.answers?.[0]?.text || ''); if (!answer) return null; return { reply: answer, history: [{ role: 'user', content: text }, { role: 'assistant', content: answer, provider: 'JARVIS' }], provider: 'JARVIS', trace: [{ kind: 'fallback', label: 'JARVIS yedek uzman', value: 'Ana yanıt yolu başarısız olduğu için hızlı yedek yanıt kullanıldı' }] }; }
function webFallback(text, webRows) { const rows = (webRows || []).slice(0, 3); if (!rows.length) return null; const body = rows.map(row => { const title = String(row.title || 'Kaynak').trim(); const snippet = row.snippet ? ` — ${String(row.snippet).slice(0, 180)}` : ''; return `- [${title}](${directUrl(row.url || '')})${snippet}`; }).join('\n'); const reply = `Bulabildiğim doğrulanabilir güncel bilgiler:\n\n${body}`; return { reply, history: [{ role: 'user', content: text }, { role: 'assistant', content: reply, provider: 'JARVIS' }], provider: 'JARVIS', trace: [{ kind: 'fallback', label: 'JARVIS web yedeği', value: 'Ana yanıt yolu yerine canlı web sonuçları kullanıldı' }] }; }
function withTiming(payload, started) { payload.trace = [...(Array.isArray(payload.trace) ? payload.trace : []), { kind: 'timing', label: 'JARVIS yanıt süresi', value: `${Date.now() - started} ms` }]; return payload; }

async function simpleChat(core, req, env, ctx, text) {
  const started = Date.now();
  const aiFallbackPromise = workersAiFallback(env, text);
  const response = await settleWithin(core.fetch(req.clone(), env, ctx), LIMITS.simpleCoreMs, null);
  if (response?.ok) {
    let payload; try { payload = await response.clone().json(); } catch { return response; }
    payload.reply = await synthesize(env, text, payload.reply, [], [], { answers: [] });
    payload.provider = 'JARVIS';
    if (Array.isArray(payload.history)) payload.history = payload.history.map(message => message?.role === 'assistant' ? { ...message, content: payload.reply, provider: 'JARVIS' } : message);
    return jsonResponse(withTiming(payload, started), response.status);
  }
  const aiFallback = await settleWithin(aiFallbackPromise, LIMITS.fallbackAiMs + 100, null);
  if (aiFallback) return jsonResponse(withTiming(aiFallback, started));
  const experts = await settleWithin(getExperts(env, text), LIMITS.expertMs + 150, { kind: taskKind(text), picks: [], answers: [] });
  const fallback = expertFallback(text, experts);
  if (fallback) return jsonResponse(withTiming(fallback, started));
  return jsonResponse(withTiming(safeFallbackPayload(text, 'JARVIS şu an yanıt üretemedi. Mesajın kaydedildi.', 'Ana, Workers AI ve hızlı uzman yolları yanıt vermedi'), started));
}

async function orchestratedChat(core, req, env, ctx, text) {
  const started = Date.now();
  const basePromise = settleWithin(core.fetch(req.clone(), env, ctx), LIMITS.complexCoreMs, null);
  const aiFallbackPromise = workersAiFallback(env, text);
  const expertPromise = getExperts(env, text).catch(() => ({ kind: taskKind(text), picks: [], answers: [] }));
  const webPromise = wantsResearch(text) ? research(core, req, env, ctx, text).catch(() => []) : Promise.resolve([]);
  const toolPromise = wantsTools(text) ? tools(core, req, env, ctx, text).catch(() => []) : Promise.resolve([]);
  const [baseResponse, experts, webRows, toolRows] = await Promise.all([basePromise, expertPromise, webPromise, toolPromise]);
  if (!baseResponse?.ok) { const aiFallback = await settleWithin(aiFallbackPromise, LIMITS.fallbackAiMs + 100, null); const fallback = expertFallback(text, experts) || webFallback(text, webRows) || aiFallback; if (fallback) return jsonResponse(withTiming(fallback, started)); return jsonResponse(withTiming(safeFallbackPayload(text, 'JARVIS şu an yanıt üretemedi. Mesajın kaydedildi.', 'Ana, uzman, web ve Workers AI yolları yanıt vermedi'), started)); }
  let payload; try { payload = await baseResponse.clone().json(); } catch { return baseResponse; }
  if (webRows.length && !payload.results) payload.results = webRows;
  if (toolRows.length && !payload.tools) payload.tools = toolRows;
  payload.reply = await synthesize(env, text, payload.reply, webRows, toolRows, experts);
  payload.trace = [...(Array.isArray(payload.trace) ? payload.trace : []), ...(experts.picks.length ? [{ kind: 'pool', label: 'JARVIS uzman havuzu', value: `${experts.kind}: ${experts.picks.map(item => `${item.provider} (${item.score})`).join(' + ')}` }] : []), ...(webRows.length ? [{ kind: 'search', label: 'JARVIS araştırması', value: `${webRows.length} web sonucu incelendi` }] : []), ...(toolRows.length ? [{ kind: 'tool', label: 'JARVIS araç seçimi', value: `${toolRows.length} araç değerlendirildi` }] : []), { kind: 'timing', label: 'JARVIS yanıt süresi', value: `${Date.now() - started} ms` }];
  payload.provider = 'JARVIS';
  if (Array.isArray(payload.history)) payload.history = payload.history.map(message => message?.role === 'assistant' ? { ...message, content: message.content === payload.reply ? payload.reply : cleanReply(message.content), provider: 'JARVIS' } : message);
  return jsonResponse(payload, baseResponse.status);
}

export function createChatOrchestrator(core) { if (!core?.fetch) throw new Error('CHAT_CORE_FETCH_REQUIRED'); return async function handleChat(req, env, ctx) { let text = ''; try { text = String((await req.clone().json())?.text || '').trim(); } catch {} if (!text) return core.fetch(req, env, ctx); return needsOrchestration(text) ? orchestratedChat(core, req, env, ctx, text) : simpleChat(core, req, env, ctx, text); }; }
