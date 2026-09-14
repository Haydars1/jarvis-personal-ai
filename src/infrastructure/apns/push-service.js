import { execute, jsonResponse, queryAll, queryOne } from '../../lib/runtime.js';

const te = new TextEncoder();
let jwtCache = { token: '', expiresAt: 0, keyId: '', teamId: '' };

const now = () => Date.now();
const uid = () => crypto.randomUUID();
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

function apnsConfig(env) {
  const teamId = String(env.APNS_TEAM_ID || '').trim();
  const keyId = String(env.APNS_KEY_ID || '').trim();
  const privateKey = String(env.APNS_PRIVATE_KEY || '').trim();
  const bundleId = String(env.APNS_BUNDLE_ID || 'com.haydojarvis.jarvis').trim();
  const missing = [];
  if (!teamId) missing.push('APNS_TEAM_ID');
  if (!keyId) missing.push('APNS_KEY_ID');
  if (!privateKey) missing.push('APNS_PRIVATE_KEY');
  if (!bundleId) missing.push('APNS_BUNDLE_ID');
  return { teamId, keyId, privateKey, bundleId, missing, ready: missing.length === 0 };
}

function pemToDer(pem) {
  const b64 = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  if (!b64) throw new Error('APNS_PRIVATE_KEY_EMPTY');
  return Uint8Array.from(atob(b64), char => char.charCodeAt(0));
}

async function providerToken(env) {
  const cfg = apnsConfig(env);
  if (!cfg.ready) throw new Error(`APNS_NOT_CONFIGURED:${cfg.missing.join(',')}`);
  const timestamp = Math.floor(Date.now() / 1000);
  if (
    jwtCache.token &&
    jwtCache.expiresAt > timestamp + 120 &&
    jwtCache.keyId === cfg.keyId &&
    jwtCache.teamId === cfg.teamId
  ) return jwtCache.token;

  const header = b64u(te.encode(JSON.stringify({ alg: 'ES256', kid: cfg.keyId })));
  const payload = b64u(te.encode(JSON.stringify({ iss: cfg.teamId, iat: timestamp })));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(cfg.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    te.encode(signingInput)
  ));
  const token = `${signingInput}.${b64u(signature)}`;
  jwtCache = { token, expiresAt: timestamp + 50 * 60, keyId: cfg.keyId, teamId: cfg.teamId };
  return token;
}

function cleanToken(value) {
  const token = String(value || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '');
  return token.length >= 32 && token.length <= 256 ? token : '';
}

async function registerDevice(env, body) {
  const token = cleanToken(body.token);
  if (!token) return jsonResponse({ error: 'INVALID_DEVICE_TOKEN' }, 400);
  const environment = String(body.environment || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const appBundle = String(body.appBundle || 'com.haydojarvis.jarvis').trim().slice(0, 200) || 'com.haydojarvis.jarvis';
  const existing = await queryOne(env, 'SELECT id FROM push_devices WHERE device_token=? LIMIT 1', token);
  const timestamp = now();

  if (existing) {
    await execute(
      env,
      'UPDATE push_devices SET environment=?,app_bundle=?,enabled=1,last_seen_at=?,updated_at=?,last_error=NULL WHERE id=?',
      environment,
      appBundle,
      timestamp,
      timestamp,
      existing.id
    );
    return jsonResponse({ ok: true, id: existing.id, environment, configured: apnsConfig(env).ready });
  }

  const id = uid();
  await execute(
    env,
    'INSERT INTO push_devices(id,device_token,platform,environment,app_bundle,enabled,created_at,updated_at,last_seen_at) VALUES(?,?,?,?,?,1,?,?,?)',
    id,
    token,
    'ios',
    environment,
    appBundle,
    timestamp,
    timestamp,
    timestamp
  );
  return jsonResponse({ ok: true, id, environment, configured: apnsConfig(env).ready });
}

async function sendToDevice(env, device, payload) {
  const cfg = apnsConfig(env);
  if (!cfg.ready) throw new Error(`APNS_NOT_CONFIGURED:${cfg.missing.join(',')}`);
  const jwt = await providerToken(env);
  const host = device.environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const topic = String(device.app_bundle || cfg.bundleId || 'com.haydojarvis.jarvis');
  const response = await fetch(`https://${host}/3/device/${encodeURIComponent(device.device_token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let detail = {};
  try { detail = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(String(detail.reason || `HTTP_${response.status}`));
    error.status = response.status;
    throw error;
  }
  return { apnsId: response.headers.get('apns-id') || null };
}

function notificationPayload(notification) {
  let meta = {};
  try { meta = JSON.parse(notification.meta || '{}') || {}; } catch {}
  const data = {
    notification_id: notification.id,
    kind: notification.kind || 'info',
    ...(meta.watch_id ? { watch_id: String(meta.watch_id) } : {}),
    ...(meta.agent_id ? { agent_id: String(meta.agent_id) } : {}),
    ...(meta.campaign_id ? { campaign_id: String(meta.campaign_id) } : {}),
    ...(meta.content_id ? { content_id: String(meta.content_id) } : {})
  };
  return {
    aps: {
      alert: {
        title: String(notification.title || 'JARVIS').slice(0, 120),
        body: String(notification.body || '').slice(0, 500)
      },
      sound: 'default',
      badge: 1,
      'thread-id': String(notification.kind || 'jarvis')
    },
    jarvis: data
  };
}

async function deliverNotification(env, notification, device) {
  const existing = await queryOne(
    env,
    'SELECT status FROM push_deliveries WHERE notification_id=? AND device_id=? LIMIT 1',
    notification.id,
    device.id
  );
  if (existing?.status === 'sent') return { skipped: true };
  const timestamp = now();

  try {
    const result = await sendToDevice(env, device, notificationPayload(notification));
    await execute(
      env,
      `INSERT INTO push_deliveries(notification_id,device_id,status,apns_id,error,attempted_at,sent_at)
       VALUES(?,?,?,?,?,?,?) ON CONFLICT(notification_id,device_id) DO UPDATE SET
       status=excluded.status,apns_id=excluded.apns_id,error=NULL,attempted_at=excluded.attempted_at,sent_at=excluded.sent_at`,
      notification.id,
      device.id,
      'sent',
      result.apnsId,
      null,
      timestamp,
      timestamp
    );
    await execute(env, 'UPDATE push_devices SET last_success_at=?,last_error=NULL,updated_at=? WHERE id=?', timestamp, timestamp, device.id);
    return { sent: true };
  } catch (error) {
    const status = Number(error.status || 0);
    const permanent = status === 410 || /BadDeviceToken|DeviceTokenNotForTopic|Unregistered/i.test(String(error.message || ''));
    const message = String(error.message || error).slice(0, 500);
    await execute(
      env,
      `INSERT INTO push_deliveries(notification_id,device_id,status,apns_id,error,attempted_at,sent_at)
       VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(notification_id,device_id) DO UPDATE SET
       status=excluded.status,error=excluded.error,attempted_at=excluded.attempted_at`,
      notification.id,
      device.id,
      permanent ? 'dead' : 'failed',
      null,
      message,
      timestamp
    );
    await execute(env, 'UPDATE push_devices SET enabled=?,last_error=?,updated_at=? WHERE id=?', permanent ? 0 : 1, message, timestamp, device.id);
    return { sent: false, error: message, permanent };
  }
}

export async function flushPush(env, limit = 20) {
  const cfg = apnsConfig(env);
  if (!cfg.ready) return { ok: false, configured: false, missing: cfg.missing, sent: 0 };

  const devices = await queryAll(env, "SELECT * FROM push_devices WHERE enabled=1 AND platform='ios' ORDER BY last_seen_at DESC LIMIT 8");
  if (!devices.length) return { ok: true, configured: true, sent: 0, devices: 0 };

  const notifications = await queryAll(
    env,
    `SELECT n.* FROM notifications n
      WHERE EXISTS (SELECT 1 FROM push_devices d WHERE d.enabled=1)
        AND EXISTS (SELECT 1 FROM push_devices d2 WHERE d2.enabled=1 AND NOT EXISTS (
          SELECT 1 FROM push_deliveries pd WHERE pd.notification_id=n.id AND pd.device_id=d2.id AND pd.status IN ('sent','dead')
        ))
      ORDER BY n.created_at ASC LIMIT ?`,
    limit
  );

  let sent = 0;
  let failed = 0;
  for (const notification of notifications) {
    for (const device of devices) {
      const result = await deliverNotification(env, notification, device);
      if (result.sent) sent += 1;
      else if (result.error) failed += 1;
    }
  }
  return { ok: true, configured: true, sent, failed, devices: devices.length, notifications: notifications.length };
}

export function createPushApi(core) {
  if (!core?.fetch) throw new Error('PUSH_CORE_FETCH_REQUIRED');

  async function isAuthed(req, env, ctx) {
    const response = await core.fetch(
      new Request(new URL('/api/auth/status', req.url), { headers: req.headers }),
      env,
      ctx
    );
    try { return !!(await response.json()).authenticated; } catch { return false; }
  }

  return async function handlePush(req, env, ctx) {
    const url = new URL(req.url);
    if (!(await isAuthed(req, env, ctx))) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);

    if (url.pathname === '/api/mobile/push/register' && req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch {}
      return registerDevice(env, body);
    }

    if (url.pathname === '/api/mobile/push/status' && req.method === 'GET') {
      const cfg = apnsConfig(env);
      const devices = await queryAll(
        env,
        'SELECT id,platform,environment,app_bundle,enabled,last_seen_at,last_success_at,last_error,updated_at FROM push_devices ORDER BY last_seen_at DESC LIMIT 10'
      );
      return jsonResponse({ configured: cfg.ready, missing: cfg.missing, devices });
    }

    if (url.pathname === '/api/mobile/push/unregister' && req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch {}
      const token = cleanToken(body.token);
      if (!token) return jsonResponse({ error: 'INVALID_DEVICE_TOKEN' }, 400);
      await execute(env, 'UPDATE push_devices SET enabled=0,updated_at=? WHERE device_token=?', now(), token);
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/mobile/push/test' && req.method === 'POST') {
      const cfg = apnsConfig(env);
      if (!cfg.ready) return jsonResponse({ error: 'APNS_NOT_CONFIGURED', missing: cfg.missing }, 503);
      let body = {};
      try { body = await req.json(); } catch {}
      const devices = await queryAll(env, "SELECT * FROM push_devices WHERE enabled=1 AND platform='ios' ORDER BY last_seen_at DESC LIMIT 8");
      if (!devices.length) return jsonResponse({ error: 'NO_IOS_DEVICE_REGISTERED' }, 404);
      const synthetic = {
        id: `test-${uid()}`,
        kind: 'test',
        title: String(body.title || 'JARVIS'),
        body: String(body.body || 'Push bildirimi çalışıyor.'),
        meta: '{}'
      };
      let sent = 0;
      const errors = [];
      for (const device of devices) {
        try {
          await sendToDevice(env, device, notificationPayload(synthetic));
          sent += 1;
        } catch (error) {
          errors.push({ device: device.id, error: String(error.message || error) });
        }
      }
      return jsonResponse({ ok: sent > 0, sent, errors }, sent > 0 ? 200 : 502);
    }

    return null;
  };
}
