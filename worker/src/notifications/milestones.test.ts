import { describe, expect, it } from 'vitest';
import type { Conversation, Message } from '../db/types';
import type { PushNotification, PushSender } from './push';
import { notifyOwnerMilestones } from './milestones';

class MilestoneStore {
  seen = new Set<string>();
  async recordMilestone(conversationId: string, milestone: string) {
    const key = `${conversationId}:${milestone}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

class CapturePush implements PushSender {
  notifications: PushNotification[] = [];
  async send(notification: PushNotification) {
    this.notifications.push(notification);
  }
}

function baseConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = new Date().toISOString();
  return {
    id: 'c1', createdAt: now, updatedAt: now, status: 'ai_active', revision: 0,
    language: 'de', aiResumeEnabled: true, ...overrides,
  };
}

function visitor(body: string): Message {
  return { id: crypto.randomUUID(), conversationId: 'c1', sender: 'visitor', body, createdAt: new Date().toISOString() };
}

describe('owner notification milestones', () => {
  it('notifies phone, complete vehicle, DTC+symptom, and human request only once each', async () => {
    const store = new MilestoneStore();
    const push = new CapturePush();
    const conversation = baseConversation({
      contactPhone: '+491788354756',
      faultCode: 'P0299',
      vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
    });
    const messages = [visitor('Yokuşta güç düşüyor. Bir insanla konuşmak istiyorum.')];

    await notifyOwnerMilestones(store, push, conversation, messages);
    await notifyOwnerMilestones(store, push, conversation, messages);

    expect(push.notifications.map((item) => item.milestone).sort()).toEqual([
      'dtc_symptom', 'human_requested', 'phone_captured', 'vehicle_complete',
    ]);
    expect(push.notifications).toHaveLength(4);
    expect(push.notifications.every((item) => item.url === '/admin/chat/c1')).toBe(true);
  });

  it('does not invent milestones from incomplete context', async () => {
    const store = new MilestoneStore();
    const push = new CapturePush();
    const conversation = baseConversation({ faultCode: 'P0299', vehicle: { brand: 'BMW' } });

    await notifyOwnerMilestones(store, push, conversation, []);

    expect(push.notifications).toHaveLength(0);
  });
});
