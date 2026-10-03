import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVehicleProfile, getVehicleOptions } from '../js/vehicle-profiles.mjs';

const full = (brand, model, generation, year, engine) => ({brand, model, generation, year, engine});

test('resolves VW Passat B8 CRLB to MQB profile', () => {
  const r = resolveVehicleProfile(full('Volkswagen','Passat','B8',2017,'2.0 TDI CRLB'));
  assert.equal(r.platformId, 'vw-mqb-long');
  assert.equal(r.engineFamilyId, 'ea288-2.0-tdi');
  assert.equal(r.accuracy, 'platform');
  assert.ok(r.placements['tank-dose-path'].x > 700);
});

test('BMW G20 uses a different layout than VW Passat B8', () => {
  const vw = resolveVehicleProfile(full('Volkswagen','Passat','B8',2017,'2.0 TDI CRLB'));
  const bmw = resolveVehicleProfile(full('BMW','3er','G20/G21',2021,'320d B47'));
  assert.equal(bmw.platformId, 'bmw-clar-rwd');
  assert.notDeepEqual(bmw.placements['turbo'], vw.placements['turbo']);
  assert.notEqual(bmw.bodyVariant, vw.bodyVariant);
});

test('Ford Focus MK4 resolves to Ford front-drive platform', () => {
  const r = resolveVehicleProfile(full('Ford','Focus','MK4',2020,'2.0 EcoBlue'));
  assert.equal(r.platformId, 'ford-c2-fwd');
  assert.equal(r.engineFamilyId, 'ford-ecoblue-2.0');
  assert.ok(r.placements['filter-core'].x < r.placements['tank-dose-path'].x);
});

test('Mercedes W213 resolves to Mercedes rear-drive platform', () => {
  const r = resolveVehicleProfile(full('Mercedes-Benz','E-Klasse','W213/S213',2020,'E 220 d OM654'));
  assert.equal(r.platformId, 'mercedes-mra-rwd');
  assert.equal(r.engineFamilyId, 'om654');
  assert.equal(r.brand, 'Mercedes-Benz');
});

test('unsupported vehicle returns clearly generic profile', () => {
  const r = resolveVehicleProfile(full('Saab','9-5','YS3G',2011,'2.0T'));
  assert.equal(r.accuracy, 'generic');
  assert.equal(r.profileKey, null);
  assert.equal(r.label, 'Allgemeine Systemdarstellung');
});

test('vehicle options cascade by current selection', () => {
  const brands = getVehicleOptions({});
  assert.ok(brands.brands.includes('BMW'));
  const models = getVehicleOptions({brand:'BMW'});
  assert.deepEqual(models.models.slice(0,2), ['3er','5er']);
  const gens = getVehicleOptions({brand:'Volkswagen', model:'Passat'});
  assert.deepEqual(gens.generations, ['B8']);
  const engines = getVehicleOptions({brand:'Volkswagen', model:'Passat', generation:'B8', year:2017});
  assert.ok(engines.engines.includes('2.0 TDI CRLB'));
});
