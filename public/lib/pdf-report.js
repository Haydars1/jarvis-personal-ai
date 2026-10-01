export async function extractPdfReport(bytes) {
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error('PDF_SIZE_LIMIT');
  const pdfjs = await import('/vendor/pdfjs/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  try {
    const document = await task.promise; if (document.numPages > 100) throw new Error('PDF_PAGE_LIMIT'); let text = '';
    for (let number = 1; number <= document.numPages; number++) { const page = await document.getPage(number); const content = await page.getTextContent(); text += `\nSayfa ${number}\n` + content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''); if (text.length > 200000) throw new Error('PDF_TEXT_LIMIT'); }
    if (!text.replace(/Sayfa \d+/g, '').trim()) throw new Error('PDF_OCR_REQUIRED'); return text;
  } finally { await task.destroy(); }
}
