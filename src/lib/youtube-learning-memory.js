import { execute, queryAll, queryOne } from './runtime.js';

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const now = () => Date.now();
let schemaReady = false;

async function ensureLearningSchema(env) {
  if (schemaReady) return;
  await execute(env, `CREATE TABLE IF NOT EXISTS learning_sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL DEFAULT 'youtube-video',
    source_url TEXT NOT NULL UNIQUE,
    external_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    language TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    parent_source_id TEXT,
    job_id TEXT,
    meta_json TEXT NOT NULL DEFAULT '{}',
    learned_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  await execute(env, `CREATE TABLE IF NOT EXISTS learning_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(source_id) REFERENCES learning_sources(id) ON DELETE CASCADE,
    UNIQUE(source_id, ordinal)
  )`);
  await execute(env, 'CREATE INDEX IF NOT EXISTS idx_learning_sources_status ON learning_sources(status, updated_at DESC)');
  await execute(env, 'CREATE INDEX IF NOT EXISTS idx_learning_chunks_source ON learning_chunks(source_id, ordinal)');
  schemaReady = true;
}

export function learningTokens(text, limit = 10) {
  const stop = new Set(['nasıl','nedir','neden','hangi','için','ile','bir','bu','şu','ve','veya','olan','olarak','yapılır','yapmak','jarvis']);
  const words = String(text || '').toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}_-]+/gu) || [];
  return [...new Set(words.filter(word => word.length >= 3 && !stop.has(word)))].slice(0, Math.max(1, limit));
}

export function chunkTranscript(text, { maxChars = 1200, overlapChars = 160 } = {}) {
  const source = normalize(text);
  const max = Math.max(180, Number(maxChars) || 1200);
  const overlap = Math.max(0, Math.min(max - 40, Number(overlapChars) || 0));
  if (!source) return [];
  if (source.length <= max) return [{ ordinal: 0, content: source }];

  const chunks = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + max);
    if (end < source.length) {
      const boundary = source.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(max * 0.55)) end = boundary;
    }
    const content = source.slice(start, end).trim();
    if (content) chunks.push({ ordinal: chunks.length, content });
    if (end >= source.length) break;
    const next = Math.max(start + 1, end - overlap);
    const nextSpace = source.indexOf(' ', next);
    start = nextSpace >= 0 && nextSpace < end ? nextSpace + 1 : next;
  }
  return chunks;
}

function rowScore(row, tokens, query) {
  const title = String(row?.title || '').toLocaleLowerCase('tr-TR');
  const content = String(row?.content || '').toLocaleLowerCase('tr-TR');
  const haystack = `${title} ${content}`;
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 6;
    if (content.includes(token)) score += 3;
  }
  const phrase = String(query || '').toLocaleLowerCase('tr-TR').trim();
  if (phrase.length >= 5 && haystack.includes(phrase)) score += 20;
  return score;
}

export function rankLearningChunks(rows = [], query = '') {
  const tokens = learningTokens(query);
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({ ...row, learning_score: rowScore(row, tokens, query) }))
    .filter(row => row.learning_score > 0)
    .sort((a, b) => b.learning_score - a.learning_score || Number(a.ordinal || 0) - Number(b.ordinal || 0));
}

export function learningContextText(rows = []) {
  const selected = (Array.isArray(rows) ? rows : []).slice(0, 6);
  if (!selected.length) return '';
  return [
    'Öğrenilmiş video notları:',
    ...selected.map((row, index) => [
      `[YT${index + 1}] ${String(row.title || 'YouTube eğitimi').trim()}`,
      `Kaynak: ${String(row.source_url || '').trim()}`,
      String(row.content || '').trim().slice(0, 1800)
    ].filter(Boolean).join('\n'))
  ].join('\n\n');
}

export async function persistYouTubeLearning(env, result = {}, { jobId = null, parentSourceId = null } = {}) {
  await ensureLearningSchema(env);
  const kind = String(result?.kind || 'video');
  const sourceUrl = String(result?.source_url || '').trim();
  if (!sourceUrl) return { source_id: null, learning_status: 'missing-source', learning_chunks: 0 };

  const ts = now();
  const externalId = String(result?.video_id || result?.channel_id || '').trim() || null;
  const title = normalize(result?.title || (kind === 'channel' ? `YouTube kanalı ${externalId || ''}` : 'YouTube eğitimi'));
  const language = String(result?.language || '').trim() || null;
  const transcript = normalize(result?.transcript || '');
  const status = kind === 'video' ? (transcript ? 'learned' : 'no-transcript') : 'indexed';
  const sourceType = kind === 'channel' ? 'youtube-channel' : 'youtube-video';
  const existing = await queryOne(env, 'SELECT id,created_at FROM learning_sources WHERE source_url=?', sourceUrl);
  const sourceId = existing?.id || `learn:${crypto.randomUUID()}`;
  const meta = {
    captions_available: !!result?.captions_available,
    engine: String(result?.engine || 'jarvis-clean-room-youtube-teaching'),
    video_count: Array.isArray(result?.videos) ? result.videos.length : undefined
  };

  await execute(env, `INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_url) DO UPDATE SET source_type=excluded.source_type,external_id=excluded.external_id,title=excluded.title,language=excluded.language,status=excluded.status,parent_source_id=COALESCE(excluded.parent_source_id,learning_sources.parent_source_id),job_id=excluded.job_id,meta_json=excluded.meta_json,learned_at=excluded.learned_at,updated_at=excluded.updated_at`,
    sourceId, sourceType, sourceUrl, externalId, title, language, status, parentSourceId, jobId, JSON.stringify(meta), status === 'learned' ? ts : null, existing?.created_at || ts, ts);

  await execute(env, 'DELETE FROM learning_chunks WHERE source_id=?', sourceId);
  const chunks = kind === 'video' && transcript ? chunkTranscript(transcript) : [];
  for (const chunk of chunks) {
    await execute(env, 'INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES(?,?,?,?,?)', `${sourceId}:${chunk.ordinal}`, sourceId, chunk.ordinal, chunk.content, ts);
  }

  return { source_id: sourceId, learning_status: status, learning_chunks: chunks.length };
}

export async function searchLearningMemory(env, query, { limit = 6 } = {}) {
  await ensureLearningSchema(env);
  const tokens = learningTokens(query, 8);
  if (!tokens.length) return [];
  const clauses = tokens.slice(0, 6).map(() => '(lower(c.content) LIKE ? OR lower(s.title) LIKE ?)');
  const params = [];
  for (const token of tokens.slice(0, 6)) {
    params.push(`%${token}%`, `%${token}%`);
  }
  const rows = await queryAll(env, `SELECT c.id,c.source_id,c.ordinal,c.content,s.title,s.source_url,s.external_id,s.language
    FROM learning_chunks c JOIN learning_sources s ON s.id=c.source_id
    WHERE s.status='learned' AND (${clauses.join(' OR ')})
    ORDER BY s.updated_at DESC,c.ordinal ASC LIMIT 100`, ...params);
  return rankLearningChunks(rows, query).slice(0, Math.max(1, Math.min(12, Number(limit) || 6)));
}

export async function listYouTubeLearningSources(env, limit = 100) {
  await ensureLearningSchema(env);
  return queryAll(env, `SELECT id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,learned_at,created_at,updated_at
    FROM learning_sources ORDER BY updated_at DESC LIMIT ?`, Math.max(1, Math.min(300, Number(limit) || 100)));
}
