import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectorModel } from '../js/vehicle-selector-ui.mjs';

test('selector model starts with brands and disables dependent choices',()=>{
  const m=buildSelectorModel({});
  assert.ok(m.fields[0].options.includes('Volkswagen'));
  assert.equal(m.fields[1].disabled,true);
  assert.equal(m.summary,'Allgemeine Darstellung');
});

test('selector model exposes the next choices and German summary',()=>{
  const m=buildSelectorModel({brand:'Volkswagen',model:'Passat',generation:'B8',year:2017,engine:'2.0 TDI CRLB'});
  assert.equal(m.fields.every(f=>!f.disabled),true);
  assert.match(m.summary,/VW|Volkswagen/);
  assert.match(m.summary,/Passat B8/);
  assert.match(m.summary,/CRLB/);
});
