import { PayloadError, readPublicJson } from '../chat/schemas';
import { json } from '../http';
import type { PushSubscriptionInput, PushSubscriptionStore } from '../notifications/push';

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new PayloadError(400, 'invalid_push_subscription');
  return value.trim();
}

function parseSubscription(row: Record<string, unknown>): PushSubscriptionInput {
  const endpoint = requiredString(row.endpoint);
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new PayloadError(400, 'invalid_push_subscription');
  }
  if (url.protocol !== 'https:') throw new PayloadError(400, 'invalid_push_subscription');

  if (!row.keys || typeof row.keys !== 'object' || Array.isArray(row.keys)) {
    throw new PayloadError(400, 'invalid_push_subscription');
  }
  const keys = row.keys as Record<string, unknown>;
  const p256dh = requiredString(keys.p256dh);
  const auth = requiredString(keys.auth);
  if (p256dh.length < 8 || auth.length < 8) throw new PayloadError(400, 'invalid_push_subscription');

  return { endpoint, p256dh, auth };
}

export async function handlePushRequest(request: Request, store: PushSubscriptionStore): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/api/admin/push/subscriptions') {
    return json({ error: 'not_found' }, 404);
  }

  try {
    const subscription = parseSubscription(await readPublicJson(request));
    await store.upsertSubscription(subscription);
    return json({ ok: true }, 201);
  } catch (error) {
    if (error instanceof PayloadError) return json({ error: error.message }, error.status);
    return json({ error: 'push_subscription_failed' }, 500);
  }
}
