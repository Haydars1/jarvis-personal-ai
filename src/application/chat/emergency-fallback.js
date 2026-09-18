import { jsonResponse, settleWithin } from '../../lib/runtime.js';
import { cleanReply } from '../../lib/orchestration.js';

const MODEL = '@cf/zai-org/glm-4.7-flash';
const FAILURE_PREFIX = 'JARVIS şu an yanıt üretemedi';

function fallbackIntent(text = '') {
  const value = String(text || '').toLowerCase();
  const action = /(yap|oluştur|üret|hazırla|çiz|göster|generate|create)/i.test(value);
  if (action && /(animasyon|video|reels?|klip)/i.test(value)) return 'video';
  if (action && /(resim|görsel|foto|fotoğraf|logo|poster|kapak|afiş)/i.test(value)) return 'image';
  return 'chat';
}

function capabilityFallback(text = '') {
  const kind = fallbackIntent(text);
  if (kind === 'video') return 'Video/animasyon isteğini aldım. Medya üretim sağlayıcısını devreye alıyorum; üretim sağlayıcısı hazır değilse isteği kaydedip uygun sağlayıcı üzerinden devam edeceğim.';
  if (kind === 'image') return 'Görsel isteğini aldım. Görsel üretim yeteneğini devreye alıyorum; üretim sağlayıcısı hazır değilse isteği kaydedip uygun sağlayıcı üzerinden devam edeceğim.';
  return '';
}

function extractWorkersText(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content.map(part => typeof part === 'string' ? part : (part?.text || part?.content || '')).join('').trim();
    if (joined) return joined;
  }
  return String(result?.response || result?.result?.response || result?.text || result?.output_text || '').trim();
}

async function generateEmergencyReply(env, text) {
  if (!env.AI || !text) return '';
  try {
    const run = env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Sen JARVIS kişisel asistansın. Kullanıcıya doğrudan, doğal, doğru ve yararlı Türkçe cevap ver. Basit sorularda hızlı ve net ol; gerektiğinde kısa açıklama ve pratik ayrıntı ekle. İç sistem/provider hatalarından bahsetme.' },
        { role: 'user', content: text }
      ],
      max_completion_tokens: 700,
      temperature: 0.15
    });
    const result = await settleWithin(run, 12_000, null);
    return cleanReply(extractWorkersText(result));
  } catch {
    return '';
  }
}

export function createEmergencyChatFallback(handleChat) {
  return async function emergencyChatFallback(req, env, ctx) {
    const response = await handleChat(req, env, ctx);
    if (!response?.ok) return response;

    let payload;
    try { payload = await response.clone().json(); } catch { return response; }
    const current = String(payload?.reply || '').trim();
    if (!current.startsWith(FAILURE_PREFIX)) return response;

    let text = '';
    try { text = String((await req.clone().json())?.text || '').trim(); } catch {}
    const reply = await generateEmergencyReply(env, text) || capabilityFallback(text);
    if (!reply) return response;

    payload.reply = reply;
    payload.provider = 'JARVIS';
    payload.history = Array.isArray(payload.history) && payload.history.length
      ? payload.history.map(message => message?.role === 'assistant' ? { ...message, content: reply, provider: 'JARVIS' } : message)
      : [{ role: 'user', content: text }, { role: 'assistant', content: reply, provider: 'JARVIS' }];
    payload.trace = [...(Array.isArray(payload.trace) ? payload.trace : []), { kind: 'fallback', label: 'JARVIS emergency AI', value: 'Primary chat paths failed; Workers AI returned the final reply' }];
    return jsonResponse(payload, response.status);
  };
}
