import { describe, expect, it } from 'vitest';
import { normalizeLanguage, t } from './language';

describe('language domain', () => {
  it('normalizes regional language tags and falls back to German', () => {
    expect(normalizeLanguage('tr-TR')).toBe('tr');
    expect(normalizeLanguage('en_US')).toBe('en');
    expect(normalizeLanguage('xx')).toBe('de');
  });

  it('translates core UI and substitutes parameters', () => {
    expect(t('tr', 'nav.faults')).toBe('Arıza Kodları');
    expect(t('en', 'chat.send')).toBe('Send');
    expect(t('de', 'fault.priority', { value: 'Hoch' })).toContain('Hoch');
  });
});
