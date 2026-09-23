import { knowledgeFreshness, normalizeMemoryText } from './policy.js';

function id(prefix, seed) {
  const value = normalizeMemoryText(seed).replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
  return `${prefix}-${value}`;
}

export function buildKnowledgeRecord(input = {}) {
  const text = String(input.text || '').trim();
  const sourceUrl = String(input.sourceUrl || '').trim();
  if (!text) throw new Error('knowledge text required');
  if (!sourceUrl) throw new Error('knowledge provenance required');
  const domain = String(input.domain || 'general');
  const now = Number(input.now ?? Date.now());
  const confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0.7)));
  return {
    id: input.id || id('knowledge', `${domain}-${sourceUrl}-${text}`),
    domain,
    text,
    source_url: sourceUrl,
    source_title: String(input.sourceTitle || ''),
    confidence,
    observed_at: Number(input.observedAt ?? now),
    verified_at: Number(input.verifiedAt ?? now),
    expires_at: Number(input.expiresAt ?? (now + knowledgeFreshness(domain, text))),
    status: String(input.status || 'active'),
    supersedes_id: input.supersedesId || null,
    created_at: now,
    updated_at: now
  };
}

export function buildLearningEvent(input = {}) {
  const now = Number(input.now ?? Date.now());
  return {
    id: input.id || `learn-${now}-${Math.random().toString(36).slice(2, 10)}`,
    kind: String(input.kind || 'unknown'),
    domain: String(input.domain || 'general'),
    provider: input.provider ? String(input.provider) : null,
    outcome: input.outcome ? String(input.outcome) : null,
    latency_ms: Math.max(0, Number(input.latencyMs || 0)),
    error_class: input.errorClass ? String(input.errorClass).slice(0, 80) : null,
    meta: JSON.stringify(input.meta || {}),
    created_at: now
  };
}

export function buildProviderDomainMetric(input = {}) {
  return {
    provider: String(input.provider || ''),
    domain: String(input.domain || 'general'),
    samples: 1,
    successes: input.ok ? 1 : 0,
    failures: input.ok ? 0 : 1,
    avg_latency_ms: Math.max(0, Number(input.latencyMs || 0)),
    recent_failures: input.ok ? 0 : 1,
    last_error: input.error ? String(input.error).slice(0, 240) : null,
    updated_at: Number(input.now ?? Date.now())
  };
}

export async function saveKnowledge(db, input) {
  if (!db) return null;
  const r = buildKnowledgeRecord(input);
  await db.prepare(`INSERT INTO knowledge_memories(id,domain,text,source_url,source_title,confidence,observed_at,verified_at,expires_at,status,supersedes_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET confidence=excluded.confidence,verified_at=excluded.verified_at,expires_at=excluded.expires_at,status=excluded.status,updated_at=excluded.updated_at`).bind(r.id,r.domain,r.text,r.source_url,r.source_title,r.confidence,r.observed_at,r.verified_at,r.expires_at,r.status,r.supersedes_id,r.created_at,r.updated_at).run();
  return r;
}

export async function recordLearningEvent(db, input) {
  if (!db) return null;
  const r = buildLearningEvent(input);
  await db.prepare(`INSERT INTO learning_events(id,kind,domain,provider,outcome,latency_ms,error_class,meta,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(r.id,r.kind,r.domain,r.provider,r.outcome,r.latency_ms,r.error_class,r.meta,r.created_at).run();
  return r;
}

export async function recordProviderDomainMetric(db, input) {
  if (!db) return null;
  const r = buildProviderDomainMetric(input);
  await db.prepare(`INSERT INTO provider_domain_metrics(provider,domain,samples,successes,failures,avg_latency_ms,recent_failures,last_error,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,domain) DO UPDATE SET samples=samples+1,successes=successes+excluded.successes,failures=failures+excluded.failures,avg_latency_ms=((avg_latency_ms*samples)+excluded.avg_latency_ms)/(samples+1),recent_failures=CASE WHEN excluded.failures=1 THEN MIN(recent_failures+1,10) ELSE MAX(recent_failures-1,0) END,last_error=excluded.last_error,updated_at=excluded.updated_at`).bind(r.provider,r.domain,r.samples,r.successes,r.failures,r.avg_latency_ms,r.recent_failures,r.last_error,r.updated_at).run();
  return r;
}

export async function getLearningContext(db, domain, now = Date.now(), limit = 6) {
  if (!db) return [];
  const result = await db.prepare(`SELECT domain,text,source_url,source_title,confidence,verified_at,expires_at FROM knowledge_memories WHERE status='active' AND expires_at>? AND (domain=? OR domain='general') ORDER BY confidence DESC, verified_at DESC LIMIT ?`).bind(now, domain || 'general', limit).all();
  return result?.results || [];
}