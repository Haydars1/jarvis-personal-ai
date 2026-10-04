import { describe, expect, it } from 'vitest';
import { LANGUAGE_STORAGE_KEY, loadLanguage, normalizeLanguage, saveLanguage, t } from './language';

describe('language domain', () => {
  it('normalizes regional language tags and falls back to German', () => {
    expect(normalizeLanguage('tr-TR')).toBe('tr');
    expect(normalizeLanguage('en_US')).toBe('en');
    expect(normalizeLanguage('xx')).toBe('de');
  });

  it('uses the current device language instead of a legacy stored language', () => {
    const memory = new Map<string, string>([[LANGUAGE_STORAGE_KEY, 'de']]);
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    };

    expect(loadLanguage(storage, 'tr-TR')).toBe('tr');
  });

  it('keeps an explicit homepage language choice as a manual override', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    };

    saveLanguage(storage, 'en');

    expect(memory.get('6006_language_manual')).toBe('1');
    expect(loadLanguage(storage, 'tr-TR')).toBe('en');
  });

  it('translates core UI and substitutes parameters', () => {
    expect(t('tr', 'nav.faults')).toBe('Arıza Kodları');
    expect(t('en', 'chat.send')).toBe('Send');
    expect(t('de', 'fault.priority', { value: 'Hoch' })).toContain('Hoch');
  });
});
