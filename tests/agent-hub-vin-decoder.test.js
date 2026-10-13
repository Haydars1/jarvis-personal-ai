import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVin,decodeVehicleVin} from '../src/lib/agent-hub-vin-decoder.js';
test('VIN decoder rejects invalid lengths and forbidden letters',()=>{
 assert.throws(()=>validateVin('ABC'),/INVALID_VIN/);
 assert.throws(()=>validateVin('1HGCM82633A00435I'),/INVALID_VIN/);
 assert.equal(validateVin('1hgcm82633a004352'),'1HGCM82633A004352');
});
test('official vPIC integration returns bounded real vehicle fields',async()=>{
 const vehicle=await decodeVehicleVin('1HGCM82633A004352',async(url,opts)=>{
  assert.equal(url,'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1HGCM82633A004352?format=json');
  assert.equal(opts.headers.Accept,'application/json');
  return {ok:true,json:async()=>({Results:[{Make:'HONDA',Model:'Accord',ModelYear:'2003',EngineModel:'K24',FuelTypePrimary:'Gasoline',ErrorCode:'0'}]})};
 });
 assert.equal(vehicle.make,'HONDA');
 assert.equal(vehicle.model,'Accord');
 assert.equal(vehicle.year,'2003');
 assert.equal(vehicle.source,'NHTSA vPIC');
});
test('VIN decoder reports upstream errors and empty responses',async()=>{
 await assert.rejects(decodeVehicleVin('1HGCM82633A004352',async()=>({ok:false})),/NHTSA_UNAVAILABLE/);
 await assert.rejects(decodeVehicleVin('1HGCM82633A004352',async()=>({ok:true,json:async()=>({Results:[]})})),/VIN_NOT_FOUND/);
});
