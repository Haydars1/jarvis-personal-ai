// hayırlıevlad Credential Management — vault CRUD, provider config, connectivity test
// Language: JavaScript (Cloudflare Workers ESM)

import { fetchT, now } from './core.js';
import { qall, run } from './d1.js';
import { decSecret } from './crypto.js';

export async function credentialRows(env) {
  return qall(env, "SELECT id,provider,label,kind,capabilities,endpoint,model,priority,enabled,meta,last_status,last_error,last_test_at,created_at,updated_at FROM credentials ORDER BY enabled DESC,priority ASC,created_at DESC");
}

export async function credentialSecrets(env, capability = null) {
  let rows = await qall(env, "SELECT * FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC");
  if (capability) rows = rows.filter(r => {
    try { const c = JSON.parse(r.capabilities || '[]'); return !c.length || c.includes(capability) || c.includes('chat'); } catch { return true; }
  });
  const out = [];
  for (const r of rows) {
    try {
      out.push({ ...r, secret: await decSecret(env, r.encrypted_secret), capabilities: JSON.parse(r.capabilities || '[]'), meta: JSON.parse(r.meta || '{}') });
    } catch (e) {
      await run(env, 'UPDATE credentials SET last_status=?,last_error=?,updated_at=? WHERE id=?', 'decrypt_error', e.message, now(), r.id);
    }
  }
  return out;
}

export async function testCredential(env, c) {
  const p = String(c.provider || '').toLowerCase(), sec = c.secret || await decSecret(env, c.encrypted_secret);
  try {
    if (!sec) throw Error('NO_API_KEY');
    if (p === 'gemini') {
      const model = c.model || 'gemini-2.5-flash';
      const r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(sec)}`);
      if (!r.ok) throw Error('HTTP_' + r.status);
    } else if (p === 'google') {
      if (!String(c.endpoint || '').includes('.apps.googleusercontent.com')) throw Error('GOOGLE_CLIENT_ID_INVALID');
    } else if (p === 'meta') {
      const r = await fetchT('https://graph.facebook.com/v24.0/me?access_token=' + encodeURIComponent(sec));
      if (!r.ok) throw Error('HTTP_' + r.status);
    } else if (p === 'github') {
      const r = await fetchT('https://api.github.com/user', { headers: { authorization: 'Bearer ' + sec, accept: 'application/vnd.github+json', 'user-agent': 'hayirlievlad-SelfUpdate' } });
      if (!r.ok) throw Error('HTTP_' + r.status);
    } else if (p === 'anthropic') {
      const r = await fetchT('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': sec, 'anthropic-version': '2023-06-01' } });
      if (!r.ok) throw Error('HTTP_' + r.status);
    } else {
      const base = providerBase(p, c.endpoint);
      if (!base) throw Error('NO_ENDPOINT');
      const r = await fetchT(base + '/models', { headers: { authorization: 'Bearer ' + sec } });
      if (!r.ok && r.status !== 404) throw Error('HTTP_' + r.status);
    }
    await run(env, 'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?', 'ok', now(), now(), c.id);
    return { ok: true };
  } catch (e) {
    await run(env, 'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?', 'error', e.message, now(), now(), c.id);
    return { ok: false, error: e.message };
  }
}

export function providerBase(p, endpoint = '') {
  const map = {
    openai: 'https://api.openai.com/v1', groq: 'https://api.groq.com/openai/v1',
    openrouter: 'https://openrouter.ai/api/v1', nvidia: 'https://integrate.api.nvidia.com/v1',
    mistral: 'https://api.mistral.ai/v1', deepseek: 'https://api.deepseek.com/v1',
    together: 'https://api.together.xyz/v1', cerebras: 'https://api.cerebras.ai/v1',
    perplexity: 'https://api.perplexity.ai', xai: 'https://api.x.ai/v1'
  };
  return (map[p] || String(endpoint || '')).replace(/\/$/, '');
}

export function providerModel(p, model = '') {
  const map = {
    openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile',
    openrouter: 'openrouter/auto', nvidia: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    mistral: 'mistral-small-latest', deepseek: 'deepseek-chat',
    together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', cerebras: 'llama3.1-8b',
    perplexity: 'sonar-pro', xai: 'grok-3-mini'
  };
  return model || map[p] || '';
}
