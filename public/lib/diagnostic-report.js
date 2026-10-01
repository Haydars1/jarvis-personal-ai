export function analyzeDiagnosticReport(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 200000) throw new Error('REPORT_TEXT_SIZE');
  const lines = text.split(/\r?\n/), codes = new Map();
  for (let index = 0; index < lines.length; index++) {
    for (const match of lines[index].toUpperCase().matchAll(/\b([PBCU][0-3][0-9A-F]{3})(?:[ -]?([0-9A-F]{2}))?\b/g)) {
      const code = match[1], subtype = match[2] || null, key = code + (subtype || '');
      if (!codes.has(key)) codes.set(key, { code, subtype, occurrences: 0, context: lines.slice(Math.max(0, index - 1), index + 2).join('\n').slice(0, 1500) });
      codes.get(key).occurrences++;
    }
  }
  return { codes: [...codes.values()], code_count: codes.size, text_characters: text.length, conclusion: 'Kodlar rapordan çıkarıldı; arıza sebebi henüz doğrulanmadı.' };
}
