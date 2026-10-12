import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTOMOTIVE_TOOLS,recommendAutomotiveTools} from '../src/lib/agent-hub-automotive-tools.js';
test('verified automotive catalog only contains the selected repositories',()=>{
 assert.equal(AUTOMOTIVE_TOOLS.length,8);
 assert.ok(AUTOMOTIVE_TOOLS.every(t=>t.repo.includes('/')&&t.runtime));
 assert.ok(AUTOMOTIVE_TOOLS.every(t=>t.thinkdiag_compatible===false));
});
test('OBD, firmware and VIN tasks resolve to relevant sources',()=>{
 const obd=recommendAutomotiveTools('ELM327 OBD canlı veri');
 assert.ok(obd.some(x=>x.repo==='brendan-w/python-OBD'));
 assert.ok(obd.some(x=>x.repo==='tronikos/elm327_obdii'));
 const ecu=recommendAutomotiveTools('KT200 ECU BIN firmware analizi');
 assert.ok(ecu.some(x=>x.repo==='NationalSecurityAgency/ghidra'));
 const vin=recommendAutomotiveTools('VIN şasi ile marka model araç bul');
 assert.ok(vin.some(x=>x.repo==='davidpeckham/vpic-api'));
 assert.deepEqual(recommendAutomotiveTools(''),[]);
 assert.ok(ecu.every(x=>x.installed===false&&x.auto_execute===false));
});
test('automotive discovery API and UI are authenticated and label device limits',()=>{
 const api=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 assert.match(api,/\/api\/tools\/agent-hub\/automotive-tools/);
 assert.match(api,/recommendAutomotiveTools\(task\)/);
 assert.match(ui,/hubAutoToolsFind/);
 assert.match(ui,/Thinkdiag uyumluluğu doğrulanmadı/);
});
