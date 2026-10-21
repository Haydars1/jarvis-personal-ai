import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEcuIdentity } from '../src/application/ecu/ecu-identity-parser.js';

// Reports are read from an operator-selected local path. No undocumented KT200/Thinkdiag USB calls.
const HOST = '127.0.0.1';
const PORT = Number(process.env.ECU_ADAPTER_PORT || 8765);
const REPORT = String(process.env.ECU_IDENTITY_FILE || '').trim();
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_AGE_MS = 4 * 60 * 60 * 1000;
const ALLOWED = new Set(['.txt','.json','.pdf']);

export async function readIdentityReport(filePath = REPORT, now = Date.now()) {
  if (!filePath) throw Error('ECU_IDENTITY_FILE_NOT_CONFIGURED');
  const file = path.resolve(filePath);
  const ext = path.extname(file).toLowerCase();
  if (!ALLOWED.has(ext)) throw Error('FILE_EXTENSION_NOT_SUPPORTED');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_BYTES || stat.size < 1) throw Error('REPORT_SIZE_INVALID');
  if (now - stat.mtimeMs > MAX_AGE_MS || stat.mtimeMs - now > 60000) throw Error('REPORT_TOO_OLD_OR_CLOCK_INVALID');
  const data = await fs.readFile(file);
  let text;
  if (ext === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true, disableFontFace: true });
    const document = await task.promise;
    try {
      const pages = [];
      for (let i = 1; i <= Math.min(5, document.numPages); i++) {
        const page = await document.getPage(i);
        const items = (await page.getTextContent()).items;
        pages.push(items.map(item => String(item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''));
      }
      text = pages.join('\n');
    } finally { await document.destroy(); }
  } else {
    text = data.toString('utf8');
  }
  const identity = parseEcuIdentity(text);
  return {
    identity, source_kind: 'LOCAL_EXPORTED_REPORT', direct_usb_read: false,
    simulated: false, source: { filename: path.basename(file), modified_at: new Date(stat.mtimeMs).toISOString() }
  };
}
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'content-length':Buffer.byteLength(body), 'cache-control':'no-store' });
  res.end(body);
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16000) throw Error('REQUEST_TOO_LARGE'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}
export function startServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/capabilities') {
      let valid = false;
      try {
        if (REPORT) {
          const s = await fs.stat(REPORT);
          valid = s.isFile() && s.size <= MAX_BYTES && Date.now() - s.mtimeMs <= MAX_AGE_MS && Date.now() >= s.mtimeMs - 60000;
        }
      } catch {}
      return json(res, 200, { adapter:'ecu-report-reader', capabilities:valid ? ['import_ecu_identity'] : [], direct_usb_read:false });
    }
    if (req.method === 'POST' && url.pathname === '/execute') {
      try {
        const data = JSON.parse(await readBody(req));
        if (data?.job?.action !== 'import_ecu_identity') return json(res,400,{ok:false,error:'UNSUPPORTED_ACTION'});
        return json(res, 200, { ok:true, result:await readIdentityReport() });
      } catch(error) { return json(res, 422, { ok:false, error:String(error?.message || error).slice(0,160) }); }
    }
    return json(res, 404, { ok:false,error:'NOT_FOUND' });
  }).listen(PORT, HOST, () => console.log('ECU report adapter ready at http://' + HOST + ':' + PORT + ' (report: ' + (REPORT ? path.basename(REPORT) : 'not configured') + ')'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) startServer();
