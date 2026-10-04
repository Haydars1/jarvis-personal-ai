import { describe, expect, it } from 'vitest';
import { loadVehicle, saveVehicle, VEHICLE_STORAGE_KEY } from './persistence';

function storage(seed: Record<string,string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key:string){ return data.get(key) ?? null; },
    setItem(key:string,value:string){ data.set(key,value); },
    removeItem(key:string){ data.delete(key); },
    dump(){ return data; }
  };
}

const passat = { brand:'Volkswagen', model:'Passat', generation:'B8', year:2017, engine:'2.0 TDI CRLB' };

describe('vehicle persistence', () => {
  it('loads valid canonical state and rejects malformed state', () => {
    expect(loadVehicle(storage({ [VEHICLE_STORAGE_KEY]: JSON.stringify(passat) }))).toEqual(passat);
    expect(loadVehicle(storage({ [VEHICLE_STORAGE_KEY]: '{bad-json' }))).toEqual({});
  });

  it('migrates a valid legacy storage key', () => {
    expect(loadVehicle(storage({ '6006.vehicle': JSON.stringify(passat) }))).toEqual(passat);
    expect(loadVehicle(storage({ '6006-vehicle': JSON.stringify(passat) }))).toEqual(passat);
  });

  it('rejects persisted unsupported vehicles', () => {
    const bad = { brand:'Unknown', model:'X', generation:'Y', year:2022, engine:'Z' };
    expect(loadVehicle(storage({ [VEHICLE_STORAGE_KEY]: JSON.stringify(bad) }))).toEqual({});
  });

  it('saves canonical state and removes empty selection', () => {
    const s = storage({ '6006.vehicle':'legacy' });
    saveVehicle(s, passat);
    expect(JSON.parse(s.dump().get(VEHICLE_STORAGE_KEY)!)).toEqual(passat);
    expect(s.dump().has('6006.vehicle')).toBe(false);
    saveVehicle(s, {});
    expect(s.dump().has(VEHICLE_STORAGE_KEY)).toBe(false);
  });
});
