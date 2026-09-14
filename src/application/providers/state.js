import { jsonResponse, queryAll } from '../../lib/runtime.js';

const AI_PROVIDER_NAMES = {
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  xai: 'xAI',
  together: 'Together AI',
  fireworks: 'Fireworks AI'
};

export function createProviderState(core) {
  if (!core?.fetch) throw new Error('PROVIDER_STATE_CORE_FETCH_REQUIRED');

  async function augmentState(req, env, ctx) {
    const response = await core.fetch(req, env, ctx);
    if (!response.ok || !env.DB) return response;
    let data;
    try { data = await response.clone().json(); } catch { return response; }

    try {
      const rows = await queryAll(env, "SELECT provider,label,last_status,enabled,capabilities FROM credentials WHERE enabled=1 ORDER BY priority ASC,created_at ASC");
      const extras = rows.filter(row => AI_PROVIDER_NAMES[String(row.provider || '').toLowerCase()]);
      data.status = data.status || {};
      data.status.ai = data.status.ai || { connected: false, count: 0, healthy: 0, providers: [] };
      const existing = Array.isArray(data.status.ai.providers) ? data.status.ai.providers : [];
      const names = extras.map(row => row.label || AI_PROVIDER_NAMES[String(row.provider || '').toLowerCase()]);
      data.status.ai.providers = [...new Set([...existing, ...names])];
      data.status.ai.count = data.status.ai.providers.length;
      data.status.ai.healthy = Math.max(Number(data.status.ai.healthy || 0), rows.filter(row => row.last_status === 'ok').length);
      data.status.ai.connected = data.status.ai.count > 0;

      if (data.integrations?.ai) {
        data.integrations.ai.connected = data.status.ai.connected;
        data.integrations.ai.count = data.status.ai.count;
        data.integrations.ai.provider = data.status.ai.providers.join(' • ');
      }
    } catch {}

    return jsonResponse(data, response.status, Object.fromEntries(response.headers));
  }

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/state' && req.method === 'GET') return augmentState(req, env, ctx);
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
