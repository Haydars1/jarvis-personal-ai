import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEcuIdentity } from '../src/application/ecu/ecu-identity-parser.js';
import { parseKt200HtmlRows, classifyKt200Connection, filterKt200Rows, checkKt200Live } from '../src/application/ecu/kt200-live-source.js';
import { readIdentityReport } from '../local-bridge/ecu-identity-report-adapter.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('real ECU ID report labels are parsed, not simulated', () => {
  const x = parseEcuIdentity('Part Number: 04L 906 026 AC\nHW: H41\nSW: 9971\nECU Type: EDC17C64');
  assert.equal(x.ecu_part_number,'04L 906 026 AC');
  assert.equal(x.hw,'H41');
  assert.equal(x.sw,'9971');
  assert.equal(x.ecu_type,'EDC17C64');
  assert.equal(x.verified_by_vehicle,false);
});
test('multilingual ECU ID and JSON import supported',()=>{
  const x=parseEcuIdentity('Teilenummer: 04L906026AC\nHardware Nummer: H41\nSoftware Nummer: 0071');
  assert.equal(x.ecu_part_number,'04L906026AC');
  assert.equal(x.hw,'H41');
  const j=parseEcuIdentity({part_number:'04L906026AC',hw:'H41',sw:'0071'});
  assert.equal(j.hw,'H41');
});
test('reject text not containing any ECU ID',()=>{
  assert.throws(()=>parseEcuIdentity('random customer note'),/ECU_ID_FIELDS_NOT_FOUND/);
});
test('read-only adapter consumes real local report and reports its provenance',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ecuidentity-'));
  try {
    const file=path.join(dir,'ecu-id.txt');
    await fs.writeFile(file,'Part Number: 04L 906 026 AC\nHW: H41\nSW: 9971');
    const result=await readIdentityReport(file);
    assert.equal(result.identity.sw,'9971');
    assert.equal(result.direct_usb_read,false);
    assert.equal(result.simulated,false);
    await assert.rejects(()=>readIdentityReport(file,Date.now()+6*60*60*1000),/REPORT_TOO_OLD/);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('KT200 protocol table parsing preserves read type and connection',()=>{
  const html='<table><tr><th>Category</th></tr><tr><td>ECU</td><td>Audi</td><td>car</td><td>A6</td><td>3.0 TDI</td><td>Bosch</td><td>EDC17CP44</td><td>TC1797</td><td>R/W / BENCH MODE</td><td>all</td></tr></table>';
  const rows=parseKt200HtmlRows(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].access,'READ_WRITE_LISTED');
  assert.deepEqual(rows[0].methods,['BENCH']);
  assert.equal(filterKt200Rows(rows,{brand:'Audi',model:'A6'}).length,1);
});
test('VR is not incorrectly classified as physical read',()=>{
  const c=classifyKt200Connection('VR/W / OBD');
  assert.equal(c.access,'VIRTUAL_READ_AND_WRITE');
  assert.deepEqual(c.methods,['OBD']);
});
test('live source reports unparseable or unavailable instead of inventing support',async()=>{
  const res=await checkKt200Live({brand:'Audi'},async()=>new Response('<html><body>JS loaded</body></html>',{status:200,headers:{'content-type':'text/html'}}));
  assert.equal(res.status,'VENDOR_TABLE_NOT_MACHINE_READABLE');
  assert.deepEqual(res.results,[]);
});
