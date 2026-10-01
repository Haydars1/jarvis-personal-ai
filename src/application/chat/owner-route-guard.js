import { jsonResponse } from '../../lib/runtime.js';

// These routes are intercepted before the legacy worker's owner-session check.
export function createOwnerRouteGuard(authCore, handleRequest) {
  return async function ownerRouteGuard(req, env, ctx) {
    const path = new URL(req.url).pathname;
    if (path === '/api/chat/send' || path === '/api/ecu/channels' || path.startsWith('/api/ecu/channels/')) {
      const status = await authCore.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
      let authenticated = false;
      try { authenticated = status.ok && (await status.json()).authenticated === true; } catch {}
      if (!authenticated) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
    }
    return handleRequest(req, env, ctx);
  };
}
