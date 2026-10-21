// Tuning Project Management Module
// Session/project tracking, notes, presets, collaboration

import { q1, qall, run } from './d1.js';
import { id as genId, now } from './core.js';

// ─── Schema Bootstrap ──────────────────────────────────────────────────────

const TUNING_PROJECTS_DDL = `
CREATE TABLE IF NOT EXISTS ecu_tuning_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  ecu_type TEXT,
  fuel_type TEXT,
  upload_ids TEXT DEFAULT '[]',
  tuned_ids TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  notes TEXT,
  target_goals TEXT DEFAULT '[]',
  safety_profile TEXT DEFAULT 'standard',
  created_at INTEGER,
  updated_at INTEGER
)`;

const TUNING_SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS ecu_tuning_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_type TEXT DEFAULT 'tuning',
  status TEXT DEFAULT 'open',
  operations TEXT DEFAULT '[]',
  changes_applied TEXT DEFAULT '[]',
  checksum_status TEXT,
  notes TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  duration_ms INTEGER
)`;

const TUNING_NOTES_DDL = `
CREATE TABLE IF NOT EXISTS ecu_tuning_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  upload_id TEXT,
  note_type TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER
)`;

/**
 * Ensure project tables exist (safe to call multiple times)
 */
export async function ensureProjectTables(env) {
  try {
    await run(env, TUNING_PROJECTS_DDL);
    await run(env, TUNING_SESSIONS_DDL);
    await run(env, TUNING_NOTES_DDL);
    return true;
  } catch (e) {
    // Tables might already exist, that's fine
    return false;
  }
}

// ─── Projects CRUD ─────────────────────────────────────────────────────────

export async function createProject(env, data) {
  await ensureProjectTables(env);
  const project = {
    id: data.id || genId(),
    name: data.name || 'Untitled Project',
    description: data.description || '',
    status: 'active',
    vehicle_make: data.vehicle_make || data.make || '',
    vehicle_model: data.vehicle_model || data.model || '',
    vehicle_year: data.vehicle_year || data.year || null,
    ecu_type: data.ecu_type || '',
    fuel_type: data.fuel_type || '',
    upload_ids: JSON.stringify(data.upload_ids || []),
    tuned_ids: JSON.stringify(data.tuned_ids || []),
    tags: JSON.stringify(data.tags || []),
    notes: data.notes || '',
    target_goals: JSON.stringify(data.target_goals || []),
    safety_profile: data.safety_profile || 'standard',
    created_at: now(),
    updated_at: now(),
  };
  await run(env,
    `INSERT INTO ecu_tuning_projects (id,name,description,status,vehicle_make,vehicle_model,vehicle_year,ecu_type,fuel_type,upload_ids,tuned_ids,tags,notes,target_goals,safety_profile,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    project.id, project.name, project.description, project.status,
    project.vehicle_make, project.vehicle_model, project.vehicle_year,
    project.ecu_type, project.fuel_type, project.upload_ids, project.tuned_ids,
    project.tags, project.notes, project.target_goals, project.safety_profile,
    project.created_at, project.updated_at
  );
  return project;
}

export async function getProject(env, projectId) {
  await ensureProjectTables(env);
  const p = await q1(env, 'SELECT * FROM ecu_tuning_projects WHERE id=?', projectId);
  if (!p) return null;
  return parseProject(p);
}

export async function listProjects(env, opts = {}) {
  await ensureProjectTables(env);
  const { status, limit = 50, offset = 0 } = opts;
  let sql = 'SELECT * FROM ecu_tuning_projects';
  const params = [];
  if (status) { sql += ' WHERE status=?'; params.push(status); }
  sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = await qall(env, sql, ...params);
  return rows.map(parseProject);
}

export async function updateProject(env, projectId, updates) {
  await ensureProjectTables(env);
  const existing = await q1(env, 'SELECT * FROM ecu_tuning_projects WHERE id=?', projectId);
  if (!existing) return null;

  const fields = [];
  const vals = [];
  const allowedFields = ['name','description','status','vehicle_make','vehicle_model','vehicle_year','ecu_type','fuel_type','notes','safety_profile'];
  for (const f of allowedFields) {
    if (updates[f] !== undefined) { fields.push(`${f}=?`); vals.push(updates[f]); }
  }
  // JSON fields
  for (const f of ['upload_ids','tuned_ids','tags','target_goals']) {
    if (updates[f] !== undefined) { fields.push(`${f}=?`); vals.push(JSON.stringify(updates[f])); }
  }
  if (fields.length === 0) return parseProject(existing);

  fields.push('updated_at=?'); vals.push(now());
  vals.push(projectId);
  await run(env, `UPDATE ecu_tuning_projects SET ${fields.join(',')} WHERE id=?`, ...vals);
  return getProject(env, projectId);
}

export async function deleteProject(env, projectId) {
  await ensureProjectTables(env);
  await run(env, 'DELETE FROM ecu_tuning_notes WHERE project_id=?', projectId);
  await run(env, 'DELETE FROM ecu_tuning_sessions WHERE project_id=?', projectId);
  await run(env, 'DELETE FROM ecu_tuning_projects WHERE id=?', projectId);
  return true;
}

export async function addUploadToProject(env, projectId, uploadId) {
  const p = await q1(env, 'SELECT upload_ids FROM ecu_tuning_projects WHERE id=?', projectId);
  if (!p) return false;
  const ids = JSON.parse(p.upload_ids || '[]');
  if (!ids.includes(uploadId)) {
    ids.push(uploadId);
    await run(env, 'UPDATE ecu_tuning_projects SET upload_ids=?, updated_at=? WHERE id=?', JSON.stringify(ids), now(), projectId);
  }
  return true;
}

export async function addTunedToProject(env, projectId, tunedId) {
  const p = await q1(env, 'SELECT tuned_ids FROM ecu_tuning_projects WHERE id=?', projectId);
  if (!p) return false;
  const ids = JSON.parse(p.tuned_ids || '[]');
  if (!ids.includes(tunedId)) {
    ids.push(tunedId);
    await run(env, 'UPDATE ecu_tuning_projects SET tuned_ids=?, updated_at=? WHERE id=?', JSON.stringify(ids), now(), projectId);
  }
  return true;
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function startSession(env, projectId, sessionType = 'tuning') {
  await ensureProjectTables(env);
  const session = {
    id: genId(),
    project_id: projectId || null,
    session_type: sessionType,
    status: 'open',
    operations: '[]',
    changes_applied: '[]',
    checksum_status: null,
    notes: '',
    started_at: now(),
    ended_at: null,
    duration_ms: null,
  };
  await run(env,
    `INSERT INTO ecu_tuning_sessions (id,project_id,session_type,status,operations,changes_applied,checksum_status,notes,started_at,ended_at,duration_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    session.id, session.project_id, session.session_type, session.status,
    session.operations, session.changes_applied, session.checksum_status,
    session.notes, session.started_at, session.ended_at, session.duration_ms
  );
  return session;
}

export async function endSession(env, sessionId, result = {}) {
  const s = await q1(env, 'SELECT * FROM ecu_tuning_sessions WHERE id=?', sessionId);
  if (!s) return null;
  const endedAt = now();
  const duration = endedAt - (s.started_at || endedAt);
  await run(env,
    'UPDATE ecu_tuning_sessions SET status=?, checksum_status=?, notes=?, ended_at=?, duration_ms=? WHERE id=?',
    result.status || 'completed',
    result.checksum_status || s.checksum_status,
    result.notes || s.notes,
    endedAt, duration, sessionId
  );
  return { ...parseSession(s), status: result.status || 'completed', ended_at: endedAt, duration_ms: duration };
}

export async function addSessionOperation(env, sessionId, operation) {
  const s = await q1(env, 'SELECT operations FROM ecu_tuning_sessions WHERE id=?', sessionId);
  if (!s) return false;
  const ops = JSON.parse(s.operations || '[]');
  ops.push({ ...operation, timestamp: now() });
  await run(env, 'UPDATE ecu_tuning_sessions SET operations=? WHERE id=?', JSON.stringify(ops), sessionId);
  return true;
}

export async function addSessionChanges(env, sessionId, changes) {
  const s = await q1(env, 'SELECT changes_applied FROM ecu_tuning_sessions WHERE id=?', sessionId);
  if (!s) return false;
  const existing = JSON.parse(s.changes_applied || '[]');
  existing.push(...(Array.isArray(changes) ? changes : [changes]));
  await run(env, 'UPDATE ecu_tuning_sessions SET changes_applied=? WHERE id=?', JSON.stringify(existing), sessionId);
  return true;
}

export async function getSession(env, sessionId) {
  await ensureProjectTables(env);
  const s = await q1(env, 'SELECT * FROM ecu_tuning_sessions WHERE id=?', sessionId);
  return s ? parseSession(s) : null;
}

export async function listSessions(env, projectId = null, opts = {}) {
  await ensureProjectTables(env);
  const { status, limit = 50 } = opts;
  let sql = 'SELECT * FROM ecu_tuning_sessions';
  const params = [];
  const conds = [];
  if (projectId) { conds.push('project_id=?'); params.push(projectId); }
  if (status) { conds.push('status=?'); params.push(status); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY started_at DESC LIMIT ?';
  params.push(limit);
  const rows = await qall(env, sql, ...params);
  return rows.map(parseSession);
}

// ─── Notes ─────────────────────────────────────────────────────────────────

export async function addNote(env, data) {
  await ensureProjectTables(env);
  const note = {
    id: genId(),
    project_id: data.project_id || null,
    session_id: data.session_id || null,
    upload_id: data.upload_id || null,
    note_type: data.note_type || 'general',
    content: data.content || '',
    metadata: JSON.stringify(data.metadata || {}),
    created_at: now(),
  };
  await run(env,
    `INSERT INTO ecu_tuning_notes (id,project_id,session_id,upload_id,note_type,content,metadata,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    note.id, note.project_id, note.session_id, note.upload_id,
    note.note_type, note.content, note.metadata, note.created_at
  );
  return note;
}

export async function listNotes(env, filters = {}) {
  await ensureProjectTables(env);
  const { project_id, session_id, upload_id, note_type, limit = 100 } = filters;
  let sql = 'SELECT * FROM ecu_tuning_notes';
  const conds = [], params = [];
  if (project_id) { conds.push('project_id=?'); params.push(project_id); }
  if (session_id) { conds.push('session_id=?'); params.push(session_id); }
  if (upload_id) { conds.push('upload_id=?'); params.push(upload_id); }
  if (note_type) { conds.push('note_type=?'); params.push(note_type); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  const rows = await qall(env, sql, ...params);
  return rows.map(n => ({ ...n, metadata: JSON.parse(n.metadata || '{}') }));
}

export async function deleteNote(env, noteId) {
  await ensureProjectTables(env);
  await run(env, 'DELETE FROM ecu_tuning_notes WHERE id=?', noteId);
  return true;
}

// ─── Project Stats ─────────────────────────────────────────────────────────

export async function projectStats(env, projectId) {
  await ensureProjectTables(env);
  const p = await getProject(env, projectId);
  if (!p) return null;
  const sessions = await qall(env, 'SELECT status, COUNT(*) as cnt FROM ecu_tuning_sessions WHERE project_id=? GROUP BY status', projectId);
  const notes = await q1(env, 'SELECT COUNT(*) as cnt FROM ecu_tuning_notes WHERE project_id=?', projectId);
  const totalDuration = await q1(env, 'SELECT SUM(duration_ms) as total FROM ecu_tuning_sessions WHERE project_id=? AND duration_ms IS NOT NULL', projectId);
  return {
    project: p,
    uploads: p.upload_ids.length,
    tunedFiles: p.tuned_ids.length,
    sessions: sessions.reduce((a, s) => { a[s.status] = s.cnt; return a; }, {}),
    notes: notes?.cnt || 0,
    totalSessionTime: totalDuration?.total || 0,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseProject(row) {
  return {
    ...row,
    upload_ids: JSON.parse(row.upload_ids || '[]'),
    tuned_ids: JSON.parse(row.tuned_ids || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    target_goals: JSON.parse(row.target_goals || '[]'),
  };
}

function parseSession(row) {
  return {
    ...row,
    operations: JSON.parse(row.operations || '[]'),
    changes_applied: JSON.parse(row.changes_applied || '[]'),
  };
}
