import { classifyCapability, providerPreference } from './capability-policy.js';
const RESEARCH_RE = /(araştır|bak|bul|karşılaştır|güncel|son durum|kaynak|google|internette|webde|web'de|hangi|nereden|nasıl yapılır|video|foto|fotoğraf|şema|örnek|fiyat|haber|canlı|skor|maç|fikstür)/i;
const TOOLS_RE = /(araç|tool|ai bul|yapay zeka bul|bunu yapacak|entegre et|sisteme ekle|otomasyon|üret|oluştur|görsel üret|resim üret|video üret|ses üret|müzik üret|tts|speech)/i;
const SUPPORTED_PROVIDERS = new Set(['gemini', 'nvidia', 'deepseek', 'mistral', 'xai', 'together', 'fireworks', 'groq', 'openrouter', 'openai', 'anthropic', 'perplexity', 'cohere', 'cerebras', 'sambanova', 'ollama', 'openai-compatible']);

export function wantsResearch(text = '') { return RESEARCH_RE.test(String(text)); }
export function wantsTools(text = '') { return TOOLS_RE.test(String(text)); }

export function taskKind(text = '') {
  const classified=classifyCapability(text);
  if (classified!=='chat') return classified;
  const value=String(text).toLowerCase();
  if (/(hesapla|analiz|neden|strateji|plan|mantık|karar|kanıtla|çıkarım)/i.test(value)) return 'reasoning';
  if (/(çevir|tercüme|ne demek|almanca|ingilizce|türkçesi|translation)/i.test(value)) return 'translation';
  if (/(foto|fotoğraf|resim|görsel|image|ekran görüntüsü|şema|diagram)/i.test(value) && !/(üret|oluştur|çiz|generate)/i.test(value)) return 'vision';
  if (/(görsel üret|resim üret|fotoğraf üret|image generate|çiz|midjourney|dall.?e)/i.test(value)) return 'image';
  if (/(ses üret|seslendir|tts|text.?to.?speech|voice|müzik üret|audio)/i.test(value)) return 'audio';
  if (/(metin yaz|açıklama|başlık|senaryo|script|reklam metni|yaratıcı|creative)/i.test(value)) return 'creative';
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
  return complexity(text) === 'complex' || ['coding','reasoning','research','reporting','social_strategy','ecu_diagnostics','ecu_file_analysis','vehicle_coding','service_procedure','performance_calibration','emissions_modification','vision','video_creation','image','audio'].includes(kind) || wantsTools(text);
}

export function parseCapabilities(row) { try { return JSON.parse(row?.capabilities || '[]'); } catch { return []; } }

export function scoreProvider(row, kind) {
  const provider = String(row?.provider || '').toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) return null;
  const need = ['coding','reasoning','vision','video_creation','image','audio','translation','research','reporting','social_strategy','ecu_diagnostics','ecu_file_analysis','vehicle_coding','service_procedure','performance_calibration','emissions_modification'].includes(kind) ? kind : 'chat';
  const capabilities = parseCapabilities(row);
  const required = ({reporting:'research',social_strategy:'chat',ecu_diagnostics:'reasoning',ecu_file_analysis:'reasoning',vehicle_coding:'reasoning',service_procedure:'reasoning',performance_calibration:'reasoning',emissions_modification:'reasoning',video_creation:'chat'})[need] || need;
  let score = providerPreference(kind, provider);
  if (capabilities.includes(need) || capabilities.includes(required)) score += 36;
  else if (capabilities.includes('reasoning') && ['coding','research','reporting','ecu_diagnostics','ecu_file_analysis','vehicle_coding','service_procedure','performance_calibration','emissions_modification'].includes(need)) score += 14;
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
