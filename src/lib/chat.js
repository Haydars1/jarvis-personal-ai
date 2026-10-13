// JARVIS Chat — message storage, history, explicit memory
// Language: JavaScript (Cloudflare Workers ESM)

import { now, id } from './core.js';
import { qall, run, log } from './d1.js';

export async function addChat(env, role, content, provider = null) {
  const text = String(content || '').trim(); if (!text) return;
  await run(env, 'INSERT INTO chat_messages(id,role,content,provider,created_at) VALUES(?,?,?,?,?)', id(), role, text, provider, now());
  await run(env, 'DELETE FROM chat_messages WHERE id IN (SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT -1 OFFSET 2000)');
}

export async function chatHistory(env, limit = 100) {
  const rows = await qall(env, 'SELECT id,role,content,provider,created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?', Math.min(Math.max(Number(limit) || 100, 1), 300));
  return rows.reverse();
}

export async function rememberExplicit(env, text) {
  const raw = String(text || '').trim();
  const l = raw.toLocaleLowerCase('tr-TR');
  const explicit = /^(jarvis[, ]*)?(bunu|şunu|sunu|bu bilgiyi)?\s*(hafızana|belleğine|bellegine)\s+kaydet[: ]+/i.test(l)
    || /^(jarvis[, ]*)?(bunu|şunu|sunu|bu bilgiyi)\s+hatırla[: ]+/i.test(l)
    || /^(jarvis[, ]*)?kaydet[: ]+/i.test(l);
  if (!explicit) return null;
  const clean = raw
    .replace(/^(jarvis[, ]*)?/i, '')
    .replace(/^(bunu|şunu|sunu|bu bilgiyi)?\s*(hafızana|belleğine|bellegine)\s+kaydet[: ]*/i, '')
    .replace(/^(bunu|şunu|sunu|bu bilgiyi)\s+hatırla[: ]*/i, '')
    .replace(/^kaydet[: ]*/i, '')
    .trim();
  if (clean.length < 3) return null;
  const mid = id(); await run(env, 'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)', mid, clean, JSON.stringify(['chat', 'explicit']), now());
  await log(env, 'memory', 'Hafızaya kaydedildi: ' + clean, { id: mid }); return clean;
}
