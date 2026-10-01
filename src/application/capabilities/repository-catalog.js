import { repositoryIntegrations } from '../../lib/repository-integrations.js';
import { jsonResponse } from '../../lib/runtime.js';
export function createRepositoryCatalog(core) {
  return {
    async fetch(req, env, ctx) {
      if (new URL(req.url).pathname !== '/api/tools/repositories') return core.fetch(req, env, ctx);
      const auth = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
      if (!(await auth.json()).authenticated) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
      if (req.method !== 'GET') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      const repositories = repositoryIntegrations();
      return jsonResponse({ total: repositories.length, repositories });
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
