const TYPES = Object.freeze({ u8: [1, 'getUint8', 'setUint8', 0, 255], s8: [1, 'getInt8', 'setInt8', -128, 127], u16: [2, 'getUint16', 'setUint16', 0, 65535], s16: [2, 'getInt16', 'setInt16', -32768, 32767], u32: [4, 'getUint32', 'setUint32', 0, 4294967295], s32: [4, 'getInt32', 'setInt32', -2147483648, 2147483647] });
const integer = value => typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value) ? Number.parseInt(value.slice(2), 16) : value;

export function validateDefinition(input, bytesLength, sha256) {
  if (!input || input.version !== 1 || !Array.isArray(input.maps) || !input.maps.length || input.maps.length > 500) throw new Error('MAP_DEFINITION_FORMAT');
  if (!/^[a-f0-9]{64}$/i.test(input.original_sha256 || '') || input.original_sha256.toLowerCase() !== sha256.toLowerCase()) throw new Error('MAP_ORIGINAL_HASH_MISMATCH');
  const ids = new Set();
  const maps = input.maps.map(map => {
    const type = TYPES[map.type], address = integer(map.address), rows = map.rows ?? 1, columns = map.columns ?? 1, factor = map.factor ?? 1, offset = map.offset ?? 0;
    if (!map.id || ids.has(map.id) || !type || !['le', 'be'].includes(map.endian) || !Number.isInteger(address) || address < 0 || !Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows * columns > 10000 || address + rows * columns * type[0] > bytesLength || !Number.isFinite(factor) || factor === 0 || !Number.isFinite(offset)) throw new Error('MAP_LAYOUT_INVALID');
    if (!Number.isFinite(map.min) || !Number.isFinite(map.max) || map.min > map.max) throw new Error('MAP_LIMITS_REQUIRED');
    ids.add(map.id); return { ...map, address, rows, columns, factor, offset };
  });
  return { ...input, maps, checksum_status: 'not-verified' };
}

export function readMap(bytes, map) {
  const [size, getter] = TYPES[map.type]; const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: map.rows * map.columns }, (_, index) => view[getter](map.address + index * size, map.endian === 'le') * map.factor + map.offset);
}

export function writeMapCell(bytes, map, index, physicalValue) {
  if (!Number.isInteger(index) || index < 0 || index >= map.rows * map.columns || !Number.isFinite(physicalValue) || physicalValue < map.min || physicalValue > map.max) throw new Error('MAP_VALUE_OUT_OF_RANGE');
  const [size, , setter, min, max] = TYPES[map.type]; const raw = (physicalValue - map.offset) / map.factor; const rounded = Math.round(raw);
  if (Math.abs(raw - rounded) > 1e-7 || rounded < min || rounded > max) throw new Error('MAP_VALUE_NOT_REPRESENTABLE');
  const result = new Uint8Array(bytes); new DataView(result.buffer)[setter](map.address + index * size, rounded, map.endian === 'le'); return result;
}

export function parseIntelHex(text) {
  const chunks = []; let upper = 0, eof = false, min = Infinity, max = 0, total = 0;
  for (const line of String(text).trim().split(/\r?\n/)) {
    if (eof || !/^:(?:[a-f0-9]{2})+$/i.test(line)) throw new Error('HEX_RECORD_FORMAT');
    const record = Uint8Array.from(line.slice(1).match(/../g), hex => parseInt(hex, 16));
    if (record.length !== record[0] + 5 || record.reduce((a, b) => a + b, 0) % 256) throw new Error('HEX_RECORD_CHECKSUM');
    const count = record[0], address = (record[1] << 8) | record[2], type = record[3];
    if (type === 0) {
      if (!count) continue; const absolute = upper + address;
      total += count; if (total > 12 * 1024 * 1024 || absolute + count > 0x100000000) throw new Error('HEX_SIZE_LIMIT');
      chunks.push({ address: absolute, bytes: record.slice(4, 4 + count) }); min = Math.min(min, absolute); max = Math.max(max, absolute + count);
    } else if (type === 1 && count === 0 && address === 0) eof = true;
    else if ([2, 4].includes(type) && count === 2 && address === 0) upper = ((record[4] << 8) | record[5]) * (type === 2 ? 16 : 65536);
    else if ([3, 5].includes(type) && count === 4) {} // Entry points retained by original input, not calibration bytes.
    else throw new Error('HEX_UNSUPPORTED_RECORD');
  }
  if (!eof || !chunks.length || max - min > 12 * 1024 * 1024) throw new Error('HEX_INCOMPLETE_OR_SPARSE');
  const bytes = new Uint8Array(max - min).fill(255), assigned = new Uint8Array(bytes.length);
  for (const chunk of chunks) for (let i = 0; i < chunk.bytes.length; i++) { const index = chunk.address - min + i; if (assigned[index]) throw new Error('HEX_OVERLAP'); bytes[index] = chunk.bytes[i]; assigned[index] = 1; }
  return { bytes, base_address: min, original_format: 'intel-hex' };
}
