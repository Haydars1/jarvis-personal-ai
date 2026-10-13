// ECU Checksum Module — MED17/EDC17 TriCore block checksum system
// Port of medc17-checksum-tool (Connor Howell, MIT License 2025)
// Handles: block scanning, CRC32/ADD32/ADD16 calculation + correction,
// two-pass correction flow (ADD first, then CRC32 validation).
//
// CRC32 CORRECTION is deferred to v2 — requires RIPEMD-160 + Bleichenbacher
// signature forging + GF(2) matrix solver, too heavy for Cloudflare Workers.
// v1 corrects ADD32/ADD16 (Dataset/calibration blocks where DPF params live)
// and validates CRC32 (Application blocks).
//
// Target: Cloudflare Workers ESM — no Node.js Buffer, no 'struct', no 'hashlib'.

// ─── Constants ───────────────────────────────────────────────────────────────

const MEDC17_MAGIC_A    = 0xFADECAFE;   // checksum seed — at block_start + 64
const MEDC17_MAGIC_B    = 0xCAFEAFFE;   // expected value — at block_start + 68
const MEDC17_MAGIC_OFFSET = 64;         // distance from block start to magic word A

// Block class byte at block_start + 15
const MEDC17_BLOCK_CLASSES = new Set([0x80, 0xA0]); // 0x80 = application, 0xA0 = data/cal

// Block identifiers — byte 0 of the block header
const BLOCK_IDENTIFIERS = {
  0x10: 'Startup Block',
  0x20: 'Tuning protection',
  0x30: 'Customer Block',
  0x40: 'Application software #0',
  0x50: 'Application software #1',
  0x60: 'Dataset #0',
  0x70: 'Dataset #1',
  0x80: 'Variant dataset',
  0x90: 'Customer Tuning protection',
  0xA0: 'Application software #2',
  0xB0: 'Application software #3',
  0xC0: 'Absolute constants #0',
  0xD0: 'Emulation extension chip',
  0xE0: 'Customer specific',
  0xF0: 'Ramloader',
  0xF1: 'Application Attestation',
};

// Algorithm IDs in checksum structures
const ALGO_CRC32 = 0x00;
const ALGO_ADD32 = 0x01;
const ALGO_ADD16 = 0x10;

const ALGO_NAMES = { [ALGO_CRC32]: 'CRC32', [ALGO_ADD32]: 'ADD32', [ALGO_ADD16]: 'ADD16' };

// TriCore flash segment mask — strips the segment nibble so 0x80 and 0xA0 aliases resolve identically
const FLASH_SEGMENT_MASK = 0x0FFFFFFF;

// "Not programmed" fill words — unprogrammed partitions use these instead of computed checksums
const BLANK_WORDS = new Set([0xFFFFFFFF, 0xAFAFAFAF]);

// DEADBEEF block terminator
const DEADBEEF = 0xDEADBEEF;

// Checksum structure size in bytes
const CS_STRUCT_SIZE = 32;

// CRC32 pass value — complement of CAFEAFFE
const CRC32_PASS = 0x35015001;

// ─── CRC32 Table ─────────────────────────────────────────────────────────────

let CRC32_TABLE = null;

function initCrc32Table() {
  if (CRC32_TABLE) return;
  CRC32_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
    }
    CRC32_TABLE[i] = crc;
  }
}

// Reverse CRC32 table — walks a CRC32 backward from the end of a region
let CRC32_REVERSE_TABLE = null;

function initCrc32ReverseTable() {
  if (CRC32_REVERSE_TABLE) return;
  initCrc32Table();
  CRC32_REVERSE_TABLE = new Uint32Array(256);
  for (let j = 0; j < 256; j++) {
    const fwd = CRC32_TABLE[j];
    CRC32_REVERSE_TABLE[fwd >>> 24] = ((fwd << 8) >>> 0) ^ j;
  }
}

// ─── Low-level Readers ───────────────────────────────────────────────────────

function readU32LE(data, offset) {
  if (offset + 4 > data.length) return 0;
  return (data[offset] | (data[offset+1] << 8) | (data[offset+2] << 16) | (data[offset+3] << 24)) >>> 0;
}

function readU16LE(data, offset) {
  if (offset + 2 > data.length) return 0;
  return data[offset] | (data[offset+1] << 8);
}

function writeU32LE(data, offset, value) {
  const v = value >>> 0;
  data[offset]     = v & 0xFF;
  data[offset + 1] = (v >>> 8) & 0xFF;
  data[offset + 2] = (v >>> 16) & 0xFF;
  data[offset + 3] = (v >>> 24) & 0xFF;
}

// ─── Flash Address Helpers ───────────────────────────────────────────────────

function flashCanonical(memAddr) {
  // Cached-segment form — 0x80 and 0xA0 aliases of same physical byte match
  return ((memAddr & FLASH_SEGMENT_MASK) | 0x80000000) >>> 0;
}

function isFlashAddr(addr) {
  // TriCore flash addresses live in 0x80000000-0xBFFFFFFF
  const top = (addr >>> 28) & 0xF;
  return top === 0x8 || top === 0x9 || top === 0xA || top === 0xB;
}

function memToFile(memAddr, blockStartMem, blockStartBin) {
  return (flashCanonical(memAddr) - flashCanonical(blockStartMem)) + blockStartBin;
}

// ─── Magic Pair Search ───────────────────────────────────────────────────────
// FADECAFE as LE bytes: CE CA DE FA,  CAFEAFFE as LE bytes: FE AF FE CA
// Combined 8-byte needle for the magic pair

function findMagicPair(data, startPos) {
  // Search for FADECAFE followed by CAFEAFFE in little-endian
  const len = data.length - 7;
  for (let i = startPos; i < len; i++) {
    if (data[i]     === 0xCE && data[i+1] === 0xCA &&
        data[i+2]   === 0xDE && data[i+3] === 0xFA &&
        data[i+4]   === 0xFE && data[i+5] === 0xAF &&
        data[i+6]   === 0xFE && data[i+7] === 0xCA) {
      return i;
    }
  }
  return -1;
}

// ─── Block Signature Validation ──────────────────────────────────────────────

function hasBlockSignature(data, hdr) {
  if (hdr < 0 || hdr + 72 > data.length) return false;
  return (
    (data[hdr] in BLOCK_IDENTIFIERS) &&
    data[hdr + 1] === 0x00 &&
    data[hdr + 3] === 0x00 &&
    MEDC17_BLOCK_CLASSES.has(data[hdr + 15])
  );
}

// ─── Checksum Structure Parsing ──────────────────────────────────────────────

function parseChecksumStructures(data, offset, count) {
  const structures = [];
  for (let i = 0; i < count; i++) {
    const so = offset + (i * CS_STRUCT_SIZE);
    if (so + CS_STRUCT_SIZE > data.length) break;

    structures.push({
      offset:         so,
      csBlockId:      data[so],
      csStart:        readU32LE(data, so + 4),
      csEnd:          readU32LE(data, so + 8),
      csStartVal:     readU32LE(data, so + 12),  // seed — usually 0xFADECAFE
      csExpectedVal:  readU32LE(data, so + 16),  // expected — usually 0xCAFEAFFE
      blockIdRef:     readU32LE(data, so + 20),
      blockIdAddr:    readU32LE(data, so + 24),
      csAlgorithm:    readU16LE(data, so + 28) & 0xFF,
      // filled by validation
      calculatedChecksum: null,
      isValid: null,
    });
  }
  return structures;
}

// ─── Block Parsing ───────────────────────────────────────────────────────────

function parseBlock(data, flatAddress) {
  if (flatAddress + 0x40 > data.length) return null;

  const blockIdentifier = readU32LE(data, flatAddress);
  const size = readU32LE(data, flatAddress + 4);
  const blockEnd = readU32LE(data, flatAddress + 12);

  const blockTypeId = blockIdentifier & 0xFF;
  if (!(blockTypeId in BLOCK_IDENTIFIERS)) return null;

  // minimum header size
  if (size < 0x40 || size > data.length || flatAddress + size > data.length) return null;

  // Blocks terminate with DEADBEEF
  const blockEndOffset = flatAddress + size - 4;
  if (readU32LE(data, blockEndOffset) !== DEADBEEF) return null;

  if (!isFlashAddr(blockEnd)) return null;

  // Software identifier at +0x1A (10 bytes)
  const swIdentifier = data.slice(flatAddress + 26, flatAddress + 36);

  // Number of checksum structures at +0x2C
  const numChecksumStructures = readU32LE(data, flatAddress + 0x2C);

  // DLL caps at 8
  if (numChecksumStructures < 1 || numChecksumStructures > 8) return null;

  // Block start memory address
  const blockStart = (((blockEnd + 5) - size - 1) >>> 0);
  if (!isFlashAddr(blockStart)) return null;

  const checksumAdjust = readU32LE(data, flatAddress + 0x30);

  const checksumStructures = parseChecksumStructures(
    data, flatAddress + 0x34, numChecksumStructures
  );

  const checksumOffset = flatAddress + 0x34 + (numChecksumStructures * CS_STRUCT_SIZE);
  const checksum = readU32LE(data, checksumOffset);
  const checksumComplement = (~checksum) >>> 0;

  const blockName = BLOCK_IDENTIFIERS[blockTypeId] || `Unknown (0x${blockTypeId.toString(16)})`;

  // Detect unprogrammed/reserved partitions — fill words in both checksum and adjust
  const isUnprogrammed = BLANK_WORDS.has(checksum) && BLANK_WORDS.has(checksumAdjust);

  return {
    binStart: flatAddress,
    binEnd: flatAddress + size - 1,
    blockStart,
    blockEnd: (blockEnd + 3) >>> 0,
    blockIdentifier,
    blockTypeId,
    blockName,
    size,
    swIdentifier,
    numChecksumStructures,
    checksumAdjust,
    checksum,
    checksumComplement,
    checksumStructures,
    isUnprogrammed,
  };
}

// ─── Block Scanner ───────────────────────────────────────────────────────────

export function findBoschBlocks(data) {
  const blocks = [];
  let search = 0;

  while (true) {
    const pos = findMagicPair(data, search);
    if (pos < 0) break;
    search = pos + 1; // overlapping matches

    const hdr = pos - MEDC17_MAGIC_OFFSET;
    if (!hasBlockSignature(data, hdr)) continue;

    const block = parseBlock(data, hdr);
    if (!block) continue;

    blocks.push(block);
  }

  // Sort by binary position
  blocks.sort((a, b) => a.binStart - b.binStart);
  return blocks;
}

// ─── ECU Variant Identification ──────────────────────────────────────────────

export function identifyEcuVariant(data, blocks) {
  // Find Dataset #0 block (ID 0x60)
  const dsBlock = blocks.find(b => (b.blockIdentifier & 0xFF) === 0x60);
  if (!dsBlock) return 'Unknown';

  const variantOffset = dsBlock.binStart + 0x78;
  if (variantOffset + 100 > data.length) return 'Unknown';

  // Read null-terminated ASCII at +0x78
  let end = variantOffset;
  while (end < variantOffset + 100 && end < data.length && data[end] !== 0) end++;

  const raw = String.fromCharCode(...data.slice(variantOffset, end));
  const fields = raw.split('/');

  for (const field of fields) {
    const f = field.trim();
    if (/MED17|EDC17|MEDC17/i.test(f)) return f;
  }

  const nonEmpty = fields.filter(f => f.trim()).slice(0, 3);
  return nonEmpty.length ? nonEmpty.join('/') : 'Unknown';
}

// ─── Checksum Calculation ────────────────────────────────────────────────────

/**
 * CRC32 — algorithm 0x00 (SB_CRC32_ALGO_E)
 * Bit-by-bit CRC32-IEEE over LE dwords, matching TriCore implementation.
 * A pass gives 0x35015001, complement of 0xCAFEAFFE.
 * initial_value is usually 0xFADECAFE.
 */
export function calculateCrc32(data, start, endInclusive, initialValue) {
  if (start < 0 || endInclusive >= data.length || start > endInclusive) return 0;

  let crc = initialValue >>> 0;
  let pos = start;

  while (pos + 3 <= endInclusive) {
    let dword = readU32LE(data, pos);
    pos += 4;

    for (let bit = 0; bit < 32; bit++) {
      const xorResult = (dword ^ crc) >>> 0;
      dword = dword >>> 1;
      if (xorResult & 1) {
        crc = ((crc >>> 1) ^ 0xEDB88320) >>> 0;
      } else {
        crc = crc >>> 1;
      }
    }
  }

  return crc >>> 0;
}

/**
 * ADD32 — algorithm 0x01 (SB_ADD32_ALGO_E): sum of LE dwords.
 */
export function calculateAdd32(data, start, endInclusive, initialValue) {
  if (start < 0 || endInclusive >= data.length || start > endInclusive) return 0;

  let checksum = initialValue >>> 0;
  let pos = start;

  while (pos + 3 <= endInclusive) {
    const dword = readU32LE(data, pos);
    pos += 4;
    checksum = (checksum + dword) >>> 0;
  }

  return checksum;
}

/**
 * ADD16 — algorithm 0x10 (SB_ADD16_ALGO_E): sum of 16-bit words.
 * Last word goes into high 16 bits — verified against factory firmware.
 * Do NOT simplify the tail to a flat add.
 */
export function calculateAdd16(data, start, endInclusive, initialValue) {
  if (start < 0 || endInclusive >= data.length || start > endInclusive) return 0;

  let checksum = initialValue >>> 0;
  let pos = start;

  // Main loop — fold each dword as low_word + high_word
  const lastWordStart = endInclusive - 1; // last 2 bytes
  while (pos <= lastWordStart - 2) {
    const word = data[pos] | (data[pos + 1] << 8);
    pos += 2;
    checksum = (checksum + word) >>> 0;
  }

  // Last 16-bit word goes into the high 16 bits
  if (pos + 1 <= endInclusive) {
    const word = data[pos] | (data[pos + 1] << 8);
    checksum = (checksum + ((word << 16) >>> 0)) >>> 0;
  }

  return checksum;
}

// ─── CRC32 Fold Patch ────────────────────────────────────────────────────────
// Solve the 4 bytes at `hole` so CRC32 over [regionStart, regionEndIncl] equals `target`.
// Uses table-driven forward/backward CRC32. For CVN correction.

export function crc32FoldPatch(data, regionStart, regionEndIncl, hole,
                                init = 0xFFFFFFFF, target = 0, xorout = 0xFFFFFFFF) {
  initCrc32ReverseTable();
  const fwdTbl = CRC32_TABLE;
  const revTbl = CRC32_REVERSE_TABLE;

  // Forward to the near edge of the hole
  let f = init >>> 0;
  for (let pos = regionStart; pos < hole; pos++) {
    f = ((f >>> 8) ^ fwdTbl[(data[pos] ^ f) & 0xFF]) >>> 0;
  }

  // Backward from the region end to the far edge of the hole
  let u = ((target ^ xorout) >>> 0);
  let pos = regionEndIncl;
  while (hole + 4 <= pos) {
    u = ((data[pos] ^ revTbl[u >>> 24] ^ ((u << 8) >>> 0))) >>> 0;
    pos--;
  }

  // Fold forward into backward, byte by byte
  u = (((u << 8) >>> 0) ^ revTbl[u >>> 24]) >>> 0;
  u = ((((f >>> 16) & 0xFF) ^ revTbl[u >>> 24] ^ ((((u ^ (f >>> 24)) << 8) >>> 0)))) >>> 0;
  u = ((((f >>> 8) & 0xFF) ^ revTbl[u >>> 24] ^ (((u << 8) >>> 0)))) >>> 0;
  return ((((u << 8) >>> 0) ^ revTbl[u >>> 24] ^ (f & 0xFF))) >>> 0;
}

// ─── Checksum Validation ─────────────────────────────────────────────────────

function validateChecksumStructure(data, cs, blockStartMem, blockStartBin) {
  const startOff = memToFile(cs.csStart, blockStartMem, blockStartBin);
  const endOff   = memToFile(cs.csEnd,   blockStartMem, blockStartBin);

  if (startOff < 0 || endOff > data.length || startOff >= endOff) {
    cs.calculatedChecksum = null;
    cs.isValid = false;
    return false;
  }

  if (cs.csAlgorithm === ALGO_CRC32) {
    // CRC32 compares against the complement
    const checksum = calculateCrc32(data, startOff, endOff, cs.csStartVal);
    cs.calculatedChecksum = checksum;
    cs.isValid = (checksum === ((~cs.csExpectedVal) >>> 0));
  } else if (cs.csAlgorithm === ALGO_ADD32) {
    const checksum = calculateAdd32(data, startOff, endOff, cs.csStartVal);
    cs.calculatedChecksum = checksum;
    cs.isValid = (checksum === cs.csExpectedVal);
  } else if (cs.csAlgorithm === ALGO_ADD16) {
    const checksum = calculateAdd16(data, startOff, endOff, cs.csStartVal);
    cs.calculatedChecksum = checksum;
    cs.isValid = (checksum === cs.csExpectedVal);
  } else {
    cs.calculatedChecksum = null;
    cs.isValid = null;
  }

  return cs.isValid ?? false;
}

export function validateAllChecksums(data, blocks) {
  const results = [];

  for (const block of blocks) {
    const blockResult = {
      blockName: block.blockName,
      blockTypeId: block.blockTypeId,
      isUnprogrammed: block.isUnprogrammed,
      structures: [],
    };

    if (block.isUnprogrammed) {
      results.push(blockResult);
      continue;
    }

    for (const cs of block.checksumStructures) {
      validateChecksumStructure(data, cs, block.blockStart, block.binStart);
      blockResult.structures.push({
        algorithm: ALGO_NAMES[cs.csAlgorithm] || `0x${cs.csAlgorithm.toString(16)}`,
        isValid: cs.isValid,
        expected: cs.csExpectedVal,
        calculated: cs.calculatedChecksum,
      });
    }

    results.push(blockResult);
  }

  return results;
}

// ─── Checksum Correction ─────────────────────────────────────────────────────

/**
 * Correct an ADD32 checksum by adjusting the last dword of the checksummed region.
 * The difference between target and current is added to the last dword.
 */
function correctAdd32(data, cs, blockStartMem, blockStartBin) {
  if (cs.csAlgorithm !== ALGO_ADD32) return false;

  const startOff = memToFile(cs.csStart, blockStartMem, blockStartBin);
  const endOff   = memToFile(cs.csEnd,   blockStartMem, blockStartBin);

  if (startOff < 0 || endOff > data.length || startOff >= endOff) return false;

  const current = calculateAdd32(data, startOff, endOff, cs.csStartVal);
  const target  = cs.csExpectedVal;

  const difference = ((target - current) >>> 0);

  // endOff is inclusive — last dword starts 3 bytes back
  const lastDwordOff = endOff - 3;
  const oldValue = readU32LE(data, lastDwordOff);
  const newValue = ((oldValue + difference) >>> 0);

  writeU32LE(data, lastDwordOff, newValue);
  return true;
}

/**
 * Correct an ADD16 checksum by adjusting the last dword of the checksummed region.
 * The dword contributes low_word + high_word, so adding the difference to the
 * dword as a whole moves the sum by the same amount.
 */
function correctAdd16(data, cs, blockStartMem, blockStartBin) {
  if (cs.csAlgorithm !== ALGO_ADD16) return false;

  const startOff = memToFile(cs.csStart, blockStartMem, blockStartBin);
  const endOff   = memToFile(cs.csEnd,   blockStartMem, blockStartBin);

  if (startOff < 0 || endOff > data.length || startOff >= endOff) return false;

  const current = calculateAdd16(data, startOff, endOff, cs.csStartVal);
  const target  = cs.csExpectedVal;

  const difference = ((target - current) >>> 0);

  const lastDwordOff = endOff - 3;
  const oldValue = readU32LE(data, lastDwordOff);
  const newValue = ((oldValue + difference) >>> 0);

  writeU32LE(data, lastDwordOff, newValue);
  return true;
}

// ─── Two-Pass Correction Flow ────────────────────────────────────────────────

/**
 * fixChecksums(buffer) — Main entry point.
 *
 * Takes a Uint8Array (ECU binary), scans for Bosch checksum blocks,
 * corrects ADD32/ADD16 checksums (Pass 1), then validates CRC32 (Pass 2).
 *
 * Returns: {
 *   modified: Uint8Array,      // corrected binary
 *   blocks: number,            // total blocks found
 *   variant: string,           // ECU variant string
 *   corrected: number,         // ADD32/ADD16 checksums corrected
 *   crc32Valid: number,        // CRC32 checksums that passed
 *   crc32Invalid: number,      // CRC32 checksums that failed (need v2 for correction)
 *   skipped: number,           // unprogrammed blocks skipped
 *   log: string[],             // human-readable log
 * }
 */
export function fixChecksums(buffer) {
  const data = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer);
  const out  = new Uint8Array(data); // working copy
  const log  = [];

  // 1. Scan for blocks
  const blocks = findBoschBlocks(out);
  log.push(`Scanned ${data.length.toLocaleString()} bytes — found ${blocks.length} Bosch checksum block(s)`);

  if (blocks.length === 0) {
    return {
      modified: out, blocks: 0, variant: 'Unknown',
      corrected: 0, crc32Valid: 0, crc32Invalid: 0, skipped: 0, log,
    };
  }

  // Identify ECU variant
  const variant = identifyEcuVariant(out, blocks);
  log.push(`ECU variant: ${variant}`);

  let corrected = 0;
  let crc32Valid = 0;
  let crc32Invalid = 0;
  let skipped = 0;

  // 2. Pass 1 — ADD32/ADD16 correction
  log.push('--- Pass 1: ADD32/ADD16 correction ---');

  for (const block of blocks) {
    if (block.isUnprogrammed) {
      log.push(`  ${block.blockName}: unprogrammed — skipped`);
      skipped++;
      continue;
    }

    for (const cs of block.checksumStructures) {
      if (cs.csAlgorithm !== ALGO_ADD32 && cs.csAlgorithm !== ALGO_ADD16) continue;

      const algoName = ALGO_NAMES[cs.csAlgorithm];

      // Validate current state
      validateChecksumStructure(out, cs, block.blockStart, block.binStart);

      if (cs.isValid) {
        log.push(`  ${block.blockName} ${algoName}: already valid`);
        continue;
      }

      // Correct
      let ok = false;
      if (cs.csAlgorithm === ALGO_ADD32) {
        ok = correctAdd32(out, cs, block.blockStart, block.binStart);
      } else {
        ok = correctAdd16(out, cs, block.blockStart, block.binStart);
      }

      if (ok) {
        // Verify
        validateChecksumStructure(out, cs, block.blockStart, block.binStart);
        if (cs.isValid) {
          corrected++;
          log.push(`  ${block.blockName} ${algoName}: CORRECTED ✓`);
        } else {
          log.push(`  ${block.blockName} ${algoName}: correction applied but verify failed`);
        }
      } else {
        log.push(`  ${block.blockName} ${algoName}: correction failed (out of bounds)`);
      }
    }
  }

  // 3. Pass 2 — CRC32 validation (correction deferred to v2)
  log.push('--- Pass 2: CRC32 validation ---');

  for (const block of blocks) {
    if (block.isUnprogrammed) continue;

    for (const cs of block.checksumStructures) {
      if (cs.csAlgorithm !== ALGO_CRC32) continue;

      validateChecksumStructure(out, cs, block.blockStart, block.binStart);

      if (cs.isValid) {
        crc32Valid++;
        log.push(`  ${block.blockName} CRC32: valid ✓`);
      } else {
        crc32Invalid++;
        log.push(`  ${block.blockName} CRC32: INVALID (correction requires v2)`);
      }
    }
  }

  // Summary
  log.push(`--- Summary: ${corrected} corrected, ${crc32Valid} CRC32 valid, ${crc32Invalid} CRC32 invalid, ${skipped} skipped ---`);

  return {
    modified: out,
    blocks: blocks.length,
    variant,
    corrected,
    crc32Valid,
    crc32Invalid,
    skipped,
    log,
  };
}

// ─── Utility Exports ─────────────────────────────────────────────────────────

export {
  BLOCK_IDENTIFIERS,
  ALGO_CRC32, ALGO_ADD32, ALGO_ADD16, ALGO_NAMES,
  FLASH_SEGMENT_MASK,
  readU32LE, writeU32LE, readU16LE,
  flashCanonical, memToFile,
  hasBlockSignature,
};
