import { describe, expect, it } from 'vitest';
import { getVehicleOptions, resolveVehicleProfile, supportsVehicleSpecificScene } from './profile';

describe('vehicle profile resolver', () => {
  it('resolves exact Passat B8 CRLB and refuses an exact SCR layout', () => {
    const profile = resolveVehicleProfile({ brand:'Volkswagen', model:'Passat', generation:'B8', year:2017, engine:'2.0 TDI CRLB' });
    expect(profile.profileKey).toBeTruthy();
    expect(profile.platformId).toBe('vw-mqb-long');
    expect(profile.accuracy).toBe('exact');
    expect(profile.placements.turbo).toBeTruthy();
    expect(supportsVehicleSpecificScene(profile, 'scr')).toBe(false);
  });

  it('resolves BMW, Ford and Mercedes detailed profiles', () => {
    const bmw = resolveVehicleProfile({ brand:'BMW', model:'3er', generation:'G20/G21', year:2021, engine:'320d B47' });
    const ford = resolveVehicleProfile({ brand:'Ford', model:'Focus', generation:'MK4', year:2020, engine:'2.0 EcoBlue' });
    const mercedes = resolveVehicleProfile({ brand:'Mercedes-Benz', model:'E-Klasse', generation:'W213/S213', year:2020, engine:'E 220 d OM654' });
    expect(bmw.platformId).toBe('bmw-clar-rwd');
    expect(ford.platformId).toBe('ford-c2-fwd');
    expect(mercedes.platformId).toBe('mercedes-mra-rwd');
    expect(bmw.placements.engine).not.toEqual(ford.placements.engine);
  });

  it('falls back to platform then generic without inventing exact data', () => {
    const platform = resolveVehicleProfile({ brand:'BMW', model:'3er', generation:'G20/G21', year:2021, engine:'unknown engine' });
    const generic = resolveVehicleProfile({ brand:'Unknown', model:'X', generation:'Y', year:2022, engine:'Z' });
    expect(platform.accuracy).toBe('platform');
    expect(platform.profileKey).toBeNull();
    expect(generic.accuracy).toBe('generic');
    expect(Object.keys(generic.placements)).toHaveLength(0);
  });

  it('cascades catalog choices from current selection', () => {
    const initial = getVehicleOptions({});
    expect(initial.brands).toContain('Volkswagen');
    expect(initial.brands).toContain('BMW');
    const bmw3 = getVehicleOptions({ brand:'BMW', model:'3er' });
    expect(bmw3.generations).toContain('G20/G21');
    const selected = getVehicleOptions({ brand:'BMW', model:'3er', generation:'G20/G21', year:2021 });
    expect(selected.engines).toContain('320d B47');
  });
});
