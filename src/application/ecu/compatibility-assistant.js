import { execute, jsonResponse, queryAll, readJson } from '../../lib/runtime.js';
import { normalizePartNumber } from './partnumber-catalog.js';

export const KT200_SUPPORT_URL = 'https://kt200ii.com/support-list/';
const METHODS = Object.freeze(['OBD', 'BENCH', 'BOOT', 'JTAG', 'BDM']);
const READ_TYPES = Object.freeze(['PHYSICAL_READ', 'VIRTUAL_READ', 'WRITE_ONLY', 'UNKNOWN']);
const MAX_TEXT = 100;

function safeText(value, limit = MAX_TEXT) {
  return String(value ?? '').trim().slice(0, limit);
}
function folded(value) {
  return safeText(value).normalize('NFKC').toLocaleLowerCase('en-US');
}
function canonicalBrand(value) {
  const v = folded(value);
  if (v === 'vw' || v === 'volkswagen') return 'volkswagen';
  if (v === 'mercedes' || v === 'mercedes-benz') return 'mercedes';
  if (v === 'seat' || v === 'cupra') return v;
  return v;
}
function modelToken(value) { return folded(value).split(/[\\s,/]+/).filter(Boolean)[0] || ''; }
function wildcard(value) {
  return '%' + folded(value).replace(/[\\%_]/g, '\\$&') + '%';
}
function validYear(value) {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1980 && year <= 2035 ? year : NaN;
}
export function rankVehicleCandidate(record, vehicle) {
  const brand = canonicalBrand(record.brand);
  const model = folded(record.model);
  const engine = folded(record.engine);
  const wantBrand = canonicalBrand(vehicle.brand);
  const wantModel = modelToken(vehicle.model);
  const wantEngine = folded(vehicle.engine);
  if (!wantBrand || !wantModel || !brand.includes(wantBrand) || !model.includes(wantModel)) return null;
  let score = 2;
  if (brand === wantBrand) score += 2;
  if (model === wantModel) score += 2;
  if (wantEngine && engine && (engine.includes(wantEngine) || wantEngine.includes(engine))) score += 2;
  if (vehicle.ecu_part_number && normalizePartNumber(record.part_number) === normalizePartNumber(vehicle.ecu_part_number)) score += 4;
  return { ...record, score, match_status: 'POSSIBLE_ECU_NOT_VERIFIED', year_verified: false, kt200_method: 'NOT_VERIFIED' };
}
export function classifyProtocolEvidence(note, input) {
  if (normalizePartNumber(note.part_number) !== normalizePartNumber(input.ecu_part_number)) return 'DIFFERENT_ECU';
  // Missing hardware/software identity must never become an exact, confirmed match.
  if (!safeText(input.hw) || !safeText(input.sw) || !safeText(note.hw) || !safeText(note.sw)) return 'VERIFY_HW_SW';
  if (folded(input.hw) !== folded(note.hw) || folded(input.sw) !== folded(note.sw)) return 'DIFFERENT_HW_SW';
  return 'OPERATOR_RECORDED_EXACT_ID';
}
async function appAuthed(core, req, env, ctx) {
  const response = await core.fetch(new Request(new URL('/api/auth/status', req.url), { headers: req.headers }), env, ctx);
  if (!response.ok) return false;
  try { return (await response.json()).authenticated === true; } catch { return false; }
}
async function ensureNoteSchema(env) {
  await execute(env, "CREATE TABLE IF NOT EXISTS ecu_kt200_protocol_notes (id TEXT PRIMARY KEY, part_normalized TEXT NOT NULL, part_number TEXT NOT NULL, ecu_type TEXT NOT NULL DEFAULT '', hw TEXT NOT NULL DEFAULT '', sw TEXT NOT NULL DEFAULT '', method TEXT NOT NULL, read_type TEXT NOT NULL, source_url TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)");
  await execute(env, 'CREATE INDEX IF NOT EXISTS ecu_kt200_protocol_number_idx ON ecu_kt200_protocol_notes(part_normalized)');
}
async function candidates(env, params) {
  const brand = safeText(params.brand), model = safeText(params.model);
  const part = normalizePartNumber(params.ecu_part_number);
  if (!part && (!brand || !model)) return { error: 'BRAND_MODEL_OR_ECU_PART_REQUIRED' };
  const clause = part ? 'normalized_number = ?' : "LOWER(brand) LIKE ? ESCAPE '\\' AND LOWER(model) LIKE ? ESCAPE '\\'";
  const args = part ? [part] : [wildcard(brand.toLowerCase() === 'vw' ? 'volkswagen' : brand), wildcard(modelToken(model))];
  try {
    const rows = await queryAll(env, 'SELECT part_number,ecu_type,manufacturer,brand,model,engine,software_part_number,software_version,source_url,description FROM ecu_part_catalog WHERE ' + clause + ' LIMIT 150', ...args);
    const ranked = rows.map(row => part ? {
      ...row, score: 10, match_status: 'PART_NUMBER_CATALOG_MATCH', year_verified: false, kt200_method: 'NOT_VERIFIED'
    } : rankVehicleCandidate(row, params)).filter(Boolean);
    ranked.sort((a, b) => b.score - a.score || String(a.part_number).localeCompare(String(b.part_number)));
    return { results: ranked.slice(0, 40), catalogue_status: ranked.length ? 'MATCHES_FOUND' : 'NO_MATCHING_RECORDS', candidate_count: ranked.length };
  } catch (err) {
    if (/no such table: ecu_part_catalog/i.test(String(err?.message || err))) {
      return { results: [], candidate_count: 0, catalogue_status: 'CATALOG_NOT_INITIALIZED' };
    }
    throw err;
  }
}
async function lookup(url, env) {
  const params = {
    brand: safeText(url.searchParams.get('brand')),
    model: safeText(url.searchParams.get('model')),
    engine: safeText(url.searchParams.get('engine')),
    power: safeText(url.searchParams.get('power'), 20),
    ecu_part_number: safeText(url.searchParams.get('ecu_part_number')),
    hw: safeText(url.searchParams.get('hw')),
    sw: safeText(url.searchParams.get('sw')),
    year: validYear(url.searchParams.get('year'))
  };
  if (Number.isNaN(params.year)) return jsonResponse({ ok: false, error: 'INVALID_YEAR' }, 400);
  const matches = await candidates(env, params);
  if (matches.error) return jsonResponse({ ok: false, error: matches.error }, 400);
  let notes = [];
  if (params.ecu_part_number) {
    const rows = await queryAll(env, 'SELECT part_number,ecu_type,hw,sw,method,read_type,source_url,notes,created_at FROM ecu_kt200_protocol_notes WHERE part_normalized=? ORDER BY created_at DESC LIMIT 30', normalizePartNumber(params.ecu_part_number));
    notes = rows.map(row => ({ ...row, evidence_status: classifyProtocolEvidence(row, params), verification: 'OPERATOR_ENTERED_NOT_LIVE_KT200' }));
  }
  return jsonResponse({
    ok: true, vehicle: params, ...matches, notes,
    official_support_url: KT200_SUPPORT_URL,
    protocol_verified_by_vehicle: false,
    warning: 'Model/yil/motor tek basina ECU veya KT200 II OBD/Bench/Boot destegini dogrulamaz. ECU ID ve guncel protokol listesi kontrol edilmeli.'
  });
}
async function saveNote(req, env) {
  let body; try { body = await readJson(req); } catch { return jsonResponse({ ok: false, error: 'INVALID_JSON' }, 400); }
  const part_number = safeText(body?.ecu_part_number);
  const ecu_type = safeText(body?.ecu_type);
  const hw = safeText(body?.hw);
  const sw = safeText(body?.sw);
  const method = safeText(body?.method).toUpperCase();
  const read_type = safeText(body?.read_type).toUpperCase();
  const source_url = safeText(body?.source_url, 400);
  const notes = safeText(body?.notes, 600);
  if (normalizePartNumber(part_number).length < 4 || !hw || !sw || !METHODS.includes(method) || !READ_TYPES.includes(read_type) || body?.operator_confirmed !== true) {
    return jsonResponse({ ok: false, error: 'PART_HW_SW_METHOD_READ_TYPE_AND_CONFIRMATION_REQUIRED' }, 400);
  }
  try {
    const source = new URL(source_url);
    if (source.protocol !== 'https:' || !source.hostname.includes('.')) throw Error();
  } catch { return jsonResponse({ ok: false, error: 'HTTPS_SOURCE_REQUIRED' }, 400); }
  const id = crypto.randomUUID();
  await execute(env, 'INSERT INTO ecu_kt200_protocol_notes(id,part_normalized,part_number,ecu_type,hw,sw,method,read_type,source_url,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    id,normalizePartNumber(part_number),part_number,ecu_type,hw,sw,method,read_type,source_url,notes,Date.now());
  return jsonResponse({ ok: true, id, verification: 'OPERATOR_ENTERED_NOT_LIVE_KT200' }, 201);
}
export function createEcuCompatibilityAssistant(core) {
  if (!core?.fetch) throw Error('ECU_COMPATIBILITY_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith('/api/ecu/compatibility/')) return core.fetch(req, env, ctx);
      if (!(await appAuthed(core, req, env, ctx))) return jsonResponse({ ok: false, error: 'AUTH_REQUIRED' }, 401);
      if (!env.DB) return jsonResponse({ ok: false, error: 'D1_NOT_BOUND' }, 503);
      try {
        await ensureNoteSchema(env);
        if (url.pathname === '/api/ecu/compatibility/lookup' && req.method === 'GET') return lookup(url, env);
        if (url.pathname === '/api/ecu/compatibility/note' && req.method === 'POST') return saveNote(req, env);
        return jsonResponse({ ok: false, error: 'NOT_FOUND' }, 404);
      } catch (err) {
        return jsonResponse({ ok: false, error: 'ECU_COMPATIBILITY_ERROR', detail: String(err?.message || err).slice(0, 180) }, 500);
      }
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
