import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVehicleSelection, saveVehicleSelection, nextSelection } from '../js/vehicle-selection.mjs';

class MemoryStorage {
  constructor(seed={}){this.data={...seed}}
  getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null}
  setItem(k,v){this.data[k]=String(v)}
  removeItem(k){delete this.data[k]}
}

test('loads a valid persisted vehicle selection',()=>{
  const storage=new MemoryStorage({'6006.vehicle':JSON.stringify({brand:'BMW',model:'3er',generation:'G20/G21',year:2021,engine:'320d B47'})});
  assert.deepEqual(loadVehicleSelection(storage),{brand:'BMW',model:'3er',generation:'G20/G21',year:2021,engine:'320d B47'});
});

test('malformed persisted value recovers to empty selection',()=>{
  const storage=new MemoryStorage({'6006.vehicle':'{not-json'});
  assert.deepEqual(loadVehicleSelection(storage),{});
});

test('unsupported persisted value recovers to empty selection',()=>{
  const storage=new MemoryStorage({'6006.vehicle':JSON.stringify({brand:'Saab',model:'9-5',generation:'YS3G',year:2011,engine:'2.0T'})});
  assert.deepEqual(loadVehicleSelection(storage),{});
});

test('changing an upstream field clears dependent fields',()=>{
  const current={brand:'BMW',model:'3er',generation:'G20/G21',year:2021,engine:'320d B47'};
  assert.deepEqual(nextSelection(current,'brand','Ford'),{brand:'Ford'});
  assert.deepEqual(nextSelection(current,'model','5er'),{brand:'BMW',model:'5er'});
  assert.deepEqual(nextSelection(current,'year',2020),{brand:'BMW',model:'3er',generation:'G20/G21',year:2020});
});

test('save removes empty selection and serializes complete selection',()=>{
  const storage=new MemoryStorage();
  saveVehicleSelection(storage,{});
  assert.equal(storage.getItem('6006.vehicle'),null);
  saveVehicleSelection(storage,{brand:'Ford',model:'Focus',generation:'MK4',year:2020,engine:'2.0 EcoBlue'});
  assert.match(storage.getItem('6006.vehicle'),/Focus/);
});
