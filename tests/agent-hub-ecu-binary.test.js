import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEcuBinary} from '../src/lib/agent-hub-ecu-binary.js';
import {createAgentPlan} from '../src/lib/agent-hub-workflow.js';
test('reads Bosch EDC16 signatures and entropy without changing bytes',()=>{
 const bytes=new Uint8Array(2048);bytes.set(new TextEncoder().encode('BOSCH EDC16'),50);
 const original=bytes.slice();const result=inspectEcuBinary(bytes,'firmware.bin');
 assert.equal(result.size_bytes,2048);
 assert.ok(result.ascii_markers.includes('BOSCH'));
 assert.ok(result.ascii_markers.includes('EDC16'));
 assert.equal(result.checksum_verified,false);
 assert.equal(result.flashing_performed,false);
 assert.deepEqual(bytes,original);
});
test('rejects empty or oversized ECU files',()=>{
 assert.throws(()=>inspectEcuBinary(new Uint8Array(0),'x.bin'),/ECU_FILE_SIZE_UNSUPPORTED/);
 assert.throws(()=>inspectEcuBinary(new Uint8Array(4*1024*1024+1),'x.bin'),/ECU_FILE_SIZE_UNSUPPORTED/);
});
test('auto-plans real ECU cloud adapter without unsupported flashing',()=>{
 const plan=createAgentPlan({repo:'owner/ecu',task:'KT200 ECU BIN firmware incele'},new Set(['owner/ecu']));
 assert.ok(plan.steps.some(s=>s.adapter_id==='ecu-bin-inspect'));
 assert.ok(plan.steps.every(s=>s.adapter_id!=='ecu-flash'));
});
