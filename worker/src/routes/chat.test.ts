import { describe, expect, it } from 'vitest';
import type { AppendMessageInput, Conversation, ConversationContextPatch, CreateConversationInput, Message } from '../db/types';
import type { ChatStore } from '../chat/service';
import { handleChatRequest } from './chat';

class MemoryChatStore implements ChatStore {
  conversations = new Map<string, Conversation>();
  messages: Message[] = [];
  contextPatches: ConversationContextPatch[] = [];

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: input.id,
      createdAt: now,
      updatedAt: now,
      status: 'ai_active',
      revision: 0,
      language: input.language,
      pagePath: input.pagePath,
      faultCode: input.faultCode,
      vehicle: input.vehicle,
      visitorSessionId: input.visitorSessionId,
      aiResumeEnabled: true,
    };
    this.conversations.set(input.id, conversation);
    return conversation;
  }

  async getConversation(id: string) {
    return this.conversations.get(id) ?? null;
  }

  async appendMessage(input: AppendMessageInput) {
    if (input.idempotencyKey && this.messages.some((message) => message.conversationId === input.conversationId && message.idempotencyKey === input.idempotencyKey)) {
      return false;
    }
    this.messages.push({
      id: input.id,
      conversationId: input.conversationId,
      sender: input.sender,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async listMessages(conversationId: string) {
    return this.messages.filter((message) => message.conversationId === conversationId);
  }

  async findMessageByIdempotency(conversationId: string, key: string) {
    return this.messages.find((message) => message.conversationId === conversationId && message.idempotencyKey === key) ?? null;
  }

  async updateConversationContext(id: string, patch: ConversationContextPatch) {
    const current = this.conversations.get(id);
    if (!current) return false;
    this.contextPatches.push(patch);
    this.conversations.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() });
    return true;
  }
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://api.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('public chat API', () => {
  it('starts a conversation and persists normalized context plus the first visitor message', async () => {
    const store = new MemoryChatStore();
    const response = await handleChatRequest(jsonRequest('/api/chat/start', {
      language: 'tr-TR',
      pagePath: '/fehlercodes/P0299',
      faultCode: 'p0299',
      vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
      visitorSessionId: 'visitor-1',
      message: 'Yokuşta güç düşüyor.',
    }), store);

    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; language: string; faultCode: string; messages: Message[]; revision?: number };
    expect(body.language).toBe('tr');
    expect(body.faultCode).toBe('P0299');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].body).toBe('Yokuşta güç düşüyor.');
    expect(body.revision).toBeUndefined();
    expect(store.conversations.get(body.id)?.vehicle?.body).toBe('B8');
  });

  it('deduplicates repeated visitor message writes by Idempotency-Key and returns current conversation state', async () => {
    const store = new MemoryChatStore();
    await store.createConversation({ id: 'c1', language: 'de' });
    const request = () => jsonRequest('/api/chat/c1/messages', {
      language: 'de',
      message: 'Motor lambası yanıyor.',
    }, { 'Idempotency-Key': 'msg-1' });

    const first = await handleChatRequest(request(), store);
    const second = await handleChatRequest(request(), store);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    const body = await second.json() as { messages: Message[] };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].body).toBe('Motor lambası yanıyor.');
  });

  it('runs the post-write hook once for a new visitor write, but not for a duplicate', async () => {
    const store = new MemoryChatStore();
    await store.createConversation({ id: 'c1', language: 'de' });
    let calls = 0;
    const hooks = { afterVisitorMessage: async () => { calls += 1; } };
    const request = () => jsonRequest('/api/chat/c1/messages', {
      language: 'de', message: 'Motor lambası yanıyor.',
    }, { 'Idempotency-Key': 'msg-2' });

    await handleChatRequest(request(), store, hooks);
    await handleChatRequest(request(), store, hooks);
    expect(calls).toBe(1);
  });

  it('rejects malformed and oversized payloads before touching storage', async () => {
    const store = new MemoryChatStore();
    const malformed = await handleChatRequest(jsonRequest('/api/chat/start', { language: 'de' }), store);
    expect(malformed.status).toBe(400);
    expect(store.conversations.size).toBe(0);

    const oversized = await handleChatRequest(jsonRequest('/api/chat/start', {
      language: 'de', message: 'x'.repeat(20_000),
    }), store);
    expect(oversized.status).toBe(413);
    expect(store.conversations.size).toBe(0);
  });

  it('updates vehicle/fault context without sending blank contact fields', async () => {
    const store = new MemoryChatStore();
    const existing = await store.createConversation({ id: 'c1', language: 'de' });
    store.conversations.set('c1', { ...existing, contactPhone: '+491788354756' });

    const response = await handleChatRequest(jsonRequest('/api/chat/c1/messages', {
      language: 'en',
      faultCode: 'P0299',
      vehicle: { brand: 'BMW', model: '3er', body: 'G20/G21', year: 2021, engine: '320d B47' },
      message: 'Power drops uphill.',
    }, { 'Idempotency-Key': 'msg-3' }), store);

    expect(response.status).toBe(201);
    expect(store.contextPatches.at(-1)).toEqual(expect.objectContaining({ language: 'en', faultCode: 'P0299' }));
    expect(store.contextPatches.at(-1)).not.toHaveProperty('contactPhone');
    expect(store.conversations.get('c1')?.contactPhone).toBe('+491788354756');
  });
});
