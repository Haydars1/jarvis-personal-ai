// Extended ECU Checksum Algorithms
// Covers: Siemens/Continental, Delphi, Marelli, Denso, generic CRC variants
// Complements ecu-checksum.js (Bosch MED17/EDC17)

// ─── CRC Tables ────────────────────────────────────────────────────────────

// Standard CRC32 table (ISO 3309 / ITU-T V.42)
const CRC32_TABLE = new Uint32Array(256);
(function buildCRC32() {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC32_TABLE[i] = c >>> 0;
  }
})();

// CRC16-CCITT table (poly 0x1021, init 0xFFFF)
const CRC16_TABLE = new Uint16Array(256);
(function buildCRC16() {
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    CRC16_TABLE[i] = crc & 0xFFFF;
  }
})();

// ─── Core Algorithms ───────────────────────────────────────────────────────

/**
 * Standard CRC32 over a byte range
 */
export function crc32(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let crc = 0xFFFFFFFF;
  for (let i = offset; i < offset + len; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * CRC16-CCITT over a byte range
 */
export function crc16(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let crc = 0xFFFF;
  for (let i = offset; i < offset + len; i++) {
    crc = ((crc << 8) ^ CRC16_TABLE[((crc >>> 8) ^ buf[i]) & 0xFF]) & 0xFFFF;
  }
  return crc;
}

/**
 * ADD32 — sum of 32-bit big-endian words
 */
export function add32(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let sum = 0;
  for (let i = offset; i < offset + len - 3; i += 4) {
    sum = (sum + ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3])) >>> 0;
  }
  return sum;
}

/**
 * ADD32 — sum of 32-bit little-endian words
 */
export function add32le(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let sum = 0;
  for (let i = offset; i < offset + len - 3; i += 4) {
    sum = (sum + ((buf[i+3] << 24) | (buf[i+2] << 16) | (buf[i+1] << 8) | buf[i])) >>> 0;
  }
  return sum;
}

/**
 * ADD16 — sum of 16-bit big-endian words
 */
export function add16(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let sum = 0;
  for (let i = offset; i < offset + len - 1; i += 2) {
    sum = (sum + ((buf[i] << 8) | buf[i+1])) & 0xFFFF;
  }
  return sum;
}

/**
 * ADD16 — sum of 16-bit little-endian words
 */
export function add16le(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let sum = 0;
  for (let i = offset; i < offset + len - 1; i += 2) {
    sum = (sum + ((buf[i+1] << 8) | buf[i])) & 0xFFFF;
  }
  return sum;
}

/**
 * XOR32 — XOR of 32-bit big-endian words
 */
export function xor32(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  let result = 0;
  for (let i = offset; i < offset + len - 3; i += 4) {
    result = (result ^ ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3])) >>> 0;
  }
  return result;
}

// ─── ECU-Specific Checksum Implementations ─────────────────────────────────

/**
 * Siemens/Continental SID803/806 checksum
 * CRC16 over each calibration zone, stored at zone end - 2
 */
export function siemensChecksum(data, zones) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const results = [];
  for (const zone of zones) {
    const { start, end, checksumOffset } = zone;
    const csOff = checksumOffset || (end - 2);
    // Read stored checksum (LE)
    const stored = (buf[csOff + 1] << 8) | buf[csOff];
    // Compute CRC16 excluding the checksum bytes
    let computed;
    if (csOff === end - 2) {
      computed = crc16(buf, start, end - start - 2);
    } else {
      // Split around checksum location
      const part1 = crc16(buf, start, csOff - start);
      // Continue from after checksum to end
      const part2Buf = new Uint8Array(end - csOff - 2);
      part2Buf.set(buf.subarray(csOff + 2, end));
      // Chain CRC
      let crc = part1;
      for (let i = 0; i < part2Buf.length; i++) {
        crc = ((crc << 8) ^ CRC16_TABLE[((crc >>> 8) ^ part2Buf[i]) & 0xFF]) & 0xFFFF;
      }
      computed = crc;
    }
    results.push({
      zone: `0x${start.toString(16).toUpperCase()}-0x${end.toString(16).toUpperCase()}`,
      stored, computed,
      valid: stored === computed,
      checksumOffset: csOff,
      algorithm: 'CRC16-CCITT',
    });
  }
  return results;
}

/**
 * Siemens SIMOS18/PCR2.1 checksum — block-level CRC32
 */
export function simosChecksum(data, blocks) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const results = [];
  for (const block of blocks) {
    const { start, end, checksumOffset } = block;
    const csOff = checksumOffset || (end - 4);
    // Read stored CRC32 (LE)
    const stored = ((buf[csOff+3] << 24) | (buf[csOff+2] << 16) | (buf[csOff+1] << 8) | buf[csOff]) >>> 0;
    const computed = crc32(buf, start, csOff - start);
    results.push({
      block: `0x${start.toString(16).toUpperCase()}-0x${end.toString(16).toUpperCase()}`,
      stored, computed,
      valid: stored === computed,
      checksumOffset: csOff,
      algorithm: 'CRC32',
    });
  }
  return results;
}

/**
 * Delphi DCM3.5/6.2 checksum — ADD32 with complement
 * Each calibration block has an ADD32 checksum at a known offset
 * Expected sum of all 32-bit words in the block including checksum = 0x00000000
 */
export function delphiChecksum(data, blocks) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const results = [];
  for (const block of blocks) {
    const { start, end, checksumOffset } = block;
    const csOff = checksumOffset || (end - 4);
    // Stored checksum (BE)
    const stored = ((buf[csOff] << 24) | (buf[csOff+1] << 16) | (buf[csOff+2] << 8) | buf[csOff+3]) >>> 0;
    // Sum all words EXCEPT checksum position
    let sum = 0;
    for (let i = start; i < end; i += 4) {
      if (i === csOff) continue;
      sum = (sum + ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3])) >>> 0;
    }
    // Expected checksum = two's complement of sum
    const expected = ((~sum) + 1) >>> 0;
    // Validate: sum of all words including checksum should be 0
    const totalSum = (sum + stored) >>> 0;
    results.push({
      block: `0x${start.toString(16).toUpperCase()}-0x${end.toString(16).toUpperCase()}`,
      stored, expected,
      valid: totalSum === 0,
      checksumOffset: csOff,
      algorithm: 'ADD32-COMPLEMENT',
    });
  }
  return results;
}

/**
 * Marelli MJD/IAW checksum — ADD16 with two's complement
 */
export function marelliChecksum(data, blocks) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const results = [];
  for (const block of blocks) {
    const { start, end, checksumOffset } = block;
    const csOff = checksumOffset || (end - 2);
    // Stored (LE)
    const stored = (buf[csOff+1] << 8) | buf[csOff];
    // Sum 16-bit LE words excluding checksum
    let sum = 0;
    for (let i = start; i < end; i += 2) {
      if (i === csOff) continue;
      sum = (sum + ((buf[i+1] << 8) | buf[i])) & 0xFFFF;
    }
    const expected = ((~sum) + 1) & 0xFFFF;
    const totalSum = (sum + stored) & 0xFFFF;
    results.push({
      block: `0x${start.toString(16).toUpperCase()}-0x${end.toString(16).toUpperCase()}`,
      stored, expected,
      valid: totalSum === 0,
      checksumOffset: csOff,
      algorithm: 'ADD16-COMPLEMENT',
    });
  }
  return results;
}

/**
 * Denso SH7058 checksum (Subaru) — ADD32 table-based
 * Multiple checksum tables, each with start/end pairs and a stored sum
 * Sum of all 32-bit words in each range equals the stored value
 */
export function densoChecksum(data, tables) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const results = [];
  for (const table of tables) {
    const { ranges, checksumOffset } = table;
    const csOff = checksumOffset;
    // Stored checksum (BE)
    const stored = ((buf[csOff] << 24) | (buf[csOff+1] << 16) | (buf[csOff+2] << 8) | buf[csOff+3]) >>> 0;
    // Sum all ranges
    let totalSum = 0;
    for (const range of ranges) {
      totalSum = (totalSum + add32(buf, range.start, range.end - range.start)) >>> 0;
    }
    results.push({
      ranges: ranges.map(r => `0x${r.start.toString(16).toUpperCase()}-0x${r.end.toString(16).toUpperCase()}`),
      stored, computed: totalSum,
      valid: stored === totalSum,
      checksumOffset: csOff,
      algorithm: 'ADD32-TABLE',
    });
  }
  return results;
}

// ─── Auto-Detect & Validate ────────────────────────────────────────────────

/**
 * Detect checksum algorithm from ECU type string
 */
export function detectChecksumAlgo(ecuType) {
  const et = (ecuType || '').toLowerCase();
  if (/med17|edc17|mg1|md1|mevd17/.test(et)) return { vendor: 'bosch', algo: 'bosch-tricore', module: 'ecu-checksum.js' };
  if (/me7|med9|edc16/.test(et)) return { vendor: 'bosch', algo: 'add16-multipoint', module: 'ecu-checksum.js' };
  if (/sid803|sid806|sid208/.test(et)) return { vendor: 'siemens', algo: 'crc16-zone', fn: 'siemensChecksum' };
  if (/simos18|simos12|pcr2/.test(et)) return { vendor: 'siemens', algo: 'crc32-block', fn: 'simosChecksum' };
  if (/dcm3|dcm6|dcm7/.test(et)) return { vendor: 'delphi', algo: 'add32-complement', fn: 'delphiChecksum' };
  if (/mjd|iaw|8g[a-z]f/.test(et)) return { vendor: 'marelli', algo: 'add16-complement', fn: 'marelliChecksum' };
  if (/sh705[0-9]|76f00/.test(et)) return { vendor: 'denso', algo: 'add32-table', fn: 'densoChecksum' };
  return { vendor: 'unknown', algo: 'unknown', fn: null };
}

/**
 * List all available checksum algorithms with descriptions
 */
export function listChecksumAlgorithms() {
  return [
    { id: 'bosch-tricore', vendor: 'Bosch', ecuTypes: ['MED17', 'EDC17', 'MG1', 'MD1', 'MEVD17'], description: 'Block-based ADD32/CRC32 with TriCore flash layout. Scans for FADECAFE/CAFEAFFE magic markers.', capabilities: ['validate', 'correct-add32'], module: 'ecu-checksum.js' },
    { id: 'bosch-me7', vendor: 'Bosch', ecuTypes: ['ME7', 'MED9', 'EDC16'], description: 'Multi-point ADD16 checksum across calibration data zones.', capabilities: ['validate', 'correct'], module: 'ecu-checksum.js' },
    { id: 'crc16-zone', vendor: 'Siemens/Continental', ecuTypes: ['SID803', 'SID806', 'SID208'], description: 'CRC16-CCITT per calibration zone, stored at zone boundary.', capabilities: ['validate', 'correct'] },
    { id: 'crc32-block', vendor: 'Siemens/Continental', ecuTypes: ['SIMOS18', 'SIMOS12', 'PCR2.1'], description: 'CRC32 per flash block with block-level validation.', capabilities: ['validate', 'correct'] },
    { id: 'add32-complement', vendor: 'Delphi', ecuTypes: ['DCM3.5', 'DCM6.2', 'DCM7'], description: "ADD32 two's complement — sum of all block words including checksum equals zero.", capabilities: ['validate', 'correct'] },
    { id: 'add16-complement', vendor: 'Marelli', ecuTypes: ['MJD6F3', 'IAW5SF', '8GMF'], description: "ADD16 two's complement checksum for calibration blocks.", capabilities: ['validate', 'correct'] },
    { id: 'add32-table', vendor: 'Denso', ecuTypes: ['SH7058', '76F00xx'], description: 'Table-driven ADD32 with multiple range definitions per checksum entry.', capabilities: ['validate', 'correct'] },
    { id: 'crc32', vendor: 'Generic', ecuTypes: [], description: 'Standard CRC32 (ISO 3309) over arbitrary range.', capabilities: ['compute'] },
    { id: 'crc16', vendor: 'Generic', ecuTypes: [], description: 'CRC16-CCITT (poly 0x1021, init 0xFFFF) over arbitrary range.', capabilities: ['compute'] },
    { id: 'add32', vendor: 'Generic', ecuTypes: [], description: 'Simple 32-bit word sum (big-endian).', capabilities: ['compute'] },
    { id: 'add16', vendor: 'Generic', ecuTypes: [], description: 'Simple 16-bit word sum (big-endian).', capabilities: ['compute'] },
    { id: 'xor32', vendor: 'Generic', ecuTypes: [], description: 'XOR of 32-bit big-endian words.', capabilities: ['compute'] },
  ];
}

/**
 * Compute a generic checksum over a range
 */
export function computeChecksum(algo, data, offset = 0, length = null) {
  switch (algo) {
    case 'crc32': return { algorithm: 'CRC32', value: crc32(data, offset, length) };
    case 'crc16': return { algorithm: 'CRC16', value: crc16(data, offset, length) };
    case 'add32': return { algorithm: 'ADD32', value: add32(data, offset, length) };
    case 'add32le': return { algorithm: 'ADD32-LE', value: add32le(data, offset, length) };
    case 'add16': return { algorithm: 'ADD16', value: add16(data, offset, length) };
    case 'add16le': return { algorithm: 'ADD16-LE', value: add16le(data, offset, length) };
    case 'xor32': return { algorithm: 'XOR32', value: xor32(data, offset, length) };
    default: return { algorithm: algo, error: 'Unknown algorithm' };
  }
}

/**
 * Correct a complement-style checksum in-place
 * Returns the corrected checksum value written
 */
export function correctComplement(data, block, bits = 32) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const { start, end, checksumOffset } = block;
  const csOff = checksumOffset || (bits === 16 ? end - 2 : end - 4);

  if (bits === 16) {
    let sum = 0;
    for (let i = start; i < end; i += 2) {
      if (i === csOff) continue;
      sum = (sum + ((buf[i+1] << 8) | buf[i])) & 0xFFFF;
    }
    const corrected = ((~sum) + 1) & 0xFFFF;
    buf[csOff] = corrected & 0xFF;
    buf[csOff + 1] = (corrected >> 8) & 0xFF;
    return corrected;
  }

  // 32-bit
  let sum = 0;
  for (let i = start; i < end; i += 4) {
    if (i === csOff) continue;
    sum = (sum + ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3])) >>> 0;
  }
  const corrected = ((~sum) + 1) >>> 0;
  buf[csOff] = (corrected >> 24) & 0xFF;
  buf[csOff + 1] = (corrected >> 16) & 0xFF;
  buf[csOff + 2] = (corrected >> 8) & 0xFF;
  buf[csOff + 3] = corrected & 0xFF;
  return corrected;
}

// ─── Binary Analysis Helpers ───────────────────────────────────────────────

/**
 * Compute entropy of a byte buffer (Shannon entropy, 0..8)
 */
export function computeEntropy(data, offset = 0, length = null) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const len = length !== null ? length : buf.length - offset;
  if (len <= 0) return 0;

  const freq = new Uint32Array(256);
  for (let i = offset; i < offset + len; i++) freq[buf[i]]++;

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Entropy map — compute entropy in sliding windows across the file
 */
export function entropyMap(data, windowSize = 256) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const points = [];
  const step = Math.max(1, Math.floor(buf.length / 512)); // max 512 points
  for (let i = 0; i < buf.length - windowSize; i += step) {
    points.push({ offset: i, entropy: +computeEntropy(buf, i, windowSize).toFixed(3) });
  }
  return points;
}

/**
 * Extract printable ASCII strings from binary data
 */
export function extractStrings(data, minLength = 4) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const strings = [];
  let current = '';
  let startOffset = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 0x20 && c < 0x7F) {
      if (current.length === 0) startOffset = i;
      current += String.fromCharCode(c);
    } else {
      if (current.length >= minLength) {
        strings.push({ offset: startOffset, value: current, length: current.length });
      }
      current = '';
    }
  }
  if (current.length >= minLength) {
    strings.push({ offset: startOffset, value: current, length: current.length });
  }
  return strings;
}

/**
 * Detect binary sections by entropy and byte patterns
 */
export function detectSections(data) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const sections = [];
  const windowSize = 4096;
  let prevEntropy = -1;
  let sectionStart = 0;
  let sectionType = 'unknown';

  for (let i = 0; i < buf.length; i += windowSize) {
    const len = Math.min(windowSize, buf.length - i);
    const entropy = computeEntropy(buf, i, len);

    // Classify by entropy
    let type;
    if (entropy < 0.5) type = 'empty/padding';
    else if (entropy < 3.0) type = 'data/tables';
    else if (entropy < 5.0) type = 'code';
    else if (entropy < 7.0) type = 'compressed/mixed';
    else type = 'encrypted/random';

    if (type !== sectionType && i > 0) {
      sections.push({
        start: sectionStart,
        end: i,
        size: i - sectionStart,
        type: sectionType,
        avgEntropy: +(((prevEntropy + entropy) / 2).toFixed(2)),
      });
      sectionStart = i;
    }
    sectionType = type;
    prevEntropy = entropy;
  }

  // Final section
  if (sectionStart < buf.length) {
    sections.push({
      start: sectionStart,
      end: buf.length,
      size: buf.length - sectionStart,
      type: sectionType,
      avgEntropy: +(prevEntropy.toFixed(2)),
    });
  }

  return sections;
}

/**
 * Full binary analysis report
 */
export function analyzeBinary(data) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const totalEntropy = computeEntropy(buf);
  const sections = detectSections(buf);
  const strings = extractStrings(buf, 6);

  // Byte frequency histogram (top 20 most common)
  const freq = new Uint32Array(256);
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
  const byteFreq = [];
  for (let i = 0; i < 256; i++) {
    byteFreq.push({ byte: i, hex: '0x' + i.toString(16).toUpperCase().padStart(2, '0'), count: freq[i], pct: +((freq[i] / buf.length) * 100).toFixed(2) });
  }
  byteFreq.sort((a, b) => b.count - a.count);

  // Fill detection
  const fillByte = byteFreq[0];
  const fillPct = fillByte.pct;

  // Interesting strings (ECU-related keywords)
  const ecuKeywords = /bosch|siemens|continental|delphi|denso|marelli|med17|edc17|simos|sid|dcm|mjd|iaw|tricore|tc17|sh705/i;
  const interestingStrings = strings.filter(s => ecuKeywords.test(s.value)).slice(0, 50);

  return {
    fileSize: buf.length,
    fileSizeHex: '0x' + buf.length.toString(16).toUpperCase(),
    totalEntropy: +totalEntropy.toFixed(3),
    entropyClass: totalEntropy < 3 ? 'low (mostly data/tables)' : totalEntropy < 5 ? 'medium (mixed code/data)' : totalEntropy < 7 ? 'high (compressed/code)' : 'very high (encrypted/random)',
    sections: sections.slice(0, 64),
    sectionSummary: {
      totalSections: sections.length,
      byType: sections.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + s.size; return acc; }, {}),
    },
    fillByte: { ...fillByte, fillPct },
    topBytes: byteFreq.slice(0, 20),
    strings: {
      total: strings.length,
      ecuRelated: interestingStrings,
      sample: strings.slice(0, 100),
    },
  };
}
