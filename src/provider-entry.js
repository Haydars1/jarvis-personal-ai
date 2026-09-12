import core from './integration-entry.js';

const AI_PROVIDER_NAMES = {
  deepseek:'DeepSeek',
  mistral:'Mistral',
  xai:'xAI',
  together:'Together AI',
  fireworks:'Fireworks AI'
};

async function augmentState(req, env, ctx) {
  const res = await core.fetch(req, env, ctx);
  if (!res.ok || !env.DB) return res;
  let data;
  try { data = await res.clone().json(); } catch { return res; }
  try {
    const q = await env.DB.prepare(
      "SELECT provider,label,last_status,enabled,capabilities FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC"
    ).all();
    const rows = q.results || [];
    const extras = rows.filter(r => AI_PROVIDER_NAMES[String(r.provider||'').toLowerCase()]);
    data.status = data.status || {};
    data.status.ai = data.status.ai || {connected:false,count:0,healthy:0,providers:[]};
    const existing = Array.isArray(data.status.ai.providers) ? data.status.ai.providers : [];
    const names = extras.map(r => r.label || AI_PROVIDER_NAMES[String(r.provider||'').toLowerCase()]);
    data.status.ai.providers = [...new Set([...existing, ...names])];
    data.status.ai.count = data.status.ai.providers.length;
    data.status.ai.healthy = Math.max(Number(data.status.ai.healthy||0), rows.filter(r => r.last_status === 'ok').length);
    data.status.ai.connected = data.status.ai.count > 0;

    if (data.integrations?.ai) {
      data.integrations.ai.connected = data.status.ai.connected;
      data.integrations.ai.count = data.status.ai.count;
      data.integrations.ai.provider = data.status.ai.providers.join(' • ');
    }
  } catch {}
  return new Response(JSON.stringify(data), {
    status:res.status,
    headers:{...Object.fromEntries(res.headers),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === '/api/state' && req.method === 'GET') return augmentState(req, env, ctx);
    return core.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (core.scheduled) return core.scheduled(event, env, ctx);
  }
};
