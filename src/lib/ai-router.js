// JARVIS AI Router — multi-provider AI with failure cooldowns, 3-wave race, diagnostics
// Language: JavaScript (Cloudflare Workers ESM)

import { fetchT, withTimeout, now } from './core.js';
import { run, kvGet, kvSet } from './d1.js';
import { credentialRows, credentialSecrets, providerBase, providerModel } from './credentials.js';

// --- Router state ---

export function aiProviderKey(p) { return String(p || '').toLowerCase().replace(/[^a-z0-9_.@/-]+/g, '_').slice(0, 120) }

export function aiFailureCooldownMs(msg) {
  msg = String(msg || '');
  if (/404|not found|deprecated|deprecation|model.*unavailable|5028/i.test(msg)) return 86400000;
  if (/timeout|abort|network|fetch/i.test(msg)) return 180000;
  if (/401|403|invalid.*key|unauthorized|permission/i.test(msg)) return 3600000;
  if (/429|rate/i.test(msg)) return 600000;
  return 300000;
}

export async function aiRouterGet(env, key) { return await kvGet(env, 'ai_router:' + aiProviderKey(key), { failures: 0, disabled_until: 0, last_error: null, last_ok: 0, last_try: 0 }) }

export async function aiRouterMark(env, key, ok, error = '') {
  const k = aiProviderKey(key), st = await aiRouterGet(env, k);
  if (ok) { await kvSet(env, 'ai_router:' + k, { ...st, failures: 0, disabled_until: 0, last_error: null, last_ok: now(), last_try: now() }); return }
  const failures = Number(st.failures || 0) + 1, cooldown = aiFailureCooldownMs(error), disabled_until = now() + Math.min(cooldown * Math.min(failures, 4), 86400000);
  await kvSet(env, 'ai_router:' + k, { ...st, failures, disabled_until, last_error: String(error || 'UNKNOWN').slice(0, 500), last_try: now() });
}

export async function aiRouterAllowed(env, key) { const st = await aiRouterGet(env, key); return !st.disabled_until || Number(st.disabled_until) < now() }

export async function workingProviderHints(env) {
  const rows = await credentialRows(env);
  return rows.filter(x => Number(x.enabled) === 1 && x.last_status === 'ok').map(x => String(x.provider || x.label || '').toLowerCase()).filter(Boolean);
}

export function aiModeForText(text) { const l = String(text || '').toLocaleLowerCase('tr-TR'); return /kod|program|debug|hata|analiz|uzun|detay|rapor|karşılaştır|karsilastir|strateji|plan|araştır|arastir|hukuk|finans|resmi/.test(l) ? 'strong' : 'fast' }

export async function aiRouterStatus(env) { const keys = ['vault', 'OpenAI', 'Anthropic', 'Gemini', 'Groq', 'OpenRouter', 'Mistral', 'DeepSeek', 'Together', 'Cerebras', 'Perplexity', 'xAI', 'Cloudflare AI'], rows = []; for (const k of keys) { const st = await aiRouterGet(env, k); rows.push({ provider: k, disabled_until: st.disabled_until || 0, failures: st.failures || 0, last_error: st.last_error || null, last_ok: st.last_ok || 0 }) } return rows }

// --- Provider callers ---

export async function callGeminiKey(apiKey, model, messages, ms) {
  const preferred = String(model || '').trim();
  const models = [preferred, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'].filter(Boolean);
  const uniq = [...new Set(models)];
  let last = 'GEMINI_NO_MODEL';
  for (const m of uniq) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent?key=' + encodeURIComponent(apiKey);
    const r = await fetchT(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: messages.filter(x => x.role !== 'system').map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })), systemInstruction: { parts: [{ text: messages.find(x => x.role === 'system')?.content || '' }] } }) }, Math.max(1200, Math.floor(ms / uniq.length)));
    if (!r.ok) { last = 'GEMINI_' + r.status + ':' + m; if (r.status === 404 || r.status === 400) continue; throw Error(last) }
    const text = (await r.json()).candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (String(text || '').trim()) return text;
    last = 'GEMINI_EMPTY:' + m;
  }
  throw Error(last);
}

export async function callGeminiEnv(env, messages, ms) {
  return callGeminiKey(env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-2.0-flash', messages, ms);
}

export async function callOpenAICompat(base, key, model, messages, ms, provider) {
  const r = await fetchT(base.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key, 'HTTP-Referer': 'https://jarvis-personal-ai.haydojarvis.workers.dev', 'X-Title': 'JARVIS' }, body: JSON.stringify({ model, messages, temperature: .25 }) }, ms);
  if (!r.ok) throw Error(provider.toUpperCase() + '_' + r.status);
  const text = (await r.json()).choices?.[0]?.message?.content || '';
  if (!String(text || '').trim()) throw Error(provider.toUpperCase() + '_EMPTY');
  return text;
}

export async function callAnthropic(env, messages, ms) {
  const system = messages.find(x => x.role === 'system')?.content || '';
  const payload = { model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', max_tokens: 900, temperature: .25, system, messages: messages.filter(x => x.role !== 'system').map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: x.content })) };
  const r = await fetchT('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(payload) }, ms);
  if (!r.ok) throw Error('ANTHROPIC_' + r.status);
  const text = (await r.json()).content?.map(x => x.text || '').join('') || '';
  if (!String(text || '').trim()) throw Error('ANTHROPIC_EMPTY');
  return text;
}

export async function callCloudflareModel(env, model, messages, ms) {
  const out = await withTimeout(env.AI.run(model, { messages, temperature: 0.3, max_tokens: 1500 }), ms, 'CF_AI_TIMEOUT');
  const text = out?.response || out?.result?.response || out?.choices?.[0]?.message?.content || out?.text || '';
  if (!String(text || '').trim()) throw Error('CF_AI_EMPTY');
  return text;
}

export async function callVaultAI(env, c, messages, ms = 9000) {
  const p = String(c.provider || '').toLowerCase(), sec = c.secret;
  if (p === 'gemini') {
    return callGeminiKey(sec, c.model || 'gemini-2.0-flash', messages, ms);
  }
  if (p === 'anthropic') {
    const system = messages.find(x => x.role === 'system')?.content || '';
    const body = { model: providerModel(p, c.model), max_tokens: 1200, messages: messages.filter(x => x.role !== 'system') };
    if (system) body.system = system;
    const r = await fetchT('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': sec, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) }, ms);
    if (!r.ok) throw Error('ANTHROPIC_' + r.status);
    return (await r.json()).content?.map(x => x.text || '').join('') || ''
  }
  const base = providerBase(p, c.endpoint); if (!base) throw Error('NO_ENDPOINT');
  const model = providerModel(p, c.model);
  const r = await fetchT(base + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + sec, 'HTTP-Referer': 'https://jarvis-personal-ai.haydojarvis.workers.dev', 'X-Title': 'JARVIS' }, body: JSON.stringify({ model, messages, temperature: .25 }) }, ms);
  if (!r.ok) throw Error((p || 'AI').toUpperCase() + '_' + r.status);
  return (await r.json()).choices?.[0]?.message?.content || ''
}

// --- Task builders & wave race ---

export function envProviderTasks(env, messages, mode, preferred = []) {
  const tasks = [], add = (id, label, fn) => tasks.push({ id, label, fn });
  if (env.GROQ_API_KEY) add('env:groq', 'Groq', ms => callOpenAICompat('https://api.groq.com/openai/v1', env.GROQ_API_KEY, env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages, ms, 'groq'));
  if (env.CEREBRAS_API_KEY) add('env:cerebras', 'Cerebras', ms => callOpenAICompat('https://api.cerebras.ai/v1', env.CEREBRAS_API_KEY, env.CEREBRAS_MODEL || 'llama3.1-8b', messages, ms, 'cerebras'));
  if (env.OPENAI_API_KEY) add('env:openai', 'OpenAI', ms => callOpenAICompat('https://api.openai.com/v1', env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-4o-mini', messages, ms, 'openai'));
  if (env.ANTHROPIC_API_KEY) add('env:anthropic', 'Anthropic', ms => callAnthropic(env, messages, ms));
  if (env.GEMINI_API_KEY) add('env:gemini:' + (env.GEMINI_MODEL || 'gemini-2.5-flash'), 'Gemini', ms => callGeminiEnv(env, messages, ms));
  if (env.OPENROUTER_API_KEY) add('env:openrouter', 'OpenRouter', ms => callOpenAICompat('https://openrouter.ai/api/v1', env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL || 'openrouter/auto', messages, ms, 'openrouter'));
  if (env.MISTRAL_API_KEY) add('env:mistral', 'Mistral', ms => callOpenAICompat('https://api.mistral.ai/v1', env.MISTRAL_API_KEY, env.MISTRAL_MODEL || 'mistral-small-latest', messages, ms, 'mistral'));
  if (env.DEEPSEEK_API_KEY) add('env:deepseek', 'DeepSeek', ms => callOpenAICompat('https://api.deepseek.com/v1', env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL || 'deepseek-chat', messages, ms, 'deepseek'));
  if (env.TOGETHER_API_KEY) add('env:together', 'Together', ms => callOpenAICompat('https://api.together.xyz/v1', env.TOGETHER_API_KEY, env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages, ms, 'together'));
  if (env.PERPLEXITY_API_KEY) add('env:perplexity', 'Perplexity', ms => callOpenAICompat('https://api.perplexity.ai', env.PERPLEXITY_API_KEY, env.PERPLEXITY_MODEL || 'sonar-pro', messages, ms, 'perplexity'));
  if (env.XAI_API_KEY) add('env:xai', 'xAI', ms => callOpenAICompat('https://api.x.ai/v1', env.XAI_API_KEY, env.XAI_MODEL || 'grok-3-mini', messages, ms, 'xai'));
  if (env.AI) { const cf = mode === 'fast' ? ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/google/gemma-3-12b-it'] : ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.1-8b-instruct-fp8']; for (const model of cf) add('cf:' + model, 'Cloudflare AI (' + model + ')', ms => callCloudflareModel(env, model, messages, ms)) }
  const fast = ['OpenRouter', 'Groq', 'Cerebras', 'OpenAI', 'Anthropic', 'Gemini', 'Mistral', 'DeepSeek', 'Together', 'Perplexity', 'xAI', 'Cloudflare'], strong = ['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini', 'Groq', 'DeepSeek', 'Mistral', 'Together', 'Perplexity', 'xAI', 'Cerebras', 'Cloudflare'];
  const rank = (x, arr) => { const label = String(x.label || '').toLowerCase(), id = String(x.id || '').toLowerCase(); const pref = preferred.findIndex(p => label.includes(p) || id.includes(p)); if (pref >= 0) return pref; const i = arr.findIndex(p => x.label.includes(p)); return i < 0 ? 99 : i + preferred.length };
  return tasks.sort((a, b) => rank(a, mode === 'fast' ? fast : strong) - rank(b, mode === 'fast' ? fast : strong));
}

async function raceAiWave(env, tasks, ms, errs) {
  const runnable = []; for (const t of tasks) { if (await aiRouterAllowed(env, t.id)) runnable.push(t); else errs.push(t.label + ':SKIPPED_COOLDOWN') }
  if (!runnable.length) return null;
  let pending = runnable.length, settled = false;
  return await new Promise(resolve => {
    const done = v => { if (!settled) { settled = true; resolve(v) } };
    const timer = setTimeout(() => done(null), ms + 350);
    for (const t of runnable) { withTimeout(t.fn(ms), ms, t.label + '_TIMEOUT').then(async text => { if (settled) return; if (!String(text || '').trim()) throw Error('EMPTY_RESPONSE'); await aiRouterMark(env, t.id, true); clearTimeout(timer); done({ provider: t.label, text }) }).catch(async e => { const msg = String(e?.message || e || 'UNKNOWN'); errs.push(t.label + ':' + msg); await aiRouterMark(env, t.id, false, msg); pending--; if (pending <= 0) { clearTimeout(timer); done(null) } }) }
  });
}

// --- Main fallback orchestrator ---

export async function aiFallback(env, messages, opts = {}) {
  const userText = opts.userText || messages.slice().reverse().find(x => x.role === 'user')?.content || '', mode = opts.mode || aiModeForText(userText), errs = [];
  const vault = opts.noVault ? [] : (await credentialSecrets(env, 'chat')).slice(0, 4).map(c => ({ id: 'vault:' + c.id, label: c.label || c.provider, credential: c, fn: ms => callVaultAI(env, c, messages, ms) }));
  const hints = await workingProviderHints(env);
  const envTasks = envProviderTasks(env, messages, mode, hints);
  const okVault = vault.filter(x => String(x.credential?.last_status || '') === 'ok');
  const restVault = vault.filter(x => String(x.credential?.last_status || '') !== 'ok');
  const waves = mode === 'fast' ? [okVault.slice(0, 2).concat(envTasks.slice(0, 3)), envTasks.slice(3, 7).concat(restVault.slice(0, 2)), envTasks.slice(7).concat(restVault.slice(2))] : [okVault.slice(0, 3).concat(envTasks.slice(0, 3)), envTasks.slice(3, 7).concat(restVault), envTasks.slice(7)];
  for (const wave of waves) { const clean = wave.filter(Boolean); if (!clean.length) continue; const got = await raceAiWave(env, clean, mode === 'fast' ? 3500 : 6000, errs); if (got) { for (const t of clean.filter(x => x.credential && x.label === got.provider)) await run(env, 'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?', 'ok', now(), now(), t.credential.id); return got } }
  throw Error(errs.length ? 'ALL_AI_FAILED:' + errs.slice(-12).join('|') : 'NO_AI_PROVIDER');
}

// --- Diagnostics ---

export async function aiDiagnostics(env) {
  const messages = [{ role: 'system', content: 'Tek kelime cevap ver.' }, { role: 'user', content: 'ping' }];
  const rows = await credentialSecrets(env, 'chat'), items = [], started = now();
  for (const c of rows) {
    const label = c.label || c.provider, t0 = now();
    try {
      const text = await withTimeout(callVaultAI(env, c, messages, 3500), 4200, 'DIAG_TIMEOUT');
      items.push({ source: 'vault', id: c.id, provider: c.provider, label, ok: !!String(text || '').trim(), latency_ms: now() - t0, model: c.model || null, error: null });
      await run(env, 'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?', 'ok', now(), now(), c.id);
    } catch (e) {
      const error = String(e?.message || e || 'UNKNOWN');
      items.push({ source: 'vault', id: c.id, provider: c.provider, label, ok: false, latency_ms: now() - t0, model: c.model || null, error });
      await run(env, 'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?', 'error', error, now(), now(), c.id);
    }
  }
  const envTasks = envProviderTasks(env, messages, 'fast');
  for (const t of envTasks.slice(0, 12)) {
    const t0 = now();
    try {
      const text = await withTimeout(t.fn(3000), 3600, 'DIAG_TIMEOUT');
      items.push({ source: 'env', id: t.id, provider: t.label, label: t.label, ok: !!String(text || '').trim(), latency_ms: now() - t0, model: null, error: null });
    } catch (e) {
      items.push({ source: 'env', id: t.id, provider: t.label, label: t.label, ok: false, latency_ms: now() - t0, model: null, error: String(e?.message || e || 'UNKNOWN') });
    }
  }
  const working = items.filter(x => x.ok);
  const fatal = !working.length;
  const recommendation = fatal
    ? 'Hiç çalışan AI sağlayıcısı yok. En az bir geçerli OpenAI, Groq, OpenRouter, Anthropic veya Gemini anahtarı eklenip testten geçmeli; aksi halde JARVIS gerçek AI gibi cevap veremez.'
    : 'Çalışan sağlayıcı var: ' + working.map(x => x.label).join(', ') + '. Router bunları önce kullanmalı.';
  return { ok: !fatal, working: working.length, total: items.length, duration_ms: now() - started, recommendation, items };
}
