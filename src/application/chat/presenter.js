import { execute, jsonResponse, queryOne, settleWithin } from '../../lib/runtime.js';

function reasoningLeak(text = '') {
  const value = String(text || '');
  return /here'?s a thinking process|analyze user input|identify the core request|formulate response strategy|chain of thought|step-by-step reasoning|internal reasoning|\*\*Analyze User Input|\*\*Identify the Core Request/i.test(value)
    || /<think>[\s\S]*?<\/think>/i.test(value);
}

function normalizeReadableText(text = '') {
  let value = String(text || '').replace(/\r\n/g, '\n');
  value = value.replace(/([.!?])(?=[A-ZÇĞİÖŞÜ])/g, '$1\n\n');
  value = value.replace(/(:)(?=\*\*|[A-ZÇĞİÖŞÜ][\p{L}]{2,})/gu, '$1\n\n');
  value = value.replace(/([^\s\n])(?=\*\*[A-ZÇĞİÖŞÜ])/gu, '$1\n\n');
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function stripTechnicalLeak(text = '') {
  let value = String(text || '');
  value = value.replace(/^\s*(?:JARVIS\s+)?(?:LIVE\s+SEARCH(?::\s*EMPTY)?|LOCAL|CLOUDFLARE\s+AI[^\n]*)\s*$/gim, '');
  value = value.replace(/(?:^|\n)\s*(?:Yanıt gecikti\.|Canlı kaynak şu an boş döndü\.|Şu an bağlı cevap motoru zamanında dönemedi\.)[^\n]*(?=\n|$)/gi, '\n');
  value = value.replace(/(?:[?&](?:rut|uddg|u|url)=[^\s)]+)+/gi, '');
  return normalizeReadableText(value);
}

function stripThink(text = '') {
  let value = stripTechnicalLeak(String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '')).trim();
  const final = value.match(/(?:final answer|final response|cevap)\s*[:：]\s*([\s\S]+)/i);
  if (final?.[1]?.trim()) value = final[1].trim();
  if (reasoningLeak(value)) return '';
  return value;
}

function looksMostlyEnglish(text = '') {
  const value = String(text || '').toLowerCase();
  const en = (value.match(/\b(the|and|user|request|response|should|explain|with|this|that|will|can|about|provide|steps?)\b/g) || []).length;
  const tr = (value.match(/\b(ve|bir|bu|için|nasıl|olan|ile|şunu|bunu|cevap|göster|yap|olarak|gerekir)\b/g) || []).length;
  return en >= 6 && en > tr * 2;
}

async function repair(env, userText, draft) {
  const safeDraft = stripThink(draft) || 'Yanıt oluşturulamadı.';
  if (!env.AI) return safeDraft;
  const run = env.AI.run('@cf/zai-org/glm-4.7-flash', {
    prompt: `Sen JARVIS'sin. Kullanıcının gerçek isteğine doğrudan Türkçe cevap ver. İç düşünce, analiz planı, chain-of-thought, "thinking process", meta açıklama veya kullanıcı isteğini yeniden analiz eden bölüm ASLA yazma. Taslak yanlış yorumladıysa taslağı yok say. Kullanıcı görsel/video/şema istiyorsa bunu açıkça belirt ve mevcut sistemin uygun araç akışına yönlendirecek şekilde kısa cevap ver.\n\nKULLANICI İSTEĞİ:\n${String(userText || '').slice(0, 7000)}\n\nHATALI/TASLAK MODEL ÇIKTISI:\n${String(draft || '').slice(0, 9000)}\n\nYalnız kullanıcıya gösterilecek nihai cevabı yaz.`,
    max_tokens: 900,
    temperature: 0.2
  });
  const result = await settleWithin(run, 1800, null);
  if (!result) return safeDraft;
  const output = String(result?.response || result?.result?.response || result?.text || '').trim();
  return stripThink(output) || output || safeDraft;
}

async function replaceLatestAssistant(env, text, provider) {
  try {
    const row = await queryOne(env, "SELECT id FROM chat_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1");
    if (row?.id) await execute(env, 'UPDATE chat_messages SET content=?,provider=? WHERE id=?', text, provider || 'JARVIS', row.id);
  } catch {}
}

function stripAttachmentContext(text='') {
  return String(text||'')
    .replace(/\n*\[JARVIS_ATTACHMENT_CONTEXT\][\s\S]*?\[\/JARVIS_ATTACHMENT_CONTEXT\]\s*/gi,'')
    .trim();
}

function cleanHistory(rows = []) {
  return (Array.isArray(rows) ? rows : []).map(message => {
    if (message?.role === 'user') return { ...message, content: stripAttachmentContext(message.content || '') };
    if (message?.role !== 'assistant') return message;
    const clean = stripThink(message.content || '');
    if (clean) return { ...message, content: clean };
    if (reasoningLeak(message.content || '')) return { ...message, content: 'Eski hatalı model düşünce çıktısı gizlendi.', provider: 'JARVIS' };
    return message;
  });
}

export function createChatOutput(core) {
  if (!core?.fetch) throw new Error('CHAT_OUTPUT_CORE_FETCH_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/chat/history' && req.method === 'GET') {
        const response = await core.fetch(req, env, ctx);
        if (!response.ok) return response;
        try { return jsonResponse(cleanHistory(await response.clone().json()), response.status); }
        catch { return response; }
      }

      if (url.pathname === '/api/chat/send' && req.method === 'POST') {
        let userText = '';
        try { userText = String((await req.clone().json())?.text || ''); } catch {}
        const response = await core.fetch(req, env, ctx);
        if (!response.ok) return response;
        try {
          const payload = await response.clone().json();
          const draft = String(payload?.reply || '');
          let clean = stripThink(draft);
          if (reasoningLeak(draft) || looksMostlyEnglish(draft) || !clean) clean = await repair(env, userText, draft);
          if (clean && clean !== draft) {
            payload.reply = clean;
            payload.provider = `${payload.provider ? `${String(payload.provider)} · ` : ''}JARVIS Clean`;
            await replaceLatestAssistant(env, clean, payload.provider);
          }
          if (Array.isArray(payload.history)) payload.history = cleanHistory(payload.history);
          return jsonResponse(payload, response.status);
        } catch { return response; }
      }
      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
