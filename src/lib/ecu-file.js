export const MAX_ECU_FILE_BYTES = 12 * 1024 * 1024;

export function isBinaryAttachment(file) {
  return /\.(bin|ori|mod|hex|rom|ecu)$/i.test(String(file?.name || '')) ||
    /octet-stream|macbinary/i.test(String(file?.type || ''));
}

export function decodeEcuFile(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('ECU_FILE_EMPTY');
  // Bound input before decoding so an oversized upload cannot allocate another huge buffer.
  if (value.length > Math.ceil(MAX_ECU_FILE_BYTES / 3) * 4) throw new Error('ECU_FILE_TOO_LARGE');
  let raw;
  try { raw = atob(value); } catch { throw new Error('ECU_FILE_INVALID_BASE64'); }
  if (!raw.length) throw new Error('ECU_FILE_EMPTY');
  if (raw.length > MAX_ECU_FILE_BYTES) throw new Error('ECU_FILE_TOO_LARGE');
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export function ecuFileError(error) {
  return ({
    ECU_FILE_TOO_LARGE: 'ECU dosyası 12 MB sınırını aşıyor.',
    ECU_FILE_EMPTY: 'ECU dosyası boş veya dosya içeriği eksik.',
    ECU_FILE_INVALID_BASE64: 'ECU dosya içeriği geçerli Base64 biçiminde değil.'
  })[error?.message] || `ECU dosyası okunamadı: ${error?.message || String(error)}`;
}
