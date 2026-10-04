import type { D1Database } from '../env';

export interface PushNotification {
  conversationId: string;
  milestone: string;
  title: string;
  body: string;
  url: string;
}

export interface PushSender {
  send(notification: PushNotification): Promise<void>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionStore {
  upsertSubscription(subscription: PushSubscriptionInput): Promise<void>;
}

export class D1PushSubscriptionStore implements PushSubscriptionStore {
  constructor(private readonly db: D1Database) {}

  async upsertSubscription(subscription: PushSubscriptionInput): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      /* push:upsert-subscription */
      INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, created_at, updated_at, disabled_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = excluded.updated_at,
        disabled_at = NULL
    `).bind(
      crypto.randomUUID(),
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth,
      now,
      now,
    ).run();
  }
}

export class NoopPushSender implements PushSender {
  async send(_notification: PushNotification): Promise<void> {
    // Preview/local mode intentionally does not contact a push provider.
  }
}
