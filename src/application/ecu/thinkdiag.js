import { parseThinkcarTc, summarizeRecording } from '../../../public/lib/thinkcar-tc.js';
import { decodeEcuFile } from '../../lib/ecu-file.js';
import { jsonResponse } from '../../lib/runtime.js';
import { analyzeDiagnosticReport } from '../../../public/lib/diagnostic-report.js';

export const THINKDIAG_PROFILE = Object.freeze({ model: 'THINKDIAG2', app: 'ThinkDiag+', platform: 'iOS',
  supported: ['tc-recording-import', 'csv-json-export', 'parameter-statistics', 'report-text-analysis'],
  direct_bluetooth: false, firmware_flash: false,
  connection: 'ThinkDiag+ içinde cihazı bağla → tarama/kayıt yap → Raporlar’dan paylaş → Jarvis’e yükle.',
  missing: 'Doğrudan canlı kontrol için THINKCAR tarafından sağlanan SDK/protokol ve gerçek cihaz doğrulaması gerekli.' });

export function createThinkdiagImport(core) {
  return {
    async fetch(req, env, ctx) {
      const path = new URL(req.url).pathname;
      if (path === '/api/ecu/thinkdiag/profile' || path === '/api/ecu/thinkdiag/import') {
        const auth = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
        if (!(await auth.json()).authenticated) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401);
        if (path.endsWith('/profile') && req.method === 'GET') return jsonResponse(THINKDIAG_PROFILE);
        if (path.endsWith('/import') && req.method === 'POST') {
          try { const body = await req.json(); const recording = parseThinkcarTc(decodeEcuFile(body.base64)); return jsonResponse({ recording, summary: summarizeRecording(recording) }); }
          catch (error) { return jsonResponse({ error: String(error.message), detail: 'TC kaydı okunamadı; biçim, boyut veya dosya içeriğini kontrol et.' }, 400); }
        }
        return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      }
      if (path === '/api/chat/send' && req.method === 'POST') {
        const body = await req.clone().json();
        const tc = (body.attachments || []).find(file => /\.tc$/i.test(String(file.name)));
        const report = (body.attachments || []).find(file => typeof file.extractedText === 'string' && /\.(pdf|txt)$/i.test(String(file.name)));
        if (report) {
          try { const analysis = analyzeDiagnosticReport(report.extractedText); const reply = `Teşhis raporu okundu: ${analysis.code_count} farklı arıza kodu.\n` + analysis.codes.map(item => `${item.code}${item.subtype ? ' (' + item.subtype + ')' : ''}: ${item.context}`).join('\n\n') + '\n' + analysis.conclusion; return jsonResponse({ reply, provider: 'JARVIS Teşhis Raporu', analysis: { type: 'diagnostic-report', ...analysis }, history: [{ role: 'user', content: String(body.text || report.name) }, { role: 'assistant', content: reply }] }); }
          catch (error) { return jsonResponse({ error: error.message, reply: 'Rapor metni okunamadı.' }, 400); }
        }
        if (tc) {
          try {
            const recording = parseThinkcarTc(decodeEcuFile(tc.base64)); const summary = summarizeRecording(recording);
            const reply = `ThinkDiag kaydı okundu: ${recording.record_count} örnek, ${recording.parameters.length} parametre.\n` + summary.map(p => `${p.name} [${p.unit || 'birim belirtilmemiş'}]: ${p.numeric_count ? `min ${p.min}, max ${p.max}, ortalama ${p.mean.toFixed(2)}` : 'sayısal olmayan veri'}`).join('\n') + '\nKayıt başına zaman yok; hız veya güç hesaplaması için zaman üretmedim.';
            return jsonResponse({ reply, provider: 'JARVIS ThinkDiag', analysis: { type: 'thinkdiag-tc', summary, metadata: recording.metadata, record_count: recording.record_count }, history: [{ role: 'user', content: String(body.text || tc.name) }, { role: 'assistant', content: reply }] });
          } catch (error) { return jsonResponse({ error: error.message, reply: 'ThinkDiag kaydı okunamadı: ' + error.message }, 400); }
        }
      }
      return core.fetch(req, env, ctx);
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
