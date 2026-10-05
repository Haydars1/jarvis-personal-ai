// ECU API Endpoints for Jarvis Worker
// Add these to src/worker.js before the main route handler

import { detectFileFormat, identifyVehicle, generateProposals, applyTuning, validateTunedFile } from './lib/tuning-engine.js';

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

// POST /api/ecu/generate — apply tuning, generate output file
export async function ecuGenerateHandler(req, env) {
  try {
    const body = await req.json();
    const { uploadId, selectedProposals } = body;
    
    if (!uploadId || !selectedProposals || selectedProposals.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'INVALID_REQUEST'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Get upload
    const upload = await q1(env, 'SELECT * FROM ecu_uploads WHERE id = ?', uploadId);
    if (!upload) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'UPLOAD_NOT_FOUND'
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const vehicleId = upload.vehicle_type;
    const originalData = new Uint8Array(upload.binary_data);
    
    // Generate proposals (for UI consistency)
    const proposals = generateProposals(vehicleId, originalData);
    
    // Apply tuning
    const result = await applyTuning(originalData, selectedProposals, vehicleId);
    
    // Validate
    const validation = await validateTunedFile(originalData, result.tuned, vehicleId);
    if (!validation.valid) {
      await run(
        env,
        `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, error_msg, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
        id(),
        uploadId,
        vehicleId,
        'generation',
        'error',
        validation.error,
        now()
      );
      
      return new Response(JSON.stringify({
        ok: false,
        error: validation.error
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Store proposal
    const proposalId = id();
    await run(
      env,
      `INSERT INTO ecu_proposals(id, upload_id, vehicle_type, proposal_type, proposal_data, status, user_confirmed, confirmed_at, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      proposalId,
      uploadId,
      vehicleId,
      selectedProposals.join(','),
      JSON.stringify(result.appliedPatches),
      'confirmed',
      1,
      now(),
      now()
    );
    
    // Store tuned output
    const tunedId = id();
    await run(
      env,
      `INSERT INTO ecu_tuned_outputs(id, proposal_id, upload_id, tuned_binary, tuned_hash, tuned_size, applied_changes, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tunedId,
      proposalId,
      uploadId,
      result.tuned,
      result.hash,
      result.size,
      JSON.stringify(result.appliedPatches),
      'ready',
      now()
    );
    
    // Log
    await run(
      env,
      `INSERT INTO ecu_tuning_history(id, upload_id, vehicle_type, tuning_type, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      id(),
      uploadId,
      vehicleId,
      'generation',
      'ok',
      now()
    );
    
    return new Response(JSON.stringify({
      ok: true,
      tunedId,
      uploadId,
      vehicleId,
      appliedPatches: result.appliedPatches,
      hash: result.hash,
      size: result.size,
      crc32: result.crc32
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

// GET /api/ecu/download?tunedId=<id> — download tuned file
export async function ecuDownloadHandler(req, env) {
  try {
    const url = new URL(req.url);
    const tunedId = url.searchParams.get('tunedId');
    
    if (!tunedId) {
      return new Response('Missing tunedId', { status: 400 });
    }
    
    const tuned = await q1(env, 'SELECT * FROM ecu_tuned_outputs WHERE id = ?', tunedId);
    if (!tuned) {
      return new Response('Not found', { status: 404 });
    }
    
    // Update download count
    await run(env, 'UPDATE ecu_tuned_outputs SET download_count = download_count + 1 WHERE id = ?', tunedId);
    
    return new Response(tuned.tuned_binary, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="tuned_${tunedId}.bin"`,
        'content-length': tuned.tuned_size
      }
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

// Router integration — add to main worker request handler
export function ecuRoutes(req, env) {
  const url = new URL(req.url);
  
  if (url.pathname === '/api/ecu/upload' && req.method === 'POST') {
    return ecuUploadHandler(req, env);
  }
  
  if (url.pathname === '/api/ecu/generate' && req.method === 'POST') {
    return ecuGenerateHandler(req, env);
  }
  
  if (url.pathname === '/api/ecu/download' && req.method === 'GET') {
    return ecuDownloadHandler(req, env);
  }
  
  return null;
}
