import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVehicleProfile } from '../js/vehicle-profiles.mjs';
import { getFaultVisual } from '../js/fault-visual.mjs';
import { buildVehicleSchematicModel, renderVehicleSchematicSvg } from '../js/vehicle-schematic.mjs';

const sel=(brand,model,generation,year,engine)=>resolveVehicleProfile({brand,model,generation,year,engine});

test('P0299 keeps boost semantics while coordinates change by vehicle',()=>{
  const fault=getFaultVisual('P0299');
  assert.equal(fault.scene,'boost');
  assert.equal(fault.focus,'boost-path');
  const vw=buildVehicleSchematicModel(sel('Volkswagen','Passat','B8',2017,'2.0 TDI CRLB'),'P0299');
  const bmw=buildVehicleSchematicModel(sel('BMW','3er','G20/G21',2021,'320d B47'),'P0299');
  const ford=buildVehicleSchematicModel(sel('Ford','Focus','MK4',2020,'2.0 EcoBlue'),'P0299');
  assert.notDeepEqual(vw.focusPoint,bmw.focusPoint);
  assert.notDeepEqual(bmw.focusPoint,ford.focusPoint);
});

test('AdBlue model contains tank dosing SCR and NOx nodes',()=>{
  const model=buildVehicleSchematicModel(sel('Mercedes-Benz','E-Klasse','W213/S213',2020,'E 220 d OM654'),'ADBLUE');
  const ids=model.nodes.map(n=>n.id);
  for(const id of ['tank-dose-path','dose-module','dosing-injector','scr-catalyst','nox-downstream']) assert.ok(ids.includes(id));
  assert.equal(model.focusId,'tank-dose-path');
});

test('DPF pressure fault focuses the pressure sensor',()=>{
  const model=buildVehicleSchematicModel(sel('Volkswagen','Passat','B8',2017,'2.0 TDI CRLB'),'P2453');
  assert.equal(model.focusId,'pressure-sensor');
  assert.match(model.nodes.find(n=>n.id==='pressure-sensor').label,/Differenzdruck/);
});

test('ABS, oil, coolant and battery use expected system components',()=>{
  const profile=sel('BMW','3er','G20/G21',2021,'320d B47');
  assert.equal(buildVehicleSchematicModel(profile,'ABS').focusId,'abs-module');
  assert.equal(buildVehicleSchematicModel(profile,'OIL').focusId,'oil-circuit');
  assert.equal(buildVehicleSchematicModel(profile,'COOLANT').focusId,'hot-zone');
  assert.equal(buildVehicleSchematicModel(profile,'BATTERY').focusId,'battery-path');
});

test('supported profile renders a car shell and German safety text',()=>{
  const profile=sel('Ford','Focus','MK4',2020,'2.0 EcoBlue');
  const svg=renderVehicleSchematicSvg(profile,'P0299');
  assert.match(svg,/data-body="hatch-fwd-short"/);
  assert.match(svg,/Ladeluft/);
  assert.match(svg,/Hervorhebung beweist nicht/);
});

test('generic fallback renders without inventing vehicle-specific placement',()=>{
  const generic=resolveVehicleProfile({brand:'Saab',model:'9-5',generation:'YS3G',year:2011,engine:'2.0T'});
  const model=buildVehicleSchematicModel(generic,'P0299');
  assert.equal(model.isGeneric,true);
  assert.equal(model.bodyVariant,'generic');
  assert.match(renderVehicleSchematicSvg(generic,'P0299'),/Allgemeine Systemdarstellung/);
});
