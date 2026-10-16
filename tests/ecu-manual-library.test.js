import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuManualLibrary } from '../src/application/ecu/manual-library.js';
import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS, ecuStudyConcepts } from '../src/application/ecu/manual-learning-foundations.js';
const base='https://jarvis.example/api/ecu/manual-library/';
const core=(authenticated=true)=>({fetch:async()=>Response.json({authenticated})});
function mockDatabase(){
 const queries=[];
 const db={prepare(sql){queries.push(sql);const statement={bind(...args){this.args=args;return this;},async run(){return{};},async all(){return{results:[]};},async first(){return null;}};return statement;},async batch(statements){return statements.map(()=>({success:true}));}};
 return {db,queries};
}
test('all ten uploaded ECU book identities are included',()=>{
 assert.equal(ECU_MANUALS.length,10);
 assert.equal(new Set(ECU_MANUALS.map(d=>d.id)).size,10);
 assert(ECU_MANUAL_FOUNDATIONS.length>=18);
});
test('concept synthesis includes relevant ECU families',()=>{
 assert(ecuStudyConcepts('EDC15P torque',10).some(x=>x.doc==='vag_edc15p_maps'));
 assert(ecuStudyConcepts('GDI injector',10).some(x=>x.doc==='emu_pro_gdi'));
 assert(ecuStudyConcepts('M1.5.5 checksum',10).some(x=>x.doc==='motronic_155_checksum'));
});
test('manual library never intercepts existing tuning and coding endpoints',async()=>{
 let called=0;
 const core={fetch:async()=>{called++;return Response.json({unchanged:true})}};
 const response=await createEcuManualLibrary(core).fetch(new Request('https://jarvis.example/api/ecu/generate'),{},null);
 assert.equal(called,1);assert.deepEqual(await response.json(),{unchanged:true});
});
test('manual library rejects unauthorized users before schema calls',async()=>{
 const response=await createEcuManualLibrary(core(false)).fetch(new Request(base+'concepts'),{},null);
 assert.equal(response.status,401);
 assert.equal((await response.json()).error,'AUTH_REQUIRED');
});
test('manual library requires a valid D1 binding',async()=>{
 const response=await createEcuManualLibrary(core()).fetch(new Request(base+'concepts'),{},null);
 assert.equal(response.status,503);
});
test('concepts API returns synthesized learning without existing PDF upload',async()=>{
 const {db,queries}=mockDatabase();
 const response=await createEcuManualLibrary(core()).fetch(new Request(base+'concepts?q=checksum'),{DB:db},null);
 assert.equal(response.status,200);
 const json=await response.json();
 assert(json.concepts.length>0);
 assert.equal(json.not_model_training,true);
 assert(queries.every(sql=>/ecu_manual_library/i.test(sql)));
});
test('manual package importer rejects invalid/missing owner authorization',async()=>{
 const {db}=mockDatabase();
 const request=new Request(base+'import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({records:[]})});
 const response=await createEcuManualLibrary(core()).fetch(request,{DB:db},null);
 assert.equal(response.status,403);
});
test('import rejects unknown source IDs; never touches existing tables',async()=>{
 const {db,queries}=mockDatabase();
 const record={document_id:'other_manual',page:1,part:1,text:'Example',filename:'example.pdf',source_sha256:'f'.repeat(64)};
 const request=new Request(base+'import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authorized:true,records:[record]})});
 const response=await createEcuManualLibrary(core()).fetch(request,{DB:db},null);
 assert.equal(response.status,400);
 assert.equal((await response.json()).error,'UNKNOWN_DOCUMENT');
 assert(queries.every(sql=>/ecu_manual_library/i.test(sql)));
});
test('import accepts validated page chunks and D1 writes exclusively to library tables',async()=>{
 const {db,queries}=mockDatabase();
 const record={document_id:'vag_edc15p_maps',page:1,part:1,text:'EDC15P controls diesel calibration requests.',filename:'VAG EDC15 Maps.pdf',source_sha256:'a'.repeat(64),tags:['EDC15P']};
 const request=new Request(base+'import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authorized:true,records:[record]})});
 const response=await createEcuManualLibrary(core()).fetch(request,{DB:db},null);
 assert.equal(response.status,200);
 assert.equal((await response.json()).imported,1);
 assert(queries.every(sql=>/ecu_manual_library/i.test(sql)));
 assert(!queries.some(sql=>/\b(drop|delete|alter|truncate)\b/i.test(sql)));
});
