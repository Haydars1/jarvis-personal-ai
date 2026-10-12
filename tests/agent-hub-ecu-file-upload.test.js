import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectEcuBinary} from '../src/lib/agent-hub-ecu-binary.js';
test('direct ECU file inspection returns deterministic read-only metadata',()=>{
 const bytes=new Uint8Array(2048);
 bytes.set(new TextEncoder().encode('BOSCH EDC17'),64);
 const analysis=inspectEcuBinary(bytes,'test.bin');
 assert.ok(analysis.ascii_markers.includes('BOSCH'));
 assert.ok(analysis.ascii_markers.includes('EDC17'));
 assert.equal(analysis.read_only,true);
 assert.equal(analysis.checksum_verified,false);
 assert.equal(analysis.flashing_performed,false);
});
test('user ECU upload route requires authentication and limits untrusted files',()=>{
 const source=readFileSync(new URL('../src/application/capabilities/cloud-execution.js',import.meta.url),'utf8');
 const start=source.indexOf("if(path==='/api/tools/agent-hub/ecu-file-inspect'");
 assert.ok(start>0);
 const route=source.slice(start,start+1150);
 assert.match(route,/appAuthed\(core,req,env,ctx\)/);
 assert.match(route,/content-length/);
 assert.match(route,/4\*1024\*1024/);
 assert.match(route,/inspectEcuBinary\(bytes,name\)/);
 assert.match(route,/persisted:false/);
});
test('JARVIS UI can submit real selected file to ECU API',()=>{
 const src=readFileSync(new URL('../public/agent-hub-ui.js',import.meta.url),'utf8');
 assert.match(src,/hubEcuFile/);
 assert.match(src,/ecu-file-inspect/);
 assert.match(src,/body:file/);
});
