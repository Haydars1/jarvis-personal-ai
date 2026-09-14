const RESEARCH_RE = /(araştır|bak|bul|karşılaştır|güncel|son durum|kaynak|google|internette|webde|web'de|hangi|nereden|nasıl yapılır|video|foto|fotoğraf|şema|örnek|fiyat|haber|canlı|skor|maç|fikstür)/i;
const TOOLS_RE = /(araç|tool|ai bul|yapay zeka bul|bunu yapacak|entegre et|sisteme ekle|otomasyon|üret|oluştur)/i;
const SUPPORTED_PROVIDERS = new Set(['gemini', 'nvidia', 'deepseek', 'mistral', 'xai', 'together', 'fireworks', 'groq', 'openrouter', 'openai-compatible']);

const PROVIDER_BIAS = {
  coding: { nvidia: 26, deepseek: 25, xai: 20, mistral: 18, openrouter: 16, together: 14, fireworks: 14, gemini: 17, groq: 15 },
  reasoning: { deepseek: 26, nvidia: 24, xai: 22, gemini: 20, mistral: 18, openrouter: 16, together: 14, fireworks: 14 },
  research: { gemini: 23, xai: 22, openrouter: 18, nvidia: 16, deepseek: 15, mistral: 14 },
  vision: { gemini: 27, nvidia: 24, xai: 18, openrouter: 16 },
  creative: { gemini: 21, mistral: 20, xai: 19, openrouter: 18, nvidia: 16 },
  chat: { nvidia: 22, groq: 21, gemini: 20, mistral: 18, xai: 18, deepseek: 17, openrouter: 16 }
};

export function wantsResearch(text = '') {
  return RESEARCH_RE.test(String(text));
}

export function wantsTools(text = '') {
  return TOOLS_RE.test(String(text));
}

export function taskKind(text = '') {
  const value = String(text).toLowerCase();
  if (/(kod|code|javascript|typescript|python|sql|github|debug|hata|refactor|api|worker|cloudflare)/i.test(value)) return 'coding';
  if (/(hesapla|analiz|neden|karşılaştır|strateji|plan|mantık|teşhis|diagnose|karar)/i.test(value)) return 'reasoning';
  if (/(foto|fotoğraf|resim|görsel|image|ekran görüntüsü|şema|diagram)/i.test(value)) return 'vision';
  if (/(reels|video|animasyon|klip|text.?to.?video|image.?to.?video)/i.test(value)) return 'video';
  if (/(metin yaz|caption|açıklama|başlık|senaryo|script|reklam metni|yaratıcı|creative)/i.test(value)) return 'creative';
  if (wantsResearch(value)) return 'research';
  return 'chat';
}

export function complexity(text = '') {
  const value = String(text);
  let score = 0;
  if (value.length > 260) score += 1;
  if (/(ve|sonra|ayrıca|hem|bir de|karşılaştır|araştır|analiz)/i.test(value)) score += 1;
  if ((value.match(/[?.!,;]/g) || []).length > 4) score += 1;
  return score >= 2 ? 'complex' : 'simple';
}

export function needsOrchestration(text = '') {
  const kind = taskKind(text);
  return complexity(text) === 'complex' || ['coding', 'reasoning', 'research', 'vision', 'video'].includes(kind) || wantsTools(text);
}

export function parseCapabilities(row) {
  try {
    return JSON.parse(row?.capabilities || '[]');
  } catch {
    return [];
  }
}

export function scoreProvider(row, kind) {
  const provider = String(row?.provider || '').toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) return null;

  const need = kind === 'coding' ? 'coding' : kind === 'reasoning' ? 'reasoning' : kind === 'vision' ? 'vision' : 'chat';
  const capabilities = parseCapabilities(row);
  let score = PROVIDER_BIAS[kind]?.[provider] || 10;

  if (capabilities.includes(need)) score += 30;
  else if (capabilities.includes('reasoning') && need === 'coding') score += 14;
  else if (capabilities.includes('chat')) score += 8;

  const samples = Number(row?.samples || 0);
  const successes = Number(row?.successes || 0);
  const latency = Number(row?.avg_latency_ms || 0);
  if (samples >= 3) score += Math.round((successes / Math.max(1, samples)) * 12);
  if (latency && latency < 1500) score += 10;
  else if (latency > 3500) score -= 16;
  score -= Math.min(12, Number(row?.priority || 100) / 20);
  return score;
}

export function directUrl(value = '') {
  try {
    const raw = String(value).startsWith('//') ? `https:${String(value)}` : String(value);
    const url = new URL(raw);
    if (url.hostname.includes('duckduckgo.com') && url.pathname.startsWith('/l/')) {
      return url.searchParams.get('uddg') || raw;
    }
    return raw;
  } catch {
    return String(value);
  }
}

export function cleanReply(raw = '') {
  let value = String(raw || '').replace(/\r\n/g, '\n');
  value = value.replace(/(?:https?:)?\/\/duckduckgo\.com\/l\/\?[^\s)]+/gi, match => directUrl(match));
  value = value.replace(/\n{3,}/g, '\n\n');
  return value.trim();
}

export function safeFallbackPayload(text, reply, traceValue) {
  return {
    reply,
    history: [
      { role: 'user', content: text },
      { role: 'assistant', content: reply, provider: 'JARVIS' }
    ],
    provider: 'JARVIS',
    trace: [{ kind: 'fallback', label: 'JARVIS güvenli cevap', value: traceValue }]
  };
}
