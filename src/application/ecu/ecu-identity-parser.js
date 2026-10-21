import { normalizePartNumber } from './partnumber-catalog.js';

const take = (value, max = 120) => String(value ?? '').normalize('NFKC').trim().slice(0, max);
function keyValues(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/).slice(0, 800)) {
    const match = line.match(/^\s*([^:=]{2,70})\s*[:=]\s*(.{1,150})\s*$/);
    if (!match) continue;
    const key = match[1].toLocaleLowerCase('en-US').replace(/[^a-z0-9ğüşöçı]+/g, '');
    const value = take(match[2]);
    if (value && !result[key]) result[key] = value;
  }
  return result;
}
const names = {
  ecu_part_number: ['ecupartnumber','ecupartno','partnumber','oempartnumber','oemnumber','ecuparcanumarasi','teilenummer','ersatzteilnummer','steuergeraetnummer','steuergeratnummer','boschpartnumber','parcanumarasi'],
  hw: ['hardware','hardwarenumber','hardwarenummer','hardwareversion','hwnumber','hwno','hw'],
  sw: ['software','softwarenumber','softwareversion','softwarenummer','softwarestand','swnumber','swno','sw'],
  ecu_type: ['ecutype','ecumodel','ecumodeli','controlunittype','steuergeraettyp','steuergerattyp','ecufamily']
  // Do not forward vehicle VIN by default; only technical ECU identification is needed.
};
export function parseEcuIdentity(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input || {});
  if (raw.length > 150000) throw Error('REPORT_TOO_LARGE');
  let map = {};
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const original = input.identity && typeof input.identity === 'object' ? input.identity : input;
    for (const [key,value] of Object.entries(original)) map[key.toLowerCase().replace(/[^a-z0-9ğüşöçı]+/g, '')] = value;
  } else {
    try { const parsed = JSON.parse(raw); if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') return parseEcuIdentity(parsed); } catch {}
    map = keyValues(raw);
  }
  const pick = keys => { for (const key of keys) if (map[key] != null) return take(map[key]); return ''; };
  const result = Object.fromEntries(Object.entries(names).map(([key, keys]) => [key, pick(keys)]));
  if (!result.ecu_part_number && !result.hw && !result.sw && !result.ecu_type) throw Error('ECU_ID_FIELDS_NOT_FOUND');
  if (result.ecu_part_number && normalizePartNumber(result.ecu_part_number).length < 4) throw Error('INVALID_ECU_PART_NUMBER');
  return { ...result, confidence: result.ecu_part_number && result.hw && result.sw ? 'IDENTIFIERS_PRESENT_NOT_DEVICE_VERIFIED' : 'PARTIAL_REPORT', verified_by_vehicle: false };
}
