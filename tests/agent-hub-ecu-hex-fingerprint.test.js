import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEcuBinary} from '../src/lib/agent-hub-ecu-binary.js';
function hexRecord(type,address,payload=[]){
 const data=[payload.length,address>>>8,address&255,type,...payload];
 return ':'+[...data,(-data.reduce((sum,b)=>sum+b,0))&255].map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join('');
}
const encode=text=>new TextEncoder().encode(text);
const hex=(...records)=>encode([...records,hexRecord(1,0)].join('\n'));
test('Intel HEX fingerprint measures decoded payload and retains upload size',()=>{
 const payload=encode('BOSCH EDC16');
 const file=hex(hexRecord(0,0x20,Array.from(payload)));
 const before=file.slice();
 const result=inspectEcuBinary(file,'image.hex');
 const raw=inspectEcuBinary(payload,'image.bin');
 assert.equal(result.header_hex,raw.header_hex);
 assert.equal(result.entropy_bits_per_byte,raw.entropy_bits_per_byte);
 assert.deepEqual(result.ascii_markers,raw.ascii_markers);
 assert.equal(result.payload_size_bytes,payload.length);
 assert.equal(result.size_bytes,file.length);
 assert.equal(result.record_checksums_valid,true);
 assert.equal(result.checksum_verified,false);
 assert.deepEqual(file,before);
});
test('contiguous Intel HEX records retain signatures across record boundaries',()=>{
 const file=hex(hexRecord(0,0,[66,79]),hexRecord(0,2,[83,67,72]));
 const result=inspectEcuBinary(file,'split.hex');
 assert.ok(result.ascii_markers.includes('BOSCH'));
 assert.equal(result.header_hex,'42 4F 53 43 48');
});
test('sparse Intel HEX memory gaps never create synthetic ECU signatures',()=>{
 const file=hex(hexRecord(0,0,[66,79]),hexRecord(0,0x100,[83,67,72]));
 const result=inspectEcuBinary(file,'sparse.hex');
 assert.ok(!result.ascii_markers.includes('BOSCH'));
 assert.equal(result.payload_size_bytes,5);
});
test('raw binary fingerprint preserves existing metadata and rejects malformed HEX',()=>{
 const raw=Uint8Array.of(0,255,0,255);
 const result=inspectEcuBinary(raw,'image.bin');
 assert.equal(result.entropy_bits_per_byte,1);
 assert.equal(result.payload_size_bytes,4);
 assert.equal(result.header_hex,'00 FF 00 FF');
 assert.equal(result.format,'raw-binary');
 assert.throws(()=>inspectEcuBinary(encode(':00000001FE'),'bad.hex'),/HEX_RECORD_CHECKSUM_INVALID/);
});
