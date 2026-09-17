import { classifyLearningDomain, isSensitiveMemory, normalizeMemoryText } from './policy.js';
import { buildKnowledgeRecord, saveKnowledge, recordLearningEvent, recordProviderDomainMetric, getLearningContext } from './repository.js';

export function eligiblePersonalFact(text = '') {
  const value = String(text || '').trim();
  return value.length >= 8 && value.length <= 300 && !isSensitiveMemory(value);
}

export function sourceBackedKnowledge(domain, results = [], now = Date.now()) {
  return (Array.isArray(results) ? results : []).slice(0, 6).flatMap(row => {
    const text = String(row?.snippet || '').trim();
    const sourceUrl = String(row?.url || '').trim();
    if (!text || !sourceUrl) return [];
    try { return [buildKnowledgeRecord({ domain, text, sourceUrl, sourceTitle: row.title || '', confidence: 0.72, now })]; }
    catch { return []; }
  });
}

export async function learnSearchResults(env, query, results = []) {
  if (!env?.DB) return;
  const domain = classifyLearningDomain(query);
  for (const row of sourceBackedKnowledge(domain, results)) {
    try { await saveKnowledge(env.DB, { domain: row.domain, text: row.text, sourceUrl: row.source_url, sourceTitle: row.source_title, confidence: row.confidence, observedAt: row.observed_at, verifiedAt: row.verified_at, expiresAt: row.expires_at }); } catch {}
  }
}

export async function learnProviderOutcome(env, { text = '', provider = 'JARVIS', latencyMs = 0, ok = true, error = '' } = {}) {
  if (!env?.DB) return;
  const domain = classifyLearningDomain(text);
  const errorClass = /timeout/i.test(error) ? 'timeout' : error ? 'error' : null;
  await Promise.allSettled([
    recordProviderDomainMetric(env.DB, { provider, domain, ok, latencyMs, error }),
    recordLearningEvent(env.DB, { kind: 'provider_outcome', domain, provider, outcome: ok ? 'success' : errorClass || 'failure', latencyMs, errorClass })
  ]);
}

export async function learningContext(env, text, limit = 6) {
  if (!env?.DB) return [];
  return getLearningContext(env.DB, classifyLearningDomain(text), Date.now(), limit);
}

export async function savePersonalFact(env, fact, memoryIdFactory) {
  if (!env?.DB || !eligiblePersonalFact(fact)) return null;
  const normalized = normalizeMemoryText(fact);
  const existing = await env.DB.prepare('SELECT memory_id FROM personal_memory_meta WHERE normalized_text=? LIMIT 1').bind(normalized).first();
  const now = Date.now();
  if (existing?.memory_id) {
    await env.DB.prepare('UPDATE personal_memory_meta SET seen_count=seen_count+1,last_seen_at=?,updated_at=? WHERE memory_id=?').bind(now, now, existing.memory_id).run();
    return existing.memory_id;
  }
  const memoryId = memoryIdFactory();
  await env.DB.prepare('INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)').bind(memoryId, String(fact).trim(), JSON.stringify(['auto','learning-engine']), now).run();
  await env.DB.prepare('INSERT INTO personal_memory_meta(memory_id,normalized_text,domain,confidence,seen_count,last_seen_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(memoryId, normalized, classifyLearningDomain(fact), 0.75, now, now).run();
  return memoryId;
}