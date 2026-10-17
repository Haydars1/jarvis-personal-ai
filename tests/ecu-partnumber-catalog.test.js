import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_GROUPS, normalizePartNumber, normalizeCatalogRecord, createEcuPartnumberCatalog } from '../src/application/ecu/partnumber-catalog.js';

test('seven catalog groups',()=>{
  assert.deepEqual(CATALOG_GROUPS,['bosch','ford','mazda','vag','peugeot','citroen','man']);
});
test('part normalization preserves leading zeroes and suffixes',()=>{
  assert.equal(normalizePartNumber('0 261 200 001'), '0261200001');
  assert.equal(normalizePartNumber('021 906 018 A'),'021906018A');
});
test('record mappings and source URL',()=>{
  const r=normalizeCatalogRecord({group:'VAG',part_number:'021 906 018 A',ecu_type:'ME7.1',software_version:'6781',source_url:'https://www.controlunits.info/partnumbers/vag/021906018A/'});
  assert.equal(r.id,'vag:021906018A');
  assert.equal(r.ecu_type,'ME7.1');
  assert.equal(r.software_version,'6781');
});
test('invalid inputs fail closed',()=>{
  assert.throws(()=>normalizeCatalogRecord({group:'unknown',part_number:'123456'}),/INVALID_GROUP/);
  assert.throws(()=>normalizeCatalogRecord({group:'bosch',part_number:'?'}),/INVALID_PART_NUMBER/);
  assert.throws(()=>normalizeCatalogRecord({group:'bosch',part_number:'0261200001',source_url:'javascript:alert(1)'}),/INVALID_SOURCE_URL/);
});
test('unrelated routes continue to call original core',async()=>{
  let calls=0;
  const core={fetch:async()=>{calls++;return Response.json({legacy:true});}};
  const result=await createEcuPartnumberCatalog(core).fetch(new Request('https://example.com/api/ecu/generate'),{},{});
  assert.deepEqual(await result.json(),{legacy:true});assert.equal(calls,1);
});
test('owner authentication precedes all D1 access',async()=>{
  const core={fetch:async()=>Response.json({authenticated:false})};
  const result=await createEcuPartnumberCatalog(core).fetch(new Request('https://example.com/api/ecu/partnumbers/stats'),{},{});
  assert.equal(result.status,401);assert.equal((await result.json()).error,'AUTH_REQUIRED');
});
test('no D1 binding is handled gracefully',async()=>{
  const core={fetch:async()=>Response.json({authenticated:true})};
  const result=await createEcuPartnumberCatalog(core).fetch(new Request('https://example.com/api/ecu/partnumbers/stats'),{},{});
  assert.equal(result.status,503);
});
test('bulk import requires declared rights and never mutates other tables',async()=>{
  const sql=[];
  const db={prepare(statement){sql.push(statement);return{bind(){return this;},run:async()=>({}),all:async()=>({results:[]}),first:async()=>({total:0})}}};
  const core={fetch:async()=>Response.json({authenticated:true})};
  const req=new Request('https://example.com/api/ecu/partnumbers/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({records:[{group:'bosch',part_number:'0261200001'}]})});
  const result=await createEcuPartnumberCatalog(core).fetch(req,{DB:db},{});
  assert.equal(result.status,403);assert.equal((await result.json()).error,'IMPORT_REQUIRES_RIGHTS_CONFIRMATION');
  assert(sql.every(s=>!/(\bdelete\b|\bdrop\b|\balter\b)/i.test(s)));
  assert(sql.every(s=>/ecu_part_catalog/i.test(s)));
});
