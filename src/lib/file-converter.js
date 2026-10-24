// Tuning File Format Converter
// Intel HEX ↔ Motorola S-Record ↔ raw BIN conversion
// With checksum validation, address gap handling, and metadata extraction

// ─── Intel HEX (IHEX) Parser ──────────────────────────────────────────────

const IHEX_RECORD_TYPES = {
  0x00: 'DATA',
  0x01: 'EOF',
  0x02: 'EXT_SEGMENT_ADDR',  // Extended Segment Address (16-bit segment << 4)
  0x03: 'START_SEGMENT_ADDR', // Start Segment Address (CS:IP)
  0x04: 'EXT_LINEAR_ADDR',    // Extended Linear Address (upper 16 bits)
  0x05: 'START_LINEAR_ADDR',  // Start Linear Address (32-bit EIP)
};

/**
 * Parse Intel HEX string → binary data + metadata
 * @param {string} hexStr - Intel HEX file content
 * @returns {{data: Uint8Array, startAddress: number, endAddress: number, entryPoint: number|null, errors: string[], records: number}}
 */
export function parseIntelHex(hexStr) {
  const lines = hexStr.split(/\r?\n/).filter(l => l.trim().length > 0);
  const errors = [];
  let baseAddress = 0;
  let entryPoint = null;
  let minAddr = Infinity, maxAddr = 0;
  const segments = []; // {address, data}
  let recordCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith(':')) { errors.push(`Line ${i+1}: missing start code ':'`); continue; }

    const hex = line.substring(1);
    if (hex.length < 10) { errors.push(`Line ${i+1}: too short`); continue; }
    if (!/^[0-9A-Fa-f]+$/.test(hex)) { errors.push(`Line ${i+1}: invalid hex chars`); continue; }

    const byteCount = parseInt(hex.substring(0, 2), 16);
    const address   = parseInt(hex.substring(2, 6), 16);
    const recType   = parseInt(hex.substring(6, 8), 16);
    const dataHex   = hex.substring(8, 8 + byteCount * 2);
    const checksum  = parseInt(hex.substring(8 + byteCount * 2, 10 + byteCount * 2), 16);

    // Verify checksum
    let sum = 0;
    for (let b = 0; b < hex.length - 2; b += 2) sum += parseInt(hex.substring(b, b + 2), 16);
    const calcCheck = (~sum + 1) & 0xFF;
    if (calcCheck !== checksum) {
      errors.push(`Line ${i+1}: checksum error (expected ${calcCheck.toString(16).toUpperCase()}, got ${checksum.toString(16).toUpperCase()})`);
    }

    recordCount++;

    switch (recType) {
      case 0x00: { // Data
        const fullAddr = baseAddress + address;
        const data = new Uint8Array(byteCount);
        for (let b = 0; b < byteCount; b++) data[b] = parseInt(dataHex.substring(b*2, b*2+2), 16);
        segments.push({ address: fullAddr, data });
        if (fullAddr < minAddr) minAddr = fullAddr;
        if (fullAddr + byteCount > maxAddr) maxAddr = fullAddr + byteCount;
        break;
      }
      case 0x01: // EOF
        break;
      case 0x02: // Extended Segment Address
        baseAddress = parseInt(dataHex, 16) << 4;
        break;
      case 0x03: // Start Segment Address
        entryPoint = (parseInt(dataHex.substring(0, 4), 16) << 4) + parseInt(dataHex.substring(4, 8), 16);
        break;
      case 0x04: // Extended Linear Address
        baseAddress = parseInt(dataHex, 16) << 16;
        break;
      case 0x05: // Start Linear Address
        entryPoint = parseInt(dataHex, 16);
        break;
      default:
        errors.push(`Line ${i+1}: unknown record type 0x${recType.toString(16).toUpperCase()}`);
    }
  }

  if (minAddr === Infinity) {
    return { data: new Uint8Array(0), startAddress: 0, endAddress: 0, entryPoint, errors, records: recordCount };
  }

  // Merge segments into continuous binary
  const size = maxAddr - minAddr;
  const data = new Uint8Array(size);
  data.fill(0xFF); // Standard fill byte for flash
  for (const seg of segments) {
    data.set(seg.data, seg.address - minAddr);
  }

  return { data, startAddress: minAddr, endAddress: maxAddr, entryPoint, errors, records: recordCount };
}

/**
 * Generate Intel HEX from binary data
 * @param {Uint8Array} data - Binary data
 * @param {number} startAddress - Base address (default 0)
 * @param {number} bytesPerLine - Bytes per data record (default 16, max 255)
 * @returns {string} Intel HEX file content
 */
export function generateIntelHex(data, startAddress = 0, bytesPerLine = 16) {
  const lines = [];
  let currentExtAddr = -1;

  for (let offset = 0; offset < data.length; offset += bytesPerLine) {
    const fullAddr = startAddress + offset;
    const extAddr = (fullAddr >>> 16) & 0xFFFF;
    const localAddr = fullAddr & 0xFFFF;

    // Emit Extended Linear Address record if needed
    if (extAddr !== currentExtAddr) {
      currentExtAddr = extAddr;
      const elaHex = extAddr.toString(16).toUpperCase().padStart(4, '0');
      const elaSum = ihexChecksum(`02000004${elaHex}`);
      lines.push(`:02000004${elaHex}${elaSum}`);
    }

    const count = Math.min(bytesPerLine, data.length - offset);
    const addrHex = localAddr.toString(16).toUpperCase().padStart(4, '0');
    const countHex = count.toString(16).toUpperCase().padStart(2, '0');
    let dataHex = '';
    for (let i = 0; i < count; i++) dataHex += data[offset + i].toString(16).toUpperCase().padStart(2, '0');

    const recBody = `${countHex}${addrHex}00${dataHex}`;
    lines.push(`:${recBody}${ihexChecksum(recBody)}`);
  }

  // EOF record
  lines.push(':00000001FF');
  return lines.join('\n') + '\n';
}

function ihexChecksum(hexBody) {
  let sum = 0;
  for (let i = 0; i < hexBody.length; i += 2) sum += parseInt(hexBody.substring(i, i + 2), 16);
  return ((~sum + 1) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}


// ─── Motorola S-Record Parser ─────────────────────────────────────────────

const SREC_TYPES = {
  S0: { name: 'HEADER',       addrLen: 2, isData: false },
  S1: { name: 'DATA_16',      addrLen: 2, isData: true },
  S2: { name: 'DATA_24',      addrLen: 3, isData: true },
  S3: { name: 'DATA_32',      addrLen: 4, isData: true },
  S5: { name: 'RECORD_COUNT', addrLen: 2, isData: false },
  S7: { name: 'END_32',       addrLen: 4, isData: false },
  S8: { name: 'END_24',       addrLen: 3, isData: false },
  S9: { name: 'END_16',       addrLen: 2, isData: false },
};

/**
 * Parse Motorola S-Record string → binary data + metadata
 * @param {string} srecStr - S-Record file content
 * @returns {{data: Uint8Array, startAddress: number, endAddress: number, entryPoint: number|null, header: string, errors: string[], records: number}}
 */
export function parseSRecord(srecStr) {
  const lines = srecStr.split(/\r?\n/).filter(l => l.trim().length > 0);
  const errors = [];
  const segments = [];
  let minAddr = Infinity, maxAddr = 0;
  let entryPoint = null;
  let header = '';
  let recordCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 4) continue;
    const type = line.substring(0, 2).toUpperCase();
    const info = SREC_TYPES[type];
    if (!info) { errors.push(`Line ${i+1}: unknown record type '${type}'`); continue; }

    const hex = line.substring(2);
    if (!/^[0-9A-Fa-f]+$/.test(hex)) { errors.push(`Line ${i+1}: invalid hex chars`); continue; }

    const byteCount = parseInt(hex.substring(0, 2), 16);
    const totalDataLen = byteCount - info.addrLen - 1; // subtract address bytes and checksum

    // Verify checksum (ones' complement of sum of all bytes after S-type)
    let sum = 0;
    for (let b = 0; b < (byteCount + 1) * 2; b += 2) sum += parseInt(hex.substring(b, b + 2), 16);
    if ((sum & 0xFF) !== 0xFF) {
      errors.push(`Line ${i+1}: checksum error`);
    }

    recordCount++;

    const addrHex = hex.substring(2, 2 + info.addrLen * 2);
    const address = parseInt(addrHex, 16);

    if (type === 'S0') {
      // Header record — data is ASCII text
      const dataStart = 2 + info.addrLen * 2;
      const dataHex = hex.substring(dataStart, dataStart + totalDataLen * 2);
      let headerText = '';
      for (let b = 0; b < dataHex.length; b += 2) headerText += String.fromCharCode(parseInt(dataHex.substring(b, b + 2), 16));
      header = headerText;
    } else if (info.isData && totalDataLen > 0) {
      const dataStart = 2 + info.addrLen * 2;
      const data = new Uint8Array(totalDataLen);
      for (let b = 0; b < totalDataLen; b++) data[b] = parseInt(hex.substring(dataStart + b*2, dataStart + b*2 + 2), 16);
      segments.push({ address, data });
      if (address < minAddr) minAddr = address;
      if (address + totalDataLen > maxAddr) maxAddr = address + totalDataLen;
    } else if (type === 'S7' || type === 'S8' || type === 'S9') {
      entryPoint = address;
    }
  }

  if (minAddr === Infinity) {
    return { data: new Uint8Array(0), startAddress: 0, endAddress: 0, entryPoint, header, errors, records: recordCount };
  }

  const size = maxAddr - minAddr;
  const data = new Uint8Array(size);
  data.fill(0xFF);
  for (const seg of segments) data.set(seg.data, seg.address - minAddr);

  return { data, startAddress: minAddr, endAddress: maxAddr, entryPoint, header, errors, records: recordCount };
}

/**
 * Generate Motorola S-Record from binary data
 * @param {Uint8Array} data - Binary data
 * @param {number} startAddress - Base address (default 0)
 * @param {number} bytesPerLine - Bytes per data record (default 16, max 250)
 * @param {string} header - Optional header string for S0 record
 * @returns {string} S-Record file content
 */
export function generateSRecord(data, startAddress = 0, bytesPerLine = 16, header = 'ECU_DATA') {
  const lines = [];

  // S0 Header
  const headerBytes = new TextEncoder().encode(header);
  const s0Data = Array.from(headerBytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  const s0ByteCount = 2 + headerBytes.length + 1; // addr(2) + data + checksum
  const s0Body = `${s0ByteCount.toString(16).toUpperCase().padStart(2, '0')}0000${s0Data}`;
  lines.push(`S0${s0Body}${srecChecksum(s0Body)}`);

  // Determine record type based on address range
  const endAddr = startAddress + data.length;
  let recType, addrLen;
  if (endAddr <= 0xFFFF) { recType = 'S1'; addrLen = 2; }
  else if (endAddr <= 0xFFFFFF) { recType = 'S2'; addrLen = 3; }
  else { recType = 'S3'; addrLen = 4; }

  let dataRecords = 0;
  for (let offset = 0; offset < data.length; offset += bytesPerLine) {
    const addr = startAddress + offset;
    const count = Math.min(bytesPerLine, data.length - offset);
    const byteCount = addrLen + count + 1; // addr + data + checksum

    const addrHex = addr.toString(16).toUpperCase().padStart(addrLen * 2, '0');
    let dataHex = '';
    for (let i = 0; i < count; i++) dataHex += data[offset + i].toString(16).toUpperCase().padStart(2, '0');

    const recBody = `${byteCount.toString(16).toUpperCase().padStart(2, '0')}${addrHex}${dataHex}`;
    lines.push(`${recType}${recBody}${srecChecksum(recBody)}`);
    dataRecords++;
  }

  // S5 Record count
  if (dataRecords <= 0xFFFF) {
    const s5Body = `03${dataRecords.toString(16).toUpperCase().padStart(4, '0')}`;
    lines.push(`S5${s5Body}${srecChecksum(s5Body)}`);
  }

  // End record
  const endType = recType === 'S1' ? 'S9' : recType === 'S2' ? 'S8' : 'S7';
  const endAddrHex = startAddress.toString(16).toUpperCase().padStart(addrLen * 2, '0');
  const endByteCount = addrLen + 1;
  const endBody = `${endByteCount.toString(16).toUpperCase().padStart(2, '0')}${endAddrHex}`;
  lines.push(`${endType}${endBody}${srecChecksum(endBody)}`);

  return lines.join('\n') + '\n';
}

function srecChecksum(hexBody) {
  let sum = 0;
  for (let i = 0; i < hexBody.length; i += 2) sum += parseInt(hexBody.substring(i, i + 2), 16);
  return ((~sum) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}


// ─── Format Detection ─────────────────────────────────────────────────────

/**
 * Detect file format from content
 * @param {string|Uint8Array} content
 * @returns {{format: string, confidence: number, details: object}}
 */
export function detectFormat(content) {
  if (content instanceof Uint8Array) {
    // Check for known binary signatures
    if (content.length >= 2) {
      // Motorola S19 starts with 'S' (0x53)
      if (content[0] === 0x53 && (content[1] >= 0x30 && content[1] <= 0x39)) {
        return { format: 'srec', confidence: 0.9, details: { note: 'Starts with S-record marker' } };
      }
      // Intel HEX starts with ':' (0x3A)
      if (content[0] === 0x3A) {
        return { format: 'ihex', confidence: 0.9, details: { note: 'Starts with Intel HEX colon' } };
      }
    }
    return { format: 'bin', confidence: 1.0, details: { size: content.length } };
  }

  const str = typeof content === 'string' ? content : '';
  const trimmed = str.trim();

  if (trimmed.startsWith(':')) {
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim().startsWith(':'));
    return { format: 'ihex', confidence: lines.length > 0 ? 0.95 : 0.5, details: { recordLines: lines.length } };
  }

  if (/^S[0-9]/m.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/).filter(l => /^S[0-9]/.test(l.trim()));
    return { format: 'srec', confidence: lines.length > 0 ? 0.95 : 0.5, details: { recordLines: lines.length } };
  }

  return { format: 'unknown', confidence: 0, details: { note: 'Could not detect format' } };
}


// ─── High-Level Conversion Functions ──────────────────────────────────────

/**
 * Convert between formats
 * @param {string|Uint8Array} input - Input file content
 * @param {string} fromFormat - Source format: 'ihex', 'srec', 'bin'
 * @param {string} toFormat - Target format: 'ihex', 'srec', 'bin'
 * @param {object} options - {startAddress, bytesPerLine, header, fillByte}
 * @returns {{output: string|Uint8Array, metadata: object, errors: string[]}}
 */
export function convertFile(input, fromFormat, toFormat, options = {}) {
  const { startAddress = 0, bytesPerLine = 16, header = 'ECU_DATA', fillByte = 0xFF } = options;

  if (fromFormat === toFormat) {
    return { output: input, metadata: { note: 'Same format, no conversion needed' }, errors: [] };
  }

  // Step 1: Parse input to binary
  let data, meta;
  switch (fromFormat) {
    case 'ihex': {
      const parsed = parseIntelHex(typeof input === 'string' ? input : new TextDecoder().decode(input));
      data = parsed.data;
      meta = { startAddress: parsed.startAddress, endAddress: parsed.endAddress, entryPoint: parsed.entryPoint, records: parsed.records, parseErrors: parsed.errors };
      break;
    }
    case 'srec': {
      const parsed = parseSRecord(typeof input === 'string' ? input : new TextDecoder().decode(input));
      data = parsed.data;
      meta = { startAddress: parsed.startAddress, endAddress: parsed.endAddress, entryPoint: parsed.entryPoint, header: parsed.header, records: parsed.records, parseErrors: parsed.errors };
      break;
    }
    case 'bin': {
      data = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
      meta = { startAddress, size: data.length };
      break;
    }
    default:
      return { output: null, metadata: {}, errors: [`Unknown source format: ${fromFormat}`] };
  }

  const baseAddr = meta.startAddress || startAddress;

  // Step 2: Generate output format
  let output;
  switch (toFormat) {
    case 'ihex':
      output = generateIntelHex(data, baseAddr, bytesPerLine);
      break;
    case 'srec':
      output = generateSRecord(data, baseAddr, bytesPerLine, header);
      break;
    case 'bin':
      output = data;
      break;
    default:
      return { output: null, metadata: meta, errors: [`Unknown target format: ${toFormat}`] };
  }

  return {
    output,
    metadata: {
      ...meta,
      sourceFormat: fromFormat,
      targetFormat: toFormat,
      binarySize: data.length,
      outputSize: typeof output === 'string' ? output.length : output.length,
    },
    errors: meta.parseErrors || [],
  };
}

/**
 * Validate a hex file and return detailed report
 * @param {string} content - File content (Intel HEX or S-Record)
 * @returns {{valid: boolean, format: string, records: number, dataSize: number, addressRange: object, entryPoint: number|null, errors: string[], warnings: string[]}}
 */
export function validateHexFile(content) {
  const detected = detectFormat(content);
  const warnings = [];

  if (detected.format === 'ihex') {
    const parsed = parseIntelHex(content);
    const gaps = findAddressGaps(content, 'ihex');
    if (gaps.length > 0) warnings.push(`${gaps.length} address gap(s) found`);
    return {
      valid: parsed.errors.length === 0,
      format: 'Intel HEX',
      records: parsed.records,
      dataSize: parsed.data.length,
      addressRange: { start: '0x' + parsed.startAddress.toString(16).toUpperCase(), end: '0x' + parsed.endAddress.toString(16).toUpperCase() },
      entryPoint: parsed.entryPoint,
      errors: parsed.errors,
      warnings,
      gaps,
    };
  }

  if (detected.format === 'srec') {
    const parsed = parseSRecord(content);
    const gaps = findAddressGaps(content, 'srec');
    if (gaps.length > 0) warnings.push(`${gaps.length} address gap(s) found`);
    return {
      valid: parsed.errors.length === 0,
      format: 'Motorola S-Record',
      records: parsed.records,
      dataSize: parsed.data.length,
      addressRange: { start: '0x' + parsed.startAddress.toString(16).toUpperCase(), end: '0x' + parsed.endAddress.toString(16).toUpperCase() },
      entryPoint: parsed.entryPoint,
      header: parsed.header,
      errors: parsed.errors,
      warnings,
      gaps,
    };
  }

  return { valid: false, format: 'unknown', records: 0, dataSize: 0, addressRange: {}, entryPoint: null, errors: ['Unrecognized file format'], warnings: [] };
}

/**
 * Find address gaps in hex file (regions not covered by data records)
 */
function findAddressGaps(content, format) {
  const gaps = [];
  let regions = [];

  if (format === 'ihex') {
    const lines = content.split(/\r?\n/).filter(l => l.trim().startsWith(':'));
    let baseAddress = 0;
    for (const line of lines) {
      const hex = line.trim().substring(1);
      const byteCount = parseInt(hex.substring(0, 2), 16);
      const address   = parseInt(hex.substring(2, 6), 16);
      const recType   = parseInt(hex.substring(6, 8), 16);
      if (recType === 0x04) baseAddress = parseInt(hex.substring(8, 12), 16) << 16;
      else if (recType === 0x02) baseAddress = parseInt(hex.substring(8, 12), 16) << 4;
      else if (recType === 0x00) regions.push({ start: baseAddress + address, end: baseAddress + address + byteCount });
    }
  } else if (format === 'srec') {
    const lines = content.split(/\r?\n/).filter(l => /^S[123]/i.test(l.trim()));
    for (const line of lines) {
      const type = line.trim().substring(0, 2).toUpperCase();
      const hex = line.trim().substring(2);
      const byteCount = parseInt(hex.substring(0, 2), 16);
      const info = SREC_TYPES[type];
      if (!info || !info.isData) continue;
      const address = parseInt(hex.substring(2, 2 + info.addrLen * 2), 16);
      const dataLen = byteCount - info.addrLen - 1;
      regions.push({ start: address, end: address + dataLen });
    }
  }

  // Sort by start address and find gaps
  regions.sort((a, b) => a.start - b.start);
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].start > regions[i-1].end) {
      gaps.push({
        from: '0x' + regions[i-1].end.toString(16).toUpperCase(),
        to: '0x' + regions[i].start.toString(16).toUpperCase(),
        size: regions[i].start - regions[i-1].end,
      });
    }
  }

  return gaps;
}

/**
 * Compare two hex/bin files and produce a diff report
 */
export function compareFiles(file1, format1, file2, format2) {
  // Parse both to binary
  let data1, data2, meta1, meta2;

  if (format1 === 'bin') { data1 = file1 instanceof Uint8Array ? file1 : new Uint8Array(0); meta1 = { startAddress: 0 }; }
  else if (format1 === 'ihex') { const p = parseIntelHex(typeof file1 === 'string' ? file1 : new TextDecoder().decode(file1)); data1 = p.data; meta1 = p; }
  else { const p = parseSRecord(typeof file1 === 'string' ? file1 : new TextDecoder().decode(file1)); data1 = p.data; meta1 = p; }

  if (format2 === 'bin') { data2 = file2 instanceof Uint8Array ? file2 : new Uint8Array(0); meta2 = { startAddress: 0 }; }
  else if (format2 === 'ihex') { const p = parseIntelHex(typeof file2 === 'string' ? file2 : new TextDecoder().decode(file2)); data2 = p.data; meta2 = p; }
  else { const p = parseSRecord(typeof file2 === 'string' ? file2 : new TextDecoder().decode(file2)); data2 = p.data; meta2 = p; }

  const minLen = Math.min(data1.length, data2.length);
  const maxLen = Math.max(data1.length, data2.length);
  const diffs = [];
  let diffBytes = 0;
  let inDiff = false;
  let diffStart = 0;

  for (let i = 0; i <= maxLen; i++) {
    const b1 = i < data1.length ? data1[i] : undefined;
    const b2 = i < data2.length ? data2[i] : undefined;
    const isDiff = b1 !== b2;

    if (isDiff && !inDiff) { inDiff = true; diffStart = i; }
    if ((!isDiff || i === maxLen) && inDiff) {
      inDiff = false;
      const len = i - diffStart;
      diffBytes += len;
      if (diffs.length < 100) { // Cap at 100 diff regions
        diffs.push({
          offset: '0x' + diffStart.toString(16).toUpperCase(),
          length: len,
          file1: len <= 32 ? Array.from(data1.slice(diffStart, diffStart + len)).map(b => b?.toString(16).toUpperCase().padStart(2, '0') || '--').join(' ') : `(${len} bytes)`,
          file2: len <= 32 ? Array.from(data2.slice(diffStart, diffStart + len)).map(b => b?.toString(16).toUpperCase().padStart(2, '0') || '--').join(' ') : `(${len} bytes)`,
        });
      }
    }
    if (isDiff) diffBytes++;
  }

  return {
    file1: { format: format1, size: data1.length, startAddress: meta1.startAddress || 0 },
    file2: { format: format2, size: data2.length, startAddress: meta2.startAddress || 0 },
    identical: diffBytes === 0,
    diffRegions: diffs.length,
    totalDiffBytes: diffBytes,
    diffPercentage: maxLen > 0 ? ((diffBytes / maxLen) * 100).toFixed(2) + '%' : '0%',
    diffs: diffs.slice(0, 50), // Return first 50
  };
}

// ─── Supported Formats Reference ──────────────────────────────────────────

export const SUPPORTED_FORMATS = {
  ihex: {
    name: 'Intel HEX',
    extensions: ['.hex', '.ihex', '.h86', '.hxl', '.hxh', '.obh'],
    description: 'Standard format for microcontroller firmware. Used by most ECU flash tools.',
    features: ['Checksum per record', 'Extended addressing (16/32-bit)', 'Entry point support'],
  },
  srec: {
    name: 'Motorola S-Record',
    extensions: ['.s19', '.s28', '.s37', '.srec', '.mot', '.sx'],
    description: 'Motorola format common in automotive ECUs. Header record for metadata.',
    features: ['Checksum per record', 'Multiple address widths (S1/S2/S3)', 'Header record', 'Record count validation'],
  },
  bin: {
    name: 'Raw Binary',
    extensions: ['.bin', '.rom', '.raw', '.img', '.ori', '.mod'],
    description: 'Raw binary image. No address info or checksums — just the bytes.',
    features: ['Direct memory image', 'No overhead', 'Requires known base address'],
  },
};

export function listFormats() {
  return Object.entries(SUPPORTED_FORMATS).map(([id, f]) => ({ id, ...f }));
}
