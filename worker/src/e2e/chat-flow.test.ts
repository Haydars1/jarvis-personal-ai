import { describe, expect, it } from 'vitest';
import { FallbackAiProvider } from '../ai/fallback-provider';
import { runAiTurn } from '../chat/ai-turn';
import { ChatService, type ChatStore } from '../chat/service';
import type {
  AppendMessageInput,
  Conversation,
  ConversationContextPatch,
  CreateConversationInput,
  Message,
} from '../db/types';
import { notifyOwnerMilestones } from '../notifications/milestones';
import type { PushNotification, PushSender } from '../notifications/push';

class MemoryFlowRepository implements ChatStore {
  conversations = new Map<string, Conversation>();
  messages: Message[] = [];
  milestones = new Set<string>();

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const row: Conversation = {
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
    this.conversations.set(row.id, row);
    return row;
  }

  async getConversation(id: string) { return this.conversations.get(id) ?? null; }
  async listConversations() { return [...this.conversations.values()]; }
  async listMessages(id: string) { return this.messages.filter((message) => message.conversationId === id); }
  async findMessageByIdempotency(id: string, key: string) {
    return this.messages.find((message) => message.conversationId === id && message.idempotencyKey === key) ?? null;
  }

  async appendMessage(input: AppendMessageInput) {
    if (input.idempotencyKey && await this.findMessageByIdempotency(input.conversationId, input.idempotencyKey)) return false;
    this.messages.push({ ...input, createdAt: new Date().toISOString() });
    return true;
  }

  async appendOwnerMessageIfHuman(input: AppendMessageInput) {
    const row = this.conversations.get(input.conversationId);
    if (!row || row.status !== 'human_active') return false;
    return this.appendMessage({ ...input, sender: 'owner' });
  }

  async updateConversationContext(id: string, patch: ConversationContextPatch) {
    const row = this.conversations.get(id);
    if (!row) return false;
    this.conversations.set(id, { ...row, ...patch, updatedAt: new Date().toISOString() });
    return true;
  }

  async claimHumanTakeover(id: string, assignedTo: string) {
    const row = this.conversations.get(id);
    if (!row || row.status === 'closed') return false;
    this.conversations.set(id, { ...row, status: 'human_active', assignedTo, revision: row.revision + 1 });
    return true;
  }

  async releaseHumanTakeover(id: string) {
    const row = this.conversations.get(id);
    if (!row || row.status !== 'human_active') return false;
    this.conversations.set(id, { ...row, status: 'ai_active', assignedTo: undefined, revision: row.revision + 1 });
    return true;
  }

  async beginAiTurn(id: string) {
    const row = this.conversations.get(id);
    return row?.status === 'ai_active' && row.aiResumeEnabled ? { revision: row.revision } : null;
  }

  async commitAiTurn(id: string, expectedRevision: number, messageId: string, body: string) {
    const row = this.conversations.get(id);
    if (!row || row.status !== 'ai_active' || row.revision !== expectedRevision || !row.aiResumeEnabled) return 'stale' as const;
    this.messages.push({ id: messageId, conversationId: id, sender: 'ai', body, createdAt: new Date().toISOString() });
    this.conversations.set(id, { ...row, revision: row.revision + 1, updatedAt: new Date().toISOString() });
    return 'sent' as const;
  }

  async recordMilestone(conversationId: string, milestone: string) {
    const key = `${conversationId}:${milestone}`;
    if (this.milestones.has(key)) return false;
    this.milestones.add(key);
    return true;
  }
}

class RecordingPush implements PushSender {
  sent: PushNotification[] = [];
  async send(notification: PushNotification) { this.sent.push(notification); }
}

describe('complete 6006 chat flow', () => {
  it('moves visitor -> AI -> human takeover -> owner reply -> AI resume without leaking AI during takeover', async () => {
    const repository = new MemoryFlowRepository();
    const service = new ChatService(repository);
    const push = new RecordingPush();
    const provider = new FallbackAiProvider();

    const started = await service.start({
      language: 'tr',
      pagePath: '/fehlercodes/P0299',
      faultCode: 'P0299',
      vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
      message: 'Yokuşta güç düşüyor ve turbo basıncı düşük.',
    });

    expect(await runAiTurn(repository, provider, started.id)).toBe('sent');
    const conversation = await repository.getConversation(started.id);
    expect(conversation).not.toBeNull();
    await notifyOwnerMilestones(repository, push, conversation!, await repository.listMessages(started.id));
    expect(push.sent.map((entry) => entry.milestone)).toEqual(expect.arrayContaining(['vehicle_complete', 'dtc_symptom']));

    expect(await repository.claimHumanTakeover(started.id, 'owner@example.test')).toBe(true);
    await service.postMessage(started.id, { language: 'tr', message: 'Bir insanla konuşmak istiyorum.' }, 'visitor-2');
    expect(await runAiTurn(repository, provider, started.id)).toBe('disabled');
    expect((await repository.listMessages(started.id)).filter((message) => message.sender === 'ai')).toHaveLength(1);

    expect(await repository.appendOwnerMessageIfHuman({
      id: 'owner-1', conversationId: started.id, sender: 'owner', body: 'Aracınızın bilgilerini gördüm, kontrol ediyorum.',
    })).toBe(true);

    expect(await repository.releaseHumanTakeover(started.id)).toBe(true);
    await service.postMessage(started.id, { language: 'tr', message: 'Tamam, devam edebiliriz.' }, 'visitor-3');
    expect(await runAiTurn(repository, provider, started.id)).toBe('sent');
    expect((await repository.listMessages(started.id)).filter((message) => message.sender === 'ai')).toHaveLength(2);
  });
});
