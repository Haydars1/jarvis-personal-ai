import { ChatService, type ChatStore } from '../chat/service';
import {
  PayloadError,
  parseStartChatPayload,
  parseVisitorMessagePayload,
  readPublicJson,
} from '../chat/schemas';
import { json } from '../http';

function pathMatch(pathname: string, suffix: 'conversation' | 'messages'): string | null {
  const pattern = suffix === 'messages'
    ? /^\/api\/chat\/([^/]+)\/messages$/
    : /^\/api\/chat\/([^/]+)$/;
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function idempotencyKey(request: Request): string | null {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > 200) return null;
  return value;
}

export async function handleChatRequest(request: Request, store: ChatStore): Promise<Response> {
  const url = new URL(request.url);
  const service = new ChatService(store);

  try {
    if (request.method === 'POST' && url.pathname === '/api/chat/start') {
      const payload = parseStartChatPayload(await readPublicJson(request));
      return json(await service.start(payload), 201);
    }

    const messageConversationId = pathMatch(url.pathname, 'messages');
    if (request.method === 'POST' && messageConversationId) {
      const key = idempotencyKey(request);
      if (!key) return json({ error: 'idempotency_key_required' }, 400);
      const payload = parseVisitorMessagePayload(await readPublicJson(request));
      const result = await service.postMessage(messageConversationId, payload, key);
      if (!result) return json({ error: 'conversation_not_found' }, 404);
      return json(result.message, result.duplicate ? 200 : 201);
    }

    const conversationId = pathMatch(url.pathname, 'conversation');
    if (request.method === 'GET' && conversationId) {
      const conversation = await service.get(conversationId);
      return conversation
        ? json(conversation)
        : json({ error: 'conversation_not_found' }, 404);
    }

    return json({ error: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof PayloadError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: 'chat_request_failed' }, 500);
  }
}
