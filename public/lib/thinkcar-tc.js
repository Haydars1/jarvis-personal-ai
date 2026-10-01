// Format interoperability implementation based on cubigato/thinkcar-tc-reader.
// Apache-2.0; attribution and full license: docs/third-party/thinkcar-tc-reader-LICENSE.txt.
// Upstream specification blob: 8ace0bfce16adb4bca44e25920ba8aba449376fe.
export function parseThinkcarTc(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 0x128 || bytes.length > 12 * 1024 * 1024) throw new Error('TC_FILE_SIZE');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bounds = (offset, length) => { if (!Number.isInteger(offset) || offset < 0 || offset + length > bytes.length) throw new Error('TC_TRUNCATED'); };
  const u16 = offset => { bounds(offset, 2); return view.getUint16(offset, true); };
  const u32 = offset => { bounds(offset, 4); return view.getUint32(offset, true); };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const magic = decoder.decode(bytes.subarray(0, 4));
  if (!['LSX8', 'LSX9'].includes(magic)) throw new Error('TC_SIGNATURE');
  const table = u32(12); bounds(table, 16);
  const stringCount = u32(table + 12), stringSize = u32(table + 8);
  if (stringCount > 1000000 || stringCount < 8) throw new Error('TC_STRING_COUNT');
  bounds(table + 16, stringSize);
  const strings = ['']; let position = table + 16;
  for (let i = 0; i < stringCount; i++) {
    const length = u16(position); bounds(position, length);
    if (length < 3 || position + length > table + 16 + stringSize || bytes[position + length - 1] !== 0) throw new Error('TC_STRING_ENTRY');
    strings.push(decoder.decode(bytes.subarray(position + 2, position + length - 1)));
    position += length;
  }
  const str = index => { if (index >= strings.length) throw new Error('TC_STRING_INDEX'); return strings[index]; };
  const descriptor = u32(0x118); bounds(descriptor, 16);
  const block = u32(descriptor + 4); bounds(block, 16);
  const recordSize = u32(block + 12), dataSize = u32(block + 8);
  if (!recordSize || recordSize % 4 || recordSize > 4096 || recordSize !== u32(descriptor + 12) || dataSize % recordSize) throw new Error('TC_RECORD_SIZE');
  const columns = recordSize / 4, recordCount = dataSize / recordSize;
  if (recordCount * columns > 1000000) throw new Error('TC_RECORD_LIMIT');
  bounds(block + 16, dataSize);
  if (block + 16 + dataSize > table || descriptor < 0x128 || descriptor + 16 + 2 * recordSize > block) throw new Error('TC_SECTION_OVERLAP');
  const parameters = Array.from({ length: columns }, (_, i) => ({
    column: i, name: str(u16(descriptor + 16 + i * 4)), unit: str(u16(descriptor + 16 + recordSize + i * 4)).trim()
  }));
  const records = Array.from({ length: recordCount }, (_, row) => parameters.map((_, col) => str(u32(block + 16 + row * recordSize + col * 4))));
  const fields = ['language', 'timestamp', 'region', 'version', 'manufacturer', 'device_id', 'protocol', 'session_id'];
  return { format: magic, metadata: Object.fromEntries(fields.map((key, i) => [key, str(i + 1)])), parameters, records, record_count: recordCount,
    timing: 'sample-index', warnings: ['Kayıt başına zaman bilgisi yok; örnek sırası kullanılır.', 'TC biçimi tersine mühendislikle çözülmüştür; uygulama sürümüne göre değişebilir.'] };
}

export function summarizeRecording(recording) {
  return recording.parameters.map(parameter => {
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    for (const row of recording.records) {
      const text = String(row[parameter.column]).trim();
      if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text)) continue;
      const value = Number(text.replace(',', '.')); if (!Number.isFinite(value)) continue;
      min = Math.min(min, value); max = Math.max(max, value); sum += value; count++;
    }
    return { ...parameter, numeric_count: count, min: count ? min : null, max: count ? max : null, mean: count ? sum / count : null };
  });
}

export function recordingCsv(recording) {
  // Spreadsheet formulas must remain inert, including imported parameter labels.
  const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
  const rows = [['Record', ...recording.parameters.map(p => p.name)], ['Unit', ...recording.parameters.map(p => p.unit)], ...recording.records.map((row, index) => [index, ...row])];
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}
