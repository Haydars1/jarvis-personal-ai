import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = 'C:/Users/user/Documents/Codex/ecu-pdf-sources';
const files = [
  ['EMU_PRO_Software_Guide.pdf','EMU PRO Software Guide','https://www.ecumaster.com/files/EMU_PRO/EMU_PRO_Software_Guide.pdf'],
  ['EMU_PRO_Manual.pdf','EMU PRO Manual','https://www.ecumaster.com/files/EMU_PRO/EMU_PRO_Manual.pdf'],
  ['How-to_Tune_the_GDI_Engine_in_EMU_PRO.pdf','How-to Tune the GDI Engine in EMU PRO','https://www.ecumaster.com/files/EMU_PRO/How-to/How-to_Tune_the_GDI_Engine_in_EMU_PRO.pdf'],
  ['Bosch_MS4_Sport_Manual.pdf','Bosch MS 4 Sport Manual','https://www.bosch-motorsport.com/media/downloads/ecu_ms_4_sport_en.pdf']
];
const q = value => `'${String(value ?? '').replaceAll("'", "''")}'`;
const out = [];
out.push("CREATE TABLE IF NOT EXISTS ecu_manual_library_documents (id TEXT PRIMARY KEY, filename TEXT NOT NULL, source_sha256 TEXT NOT NULL, page_count INTEGER NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', imported_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
out.push("CREATE TABLE IF NOT EXISTS ecu_manual_library_passages (id TEXT PRIMARY KEY,document_id TEXT NOT NULL,page INTEGER NOT NULL,part INTEGER NOT NULL,content TEXT NOT NULL,has_visuals INTEGER NOT NULL DEFAULT 0,imported_at INTEGER NOT NULL, UNIQUE(document_id,page,part));");
const now = Date.now();
for (const [filename, title, url] of files) {
  let bytes;
  try { bytes = new Uint8Array(await fs.readFile(`${root}/${filename}`)); }
  catch { bytes = new Uint8Array(await (await fetch(url)).arrayBuffer()); }
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const id = `webpdf_${sha.slice(0,24)}`;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const sourceId = `jarvis:web-pdf:${id}`;
  out.push(`INSERT INTO ecu_manual_library_documents(id,filename,source_sha256,page_count,tags_json,imported_at,updated_at) VALUES(${q(id)},${q(filename)},${q(sha)},${pdf.numPages},'["official-web-source"]',${now},${now}) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,page_count=excluded.page_count;`);
  out.push(`INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at) VALUES(${q(sourceId)},'ecu-manual-full',${q(`jarvis://ecu-library/web/${id}`)},${q(id)},${q(`Web PDF: ${title}`)},'en','learned',NULL,NULL,${q(JSON.stringify({source:'official-web-pdf',url:'official',source_sha256:sha}))},${now},${now},${now}) ON CONFLICT(source_url) DO UPDATE SET status='learned',learned_at=excluded.learned_at,updated_at=excluded.updated_at;`);
  for (let page=1; page<=pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent();
    const text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
    for (let offset=0, part=1; offset<text.length || (!text.length && part===1); part++) {
      const chunk = text.slice(offset, offset+3400).trim();
      if (chunk) {
        const passageId = `${id}:${page}:${part}`;
        const chunkId = `${sourceId}:${page}:${part}`;
        out.push(`INSERT INTO ecu_manual_library_passages(id,document_id,page,part,content,has_visuals,imported_at) VALUES(${q(passageId)},${q(id)},${page},${part},${q(chunk)},0,${now}) ON CONFLICT(id) DO UPDATE SET content=excluded.content;`);
        out.push(`INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES(${q(chunkId)},${q(sourceId)},${page*10000+part},${q(`[Web PDF ${title} | page ${page}] Source text (reference only): ${chunk}`)},${now}) ON CONFLICT(source_id,ordinal) DO UPDATE SET content=excluded.content;`);
      }
      if (!text.length) break;
      offset += 3400;
    }
  }
  console.log(`${filename}: ${pdf.numPages} pages`);
}
await fs.mkdir('.wrangler', { recursive: true });
await fs.writeFile('.wrangler/web-pdf-import.sql', out.join('\n'));
console.log(`SQL statements: ${out.length}`);
