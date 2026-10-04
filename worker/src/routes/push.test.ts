import { describe, expect, it } from 'vitest';
import type { PushSubscriptionInput, PushSubscriptionStore } from '../notifications/push';
import { handlePushRequest } from './push';

class MemoryPushStore implements PushSubscriptionStore {
  subscriptions: PushSubscriptionInput[] = [];
  async upsertSubscription(subscription: PushSubscriptionInput) {
    this.subscriptions = this.subscriptions.filter((item) => item.endpoint !== subscription.endpoint);
    this.subscriptions.push(subscription);
  }
}

function request(body: unknown) {
  return new Request('https://api.example.test/api/admin/push/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('push subscription route', () => {
  it('stores a valid browser push subscription', async () => {
    const store = new MemoryPushStore();
    const response = await handlePushRequest(request({
      endpoint: 'https://push.example.test/subscription/1',
      keys: { p256dh: 'public-key-material', auth: 'auth-secret-material' },
    }), store);

    expect(response.status).toBe(201);
    expect(store.subscriptions).toEqual([{
      endpoint: 'https://push.example.test/subscription/1',
      p256dh: 'public-key-material',
      auth: 'auth-secret-material',
    }]);
  });

  it('rejects malformed subscription data', async () => {
    const store = new MemoryPushStore();
    const response = await handlePushRequest(request({ endpoint: 'not-a-url', keys: {} }), store);

    expect(response.status).toBe(400);
    expect(store.subscriptions).toHaveLength(0);
  });
});
