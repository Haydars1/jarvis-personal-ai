import test from 'node:test';
import assert from 'node:assert/strict';
import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS } from '../src/application/ecu/manual-learning-foundations.js';
import { buildEcuStudySeedSql } from '../scripts/prepare-ecu-study-seed.mjs';
test('production study migration creates exactly one record per source and concept',()=>{
  const sql=buildEcuStudySeedSql();
  assert.equal((sql.match(/INSERT INTO learning_sources/g)||[]).length,ECU_MANUALS.length);
  assert.equal((sql.match(/INSERT INTO learning_chunks/g)||[]).length,ECU_MANUAL_FOUNDATIONS.length);
  assert.equal(ECU_MANUALS.length,20);
  assert.ok(ECU_MANUAL_FOUNDATIONS.length>=50);
  assert.ok(sql.includes("ON CONFLICT(source_id,ordinal) DO UPDATE"));
  assert.doesNotMatch(sql, /\bBEGIN TRANSACTION\b/i);
  assert.doesNotMatch(sql, /\bCOMMIT\s*;/i);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE FROM|ALTER TABLE)\b/i);
});
test('production notes are source labeled and do not contain full original PDF passages',()=>{
  const sql=buildEcuStudySeedSql();
  assert.ok(sql.includes('ecu-manual'));
  assert.ok(sql.includes('no_auto_write'));
  assert.ok(sql.length<150000);
  assert.ok(!sql.includes('AD 7F FF 80 00 00'));
});
