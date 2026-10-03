import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeFaultData } from '../js/fault-localization.mjs';
const p0299={label:'P0299',title:'Ladedruckregelung – Regelgrenze unterschritten',system:'Motor / Aufladung',severity:'Mittel bis hoch',drive:'Nur vorsichtig weiterfahren.',meaning:'Das Motorsteuergerät erkennt einen niedrigeren Ladedruck.',symptoms:['Leistungsverlust'],causes:['Undichtigkeit'],diagnosis:['Soll- und Ist-Ladedruck vergleichen'],solutions:['Undichtigkeit beheben'],note:'P0299 bedeutet nicht automatisch Turbolader defekt.'};
test('P0299 content localizes to Turkish',()=>{const d=localizeFaultData(p0299,'P0299','tr');assert.match(d.title,/basınç/i);assert.match(d.meaning,/motor kontrol|basınç/i);assert.match(d.symptoms[0],/güç/i);});
test('P0299 content localizes to English',()=>{const d=localizeFaultData(p0299,'P0299','en');assert.match(d.title,/boost/i);assert.match(d.symptoms[0],/power/i);});
test('German and unknown code preserve source content',()=>{assert.equal(localizeFaultData(p0299,'P0299','de').title,p0299.title);assert.equal(localizeFaultData(p0299,'UNKNOWN','tr').title,p0299.title);});
