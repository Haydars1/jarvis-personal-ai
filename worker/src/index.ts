import type { Env, ExecutionContextLike } from './env';
import { allowedOrigin, corsHeaders, json, withCors } from './http';

const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, service: '6006-api' });
    }

    if (!url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found' }, 404);
    }

    const origin = allowedOrigin(request, env);
    if (origin === false) {
      return json({ error: 'origin_not_allowed' }, 403);
    }

    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    return withCors(json({ error: 'not_found' }, 404), origin);
  },
};

export default worker;
