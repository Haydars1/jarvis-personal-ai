import { parseThinkcarTc, summarizeRecording, recordingCsv } from './lib/thinkcar-tc.js';
import { extractPdfReport } from './lib/pdf-report.js';
import { analyzeDiagnosticReport } from './lib/diagnostic-report.js';

function mount() {
  const host = document.querySelector('#ecu .ecuShell'); if (!host || document.querySelector('#thinkdiagImport')) return;
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h3>THINKDIAG2 · ThinkDiag+ · iPhone</h3><p>ThinkDiag+ → Raporlar’dan paylaştığın TC kaydını yükle. Dosya bu cihazda okunur; bilgisayarın açık olması gerekmez.</p><input id="thinkdiagImport" type="file" accept=".tc"><p id="thinkdiagStatus" role="status">TC kaydı bekleniyor.</p><div class="row"><button id="thinkdiagCsv" disabled>CSV İNDİR</button><button id="thinkdiagJson" disabled>JSON İNDİR</button><button id="thinkdiagChat" disabled>ECU SOHBETİNDE İNCELE</button></div><div id="thinkdiagSummary" style="overflow:auto;max-height:400px"></div><p class="muted">Canlı Bluetooth bağlantısı ThinkDiag+ içinde yapılır. Jarvis bu ekranda kaydı analiz eder. PDF raporunu sohbetten yükleyebilirsin.</p>';
  host.prepend(card); let recording, selectedFile, reportText;
  const pdfInput = document.createElement('input'); pdfInput.id = 'thinkdiagPdf'; pdfInput.type = 'file'; pdfInput.accept = '.pdf,.txt'; pdfInput.setAttribute('aria-label', 'ThinkDiag PDF raporu');
  const pdfLabel = document.createElement('label'); pdfLabel.textContent = 'PDF / metin raporu yükle '; pdfLabel.append(pdfInput); card.append(pdfLabel);
  pdfInput.onchange = async event => {
    reportText = null; recording = null; selectedFile = event.target.files?.[0]; summary.textContent = ''; document.querySelector('#thinkdiagChat').disabled = true;
    document.querySelector('#thinkdiagCsv').disabled = true; document.querySelector('#thinkdiagJson').disabled = true;
    try { if (!selectedFile) return; if (selectedFile.size > 12 * 1024 * 1024) throw new Error('12 MB sınırı'); reportText = /\.pdf$/i.test(selectedFile.name) ? await extractPdfReport(new Uint8Array(await selectedFile.arrayBuffer())) : await selectedFile.text(); const result = analyzeDiagnosticReport(reportText); status.textContent = `${result.code_count} farklı arıza kodu · rapor metni okundu.`; summary.textContent = JSON.stringify(result, null, 2); document.querySelector('#thinkdiagChat').disabled = false; }
    catch (error) { status.textContent = error.message === 'PDF_OCR_REQUIRED' ? 'Bu rapor görüntü içeriyor; OCR gerekir. Metin raporu veya TC kaydını paylaş.' : 'Rapor okunamadı: ' + error.message; }
  };
  const status = document.querySelector('#thinkdiagStatus'), summary = document.querySelector('#thinkdiagSummary');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const download = (text, extension, mime) => { const url = URL.createObjectURL(new Blob([text], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = selectedFile.name.replace(/\.tc$/i, '') + extension; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  document.querySelector('#thinkdiagImport').onchange = async event => {
    recording = null; reportText = null; selectedFile = event.target.files?.[0]; summary.textContent = '';
    ['thinkdiagCsv', 'thinkdiagJson', 'thinkdiagChat'].forEach(id => document.getElementById(id).disabled = true);
    if (!selectedFile) return;
    try {
      if (selectedFile.size > 12 * 1024 * 1024) throw new Error('12 MB sınırı');
      recording = parseThinkcarTc(new Uint8Array(await selectedFile.arrayBuffer()));
      status.textContent = `${recording.record_count} örnek · ${recording.parameters.length} parametre · ${recording.metadata.manufacturer} · ${recording.metadata.timestamp}`;
      summary.innerHTML = '<table><thead><tr><th>Parametre</th><th>Birim</th><th>Min</th><th>Max</th><th>Ortalama</th></tr></thead><tbody>' + summarizeRecording(recording).map(p => '<tr>' + [p.name, p.unit || '—', p.min ?? '—', p.max ?? '—', p.mean?.toFixed(2) ?? '—'].map(value => '<td>' + escape(value) + '</td>').join('') + '</tr>').join('') + '</tbody></table><p>Kayıt başına zaman bilgisi yok; örnek sırası kullanılır.</p>';
      ['thinkdiagCsv', 'thinkdiagJson', 'thinkdiagChat'].forEach(id => document.getElementById(id).disabled = false);
    } catch (error) { status.textContent = 'Kayıt okunamadı: ' + error.message; }
  };
  document.querySelector('#thinkdiagCsv').onclick = () => download(recordingCsv(recording), '.csv', 'text/csv');
  document.querySelector('#thinkdiagJson').onclick = () => download(JSON.stringify(recording, null, 2), '.json', 'application/json');
  document.querySelector('#thinkdiagChat').onclick = async () => {
    const button = document.querySelector('#thinkdiagChat'); button.disabled = true;
    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch('/api/chat/send', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: 'ecu', text: 'ThinkDiag kaydını incele', attachments: [{ name: selectedFile.name, type: reportText ? 'application/pdf' : 'application/octet-stream', extractedText: reportText || undefined, base64: btoa(binary) }] }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || response.status);
      status.textContent = 'ECU sohbetine kaydedildi.'; const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = result.reply; summary.replaceChildren(pre);
    } catch (error) { status.textContent = 'Sohbete aktarılamadı: ' + error.message; } finally { button.disabled = false; }
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
