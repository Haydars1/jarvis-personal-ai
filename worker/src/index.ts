import { FallbackAiProvider } from './ai/fallback-provider';
import { AccessAuthError, requireAdmin } from './auth/access';
import { runAiTurn } from './chat/ai-turn';
import { ChatRepository } from './db/chat-repository';
import type { Env, ExecutionContextLike } from './env';
import { allowedOrigin, corsHeaders, json, withCors } from './http';
import { notifyOwnerMilestones } from './notifications/milestones';
import { D1PushSubscriptionStore, NoopPushSender } from './notifications/push';
import { handleAdminRequest } from './routes/admin';
import { handleChatRequest } from './routes/chat';
import { handlePushRequest } from './routes/push';

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

    const repository = new ChatRepository(env.DB);

    if (url.pathname.startsWith('/api/chat/')) {
      const response = await handleChatRequest(request, repository, {
        afterVisitorMessage: async (conversationId) => {
          await runAiTurn(repository, new FallbackAiProvider(), conversationId);
          const conversation = await repository.getConversation(conversationId);
          if (!conversation) return;
          const messages = await repository.listMessages(conversationId);
          await notifyOwnerMilestones(repository, new NoopPushSender(), conversation, messages);
        },
      });
      return withCors(response, origin);
    }

    if (url.pathname === '/api/admin/push/subscriptions') {
      try {
        await requireAdmin(request, env);
      } catch (error) {
        if (error instanceof AccessAuthError) {
          return withCors(json({ error: error.message }, error.status), origin);
        }
        return withCors(json({ error: 'admin_auth_failed' }, 401), origin);
      }
      const response = await handlePushRequest(request, new D1PushSubscriptionStore(env.DB));
      return withCors(response, origin);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      const response = await handleAdminRequest(request, repository, env);
      return withCors(response, origin);
    }

    return withCors(json({ error: 'not_found' }, 404), origin);
  },
};

export default worker;
