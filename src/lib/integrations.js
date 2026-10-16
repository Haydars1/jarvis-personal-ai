// hayırlıevlad Integrations — Google OAuth/Gmail/Drive, Meta Facebook/Instagram, Action queue
// Language: JavaScript (Cloudflare Workers ESM)

import { te, fetchT, now, id, safeJsonParse } from './core.js';
import { kvGet, kvSet, run, log } from './d1.js';
import { decSecret, encSecret } from './crypto.js';
import { credentialSecrets } from './credentials.js';

// --- Google ---

export async function googleCredential(env) {
  const rows = await credentialSecrets(env, null);
  return rows.find(c => String(c.provider || '').toLowerCase() === 'google' && c.enabled);
}

export async function googleStored(env) {
  const x = await kvGet(env, 'google_oauth', null);
  if (!x?.blob) return null;
  try { return { ...x, tokens: JSON.parse(await decSecret(env, x.blob)) } } catch { return null }
}

export async function googleAccessToken(env) {
  const c = await googleCredential(env), g = await googleStored(env);
  if (!c || !g) throw Error('GOOGLE_NOT_CONNECTED');
  let t = g.tokens;
  if (t.expires_at && t.expires_at > now() + 60000) return t.access_token;
  if (!t.refresh_token) throw Error('GOOGLE_REFRESH_TOKEN_MISSING');
  const form = new URLSearchParams({ client_id: String(c.endpoint || ''), client_secret: c.secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' });
  const r = await fetchT('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  if (!r.ok) throw Error('GOOGLE_REFRESH_' + r.status);
  const n = await r.json();
  t = { ...t, ...n, expires_at: now() + Number(n.expires_in || 3600) * 1000 };
  await kvSet(env, 'google_oauth', { email: g.email, scope: g.scope, blob: await encSecret(env, JSON.stringify(t)) });
  return t.access_token;
}

export function mailRaw({ to, subject, body }) {
  const raw = `To: ${to}\r\nSubject: ${subject || ''}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body || ''}`;
  const bytes = te.encode(raw); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function gmailList(env, max = 10) {
  const token = await googleAccessToken(env);
  const r = await fetchT(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(max, 20)}&q=${encodeURIComponent('newer_than:7d')}`, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw Error('GMAIL_LIST_' + r.status);
  const ids = (await r.json()).messages || [], out = [];
  for (const x of ids.slice(0, max)) {
    const q = await fetchT(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${x.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { authorization: 'Bearer ' + token } });
    if (q.ok) {
      const d = await q.json(), h = Object.fromEntries((d.payload?.headers || []).map(z => [z.name.toLowerCase(), z.value]));
      out.push({ id: x.id, subject: h.subject || '', from: h.from || '', date: h.date || '', snippet: d.snippet || '' });
    }
  }
  return out;
}

export async function gmailSend(env, payload) {
  const token = await googleAccessToken(env);
  const r = await fetchT('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ raw: mailRaw(payload) }) });
  if (!r.ok) throw Error('GMAIL_SEND_' + r.status);
  return r.json();
}

export async function driveFiles(env) {
  const token = await googleAccessToken(env);
  const params = new URLSearchParams({ pageSize: '30', fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)', orderBy: 'modifiedTime desc' });
  const r = await fetchT('https://www.googleapis.com/drive/v3/files?' + params, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw Error('DRIVE_' + r.status);
  return r.json();
}

// --- Meta (Facebook / Instagram) ---

export async function metaCredential(env) {
  const rows = await credentialSecrets(env, null);
  return rows.find(c => String(c.provider || '').toLowerCase() === 'meta' && c.enabled);
}

export async function metaFacebookPost(env, p) {
  const c = await metaCredential(env); if (!c) throw Error('META_NOT_CONNECTED');
  const page = String(c.endpoint || '').trim(); if (!page) throw Error('META_PAGE_ID_REQUIRED');
  const form = new URLSearchParams({ message: p.message || '', access_token: c.secret });
  const r = await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(page)}/feed`, { method: 'POST', body: form });
  if (!r.ok) throw Error('FACEBOOK_' + r.status + ':' + (await r.text()).slice(0, 200));
  return r.json();
}

export async function metaInstagramPost(env, p) {
  const c = await metaCredential(env); if (!c) throw Error('META_NOT_CONNECTED');
  const ig = String(c.model || '').trim(); if (!ig) throw Error('INSTAGRAM_BUSINESS_ID_REQUIRED');
  let form = new URLSearchParams({ image_url: p.imageUrl || '', caption: p.caption || '', access_token: c.secret });
  let r = await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(ig)}/media`, { method: 'POST', body: form });
  if (!r.ok) throw Error('INSTAGRAM_MEDIA_' + r.status + ':' + (await r.text()).slice(0, 200));
  const creation = (await r.json()).id;
  form = new URLSearchParams({ creation_id: creation, access_token: c.secret });
  r = await fetchT(`https://graph.facebook.com/v24.0/${encodeURIComponent(ig)}/media_publish`, { method: 'POST', body: form });
  if (!r.ok) throw Error('INSTAGRAM_PUBLISH_' + r.status + ':' + (await r.text()).slice(0, 200));
  return r.json();
}

// --- Action queue ---

export async function pendingAction(env, type, payload, summary, risk = 'medium') {
  const x = { id: id(), type, payload, summary, risk, status: 'pending', created_at: now() };
  await run(env, 'INSERT INTO actions(id,type,payload,summary,risk,status,created_at) VALUES(?,?,?,?,?,?,?)', x.id, type, JSON.stringify(payload), summary, risk, 'pending', x.created_at);
  await log(env, 'action', 'Onay bekliyor: ' + summary, { type });
  return x;
}

export async function executeAction(env, a) {
  const p = safeJsonParse(a.payload, {});
  if (a.type === 'gmail_send') return gmailSend(env, p);
  if (a.type === 'facebook_post') return metaFacebookPost(env, p);
  if (a.type === 'instagram_post') return metaInstagramPost(env, p);
  throw Error('UNSUPPORTED_ACTION');
}
