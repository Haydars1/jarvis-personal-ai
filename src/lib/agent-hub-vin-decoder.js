// User-triggered free NHTSA VIN decoding. Never send a VIN without a user action.
export function validateVin(value){
 const vin=String(value||'').trim().toUpperCase();
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw Error('INVALID_VIN_17_CHARACTERS');
 return vin;
}
export async function decodeVehicleVin(value,fetcher=fetch){
 const vin=validateVin(value);
 const url='https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/'+encodeURIComponent(vin)+'?format=json';
 const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'JARVIS-VIN-Decoder'},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('NHTSA_UNAVAILABLE');
 const payload=await response.json();
 const record=Array.isArray(payload?.Results)?payload.Results[0]:null;
 if(!record)throw Error('VIN_NOT_FOUND');
 const pick=key=>String(record[key]||'').slice(0,160);
 return {vin,make:pick('Make'),model:pick('Model'),year:pick('ModelYear'),manufacturer:pick('Manufacturer'),vehicle_type:pick('VehicleType'),
   engine:pick('EngineModel'),fuel:pick('FuelTypePrimary'),error_code:pick('ErrorCode'),
   error_text:pick('ErrorText'),source:'NHTSA vPIC',coverage:'US manufacturer-submitted data; EU coverage may be incomplete'};
}
