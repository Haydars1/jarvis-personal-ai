import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEcuImage,compareEcuFiles,inspectIntelHexMetadata} from '../src/lib/agent-hub-ecu-file-tools.js';
import {inspectEcuBinary} from '../src/lib/agent-hub-ecu-binary.js';
function hexRecord(type,address,payload=[]){
 const data=[payload.length,address>>>8,address&255,type,...payload],sum=data.reduce((a,b)=>a+b,0);
 return ':'+[...data,(-sum)&255].map(x=>x.toString(16).toUpperCase().padStart(2,'0')).join('');
}
const encode=s=>new TextEncoder().encode(s);
test('identical ECU binary images do not report false differences',()=>{
 const bytes=Uint8Array.of(0,1,2,3,4,5);
 const comparison=compareEcuFiles(bytes,bytes,'orig.bin','copy.ori');
 assert.equal(comparison.identical,true);
 assert.equal(comparison.total_different_bytes,0);
 assert.equal(comparison.total_changed_ranges,0);
 assert.equal(comparison.read_only,true);
 assert.equal(comparison.ecu_firmware_checksum_verified,false);
});
test('raw ECU images report exact changed, appended and removed offsets',()=>{
 const original=Uint8Array.of(0,1,2,3,4);
 const modified=Uint8Array.of(0,9,2,3,4,7);
 const comparison=compareEcuFiles(original,modified,'a.bin','b.bin');
 assert.equal(comparison.changed_bytes,1);
 assert.equal(comparison.added_bytes,1);
 assert.equal(comparison.removed_bytes,0);
 assert.equal(comparison.total_changed_ranges,2);
 assert.deepEqual(comparison.ranges.map(r=>r.start_hex),['0x00000001','0x00000005']);
 assert.equal(comparison.ranges[0].before_hex,'01');
 assert.equal(comparison.ranges[0].after_hex,'09');
 assert.deepEqual(original,Uint8Array.of(0,1,2,3,4));
});
test('Intel HEX extended addresses compare physical addresses and verify record checksums',()=>{
 const a=encode([hexRecord(4,0,[0,1]),hexRecord(0,0x20,[1,2,3]),hexRecord(1,0,[])].join('\n')+'\n');
 const b=encode([hexRecord(4,0,[0,1]),hexRecord(0,0x20,[1,9,3]),hexRecord(1,0,[])].join('\n')+'\n');
 const parsed=parseEcuImage(a,'original.hex');
 assert.equal(parsed.segments[0].start,0x10020);
 const comparison=compareEcuFiles(a,b,'a.hex','b.hex');
 assert.equal(comparison.changed_bytes,1);
 assert.equal(comparison.ranges[0].start_hex,'0x00010021');
 assert.equal(comparison.intel_hex_record_checksums_valid,true);
 assert.equal(inspectEcuBinary(a,'a.hex').format,'intel-hex');
 const meta=inspectIntelHexMetadata(a,'a.hex');
 assert.equal(meta.record_checksums_valid,true);
 assert.equal(meta.address_start_hex,'0x00010020');
 assert.equal(meta.ecu_firmware_checksum_verified,false);
});
test('Intel HEX rejects corrupted checksums, overlapping addresses and missing EOF',()=>{
 const valid=[hexRecord(0,0,[1,2]),hexRecord(1,0,[])].join('\n');
 const bad=valid.replace('0102','0103');
 assert.throws(()=>parseEcuImage(encode(bad),'a.hex'),/HEX_RECORD_CHECKSUM_INVALID/);
 const overlap=[hexRecord(0,0,[1,2]),hexRecord(0,1,[3,4]),hexRecord(1,0,[])].join('\n');
 assert.throws(()=>parseEcuImage(encode(overlap),'a.hex'),/HEX_OVERLAPPING_ADDRESSES/);
 assert.throws(()=>parseEcuImage(encode(hexRecord(0,0,[1,2])),'a.hex'),/HEX_EOF_MISSING/);
});
test('comparison refuses format mismatch instead of implying equal addresses',()=>{
 const hex=encode([hexRecord(0,0,[1,2]),hexRecord(1,0,[])].join('\n'));
 assert.throws(()=>compareEcuFiles(Uint8Array.of(1,2),hex,'a.bin','b.hex'),/ECU_COMPARE_FORMAT_MISMATCH/);
});
test('authenticated API and file form UI expose source comparison with size checks',async()=>{
 const {readFileSync}=await import('node:fs');
 const api=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 const start=api.indexOf("if(path==='/api/tools/agent-hub/ecu-compare'");
 assert.ok(start>0);
 const route=api.slice(start,start+2400);
 assert.match(route,/appAuthed\(core,req,env,ctx\)/);
 assert.match(route,/FORM_DATA_REQUIRED/);
 assert.match(route,/original\.size>4\*1024\*1024/);
 assert.match(route,/compareEcuFiles/);
 assert.match(ui,/hubEcuCompare/);
 assert.match(ui,/new FormData/);
 assert.match(ui,/ecu-compare/);
});
