import { describe, expect, it } from 'vitest';
import type { AccessTokenVerifier } from '../auth/access';
import type { AppendMessageInput, Conversation, Message } from '../db/types';
import type { AdminStore } from './admin';
import { handleAdminRequest } from './admin';

class MemoryAdminStore implements AdminStore {
  conversations = new Map<string, Conversation>();
  messages: Message[] = [];

  constructor() {
    const now = new Date().toISOString();
    this.conversations.set('c1', {
      id: 'c1', createdAt: now, updatedAt: now, status: 'ai_active', revision: 0,
      language: 'tr', faultCode: 'P0299', contactPhone: '+491788354756',
      vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
      aiResumeEnabled: true,
    });
  }

  async listConversations() {
    return [...this.conversations.values()];
  }

  async getConversation(id: string) {
    return this.conversations.get(id) ?? null;
  }

  async listMessages(id: string) {
    return this.messages.filter((message) => message.conversationId === id);
  }

  async claimHumanTakeover(id: string, assignedTo: string) {
    const current = this.conversations.get(id);
    if (!current) return false;
    this.conversations.set(id, { ...current, status: 'human_active', revision: current.revision + 1, assignedTo });
    return true;
  }

  async releaseHumanTakeover(id: string) {
    const current = this.conversations.get(id);
    if (!current || current.status !== 'human_active') return false;
    this.conversations.set(id, { ...current, status: 'ai_active', revision: current.revision + 1, assignedTo: undefined });
    return true;
  }

  async appendOwnerMessageIfHuman(input: AppendMessageInput) {
    const current = this.conversations.get(input.conversationId);
    if (!current || current.status !== 'human_active') return false;
    this.messages.push({ ...input, createdAt: new Date().toISOString() });
    return true;
  }
}

const env = {
  ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com', ACCESS_AUD: 'aud-123', ADMIN_EMAIL: 'owner@example.test',
} as never;

const verifier: AccessTokenVerifier = {
  async verify() { return { email: 'owner@example.test', sub: 'user-1' }; },
};

function request(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://api.example.test${path}`, {
    method,
    headers: {
      'Cf-Access-Jwt-Assertion': 'signed.jwt.value',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('admin chat API', () => {
  it('lists and reads protected conversation context', async () => {
    const store = new MemoryAdminStore();
    const list = await handleAdminRequest(request('/api/admin/conversations'), store, env, verifier);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'c1', faultCode: 'P0299', contactPhone: '+491788354756' })]));

    const detail = await handleAdminRequest(request('/api/admin/chat/c1'), store, env, verifier);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual(expect.objectContaining({
      conversation: expect.objectContaining({ id: 'c1', language: 'tr' }),
      messages: [],
    }));
  });

  it('takes over and releases a conversation', async () => {
    const store = new MemoryAdminStore();
    const takeover = await handleAdminRequest(request('/api/admin/chat/c1/takeover', 'POST'), store, env, verifier);
    expect(takeover.status).toBe(200);
    expect(store.conversations.get('c1')?.status).toBe('human_active');
    expect(store.conversations.get('c1')?.assignedTo).toBe('owner@example.test');

    const release = await handleAdminRequest(request('/api/admin/chat/c1/release', 'POST'), store, env, verifier);
    expect(release.status).toBe(200);
    expect(store.conversations.get('c1')?.status).toBe('ai_active');
  });

  it('rejects owner replies outside human mode and accepts them after takeover', async () => {
    const store = new MemoryAdminStore();
    const blocked = await handleAdminRequest(request('/api/admin/chat/c1/messages', 'POST', { message: 'Merhaba.' }), store, env, verifier);
    expect(blocked.status).toBe(409);
    expect(store.messages).toHaveLength(0);

    await handleAdminRequest(request('/api/admin/chat/c1/takeover', 'POST'), store, env, verifier);
    const accepted = await handleAdminRequest(request('/api/admin/chat/c1/messages', 'POST', { message: 'Aracınızla ilgili detayları gördüm.' }), store, env, verifier);
    expect(accepted.status).toBe(201);
    expect(store.messages.at(-1)?.sender).toBe('owner');
  });

  it('returns 401 when the Access assertion is missing', async () => {
    const store = new MemoryAdminStore();
    const response = await handleAdminRequest(new Request('https://api.example.test/api/admin/conversations'), store, env, verifier);
    expect(response.status).toBe(401);
  });
});
