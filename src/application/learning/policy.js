const DOMAIN_RULES = [
  ['automotive', /(araba|otomobil|mercedes|volkswagen|passat|motor|şanzıman|yakıt|turbo|adblue|egr|dpf|vehicle|car|engine)/i],
  ['software', /(javascript|typescript|python|cloudflare|worker|github|api|kod|yazılım|hata|deploy|ios|swift|app)/i],
  ['music', /(müzik|youtube|deep house|remix|vokal|acapella|bpm|midi|beat|music|audio)/i],
  ['home', /(ev|çatı|pencere|ısıtma|tadilat|bahçe|house|roof|heating)/i],
  ['travel', /(uçuş|otel|seyahat|rota|havalimanı|flight|hotel|travel)/i],
  ['finance', /(banka|kredi|faiz|euro|finans|sigorta|bank|loan|insurance)/i],
  ['news', /(bugün|şu an|güncel|son dakika|haber|latest|today|current)/i]
];

const SENSITIVE = /(api\s*key|apikey|token|şifre|parola|password|secret|sağlık|teşhis|hastalık|ilaç|din(?:i|im)?|siyasi|parti|oy tercihi|cinsel|sexual|health|diagnosis|religion|politic)/i;

export function classifyLearningDomain(text = '') {
  const value = String(text || '');
  for (const [domain, pattern] of DOMAIN_RULES) if (pattern.test(value)) return domain;
  return 'general';
}

export function isSensitiveMemory(text = '') {
  return SENSITIVE.test(String(text || ''));
}

export function normalizeMemoryText(text = '') {
  return String(text || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function knowledgeFreshness(domain = 'general', text = '') {
  const value = String(text || '');
  if (domain === 'news' || /(bugün|şu an|güncel|fiyat|stok|hava|trafik|today|current|latest|price|stock)/i.test(value)) return 6 * 60 * 60 * 1000;
  if (['travel', 'finance', 'automotive'].includes(domain)) return 30 * 24 * 60 * 60 * 1000;
  if (domain === 'software') return 90 * 24 * 60 * 60 * 1000;
  return 180 * 24 * 60 * 60 * 1000;
}

export function scoreProviderDomain(metric = {}) {
  const samples = Math.max(0, Number(metric.samples || 0));
  if (!samples) return 0.5;
  const successes = Math.max(0, Number(metric.successes || 0));
  const failures = Math.max(0, Number(metric.failures || 0));
  const latency = Math.max(0, Number(metric.avg_latency_ms || 0));
  const successRate = successes / Math.max(1, successes + failures);
  const latencyScore = 1 / (1 + latency / 2500);
  const confidence = Math.min(1, samples / 20);
  const observed = successRate * 0.8 + latencyScore * 0.2;
  return Math.max(0, Math.min(1, 0.5 * (1 - confidence) + observed * confidence));
}
