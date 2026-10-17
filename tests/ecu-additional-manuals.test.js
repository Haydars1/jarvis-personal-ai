import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS, ecuStudyConcepts } from '../src/application/ecu/manual-learning-foundations.js';
import { ECU_ADDITIONAL_MANUALS, ECU_ADDITIONAL_FOUNDATIONS } from '../src/application/ecu/manual-learning-new10.js';
import { ecuPermanentStudyContext } from '../src/application/ecu/manual-study-context.js';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ten new PDFs expand existing library to 20 without removing old manuals',()=>{
  assert.equal(ECU_ADDITIONAL_MANUALS.length,10);
  assert.equal(ECU_MANUALS.length,20);
  assert.equal(new Set(ECU_MANUALS.map(m=>m.id)).size,20);
  assert.ok(ECU_MANUAL_FOUNDATIONS.length>=50);
  assert.ok(ECU_ADDITIONAL_FOUNDATIONS.length>=30);
});
test('each learned principle is linked to one known document and source pages',()=>{
  const ids=new Set(ECU_MANUALS.map(m=>m.id));
  for(const row of ECU_MANUAL_FOUNDATIONS){
    assert.ok(ids.has(row.doc),row.doc);
    assert.ok(/\d/.test(row.pages),row.doc);
    assert.ok(Array.isArray(row.topics)&&row.topics.length,row.doc);
    assert.ok(row.lesson.length>=45,row.doc);
  }
});
test('EDC17, MSA15, EDC16 and EDC15P questions find family-specific evidence',()=>{
  for(const family of ['EDC17','MSA15','EDC16','EDC15P+']){
    const context=ecuPermanentStudyContext(family+' turbo calibration and injection quantity');
    assert.ok(context.includes('Kaynak')||context.includes('KALICI'),family);
    assert.ok(context.length>120,family);
  }
  const match=ecuStudyConcepts('MSA15 N146 pump',10);
  assert.ok(match.some(row=>row.doc==='msa15_tuning'));
});
test('ordinary messages get no ECU injection',()=>{
  assert.equal(ecuPermanentStudyContext('Merhaba, nasılsın?'),'');
});
test('compiled lessons are available to general and ECU chat without opening PDFs at request time',()=>{
  assert.match(read('src/worker.js'),/ecuPermanentStudyContext\(text\)/);
  assert.match(read('src/application/chat/orchestrator.js'),/ecuPermanentStudyContext\(text\)/);
  const module=read('src/application/ecu/manual-study-context.js');
  assert.doesNotMatch(module,/fetch\(|\.prepare\(|readFile|import\('fs'/);
});
test('full owner-supplied PDF passages are not committed as public source content',()=>{
  const source=read('src/application/ecu/manual-learning-new10.js');
  assert.doesNotMatch(source,/AD 7F FF 80 00 00|1C6820/);
  assert.match(source,/original learning notes/i);
});