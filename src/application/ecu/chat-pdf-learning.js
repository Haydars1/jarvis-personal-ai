import { searchLearningMemory } from '../../lib/youtube-learning-memory.js';
import { manualPassageMemoryStatements } from './manual-learning-seed.js';

const MAX_TEXT = 200000;
const MAX_PAGES = 1500;
const sha256 = async value => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
};
const sqlQuote = value => "'" + String(value ?? '').replaceAll("'", "''") + "'";

async function ensureSchema(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ecu_manual_library_documents (id TEXT PRIMARY KEY, filename TEXT NOT NULL, source_sha256 TEXT NOT NULL, page_count INTEGER NOT NULL, tags_json TEXT NOT NULL DEFAULT \'[]\', imported_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ecu_manual_library_passages (id TEXT PRIMARY KEY,document_id TEXT NOT NULL,page INTEGER NOT NULL,part INTEGER NOT NULL,content TEXT NOT NULL,has_visuals INTEGER NOT NULL DEFAULT 0,imported_at INTEGER NOT NULL, UNIQUE(document_id,page,part))').run();
}

// Chat attachments are already extracted by the browser PDF reader. Index them
// automatically, so a PDF added in any chat becomes searchable study context.
export async function learnChatPdfAttachments(env, attachments = []) {
  if (!env?.DB) return { learned: 0, documents: 0 };
  const pdfs = attachments.filter(file => /\.pdf$/i.test(String(file.name || '')) && typeof file.extractedText === 'string' && file.extractedText.trim()).slice(0, 4);
  if (!pdfs.length) return { learned: 0, documents: 0 };
  await ensureSchema(env);
  const statements = [], records = [], now = Date.now();
  for (const file of pdfs) {
    const text = file.extractedText.slice(0, MAX_TEXT);
    const sha = await sha256(text);
    const id = `chatpdf_${sha.slice(0, 24)}`;
    const pages = [...text.matchAll(/(?:^|\n)\s*Sayfa\s+(\d+)\s*\n/gi)];
    const sections = pages.length ? pages.map((match, index) => ({ page: Number(match[1]), text: text.slice(match.index + match[0].length, pages[index + 1]?.index ?? text.length) })) : [{ page: 1, text }];
    const pageCount = Math.min(MAX_PAGES, Math.max(...sections.map(section => section.page), 1));
    statements.push(env.DB.prepare(`INSERT INTO ecu_manual_library_documents(id,filename,source_sha256,page_count,tags_json,imported_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,page_count=MAX(page_count,excluded.page_count)`).bind(id, String(file.name || 'chat.pdf').slice(0, 180), sha, pageCount, '["chat-upload"]', now, now));
    let ordinal = 0;
    for (const section of sections) {
      const pageText = section.text.trim();
      for (let offset = 0, part = 1; offset < pageText.length || (!pageText.length && part === 1); part++) {
        const content = pageText.slice(offset, offset + 3400).trim();
        if (content) {
          records.push({ document_id: id, page: section.page, part, text: content, source_sha256: sha, filename: String(file.name || 'chat.pdf').slice(0, 180), image_count: 0 });
          ordinal++;
        }
        if (!pageText.length) break;
        offset += 3400;
      }
    }
    for (const record of records.filter(item => item.document_id === id)) {
      statements.push(env.DB.prepare('INSERT INTO ecu_manual_library_passages(id,document_id,page,part,content,has_visuals,imported_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,has_visuals=excluded.has_visuals').bind(`${id}:${record.page}:${record.part}`, id, record.page, record.part, record.text, 0, now));
    }
  }
  const learned = await manualPassageMemoryStatements(env, records, now);
  await env.DB.batch([...statements, ...learned]);
  return { learned: records.length, documents: pdfs.length };
}
