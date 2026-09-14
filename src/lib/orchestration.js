const RESEARCH_RE = /(araştır|bak|bul|karşılaştır|güncel|son durum|kaynak|google|internette|webde|web'de|hangi|nereden|nasıl yapılır|video|foto|fotoğraf|şema|örnek|fiyat|haber|canlı|skor|maç|fikstür)/i;
const TOOLS_RE = /(araç|tool|ai bul|yapay zeka bul|bunu yapacak|entegre et|sisteme ekle|otomasyon|üret|oluştur|görsel üret|resim üret|video üret|ses üret|müzik üret|tts|speech)/i;
const SUPPORTED_PROVIDERS = new Set(['gemini', 'nvidia', 'deepseek', 'mistral', 'xai', 'together', 'fireworks', 'groq', 'openrouter', 'openai', 'anthropic', 'perplexity', 'cohere', 'cerebras', 'sambanova', 'ollama', 'openai-compatible']);

const PROVIDER_BIAS = {
  coding: { anthropic: 30, openai: 29, deepseek: 27, nvidia: 25, xai: 22, gemini: 22, mistral: 19, openrouter: 18, together: 16, fireworks: 16, groq: 15, ollama: 12 },
  reasoning: { openai: 30, anthropic: 29, deepseek: 28, nvidia: 25, xai: 24, gemini: 23, mistral: 19, openrouter: 18, together: 16, fireworks: 16, cerebras: 15 },
  research: { perplexity: 31, gemini: 27, xai: 26, openai: 24, anthropic: 22, openrouter: 21, nvidia: 18, deepseek: 17, mistral: 16 },
  vision: { openai: 30, gemini: 29, anthropic: 27, nvidia: 24, xai: 20, openrouter: 19 },
  video: { openai: 20, gemini: 20, openrouter: 18 },
  image: { openai: 22, gemini: 20, openrouter: 18 },
  audio: { openai: 24, gemini: 18, openrouter: 16 },
  translation: { openai: 26, anthropic: 25, gemini: 24, mistral: 21, deepseek: 18, openrouter: 17 },
  creative: { anthropic: 28, openai: 27, gemini: 25, mistral: 22, xai: 21, openrouter: 20, nvidia: 17 },
  chat: { openai: 28, anthropic: 27, gemini: 25, nvidia: 23, groq: 22, xai: 21, mistral: 20, deepseek: 19, openrouter: 18, ollama: 14 }
};

export function wantsResearch(text = '') { return RESEARCH_RE.test(String(text)); }
export function wantsTools(text = '') { return TOOLS_RE.test(String(text)); }

export function taskKind(text = '') {
  const value = String(text).toLowerCase();
  if (/(kod|code|javascript|typescript|python|sql|github|debug|hata|refactor|api|worker|cloudflare|repo|commit)/i.test(value)) return 'coding';
  if (/(hesapla|analiz|neden|karşılaştır|strateji|plan|mantık|teşhis|diagnose|karar|kanıtla|çıkarım)/i.test(value)) return 'reasoning';
  if (/(çevir|tercüme|ne demek|almanca|ingilizce|türkçesi|translation)/i.test(value)) return 'translation';
  if (/(foto|fotoğraf|resim|görsel|image|ekran görüntüsü|şema|diagram)/i.test(value) && !/(üret|oluştur|çiz|generate)/i.test(value)) return 'vision';
  if (/(video üret|video oluştur|animasyon üret|text.?to.?video|image.?to.?video|higgsfield|sora|veo)/i.test(value)) return 'video';
  if (/(görsel üret|resim üret|fotoğraf üret|image generate|çiz|midjourney|dall.?e)/i.test(value)) return 'image';
  if (/(ses üret|seslendir|tts|text.?to.?speech|voice|müzik üret|audio)/i.test(value)) return 'audio';
  if (/(metin yaz|caption|açıklama|başlık|senaryo|script|reklam metni|yaratıcı|creative)/i.test(value)) return 'creative';
  if (wantsResearch(value)) return 'research';
  return 'chat';
}

export function complexity(text = '') {
  const value = String(text); let score = 0;
  if (value.length > 260) score += 1;
  if (/(ve|sonra|ayrıca|hem|bir de|karşılaştır|araştır|analiz)/i.test(value)) score += 1;
  if ((value.match(/[?.!,;]/g) || []).length > 4) score += 1;
  return score >= 2 ? 'complex' : 'simple';
}

export function needsOrchestration(text = '') {
  const kind = taskKind(text);
  return complexity(text) === 'complex' || ['coding', 'reasoning', 'research', 'vision', 'video', 'image', 'audio'].includes(kind) || wantsTools(text);
}

export function parseCapabilities(row) { try { return JSON.parse(row?.capabilities || '[]'); } catch { return []; } }

export function scoreProvider(row, kind) {
  const provider = String(row?.provider || '').toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) return null;
  const need = ['coding','reasoning','vision','video','image','audio','translation','research'].includes(kind) ? kind : 'chat';
  const capabilities = parseCapabilities(row);
  let score = PROVIDER_BIAS[kind]?.[provider] || 10;
  if (capabilities.includes(need)) score += 36;
  else if (capabilities.includes('reasoning') && ['coding','research'].includes(need)) score += 14;
  else if (capabilities.includes('vision') && need === 'image') score += 8;
  else if (capabilities.includes('chat')) score += 7;
  const samples = Number(row?.samples || 0), successes = Number(row?.successes || 0), latency = Number(row?.avg_latency_ms || 0), failures = Number(row?.failures || 0);
  if (samples >= 3) score += Math.round((successes / Math.max(1, samples)) * 14);
  if (latency && latency < 1500) score += 9; else if (latency > 5000) score -= 18;
  if (failures > successes && samples >= 3) score -= 12;
  score -= Math.min(12, Number(row?.priority || 100) / 20);
  return score;
}

export function directUrl(value = '') { try { const raw = String(value).startsWith('//') ? `https:${String(value)}` : String(value); const url = new URL(raw); if (url.hostname.includes('duckduckgo.com') && url.pathname.startsWith('/l/')) return url.searchParams.get('uddg') || raw; return raw; } catch { return String(value); } }
export function cleanReply(raw = '') { let value = String(raw || '').replace(/\r\n/g, '\n'); value = value.replace(/(?:https?:)?\/\/duckduckgo\.com\/l\/\?[^\s)]+/gi, match => directUrl(match)); value = value.replace(/\n{3,}/g, '\n\n'); return value.trim(); }
export function safeFallbackPayload(text, reply, traceValue) { return { reply, history: [{ role: 'user', content: text }, { role: 'assistant', content: reply, provider: 'JARVIS' }], provider: 'JARVIS', trace: [{ kind: 'fallback', label: 'JARVIS güvenli cevap', value: traceValue }] }; }
