// ECU API Endpoints for Jarvis Worker
// Full five-tier analysis + apply pipeline

import {
  detectFileFormat, fileStats, scanRegions, summarizeForAI,
  applyActions, sha256Hex, validateChecksums, buildStage1Package,
  // Legacy stubs kept for backward compat
  identifyVehicle, generateProposals, applyTuning, validateTunedFile
} from './tuning-engine.js';

const id = () => crypto.randomUUID();
const now = () => Date.now();

async function q1(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).first();
}

async function qall(env, sql, ...bind) {
  return (await env.DB.prepare(sql).bind(...bind).all()).results || [];
}

async function run(env, sql, ...bind) {
  return env.DB.prepare(sql).bind(...bind).run();
}

// POST /api/ecu/upload — receive ECU file, detect vehicle, return proposals
export async function ecuUploadHandler(req, env) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'NO_FILE' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Detect format
    const formatInfo = await detectFileFormat(bytes);
    
    // Identify vehicle
    const detections = await identifyVehicle(bytes);
    
    // Hash file
    const fileHash = btoa(String.fromCharCode(...new Uint8Array(
      await crypto.subtle.digest('SHA-256', bytes)
    )));
    
    // Store upload
    const uploadId = id();
    const primaryVehicle = detections.length > 0 ? detections[0].vehicleId : null;
    
    await run(
      env,
      `INSERT INTO ecu_uploads(id, user_id, filename, format, vehicle_type, file_hash, file_size, binary_data, uploaded_at, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uploadId,
      'jarvis-owner',
      file.name,
      formatInfo.format,
      primaryVehicle,
      fileHash,
      bytes.length,
      bytes,
      now(),
      now()
    );
    
    // Log
    await run(
      env,
      `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      id(),
      uploadId,
      primaryVehicle || 'unknown',
      'upload',
      'ok',
      now()
    );
    
    return new Response(JSON.stringify({
      ok: true,
      uploadId,
      format: formatInfo.format,
      size: bytes.length,
      detections: detections.map(d => ({
        vehicleId: d.vehicleId,
        name: d.name,
        confidence: d.confidence,
        fileSize: d.fileSize,
        expectedSize: d.expectedSize
      }))
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

// POST /api/ecu/analyze — five-tier analysis, returns detected systems + proposed actions
export async function ecuAnalyzeHandler(req, env) {
  try {
    const body = await req.json();
    const { uploadId } = body;

    if (!uploadId) {
      return json400('MISSING_UPLOAD_ID');
    }

    const upload = await q1(env, 'SELECT * FROM ecu_uploads WHERE id = ?', uploadId);
    if (!upload) return json404('UPLOAD_NOT_FOUND');

    const bytes = new Uint8Array(upload.binary_data);

    // Tier 0 definitions — D1'de bu upload'a bağlı tanım seti var mı?
    let definitions = null;
    try {
      const defRows = await qall(
        env,
        `SELECT d.name, d.description, d.display_id, d.address, d.raw_address,
                d.datatype, d.data_size, d.type, d.system, d.unit, d.math,
                d.lower_limit, d.upper_limit, d.axes, d.element_count, d.total_bytes
         FROM ecu_definitions d
         JOIN ecu_definition_sets s ON s.id = d.def_set_id
         WHERE s.upload_id = ?
         ORDER BY d.address`,
        uploadId
      );
      if (defRows.length > 0) {
        const { normalizeD1Definitions } = await import('./ecu-definition-parser.js');
        definitions = normalizeD1Definitions(defRows);
      }
    } catch (_defErr) { /* Tanım yoksa Tier 1-3 devam eder */ }

    // Full five-tier scan
    const regions = await scanRegions(bytes, definitions);

    // Stats + AI summary
    const stats = fileStats(bytes);
    const summary = summarizeForAI(bytes, regions);

    // Checksum validation
    const checksumResult = validateChecksums(bytes);

    // Deduplicate systems, build system list with action counts
    const systemMap = new Map();
    for (const r of regions) {
      if (!systemMap.has(r.system)) {
        systemMap.set(r.system, { system: r.system, regionCount: 0, actionCount: 0, confidence: 0 });
      }
      const s = systemMap.get(r.system);
      s.regionCount++;
      if (r.actions) s.actionCount += r.actions.length;
      if (r.confidence > s.confidence) s.confidence = r.confidence;
    }

    // Stage 1 package suggestion
    const detectedSystems = [...systemMap.keys()];
    const stage1 = buildStage1Package(detectedSystems);

    // Store analysis result
    const analysisId = id();
    await run(
      env,
      `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      analysisId, uploadId, upload.vehicle_type || 'unknown', 'analysis', 'ok', now()
    );

    // Cache regions JSON for the generate step
    await run(
      env,
      `UPDATE ecu_uploads SET analysis_json = ?, analyzed_at = ? WHERE id = ?`,
      JSON.stringify(regions), now(), uploadId
    ).catch(() => {
      // analysis_json sütunu yoksa sorun değil — generate'te yeniden taranır
    });

    return new Response(JSON.stringify({
      ok: true,
      analysisId,
      uploadId,
      format: upload.format,
      fileSize: bytes.length,
      stats: { entropy: stats.entropy, zeroPct: stats.zeroPct, ffPct: stats.ffPct },
      checksums: checksumResult,
      systems: [...systemMap.values()],
      totalRegions: regions.length,
      regions: regions.slice(0, 60).map(r => ({
        id: r.id,
        system: r.system,
        desc: r.desc,
        offsetHex: r.offsetHex,
        offset: r.offset,
        confidence: r.confidence,
        tier: r.tier || (r.id?.startsWith('rp_') ? 1 : r.id?.startsWith('def_') ? 0 : 2),
        foundString: r.foundString?.slice(0, 60),
        actions: (r.actions || []).map(a => ({
          id: a.id,
          label: a.label,
          offset: a.offset,
          dataSize: a.dataSize,
          newValue: a.newValue,
          mapAction: a.mapAction || null,
          effect: a.effect || null,
          system: a.system
        }))
      })),
      stage1Package: stage1,
      aiSummary: summary
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json500(e.message);
  }
}

// POST /api/ecu/definition — upload A2L/XDF definition file for Tier 0
export async function ecuDefinitionUploadHandler(req, env) {
  try {
    const formData = await req.formData();
    const uploadId = formData.get('uploadId');
    const defFile = formData.get('file');

    if (!uploadId || !defFile) {
      return json400('MISSING_UPLOAD_ID_OR_FILE');
    }

    const upload = await q1(env, 'SELECT id FROM ecu_uploads WHERE id = ?', uploadId);
    if (!upload) return json404('UPLOAD_NOT_FOUND');

    const text = await defFile.text();
    const filename = defFile.name || '';
    const isXdf = /\.xdf$/i.test(filename);

    const { parseA2L, parseXDF } = await import('./ecu-definition-parser.js');

    let parsed;
    if (isXdf) {
      parsed = parseXDF(text);
    } else {
      parsed = parseA2L(text);
    }

    const defs = parsed.definitions || [];
    if (defs.length === 0) {
      return json400('NO_DEFINITIONS_FOUND');
    }

    const ts = now();
    const fmt = isXdf ? 'xdf' : 'a2l';

    // Create definition set — links to the upload
    const defSetId = id();
    await run(
      env,
      `INSERT INTO ecu_definition_sets(id, user_id, upload_id, filename, format, ecu_family, base_offset, definition_count, meta, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      defSetId, 'system', uploadId, filename, fmt,
      parsed.meta?.ecuFamily || null,
      parsed.baseOffset ?? 0,
      defs.length,
      JSON.stringify(parsed.meta || {}),
      ts, ts
    );

    // Batch insert definitions — D1 batch limit 100
    const BATCH = 80;
    let inserted = 0;
    for (let i = 0; i < defs.length; i += BATCH) {
      const chunk = defs.slice(i, i + BATCH);
      const stmts = chunk.map(d =>
        env.DB.prepare(
          `INSERT OR REPLACE INTO ecu_definitions(id, def_set_id, name, description, display_id, address, raw_address, datatype, data_size, type, system, unit, math, lower_limit, upper_limit, axes, element_count, total_bytes, source, created_at, updated_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id(), defSetId,
          d.name, d.description || d.name, d.displayId || '',
          d.address ?? d.offset ?? 0, d.rawAddress ?? d.address ?? 0,
          d.datatype || 'UWORD', d.dataSize || 2,
          d.type || 'scalar', d.system || null,
          d.unit || '', d.math || 'X',
          d.lowerLimit ?? d.min ?? null, d.upperLimit ?? d.max ?? null,
          JSON.stringify(d.axes || []),
          d.elementCount || 1, d.totalBytes || d.dataSize || 2,
          fmt, ts, ts
        )
      );
      await env.DB.batch(stmts);
      inserted += chunk.length;
    }

    await run(
      env,
      `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      id(), uploadId, 'definition', 'definition_upload', 'ok', ts
    );

    return new Response(JSON.stringify({
      ok: true,
      uploadId,
      defSetId,
      definitionFile: filename,
      format: fmt.toUpperCase(),
      definitionsImported: inserted,
      baseOffset: parsed.baseOffset ?? 0,
      meta: parsed.meta || {}
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json500(e.message);
  }
}

// POST /api/ecu/generate — apply selected actions, produce tuned binary
export async function ecuGenerateHandler(req, env) {
  try {
    const body = await req.json();
    const { uploadId, selectedActions } = body;
    // Backward compat: accept selectedProposals as alias
    const actions = selectedActions || body.selectedProposals;

    if (!uploadId || !actions || actions.length === 0) {
      return json400('MISSING_UPLOAD_ID_OR_ACTIONS');
    }

    const upload = await q1(env, 'SELECT * FROM ecu_uploads WHERE id = ?', uploadId);
    if (!upload) return json404('UPLOAD_NOT_FOUND');

    const originalBytes = new Uint8Array(upload.binary_data);

    // If actions are region IDs (strings), resolve from cached analysis
    let resolvedActions = actions;
    if (typeof actions[0] === 'string') {
      // Resolve region IDs → action objects
      let regions = null;
      try {
        const cached = await q1(env, 'SELECT analysis_json FROM ecu_uploads WHERE id = ?', uploadId);
        if (cached?.analysis_json) regions = JSON.parse(cached.analysis_json);
      } catch (_) {}
      // Re-scan if no cache
      if (!regions) regions = await scanRegions(originalBytes);

      const regionMap = new Map();
      for (const r of regions) {
        regionMap.set(r.id, r);
        // System adıyla da eşleştir (DPF, EGR vs.)
        if (!regionMap.has(r.system)) regionMap.set(r.system, r);
      }

      resolvedActions = [];
      for (const sel of actions) {
        const region = regionMap.get(sel);
        if (region && region.actions) {
          resolvedActions.push(...region.actions);
        }
      }
      if (resolvedActions.length === 0) {
        return json400('NO_MATCHING_ACTIONS');
      }
    }

    // Apply
    const result = await applyActions(originalBytes, resolvedActions);

    // Validate size
    if (result.tuned.length !== originalBytes.length) {
      return json400('SIZE_MISMATCH');
    }

    // Hash tuned output
    const tunedHash = await sha256Hex(result.tuned);

    // Store proposal + tuned output
    const proposalId = id();
    const vehicleId = upload.vehicle_type || 'unknown';
    await run(
      env,
      `INSERT INTO ecu_proposals(id, upload_id, vehicle_type, proposal_type, proposal_data, status, user_confirmed, confirmed_at, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      proposalId, uploadId, vehicleId,
      result.applied.map(a => a.system || a.id).join(','),
      JSON.stringify(result.applied),
      'confirmed', 1, now(), now()
    );

    const tunedId = id();
    await run(
      env,
      `INSERT INTO ecu_tuned_outputs(id, proposal_id, upload_id, tuned_binary, tuned_hash, tuned_size, applied_changes, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tunedId, proposalId, uploadId,
      result.tuned, tunedHash, result.tuned.length,
      JSON.stringify(result.applied), 'ready', now()
    );

    await run(
      env,
      `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      id(), uploadId, vehicleId, 'generation', 'ok', now()
    );

    return new Response(JSON.stringify({
      ok: true,
      tunedId,
      uploadId,
      vehicleId,
      appliedCount: result.applied.length,
      applied: result.applied.map(a => ({
        id: a.id,
        system: a.system,
        offset: a.offset,
        effectType: a.effectType || a.mapAction || 'byte',
        label: a.label
      })),
      hash: tunedHash,
      size: result.tuned.length
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json500(e.message);
  }
}

// GET /api/ecu/download?tunedId=<id> — download tuned file
export async function ecuDownloadHandler(req, env) {
  try {
    const url = new URL(req.url);
    const tunedId = url.searchParams.get('tunedId');

    if (!tunedId) return new Response('Missing tunedId', { status: 400 });

    const tuned = await q1(env, 'SELECT * FROM ecu_tuned_outputs WHERE id = ?', tunedId);
    if (!tuned) return new Response('Not found', { status: 404 });

    // Get original filename
    let filename = `tuned_${tunedId}.bin`;
    try {
      const upload = await q1(env, 'SELECT filename FROM ecu_uploads WHERE id = ?', tuned.upload_id);
      if (upload?.filename) filename = 'tuned_' + upload.filename;
    } catch (_) {}

    await run(env, 'UPDATE ecu_tuned_outputs SET download_count = download_count + 1 WHERE id = ?', tunedId);

    return new Response(tuned.tuned_binary, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(tuned.tuned_size)
      }
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

// GET /api/ecu/compare?uploadId=<id>&tunedId=<id> — diff original vs tuned
export async function ecuCompareHandler(req, env) {
  try {
    const url = new URL(req.url);
    const uploadId = url.searchParams.get('uploadId');
    const tunedId = url.searchParams.get('tunedId');

    if (!uploadId || !tunedId) return json400('MISSING_IDS');

    const upload = await q1(env, 'SELECT binary_data, file_size FROM ecu_uploads WHERE id = ?', uploadId);
    const tuned = await q1(env, 'SELECT tuned_binary, tuned_size, applied_changes FROM ecu_tuned_outputs WHERE id = ?', tunedId);
    if (!upload || !tuned) return json404('NOT_FOUND');

    const orig = new Uint8Array(upload.binary_data);
    const mod = new Uint8Array(tuned.tuned_binary);

    // Build diff — changed byte regions
    const diffs = [];
    let i = 0;
    while (i < orig.length && i < mod.length) {
      if (orig[i] !== mod[i]) {
        const start = i;
        while (i < orig.length && i < mod.length && orig[i] !== mod[i] && (i - start) < 4096) i++;
        diffs.push({
          offset: start,
          offsetHex: '0x' + start.toString(16).toUpperCase(),
          length: i - start,
          originalBytes: Array.from(orig.subarray(start, Math.min(start + 32, i))).map(b => b.toString(16).padStart(2, '0')).join(' '),
          tunedBytes: Array.from(mod.subarray(start, Math.min(start + 32, i))).map(b => b.toString(16).padStart(2, '0')).join(' '),
          truncated: (i - start) > 32
        });
      } else {
        i++;
      }
    }

    let applied = [];
    try { applied = JSON.parse(tuned.applied_changes || '[]'); } catch (_) {}

    return new Response(JSON.stringify({
      ok: true,
      uploadId,
      tunedId,
      originalSize: orig.length,
      tunedSize: mod.length,
      changedRegions: diffs.length,
      totalChangedBytes: diffs.reduce((s, d) => s + d.length, 0),
      diffs: diffs.slice(0, 100),
      appliedActions: applied.map(a => ({
        id: a.id, system: a.system, offset: a.offset,
        effectType: a.effectType || a.mapAction || 'byte'
      }))
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json500(e.message);
  }
}

// GET /api/ecu/history?limit=20 — tuning history
export async function ecuHistoryHandler(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    const rows = await qall(
      env,
      `SELECT h.id, h.upload_id, h.vehicle_type, h.tuning_type, h.status, h.error_msg, h.created_at,
              u.filename, u.format, u.file_size
       FROM ecu_tuning_history h
       LEFT JOIN ecu_uploads u ON u.id = h.upload_id
       ORDER BY h.created_at DESC
       LIMIT ?`,
      limit
    );

    return new Response(JSON.stringify({ ok: true, history: rows }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json500(e.message);
  }
}

// ---------- Helpers ----------
function json400(error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status: 400, headers: { 'content-type': 'application/json' }
  });
}
function json404(error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status: 404, headers: { 'content-type': 'application/json' }
  });
}
function json500(error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status: 500, headers: { 'content-type': 'application/json' }
  });
}

// Router integration
export function ecuRoutes(req, env) {
  const url = new URL(req.url);

  if (url.pathname === '/api/ecu/upload' && req.method === 'POST') {
    return ecuUploadHandler(req, env);
  }

  if (url.pathname === '/api/ecu/analyze' && req.method === 'POST') {
    return ecuAnalyzeHandler(req, env);
  }

  if (url.pathname === '/api/ecu/definition' && req.method === 'POST') {
    return ecuDefinitionUploadHandler(req, env);
  }

  if (url.pathname === '/api/ecu/generate' && req.method === 'POST') {
    return ecuGenerateHandler(req, env);
  }

  if (url.pathname === '/api/ecu/download' && req.method === 'GET') {
    return ecuDownloadHandler(req, env);
  }

  if (url.pathname === '/api/ecu/compare' && req.method === 'GET') {
    return ecuCompareHandler(req, env);
  }

  if (url.pathname === '/api/ecu/history' && req.method === 'GET') {
    return ecuHistoryHandler(req, env);
  }
  
  return null;
}
