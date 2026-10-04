import { describe, expect, it } from 'vitest';
import { faultByCode, localizeFault } from './faults';
import { getFaultVisual } from './fault-visual';

describe('fault domain', () => {
  it('preserves the full legacy fault library through the generated TS source', () => {
    expect(faultByCode('P0299')?.title).toMatch(/Ladedruck/i);
    expect(faultByCode('ABS')?.system).toMatch(/ABS/i);
    expect(faultByCode('P2453')?.system).toMatch(/DPF/i);
  });

  it('localizes P0299 to Turkish and English', () => {
    const source = faultByCode('P0299');
    expect(source).toBeTruthy();
    expect(localizeFault(source!, 'tr').title).toMatch(/Turbo basıncı/i);
    expect(localizeFault(source!, 'tr').meaning).toMatch(/Motor kontrol ünitesi/i);
    expect(localizeFault(source!, 'en').title).toMatch(/boost|turbo/i);
    expect(localizeFault(source!, 'en').meaning).toMatch(/engine control|boost/i);
  });

  it('keeps German source text when no localization exists', () => {
    const source = { label:'X9999', title:'Deutscher Titel', system:'Test', severity:'Mittel', drive:'Prüfen', meaning:'Deutsche Bedeutung', symptoms:[], causes:[], diagnosis:[], solutions:[], note:'Hinweis' };
    expect(localizeFault(source, 'tr')).toEqual(source);
    expect(localizeFault(source, 'en')).toEqual(source);
  });

  it('maps critical known codes to expected visual families', () => {
    expect(getFaultVisual('P0299').scene).toBe('boost');
    expect(getFaultVisual('P2453').scene).toBe('dpf');
    expect(getFaultVisual('ABS').scene).toBe('brakes');
    expect(getFaultVisual('OIL').scene).toBe('oil');
    expect(getFaultVisual('ADBLUE').scene).toBe('scr');
    expect(getFaultVisual('P20EE').focus).toBe('scr-catalyst');
  });
});
