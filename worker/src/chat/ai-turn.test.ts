import { describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '../db/types';
import { FallbackAiProvider } from '../ai/fallback-provider';
import { buildAiPrompt } from '../ai/prompt';
import type { AiProvider } from '../ai/provider';
import { runAiTurn, type AiTurnRepository } from './ai-turn';

class MemoryAiStore implements AiTurnRepository {
  conversation: Conversation;
  messages: Message[] = [];

  constructor(language: Conversation['language'] = 'de') {
    const now = new Date().toISOString();
    this.conversation = {
      id: 'c1', createdAt: now, updatedAt: now, status: 'ai_active', revision: 0,
      language, faultCode: 'P0299', vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
      aiResumeEnabled: true,
    };
    this.messages.push({ id: 'v1', conversationId: 'c1', sender: 'visitor', body: 'Yokuşta güç düşüyor.', createdAt: now });
  }

  async getConversation(id: string) {
    return id === this.conversation.id ? this.conversation : null;
  }

  async listMessages(id: string) {
    return id === this.conversation.id ? [...this.messages] : [];
  }

  async beginAiTurn(id: string) {
    if (id !== this.conversation.id || this.conversation.status !== 'ai_active' || !this.conversation.aiResumeEnabled) return null;
    return { revision: this.conversation.revision };
  }

  async commitAiTurn(id: string, expectedRevision: number, messageId: string, body: string) {
    if (id !== this.conversation.id || this.conversation.status !== 'ai_active' || this.conversation.revision !== expectedRevision) return 'stale' as const;
    this.messages.push({ id: messageId, conversationId: id, sender: 'ai', body, createdAt: new Date().toISOString() });
    this.conversation.revision += 1;
    return 'sent' as const;
  }

  takeover() {
    this.conversation.status = 'human_active';
    this.conversation.revision += 1;
  }
}

describe('AI turn orchestration', () => {
  it('fallback reply follows the conversation language', async () => {
    const store = new MemoryAiStore('tr');
    const result = await runAiTurn(store, new FallbackAiProvider(), 'c1');

    expect(result).toBe('sent');
    expect(store.messages.at(-1)?.sender).toBe('ai');
    expect(store.messages.at(-1)?.body).toMatch(/tek bir arıza kodu/i);
  });

  it('discards an AI completion when human takeover wins the race', async () => {
    const store = new MemoryAiStore('de');
    const provider: AiProvider = {
      reply: vi.fn().mockImplementation(async () => {
        store.takeover();
        return { body: 'Diese Antwort darf nicht gespeichert werden.' };
      }),
    };

    const result = await runAiTurn(store, provider, 'c1');

    expect(result).toBe('stale');
    expect(store.messages.some((message) => message.body.includes('darf nicht gespeichert'))).toBe(false);
  });

  it('never calls the provider while human takeover is active', async () => {
    const store = new MemoryAiStore('en');
    store.takeover();
    const provider: AiProvider = { reply: vi.fn() };

    expect(await runAiTurn(store, provider, 'c1')).toBe('disabled');
    expect(provider.reply).not.toHaveBeenCalled();
  });

  it('prompt forbids definitive failed-part claims from a single DTC', () => {
    const prompt = buildAiPrompt({
      language: 'en',
      faultCode: 'P0299',
      vehicle: { brand: 'BMW', model: '3er', body: 'G20/G21', year: 2021, engine: '320d B47' },
      messages: [{ id: 'v1', conversationId: 'c1', sender: 'visitor', body: 'Low boost.', createdAt: new Date().toISOString() }],
    });

    expect(prompt).toMatch(/single DTC/i);
    expect(prompt).toMatch(/do not claim.*definitely failed/i);
    expect(prompt).toMatch(/reply only in English/i);
  });
});
