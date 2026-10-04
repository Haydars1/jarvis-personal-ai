import type { AccessTokenVerifier } from '../auth/access';
import { AccessAuthError, requireAdmin } from '../auth/access';
import type { Env } from '../env';
import { json } from '../http';
import type { AppendMessageInput, Conversation, Message } from '../db/types';

export interface AdminStore {
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  listMessages(conversationId: string): Promise<Message[]>;
  claimHumanTakeover(id: string, assignedTo: string): Promise<boolean>;
  releaseHumanTakeover(id: string): Promise<boolean>;
  appendOwnerMessageIfHuman(input: AppendMessageInput): Promise<boolean>;
}

function safeMessageBody(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const message = (value as { message?: unknown }).message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 4000) return null;
  return trimmed;
}

async function parseJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleAdminRequest(
  request: Request,
  store: AdminStore,
  env: Env,
  verifier?: AccessTokenVerifier,
): Promise<Response> {
  let identity;
  try {
    identity = await requireAdmin(request, env, verifier);
  } catch (error) {
    if (error instanceof AccessAuthError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: 'admin_auth_failed' }, 401);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/api/admin/conversations') {
    return json(await store.listConversations());
  }

  const detailMatch = path.match(/^\/api\/admin\/chat\/([^/]+)$/);
  if (request.method === 'GET' && detailMatch) {
    const id = decodeURIComponent(detailMatch[1]);
    const conversation = await store.getConversation(id);
    if (!conversation) return json({ error: 'conversation_not_found' }, 404);
    const messages = await store.listMessages(id);
    return json({ conversation, messages });
  }

  const actionMatch = path.match(/^\/api\/admin\/chat\/([^/]+)\/(takeover|release)$/);
  if (request.method === 'POST' && actionMatch) {
    const id = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const ok = action === 'takeover'
      ? await store.claimHumanTakeover(id, identity.email)
      : await store.releaseHumanTakeover(id);
    if (!ok) return json({ error: action === 'takeover' ? 'takeover_failed' : 'release_failed' }, 409);
    const conversation = await store.getConversation(id);
    return json({ ok: true, conversation });
  }

  const messageMatch = path.match(/^\/api\/admin\/chat\/([^/]+)\/messages$/);
  if (request.method === 'POST' && messageMatch) {
    const id = decodeURIComponent(messageMatch[1]);
    const body = safeMessageBody(await parseJson(request));
    if (!body) return json({ error: 'invalid_message' }, 400);

    const input: AppendMessageInput = {
      id: crypto.randomUUID(),
      conversationId: id,
      sender: 'owner',
      body,
    };
    const inserted = await store.appendOwnerMessageIfHuman(input);
    if (!inserted) return json({ error: 'human_takeover_required' }, 409);
    return json({ ok: true, message: input }, 201);
  }

  return json({ error: 'not_found' }, 404);
}
